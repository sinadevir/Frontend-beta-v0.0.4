import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, MoreHorizontal, Search, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Inbox, X, FilterX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState } from "./query-state";
import { YesNo } from "./status-badge";
import { ColumnFilterCell, inferFilter, matchesFilter, filterParams, filterText, type ColumnFilter, type FilterOption } from "./column-filter";
import { faNum } from "@/lib/jalali";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string; header: string; cell?: (r: T) => ReactNode; value?: (r: T) => string | number | undefined; className?: string; hidden?: boolean; sortable?: boolean;
  /** Filter shown under the header. Declared filters (here or via a matching `filters` entry) go to the server on server tables; every other column gets one inferred from its values (text, date, yes/no or a pick list), applied to the rows on screen. `false` turns it off. */
  filter?: ColumnFilter | false;
};
export type { ColumnFilter, FilterOption };
export type RowAction<T> = { label: string; icon?: LucideIcon; onClick: (r: T) => void; destructive?: boolean; show?: (r: T) => boolean };
/** A select filter. When `column` (or `key`, case-insensitive) names a visible column it is drawn in that column's filter cell; otherwise in the toolbar. */
export type Filter = { key: string; label: string; options: FilterOption[]; column?: string };

type Props<T> = {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string | number;
  searchPlaceholder?: string; filters?: Filter[]; actions?: RowAction<T>[]; onRowClick?: (r: T) => void;
  toolbar?: ReactNode; pageSize?: number; selectable?: boolean; bulkActions?: (sel: T[], clear: () => void) => ReactNode; dense?: boolean;
  loading?: boolean; fetching?: boolean; error?: unknown; onRetry?: () => void; emptyText?: string; emptyAction?: ReactNode; exportName?: string; hideSearch?: boolean;
  /** Server mode: when given, search/filter/paging are sent to the backend instead of applied locally. */
  server?: { total: number; page: number; pageSize: number; onPageChange: (p: number) => void; search?: string; onSearchChange?: (q: string) => void; filterValues?: Record<string, string>; onFilterChange?: (key: string, value: string) => void };
};

const get = <T,>(c: Column<T>, r: T) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key]) as string | number | undefined;
/** Reads a record field by name, ignoring letter case (filter keys are often PascalCase, record fields camelCase). */
const field = (r: unknown, k: string): unknown => {
  const rec = r as Record<string, unknown>;
  if (k in rec) return rec[k];
  const hit = Object.keys(rec).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit === undefined ? undefined : rec[hit];
};
const fv = (o: FilterOption) => (typeof o === "string" ? o : o.value);
const fl = (o: FilterOption) => (typeof o === "string" ? o : o.label);
/** Selection column: fixed width, divider on its inner side and room on both sides so the box never touches row text. */
const selCell = "w-12 min-w-12 px-3 text-center";

export function DataTable<T>({ rows, columns, rowKey, searchPlaceholder = "جستجو…", filters = [], actions, onRowClick, toolbar, pageSize = 10, selectable, bulkActions, dense, loading, fetching, error, onRetry, emptyText = "موردی یافت نشد", emptyAction, exportName = "export", hideSearch, server }: Props<T>) {
  const [q, setQ] = useState(server?.search ?? "");
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});
  const filterValues = useMemo(() => ({ ...(server?.filterValues ?? {}), ...localFilters }), [server?.filterValues, localFilters]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set(columns.filter((c) => c.hidden).map((c) => c.key)));
  const [localPage, setLocalPage] = useState(0);
  const [sel, setSel] = useState<Set<string | number>>(new Set());

  // debounce server search
  useEffect(() => {
    if (!server?.onSearchChange || q === (server.search ?? "")) return;
    const t = setTimeout(() => server.onSearchChange?.(q), 400);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve each column's filter: explicit > matching select `filters` entry > inferred from the column's values.
  // On server tables explicit filters are sent to the endpoint; inferred ones narrow the rows already loaded.
  const { colFilters, localCols } = useMemo(() => {
    const m = new Map<string, ColumnFilter>();
    const local = new Set<string>();
    for (const c of columns) {
      if (c.filter === false) continue;
      const f = filters.find((x) => (x.column ?? x.key).toLowerCase() === c.key.toLowerCase());
      const declared: ColumnFilter | undefined = c.filter ?? (f ? { type: "select", param: f.key, options: f.options, raw: true } : undefined);
      const cf = declared ?? inferFilter(rows.map((r) => (r as Record<string, unknown>)[c.key] ?? get(c, r)));
      if (!cf) continue;
      m.set(c.key, cf);
      if (!declared || !server) local.add(c.key);
    }
    return { colFilters: m, localCols: local };
  }, [columns, filters, rows, server]);
  const toolbarFilters = useMemo(() => filters.filter((f) => ![...colFilters.values()].some((cf) => cf.type === "select" && cf.param === f.key)), [filters, colFilters]);
  // Filter keys answered by the server; every other key is applied in the browser.
  const serverKeys = useMemo(() => {
    if (!server) return new Set<string>();
    const k = new Set(toolbarFilters.map((f) => f.key));
    for (const [key, cf] of colFilters) if (!localCols.has(key)) filterParams(cf, key).forEach((x) => k.add(x));
    return k;
  }, [server, toolbarFilters, colFilters, localCols]);

  const data = useMemo(() => {
    let d = rows.filter((r) => {
      if (!server) {
        if (q && !columns.some((c) => String(get(c, r) ?? "").includes(q))) return false;
        if (!toolbarFilters.every((f) => !filterValues[f.key] || filterValues[f.key] === "all" || String(field(r, f.key)) === filterValues[f.key])) return false;
      }
      return columns.every((c) => {
        const cf = colFilters.get(c.key);
        if (!cf || !localCols.has(c.key)) return true;
        const rec = r as Record<string, unknown>;
        if (cf.type === "select" && cf.raw) return matchesFilter(cf, c.key, filterValues, field(rec, cf.param ?? c.key));
        const raw = rec[c.key] ?? get(c, r);
        return matchesFilter(cf, c.key, filterValues, cf.type === "text" ? filterText(raw, get(c, r)) : raw);
      });
    });
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) d = [...d].sort((a, b) => String(get(c, a) ?? "").localeCompare(String(get(c, b) ?? ""), "fa", { numeric: true }) * sort.dir);
    }
    return d;
  }, [rows, q, filterValues, sort, columns, toolbarFilters, colFilters, localCols, server]);

  const page = server ? server.page - 1 : localPage;
  const size = server ? server.pageSize : pageSize;
  const total = server ? server.total : data.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const view = server ? data : data.slice(page * size, page * size + size);
  const visible = columns.filter((c) => !hidden.has(c.key));
  const selectedRows = rows.filter((r) => sel.has(rowKey(r)));
  const setPage = (p: number) => (server ? server.onPageChange(p + 1) : setLocalPage(p));
  const setFilter = (k: string, v: string) => { if (server?.onFilterChange && serverKeys.has(k)) server.onFilterChange(k, v === "all" ? "" : v); else { setLocalFilters((f) => ({ ...f, [k]: v })); setLocalPage(0); } };
  const colSpan = visible.length + (selectable ? 1 : 0) + (actions ? 1 : 0);
  const shownFilters = visible.filter((c) => colFilters.has(c.key));
  const activeParams = shownFilters.flatMap((c) => filterParams(colFilters.get(c.key)!, c.key)).filter((k) => filterValues[k] && filterValues[k] !== "all");
  const clearFilters = () => {
    activeParams.filter((k) => serverKeys.has(k)).forEach((k) => server?.onFilterChange?.(k, ""));
    const n = { ...localFilters }; activeParams.forEach((k) => delete n[k]); setLocalFilters(n); setLocalPage(0);
  };

  return (
    <div dir="rtl" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2.5 border-b bg-card px-4 py-3">
        {/* RTL: first child sits at the top-right. Order = [primary buttons] [search] [filters] ........ [clear / columns / export] */}
        {toolbar && <div className="flex flex-wrap items-center gap-2 empty:hidden">{toolbar}</div>}
        {!hideSearch && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); if (!server) setLocalPage(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} title={searchPlaceholder} className="h-10 rounded-xl border-transparent bg-muted/70 ps-9 pe-8 text-sm shadow-none transition-colors focus-visible:border-ring focus-visible:bg-card md:text-sm" />
            {q && <button type="button" onClick={() => { setQ(""); server?.onSearchChange?.(""); }} className="absolute end-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="پاک کردن جستجو"><X className="size-3.5" /></button>}
          </div>
        )}
        {toolbarFilters.map((f) => (
          <Select key={f.key} value={filterValues[f.key] || "all"} onValueChange={(v) => setFilter(f.key, v)}>
            <SelectTrigger className="h-9 w-auto min-w-36 text-sm" aria-label={f.label}><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent><SelectItem value="all">همه {f.label}</SelectItem>{f.options.map((o) => <SelectItem key={fv(o)} value={fv(o)}>{fl(o)}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        {activeParams.length > 0 && (
          <Button type="button" variant="outline" size="sm" dir="rtl" className="h-9 gap-1.5 border-dashed text-sm text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            <FilterX />پاک کردن فیلترها
          </Button>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-10 rounded-lg" aria-label="انتخاب ستون‌ها" title="انتخاب ستون‌ها"><Columns3 /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>ستون‌های قابل نمایش</DropdownMenuLabel><DropdownMenuSeparator />
              {columns.map((c) => <DropdownMenuCheckboxItem key={c.key} checked={!hidden.has(c.key)} onCheckedChange={(v) => { const n = new Set(hidden); if (v) n.delete(c.key); else n.add(c.key); setHidden(n); }}>{c.header}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" className="size-10 rounded-lg" aria-label="خروجی اکسل از ردیف‌های نمایش داده‌شده" title="خروجی اکسل (ردیف‌های همین صفحه)" disabled={view.length === 0}
            onClick={() => downloadCsv(exportName, visible.map((c) => c.header), view.map((r) => visible.map((c) => get(c, r))))}><Download /></Button>
        </div>
      </div>
      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          <span>{faNum(selectedRows.length)} ردیف انتخاب شده</span>{bulkActions?.(selectedRows, () => setSel(new Set()))}
          <Button size="sm" variant="ghost" className="ms-auto h-8" onClick={() => setSel(new Set())}>لغو انتخاب</Button>
        </div>
      )}
      <div className={cn("relative", fetching && !loading && "opacity-60 transition-opacity")} aria-busy={fetching || loading || undefined}>
        <Table>
          <TableHeader><TableRow className="dt-static">
            {selectable && <TableHead className={selCell}><Checkbox className="mx-auto" aria-label="انتخاب همه ردیف‌های این صفحه" checked={view.length > 0 && view.every((r) => sel.has(rowKey(r))) ? true : view.some((r) => sel.has(rowKey(r))) ? "indeterminate" : false} onCheckedChange={(v) => { const n = new Set(sel); view.forEach((r) => (v === true ? n.add(rowKey(r)) : n.delete(rowKey(r)))); setSel(n); }} /></TableHead>}
            {visible.map((c) => {
              const active = sort?.key === c.key;
              return (
                <TableHead key={c.key} className={cn("whitespace-nowrap text-start", c.className)} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}>
                  {c.sortable === false ? c.header : (
                    <button type="button" className="-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                      {c.header}{active ? (sort!.dir === 1 ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
                    </button>
                  )}
                </TableHead>
              );
            })}
            {actions && <TableHead className="w-14 min-w-14 px-2"><span className="sr-only">عملیات</span></TableHead>}
          </TableRow>
          {shownFilters.length > 0 && (
            <TableRow className="dt-static [&_th]:bg-card [&_th]:font-normal">
              {selectable && <TableHead className={selCell} />}
              {visible.map((c) => {
                const cf = colFilters.get(c.key);
                return (
                  <TableHead key={c.key} className={cn("h-auto py-2 align-middle font-normal", c.className)} title={cf && server && localCols.has(c.key) ? "فیلتر روی ردیف‌های همین صفحه" : undefined}>
                    {cf && <ColumnFilterCell filter={cf} columnKey={c.key} label={c.header} values={filterValues} debounce={!!server} onChange={setFilter} />}
                  </TableHead>
                );
              })}
              {actions && <TableHead className="w-14 min-w-14 px-2" />}
            </TableRow>
          )}
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }, (_, i) => <TableRow key={`sk${i}`} className="dt-static">{Array.from({ length: colSpan }, (_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>)}
            {!loading && Boolean(error) && <TableRow className="dt-static"><TableCell colSpan={colSpan} className="p-4"><ErrorState error={error} onRetry={onRetry} compact className="border-0" /></TableCell></TableRow>}
            {!loading && !error && view.length === 0 && (
              <TableRow className="dt-static"><TableCell colSpan={colSpan} className="border-b-0 py-16 text-center text-muted-foreground"><span className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-info-soft ring-8 ring-info-soft/50"><Inbox className="size-7 text-primary" aria-hidden /></span><div className="font-medium text-foreground">{emptyText}</div>{emptyAction && <div className="mt-4">{emptyAction}</div>}</TableCell></TableRow>
            )}
            {!loading && !error && view.map((r) => (
              <TableRow key={rowKey(r)} className={cn(onRowClick && "cursor-pointer focus-visible:outline-none")} tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(r)} onKeyDown={(e) => { if (onRowClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(r); } }}>
                {selectable && <TableCell className={cn(selCell, "text-center")} onClick={(e) => e.stopPropagation()}><Checkbox className="mx-auto" aria-label="انتخاب ردیف" checked={sel.has(rowKey(r))} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(rowKey(r)); else n.delete(rowKey(r)); setSel(n); }} /></TableCell>}
                {visible.map((c) => <TableCell key={c.key} className={cn("whitespace-nowrap", dense && "py-2", c.className)}>{c.cell ? c.cell(r) : (() => { const v: unknown = get(c, r); return v === true || v === "true" ? <YesNo value /> : v === false || v === "false" ? <YesNo value={false} /> : v === undefined || v === null || v === "" ? <span className="text-muted-foreground/70">—</span> : String(v); })()}</TableCell>)}
                {actions && (
                  <TableCell className="px-2 text-center" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {actions.some((a) => !a.show || a.show(r)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label="عملیات ردیف" title="عملیات"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" alignOffset={12}>
                          {actions.filter((a) => !a.show || a.show(r)).map((a) => (
                            <DropdownMenuItem key={a.label} onClick={() => a.onClick(r)} className={cn(a.destructive && "text-destructive focus:text-destructive")}>{a.icon && <a.icon />}{a.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3 text-sm text-muted-foreground">
        <span>
          {loading ? "در حال بارگذاری…" : total === 0 ? "۰ رکورد" : `نمایش ${faNum(page * size + 1)} تا ${faNum(Math.min(total, page * size + (server ? data.length : view.length)))} از ${faNum(total)} رکورد`}
          {server && !loading && data.length !== rows.length && ` — ${faNum(data.length)} ردیف این صفحه با فیلتر`}
        </span>
        <nav className="flex items-center gap-1" aria-label="صفحه‌بندی">
          <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page === 0 || loading} onClick={() => setPage(0)} aria-label="صفحه اول" title="صفحه اول"><ChevronsRight /></Button>
          <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} aria-label="صفحه قبل" title="صفحه قبل"><ChevronRight /></Button>
          <span className="mx-1 min-w-28 rounded-lg bg-primary-soft px-3 py-1 text-center font-bold text-primary">صفحه {faNum(page + 1)} از {faNum(pages)}</span>
          <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page >= pages - 1 || loading} onClick={() => setPage(page + 1)} aria-label="صفحه بعد" title="صفحه بعد"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" className="size-8 rounded-lg" disabled={page >= pages - 1 || loading} onClick={() => setPage(pages - 1)} aria-label="صفحه آخر" title="صفحه آخر"><ChevronsLeft /></Button>
        </nav>
      </div>
    </div>
  );
}

/** Wires a paged query result into DataTable props. */
export function tableState<T>(q: { data?: { items: T[]; total: number; page: number; pageSize: number }; isPending: boolean; isFetching: boolean; error: unknown; refetch: () => unknown }) {
  return { rows: q.data?.items ?? [], loading: q.isPending, fetching: q.isFetching, error: q.error ?? undefined, onRetry: () => void q.refetch() };
}
