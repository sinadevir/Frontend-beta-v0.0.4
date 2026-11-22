import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { ArrowLeft, Building2, Clock, CornerDownLeft, FileText, History, IdCard, Inbox, LayoutGrid, Loader2, Search, Sparkles, UserPlus, Users, X, type LucideIcon } from "lucide-react";
import { navFlat } from "@/lib/nav";
import { usePermissions } from "@/lib/auth/permissions";
import { entitySources } from "@/features/pickers";
import { cn } from "@/lib/utils";
import { useDebounced } from "./entity-picker";

type Kind = "customer" | "party" | "premises" | "page";
type Scope = "all" | Kind;
type Hit = { key: string; kind: Kind; id: string; title: string; hint?: string; extra?: string; icon?: LucideIcon };

const RECENT_KEY = "cis.search-recent";
const PER_GROUP = 5;

/** What each kind of result looks like and where it opens. */
const KINDS: Record<Kind, { label: string; plural: string; icon: LucideIcon; tone: string; open: string }> = {
  customer: { label: "مشترک", plural: "مشترکین", icon: Users, tone: "bg-primary-soft text-primary", open: "باز کردن پرونده مشترک" },
  party: { label: "شخص", plural: "اشخاص", icon: IdCard, tone: "bg-success-soft text-success-foreground", open: "باز کردن پرونده شخص" },
  premises: { label: "ملک", plural: "املاک", icon: Building2, tone: "bg-warning-soft text-warning-foreground", open: "باز کردن پرونده ملک" },
  page: { label: "صفحه", plural: "صفحه‌ها", icon: FileText, tone: "bg-muted text-muted-foreground", open: "رفتن به صفحه" },
};
const SCOPES: Scope[] = ["all", "customer", "party", "premises", "page"];

/** Arabic/Persian letter variants and spacing are folded, so «علي» finds «علی». */
const norm = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\s]+/g, " ").trim().toLowerCase();

function readRecent(): Hit[] {
  try { return (JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as Hit[]).filter((h) => h && h.kind && h.id).slice(0, 6); } catch { return []; }
}

/** Marks the typed words inside a result title. */
function Mark({ text, q }: { text: string; q: string }) {
  const n = norm(q);
  if (!n) return <>{text}</>;
  const i = norm(text).indexOf(n);
  if (i < 0 || norm(text).length !== text.length) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded-sm bg-primary-soft px-0.5 text-primary">{text.slice(i, i + n.length)}</mark>{text.slice(i + n.length)}</>;
}

/**
 * Global search window: one large field, category tabs with result counts, results on the right and a
 * preview of the highlighted result on the left. With nothing typed it offers quick actions and recently
 * opened records. Arrow keys move, Enter opens, Tab switches category, Escape closes.
 */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate();
  const perms = usePermissions();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [sel, setSel] = useState("");
  const [recent, setRecent] = useState<Hit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q.trim(), 300);
  const live = dq.length >= 2;

  useEffect(() => { if (open) { setRecent(readRecent()); } else { setQ(""); setScope("all"); } }, [open]);

  const can = { customer: perms.can("Customer.Read"), party: perms.can("Party.Read"), premises: perms.can("Premises.Read") };
  const ask = (kind: Exclude<Kind, "page">) => ({
    queryKey: ["global-search", kind, dq],
    queryFn: ({ signal }: { signal: AbortSignal }) => entitySources[kind].search(dq, signal),
    enabled: open && live && can[kind] && (scope === "all" || scope === kind),
    retry: false,
  });
  const customers = useQuery(ask("customer"));
  const parties = useQuery(ask("party"));
  const premises = useQuery(ask("premises"));
  const typing = q.trim().length >= 2 && q.trim() !== dq;
  const busy = typing || customers.isFetching || parties.isFetching || premises.isFetching;

  const pages = useMemo<Hit[]>(() => {
    const n = norm(q);
    return navFlat
      .filter((p) => !p.perm || perms.can(p.perm))
      .filter((p) => !n || norm(`${p.title} ${p.keywords ?? ""} ${p.hint ?? ""} ${p.group}`).includes(n))
      .map((p) => ({ key: `page:${p.to}`, kind: "page" as const, id: p.to, title: p.title, hint: p.hint, extra: p.group, icon: p.icon }));
  }, [q, perms]);

  const toHits = (kind: Exclude<Kind, "page">, rows?: { value: string; label: string; hint?: string }[]) =>
    live ? (rows ?? []).map((r) => ({ key: `${kind}:${r.value}`, kind, id: r.value, title: r.label, hint: r.hint })) : [];
  const groups: Record<Kind, Hit[]> = {
    customer: toHits("customer", customers.data),
    party: toHits("party", parties.data),
    premises: toHits("premises", premises.data),
    page: q.trim() ? pages : [],
  };

  const typed = q.trim().length > 0;
  const quick: Hit[] = [
    { to: "/registration", title: "ثبت مشترک جدید", hint: "ثبت مرحله‌ای متقاضی، ملک و اشتراک", icon: UserPlus },
    { to: "/cases", title: "کارتابل درخواست‌ها", hint: "درخواست‌های در انتظار بررسی", icon: Inbox },
    { to: "/customers", title: "جستجوی مشترک", hint: "فهرست کامل مشترکین با پالایه", icon: Users },
    { to: "/premises", title: "پرونده املاک", hint: "مشخصات، نشانی و کد پستی", icon: Building2 },
  ].filter((a) => pages.some((p) => p.id === a.to) || !typed).filter((a) => navFlat.some((n) => n.to === a.to && (!n.perm || perms.can(n.perm))))
    .map((a) => ({ key: `quick:${a.to}`, kind: "page", id: a.to, title: a.title, hint: a.hint, icon: a.icon }));

  const visible: { heading: string; kind?: Kind; items: Hit[]; more?: number }[] = !typed
    ? [...(recent.length ? [{ heading: "اخیراً باز شده", items: recent }] : []), { heading: "دسترسی سریع", items: quick }]
    : (scope === "all" ? (["customer", "party", "premises", "page"] as Kind[]) : [scope as Kind])
        .map((k) => ({ heading: KINDS[k].plural, kind: k, items: scope === "all" ? groups[k].slice(0, PER_GROUP) : groups[k], more: scope === "all" ? Math.max(0, groups[k].length - PER_GROUP) : 0 }))
        .filter((g) => g.items.length);
  const flat = visible.flatMap((g) => g.items);
  const current = flat.find((h) => h.key === sel) ?? flat[0];

  // a new search, category or newly arrived results start at the first result
  const first = flat[0]?.key ?? "";
  useEffect(() => { setSel(first); }, [first, scope]);
  useEffect(() => { if (flat.length && !flat.some((h) => h.key === sel)) setSel(flat[0]!.key); }, [flat, sel]);

  const go = (h: Hit) => {
    if (h.kind === "customer") nav({ to: "/customers/$id", params: { id: h.id } });
    else if (h.kind === "party") nav({ to: "/parties/$id", params: { id: h.id } });
    else if (h.kind === "premises") nav({ to: "/premises/$id", params: { id: h.id } });
    else nav({ to: h.id as "/" });
    if (h.kind !== "page") {
      const keep = { key: h.key, kind: h.kind, id: h.id, title: h.title, hint: h.hint };
      window.localStorage.setItem(RECENT_KEY, JSON.stringify([keep, ...readRecent().filter((r) => r.key !== h.key)].slice(0, 6)));
    }
    onOpenChange(false);
  };
  const clearRecent = () => { window.localStorage.removeItem(RECENT_KEY); setRecent([]); input.current?.focus(); };
  const count = (s: Scope) => (s === "all" ? (["customer", "party", "premises", "page"] as Kind[]).reduce((n, k) => n + groups[k].length, 0) : groups[s].length);
  const nextScope = (back: boolean) => setScope((s) => SCOPES[(SCOPES.indexOf(s) + (back ? SCOPES.length - 1 : 1)) % SCOPES.length]!);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content dir="rtl" aria-describedby={undefined} onOpenAutoFocus={(e) => { e.preventDefault(); input.current?.focus(); }}
          className="fixed inset-x-3 top-[9vh] z-50 mx-auto flex max-h-[80vh] max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-raised duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-2">
          <DialogPrimitive.Title className="sr-only">جستجو در سامانه</DialogPrimitive.Title>
          <CommandPrimitive shouldFilter={false} loop value={current?.key ?? ""} onValueChange={setSel} className="flex min-h-0 flex-1 flex-col">
            {/* search field */}
            <div className="flex items-center gap-3 px-5 pt-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground shadow-brand">
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
              </span>
              <CommandPrimitive.Input ref={input} value={q} onValueChange={setQ}
                onKeyDown={(e) => { if (e.key === "Tab" && typed) { e.preventDefault(); nextScope(e.shiftKey); } }}
                placeholder="شماره اشتراک، نام شخص، کد ملی، کد ملک یا نام صفحه…"
                className="h-12 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground" />
              {q && <button type="button" onClick={() => { setQ(""); input.current?.focus(); }} aria-label="پاک کردن" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-4" /></button>}
              <DialogPrimitive.Close className="rounded-lg border border-border px-2 py-1 text-[0.6875rem] font-semibold text-muted-foreground transition-colors hover:bg-muted">بستن</DialogPrimitive.Close>
            </div>

            {/* category tabs */}
            <div role="tablist" aria-label="دسته نتایج" className={cn("flex gap-1.5 overflow-x-auto border-b border-border px-5 pb-3 pt-4 transition-opacity", !typed && "pointer-events-none opacity-45")}>
              {SCOPES.map((s) => {
                const on = s === scope;
                const Icon = s === "all" ? LayoutGrid : KINDS[s].icon;
                const disabled = s !== "all" && s !== "page" && !can[s];
                if (disabled) return null;
                const n = count(s);
                return (
                  <button key={s} type="button" role="tab" aria-selected={on} onClick={() => { setScope(s); input.current?.focus(); }}
                    className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all", on ? "border-primary bg-primary text-primary-foreground shadow-brand" : "border-border bg-card text-muted-foreground hover:border-ring/50 hover:text-foreground")}>
                    <Icon className="size-3.5" />{s === "all" ? "همه" : KINDS[s].plural}
                    {typed && (live || s === "page" || s === "all") && <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[0.625rem]", on ? "bg-primary-foreground/20" : "bg-muted")}>{n}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-0 flex-1">
              {/* results */}
              <CommandPrimitive.List className="min-h-[18rem] flex-1 overflow-y-auto p-3 md:max-h-[56vh]">
                {visible.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">{busy ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}</span>
                    <p className="text-sm font-bold text-foreground">{busy ? "در حال جستجو…" : q.trim().length < 2 && scope !== "page" ? "حداقل دو حرف بنویسید" : "نتیجه‌ای یافت نشد"}</p>
                    {!busy && <p className="text-xs text-muted-foreground">املای واژه را بررسی کنید یا دسته دیگری را انتخاب کنید.</p>}
                  </div>
                )}
                {visible.map((g) => (
                  <CommandPrimitive.Group key={g.heading} className="mb-2 last:mb-0 [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:justify-between [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground"
                    heading={<><span className="flex items-center gap-1.5">{!g.kind && (g.heading === "دسترسی سریع" ? <Sparkles className="size-3.5 text-primary" /> : <History className="size-3.5 text-primary" />)}{g.heading}</span>
                      {g.heading === "اخیراً باز شده" && <button type="button" onClick={clearRecent} className="font-semibold text-primary hover:underline">پاک کردن</button>}
                      {g.kind && !!g.more && <button type="button" onClick={() => setScope(g.kind!)} className="flex items-center gap-0.5 font-semibold text-primary hover:underline">{g.more} مورد دیگر<ArrowLeft className="size-3" /></button>}</>}>
                    {g.items.map((h) => <ResultRow key={h.key} hit={h} q={q} recent={!g.kind && g.heading === "اخیراً باز شده"} onSelect={() => go(h)} />)}
                  </CommandPrimitive.Group>
                ))}
              </CommandPrimitive.List>

              {/* preview of the highlighted result */}
              <aside aria-live="polite" className="hidden w-72 shrink-0 border-s border-border bg-muted/40 p-5 md:block">
                {current ? <Preview hit={current} onOpen={() => go(current)} /> : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs leading-6 text-muted-foreground">
                    <Search className="size-6 opacity-50" />با حرکت میان نتایج، خلاصه هر مورد اینجا نمایش داده می‌شود.
                  </div>
                )}
              </aside>
            </div>

            {/* keyboard help */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-muted/40 px-5 py-2.5 text-[0.6875rem] text-muted-foreground">
              <Hint keys={<><Key>↑</Key><Key>↓</Key></>}>جابه‌جایی</Hint>
              <Hint keys={<Key><CornerDownLeft className="size-3" /></Key>}>باز کردن</Hint>
              <Hint keys={<Key>تب</Key>}>تغییر دسته</Hint>
              <Hint keys={<Key>اسکیپ</Key>}>بستن</Hint>
              <span className="ms-auto hidden sm:inline">میان‌بُر باز کردن جستجو: کنترل همراه «ن»</span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ResultRow({ hit, q, recent, onSelect }: { hit: Hit; q: string; recent: boolean; onSelect: () => void }) {
  const k = KINDS[hit.kind];
  const Icon = recent ? Clock : hit.icon ?? k.icon;
  return (
    <CommandPrimitive.Item value={hit.key} onSelect={onSelect}
      className="group flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition-colors data-[selected=true]:bg-panel-active">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors", k.tone, "group-data-[selected=true]:bg-primary group-data-[selected=true]:text-primary-foreground")}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold text-foreground"><Mark text={hit.title} q={q} /></span>
        {hit.hint && <span className="mt-0.5 block truncate text-xs text-muted-foreground"><Mark text={hit.hint} q={q} /></span>}
      </span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground group-data-[selected=true]:bg-card">{hit.extra ?? k.label}</span>
      <ArrowLeft className="size-4 shrink-0 text-primary opacity-0 transition-all group-data-[selected=true]:-translate-x-0.5 group-data-[selected=true]:opacity-100" />
    </CommandPrimitive.Item>
  );
}

function Preview({ hit, onOpen }: { hit: Hit; onOpen: () => void }) {
  const k = KINDS[hit.kind];
  const Icon = hit.icon ?? k.icon;
  const rows: [string, string][] = [["نوع", hit.kind === "page" ? `صفحه · ${hit.extra ?? "سامانه"}` : k.label], ...(hit.kind !== "page" ? [["شناسه", hit.id] as [string, string]] : [])];
  return (
    <div key={hit.key} className="panel-swap flex h-full flex-col">
      <span className={cn("grid size-14 place-items-center rounded-2xl", k.tone)}><Icon className="size-6" /></span>
      <h3 className="mt-4 break-words text-base font-black leading-snug text-foreground">{hit.title}</h3>
      {hit.hint && <p className="mt-1 text-xs leading-6 text-muted-foreground">{hit.hint}</p>}
      <dl className="mt-4 space-y-2 rounded-xl border border-border bg-card p-3 text-xs">
        {rows.map(([a, b]) => <div key={a} className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{a}</dt><dd className="truncate font-semibold text-foreground">{b}</dd></div>)}
      </dl>
      <button type="button" onClick={onOpen} className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-brand transition-colors hover:bg-primary-hover">
        {k.open}<ArrowLeft className="size-4" />
      </button>
    </div>
  );
}

const Key = ({ children }: { children: ReactNode }) => <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-card px-1 font-sans text-[0.625rem] font-bold text-foreground shadow-card">{children}</kbd>;
const Hint = ({ keys, children }: { keys: ReactNode; children: ReactNode }) => <span className="flex items-center gap-1.5"><span className="flex gap-0.5">{keys}</span>{children}</span>;
