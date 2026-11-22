import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/jalali";

export type TreeNode = {
  id: string; title: string;
  /** Short identifier shown as a code chip at the row's end (e.g. the unit or classification code). */
  badge?: string | undefined;
  /** Quiet secondary text after the title (e.g. the unit type). */
  hint?: string | undefined;
  icon?: LucideIcon | undefined; inactive?: boolean | undefined; children?: TreeNode[] | undefined;
};

type Row = {
  n: TreeNode; depth: number; has: boolean; open: boolean;
  /** ids from the root down to this node */
  chain: string[];
  /** position of each chain node among its siblings */
  idx: number[];
  /** whether each chain node is the last of its siblings */
  last: boolean[];
  size: number;
};

const norm = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).trim().toLowerCase();
const count = (ns: TreeNode[]): number => ns.reduce((a, n) => a + 1 + count(n.children ?? []), 0);
const parentIds = (ns: TreeNode[], out: string[] = []): string[] => { for (const n of ns) if (n.children?.length) { out.push(n.id); parentIds(n.children, out); } return out; };
const hasInactive = (ns: TreeNode[]): boolean => ns.some((n) => n.inactive || hasInactive(n.children ?? []));

/** Keeps only nodes that match the search or hold a match below them. */
function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  return nodes.flatMap((n) => {
    const kids = filterTree(n.children ?? [], q);
    const hit = norm(n.title).includes(q) || norm(n.badge ?? "").includes(q) || norm(n.hint ?? "").includes(q);
    return hit || kids.length ? [{ ...n, children: hit && !kids.length ? n.children : kids }] : [];
  });
}
const dropInactive = (ns: TreeNode[]): TreeNode[] => ns.filter((n) => !n.inactive).map((n) => ({ ...n, children: dropInactive(n.children ?? []) }));

/** Path of ids from a root to `id` (empty when not found). */
export function pathTo(nodes: TreeNode[], id?: string): TreeNode[] {
  if (!id) return [];
  for (const n of nodes) {
    if (n.id === id) return [n];
    const p = pathTo(n.children ?? [], id);
    if (p.length) return [n, ...p];
  }
  return [];
}

function flatten(nodes: TreeNode[], isOpen: (n: TreeNode) => boolean, parent: Pick<Row, "chain" | "idx" | "last"> = { chain: [], idx: [], last: [] }, out: Row[] = []): Row[] {
  nodes.forEach((n, i) => {
    const has = Boolean(n.children?.length);
    const open = has && isOpen(n);
    const row: Row = { n, depth: parent.chain.length, has, open, chain: [...parent.chain, n.id], idx: [...parent.idx, i], last: [...parent.last, i === nodes.length - 1], size: nodes.length };
    out.push(row);
    if (open) flatten(n.children!, isOpen, row, out);
  });
  return out;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = norm(text).indexOf(q);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded-sm bg-warning-soft px-0.5 text-foreground ring-1 ring-warning/30">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Tree for hierarchies (organisation units, usage classifications).
 * Guide lines join each level, and the lines leading to the chosen item are drawn in blue; its ancestors are tinted and its path is shown at the foot.
 * Search highlights matches and opens their branches; «باز کردن همه / بستن همه»; inactive items can be hidden.
 * Keyboard (right-to-left): ↑ ↓ move, ← opens / goes to the first child, → closes / goes to the parent, Home / End, Enter or Space chooses.
 */
export function TreeView({ nodes, selected, onSelect, searchPlaceholder = "جستجو در درخت…", toolbar = true, empty, maxHeight = "34rem" }: {
  nodes: TreeNode[]; selected?: string | undefined; onSelect?: ((n: TreeNode) => void) | undefined; searchPlaceholder?: string; toolbar?: boolean; empty?: ReactNode;
  /** Scroll the rows inside this height (CSS length); `none` lets the tree grow. */
  maxHeight?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.children?.length).map((n) => n.id)));
  const [touched, setTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [focusId, setFocusId] = useState<string>();
  const list = useRef<HTMLDivElement>(null);
  const q = norm(query);

  // First data load: open the first level (until the user opens/closes something themselves).
  useEffect(() => { if (!touched) setExpanded(new Set(nodes.filter((n) => n.children?.length).map((n) => n.id))); }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => (showInactive ? nodes : dropInactive(nodes)), [nodes, showInactive]);
  const shown = useMemo(() => (q ? filterTree(base, q) : base), [base, q]);
  const total = useMemo(() => count(nodes), [nodes]);
  const anyInactive = useMemo(() => hasInactive(nodes), [nodes]);
  const path = useMemo(() => pathTo(nodes, selected), [nodes, selected]);
  // The blue path is measured on the tree as shown (search / hidden inactive items change sibling positions).
  const shownPath = useMemo(() => pathTo(shown, selected), [shown, selected]);
  const pathIds = shownPath.map((n) => n.id);
  // Sibling position of each node on the chosen path (level 0 among the roots, level k among its parent's children).
  const pathIdx = shownPath.map((n, k) => (k === 0 ? shown : shownPath[k - 1]!.children ?? []).findIndex((x) => x.id === n.id));

  // Keep the chosen item visible: open every branch above it.
  useEffect(() => {
    if (path.length < 2) return;
    setExpanded((s) => { const above = path.slice(0, -1).map((n) => n.id); if (above.every((id) => s.has(id))) return s; const t = new Set(s); above.forEach((id) => t.add(id)); return t; });
  }, [selected, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => flatten(shown, (n) => Boolean(q) || expanded.has(n.id)), [shown, q, expanded]);
  const tabId = rows.some((r) => r.n.id === focusId) ? focusId : rows.some((r) => r.n.id === selected) ? selected : rows[0]?.n.id;

  useEffect(() => {
    if (!selected) return;
    list.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const toggle = (id: string, open?: boolean) => { setTouched(true); setExpanded((s) => { const t = new Set(s); const next = open ?? !t.has(id); if (next) t.add(id); else t.delete(id); return t; }); };
  const setAll = (open: boolean) => { setTouched(true); setExpanded(new Set(open ? parentIds(nodes) : [])); };
  const focusRow = (id?: string) => { if (!id) return; setFocusId(id); requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus()); };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, r: Row, i: number) => {
    const k = e.key;
    if (k === "ArrowDown") focusRow(rows[i + 1]?.n.id);
    else if (k === "ArrowUp") focusRow(rows[i - 1]?.n.id);
    else if (k === "Home") focusRow(rows[0]?.n.id);
    else if (k === "End") focusRow(rows[rows.length - 1]?.n.id);
    else if (k === "ArrowLeft") { if (r.has && !r.open && !q) toggle(r.n.id, true); else if (r.open) focusRow(rows[i + 1]?.n.id); }
    else if (k === "ArrowRight") { if (r.open && !q) toggle(r.n.id, false); else focusRow(r.chain[r.chain.length - 2]); }
    else if (k === "Enter" || k === " ") onSelect?.(r.n);
    else return;
    e.preventDefault();
  };

  return (
    <div className="space-y-3">
      {toolbar && total > 0 && (
        <div className="flex items-center gap-1.5">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label="جستجو در درخت"
              className="h-9 w-full rounded-lg border border-transparent bg-muted/70 pe-8 ps-9 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-ring focus:bg-card focus:ring-4 focus:ring-ring/15" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جستجو" className="absolute end-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"><X className="size-3.5" /></button>}
          </label>
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-card">
            <TreeTool label="باز کردن همه" onClick={() => setAll(true)} icon={ChevronsUpDown} disabled={Boolean(q)} />
            <TreeTool label="بستن همه" onClick={() => setAll(false)} icon={ChevronsDownUp} disabled={Boolean(q)} />
            {anyInactive && <TreeTool label={showInactive ? "پنهان کردن غیرفعال‌ها" : "نمایش غیرفعال‌ها"} onClick={() => setShowInactive((v) => !v)} icon={showInactive ? Eye : EyeOff} pressed={!showInactive} />}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        q ? <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">موردی با «{query}» پیدا نشد.</p> : (empty ?? null)
      ) : (
        <div ref={list} role="tree" aria-label="درخت" className="-mx-1 overflow-y-auto px-1 py-0.5" style={maxHeight === "none" ? undefined : { maxHeight }}>
          {rows.map((r, i) => (
            <TreeRow key={r.n.id} r={r} q={q} active={selected === r.n.id} onPath={!!selected && selected !== r.n.id && pathIds.includes(r.n.id)} path={pathIds} pathIdx={pathIdx}
              tabbable={tabId === r.n.id} onSelect={() => { setFocusId(r.n.id); onSelect?.(r.n); }} onToggle={() => !q && toggle(r.n.id)} onKey={(e) => onKey(e, r, i)} />
          ))}
        </div>
      )}

      {toolbar && total > 0 && (
        <div className="space-y-2 border-t border-border/70 pt-2.5">
          {path.length > 1 && (
            <nav aria-label="مسیر مورد انتخاب‌شده" className="flex flex-wrap items-center gap-1 text-[0.6875rem]">
              {path.map((n, i) => (
                <span key={n.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronLeft className="size-3 text-muted-foreground/60" aria-hidden />}
                  <button type="button" onClick={() => onSelect?.(n)} className={cn("rounded-md px-1.5 py-0.5 transition-colors hover:bg-primary-soft hover:text-primary", i === path.length - 1 ? "bg-panel-active font-bold text-primary" : "text-muted-foreground")}>{n.title}</button>
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
            <span>{q ? `${faNum(count(shown))} مورد از ${faNum(total)}` : `${faNum(total)} مورد در ${faNum(nodes.length)} شاخهٔ اصلی`}</span>
            <span className="hidden sm:inline">جابه‌جایی با کلیدهای جهت‌نما</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeTool({ label, onClick, icon: Icon, disabled, pressed }: { label: string; onClick: () => void; icon: LucideIcon; disabled?: boolean; pressed?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} disabled={disabled} aria-pressed={pressed}
          className={cn("grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary disabled:pointer-events-none disabled:opacity-40", pressed && "bg-primary-soft text-primary")}>
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const line = (on: boolean) => (on ? "border-tree-line-active" : "border-tree-line");

/**
 * One row. Guide columns (one per ancestor level) are drawn before the content; column k belongs to the children of the
 * row's ancestor at depth k. A column is blue when the line from that ancestor down to the chosen item passes through it.
 */
function TreeRow({ r, q, active, onPath, path, pathIdx, tabbable, onSelect, onToggle, onKey }: {
  r: Row; q: string; active: boolean; onPath: boolean; path: string[]; pathIdx: number[]; tabbable: boolean;
  onSelect: () => void; onToggle: () => void; onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { n, depth, has, open } = r;
  const Icon = n.icon;
  // The chosen item lies below ancestor k when the selected path passes through chain[k] and goes deeper.
  const below = (k: number) => path.length > k + 1 && path[k] === r.chain[k];
  return (
    <div role="treeitem" aria-level={depth + 1} aria-setsize={r.size} aria-posinset={r.idx[depth]! + 1} aria-expanded={has ? open : undefined} aria-selected={active}
      tabIndex={tabbable ? 0 : -1} data-tree-id={n.id} onClick={onSelect} onDoubleClick={() => has && onToggle()} onKeyDown={onKey}
      className="tree-row-in group flex h-9 cursor-pointer items-stretch outline-none">
      {Array.from({ length: depth }, (_, k) => {
        const child = k + 1; // chain level of this row's node (or ancestor) that hangs from column k
        const elbow = child === depth;
        const passes = below(k);
        const myIdx = r.idx[child]!, targetIdx = pathIdx[child] ?? -1;
        // «through»: the blue line continues past this row toward a later sibling; «arrives»: this row is on the path itself.
        const through = passes && myIdx < targetIdx;
        const arrives = passes && myIdx === targetIdx;
        if (!elbow) return <span key={k} aria-hidden className="relative w-5 shrink-0">{!r.last[child] && <span className={cn("absolute inset-y-0 start-1/2 border-s", line(through))} />}</span>;
        return (
          <span key={k} aria-hidden className="relative w-5 shrink-0">
            {r.last[child] ? (
              <span className={cn("absolute start-1/2 top-0 h-1/2 w-[calc(50%+5px)] rounded-es-[7px] border-b border-s", line(arrives))} />
            ) : (
              <>
                <span className={cn("absolute start-1/2 top-0 h-1/2 border-s", line(through || arrives))} />
                <span className={cn("absolute bottom-0 start-1/2 top-1/2 border-s", line(through))} />
                <span className={cn("absolute start-1/2 top-1/2 w-[calc(50%+5px)] border-t", line(arrives))} />
              </>
            )}
          </span>
        );
      })}
      <div className={cn("relative flex min-w-0 flex-1 items-center gap-1.5 rounded-lg pe-2 text-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring/60",
        active ? "bg-panel-active text-panel-active-foreground ring-1 ring-inset ring-primary/15" : "group-hover:bg-muted/70")}>
        <span className="relative grid w-5 shrink-0 self-stretch place-items-center">
          {has ? (
            <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={open ? "بستن شاخه" : "باز کردن شاخه"}
              className={cn("relative z-10 grid size-5 place-items-center rounded-md border bg-card transition-colors hover:border-primary/40 hover:text-primary",
                open ? "border-border text-foreground/70" : "border-border text-muted-foreground", onPath && "border-primary/30 text-primary")}>
              <ChevronLeft className={cn("size-3 transition-transform duration-200", open && "-rotate-90")} strokeWidth={2.5} />
            </button>
          ) : <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-tree-line")} />}
          {open && <span aria-hidden className={cn("absolute bottom-0 start-1/2 top-[calc(50%+0.625rem)] border-s", line(below(depth)))} />}
        </span>
        {Icon && (
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-md transition-colors",
            active ? "bg-primary text-primary-foreground shadow-brand" : onPath ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground group-hover:text-primary", n.inactive && !active && "opacity-60")}>
            <Icon className="size-3.5" />
          </span>
        )}
        <span title={n.hint ? `${n.title} (${n.hint})` : n.title} className={cn("min-w-0 truncate", active ? "font-extrabold" : onPath ? "font-bold text-primary" : "font-medium", n.inactive && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          <Highlight text={n.title} q={q} />
          {n.hint && <span className="ms-1.5 text-xs font-normal text-muted-foreground no-underline"><Highlight text={n.hint} q={q} /></span>}
        </span>
        {n.inactive && <Badge variant="neutral" size="xs">غیرفعال</Badge>}
        <span className="ms-auto flex shrink-0 items-center gap-1">
          {has && <Badge variant={open ? "muted" : "count"} size="xs" title={`${faNum(n.children!.length)} زیرشاخه`}>{faNum(n.children!.length)}</Badge>}
          {n.badge && <Badge variant="code" size="xs" className={cn(active && "border-primary/25 text-primary")}><Highlight text={n.badge} q={q} /></Badge>}
        </span>
      </div>
    </div>
  );
}

/** Tree-shaped placeholder while a hierarchy loads. */
export function TreeSkeleton({ rows = 7 }: { rows?: number }) {
  const depths = [0, 1, 1, 2, 2, 1, 0, 1, 0, 1];
  return (
    <div className="space-y-3" aria-busy>
      <div className="flex gap-1.5"><Skeleton className="h-9 flex-1 rounded-lg" /><Skeleton className="h-9 w-[4.5rem] rounded-lg" /></div>
      <div className="space-y-1.5">
        {Array.from({ length: rows }, (_, i) => {
          const d = depths[i % depths.length]!;
          return (
            <div key={i} className="flex h-7.5 items-center gap-2" style={{ paddingInlineStart: `${d * 1.25}rem` }}>
              <Skeleton className="size-5 rounded-md" /><Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-3.5 rounded" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
              <Skeleton className="ms-auto h-4 w-10 rounded" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const findNode = (nodes: TreeNode[], id?: string): TreeNode | undefined => { for (const n of nodes) { if (n.id === id) return n; const f = n.children && findNode(n.children, id); if (f) return f; } return undefined; };
