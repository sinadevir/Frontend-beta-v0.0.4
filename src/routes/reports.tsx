import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarRange, CheckCircle2, Clock3, Download, Eye, FileBarChart2, FileSpreadsheet, Info, Inbox, Layers, ListChecks, Loader2, Play, Printer, Sparkles, Target, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/cis/app-shell";
import { DataTable } from "@/components/cis/data-table";
import { TreeView, type TreeNode } from "@/components/cis/tree-view";
import { JalaliDatePicker } from "@/components/cis/jalali-date-picker";
import { ErrorState } from "@/components/cis/query-state";
import { DateText } from "@/components/cis/date-text";
import { usePermissions } from "@/lib/auth/permissions";
import { P } from "@/lib/auth/permission-codes";
import { useSession } from "@/lib/api/session";
import { errorMessage } from "@/lib/api/messages";
import { downloadCsv } from "@/lib/export";
import { addDays, faNum, gToJ, jToDate, startOfDay, toDateOnly, toJalali, toJalaliDateTime } from "@/lib/jalali";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { lifecycleCasesQuery } from "@/features/lifecycle/api";
import { CATEGORIES, REPORTS, reportById, type ReportDef, type RunParams } from "@/features/reports/catalog";
import { groupCount, inRange, timeline, type Bucket, type Fetched } from "@/features/reports/engine";
import { reportHistory, useReportHistory, type ReportRun } from "@/features/reports/history";
import { BarList, Donut, TrendChart } from "@/features/reports/charts";

export const Route = createFileRoute("/reports")({
  head: () => seo("گزارش‌ها", "گزارش‌گیری از درخواست‌ها، مشترکین، املاک و فعالیت سامانه با نمودار و خروجی اکسل"),
  component: ReportsPage,
});

type Def = ReportDef<unknown>;
type Form = { from?: Date | undefined; to?: Date | undefined; status: string; extra: string; groupBy: string };
type Run = { def: Def; params: RunParams; nonce: number; record: boolean };
type Result = Fetched<unknown> & { fetched: number; at: string };

const ALL = "all";
const today = () => startOfDay(new Date());
const defaults = (d: Def): Form => ({ from: d.defaultDays ? addDays(today(), -d.defaultDays) : undefined, to: d.defaultDays ? today() : undefined, status: ALL, extra: ALL, groupBy: d.groupings[0]?.key ?? "" });
const toParams = (f: Form): RunParams => ({ from: f.from, to: f.to, status: f.status === ALL ? undefined : f.status, extra: f.extra === ALL ? undefined : f.extra, groupBy: f.groupBy });
const parseDay = (s?: string) => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return y && m && d ? new Date(y, m - 1, d) : undefined; };
const jYearStart = () => jToDate(gToJ(new Date()).jy, 1, 1);

const PRESETS: { label: string; from: () => Date | undefined; to: () => Date | undefined }[] = [
  { label: "۷ روز اخیر", from: () => addDays(today(), -7), to: today },
  { label: "۳۰ روز اخیر", from: () => addDays(today(), -30), to: today },
  { label: "۹۰ روز اخیر", from: () => addDays(today(), -90), to: today },
  { label: "از ابتدای امسال", from: jYearStart, to: today },
  { label: "همه زمان‌ها", from: () => undefined, to: () => undefined },
];

/** One line naming the settings a report was run with. */
function describe(def: Def, p: RunParams) {
  const parts: string[] = [];
  if (def.date) parts.push(p.from || p.to ? `${def.date.label} ${p.from ? `از ${toJalali(p.from)}` : ""}${p.to ? ` تا ${toJalali(p.to)}` : ""}`.replace(/\s+/g, " ") : "همه زمان‌ها");
  if (def.status && p.status) parts.push(def.status.options.find((o) => o.value === p.status)?.label ?? p.status);
  if (def.extra && p.extra) parts.push(def.extra.options.find((o) => o.value === p.extra)?.label ?? p.extra);
  const g = def.groupings.find((x) => x.key === p.groupBy);
  if (g) parts.push(g.label);
  return parts.join(" · ");
}

/** Fetches a report's rows and trims them to the chosen date range. */
async function execute(def: Def, p: RunParams, ctx: { signal?: AbortSignal; onProgress?: (l: number, t: number) => void } = {}): Promise<Result> {
  const res = await def.fetch(p, ctx);
  const rows = def.date && (p.from || p.to) ? res.rows.filter((r) => inRange(def.date!.of(r), p.from, p.to)) : res.rows;
  return { ...res, rows, fetched: res.rows.length, at: new Date().toISOString() };
}

function exportRows(def: Def, rows: unknown[]) {
  const cols = def.columns;
  const get = (c: (typeof cols)[number], r: unknown) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key]);
  downloadCsv(`report-${def.id}`, cols.map((c) => c.header), rows.map((r) => cols.map((c) => get(c, r) as string | number | undefined)));
}

function bucketsOf(def: Def, rows: unknown[], groupBy: string): { buckets: Bucket[]; time?: "week" | "month" } {
  const g = def.groupings.find((x) => x.key === groupBy) ?? def.groupings[0];
  if (!g) return { buckets: [] };
  if (g.time && def.date) return { buckets: timeline(rows, def.date.of, g.time), time: g.time };
  return { buckets: groupCount(rows, g.of ?? (() => ""), g.text, g.order) };
}

function ReportsPage() {
  const perms = usePermissions();
  const session = useSession();
  const history = useReportHistory();
  const available = useMemo(() => REPORTS.filter((r) => !r.perm || perms.can(r.perm)), [perms]);
  const [selectedId, setSelectedId] = useState<string>();
  const def = reportById(selectedId) && available.some((r) => r.id === selectedId) ? reportById(selectedId)! : available[0];
  const [form, setForm] = useState<Form>(() => (def ? defaults(def) : { status: ALL, extra: ALL, groupBy: "" }));
  const [run, setRun] = useState<Run | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [groupBy, setGroupBy] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const select = (d: Def, f?: Form) => { setSelectedId(d.id); setForm(f ?? defaults(d)); };
  useEffect(() => { if (def && !form.groupBy) setForm(defaults(def)); }, [def?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useQuery({
    queryKey: ["report", run?.def.id, run?.params, run?.nonce],
    enabled: Boolean(run),
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      const r = run!;
      setProgress({ loaded: 0, total: 0 });
      const res = await execute(r.def, r.params, { signal, onProgress: (loaded, total) => setProgress({ loaded, total }) });
      if (r.record) {
        reportHistory.add({
          reportId: r.def.id, title: r.def.title, summary: describe(r.def, r.params), at: res.at, by: session?.displayName ?? "کارشناس سامانه",
          rows: res.rows.length, total: res.total, truncated: res.truncated,
          params: { from: r.params.from ? toDateOnly(r.params.from) : undefined, to: r.params.to ? toDateOnly(r.params.to) : undefined, status: r.params.status, extra: r.params.extra, groupBy: r.params.groupBy },
        });
      }
      return res;
    },
  });

  const generate = (d: Def, f: Form, record = true) => {
    if (f.from && f.to && f.from > f.to) { toast.error("«از تاریخ» نباید بعد از «تا تاریخ» باشد"); return; }
    setGroupBy(f.groupBy);
    setRun({ def: d, params: toParams(f), nonce: Date.now(), record });
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const openRun = (h: ReportRun, record = false) => {
    const d = available.find((x) => x.id === h.reportId);
    if (!d) { toast.error("این گزارش دیگر در دسترس شما نیست"); return; }
    const f: Form = { from: parseDay(h.params.from), to: parseDay(h.params.to), status: h.params.status ?? ALL, extra: h.params.extra ?? ALL, groupBy: h.params.groupBy };
    select(d, f);
    generate(d, f, record);
  };
  const downloadRun = async (h: ReportRun) => {
    const d = available.find((x) => x.id === h.reportId);
    if (!d) { toast.error("این گزارش دیگر در دسترس شما نیست"); return; }
    const id = toast.loading(`در حال آماده‌سازی «${h.title}»…`);
    try {
      const res = await execute(d, { from: parseDay(h.params.from), to: parseDay(h.params.to), status: h.params.status, extra: h.params.extra, groupBy: h.params.groupBy });
      exportRows(d, res.rows);
      toast.success(`خروجی با ${faNum(res.rows.length)} ردیف آماده شد`, { id });
    } catch (e) { toast.error(errorMessage(e), { id }); }
  };

  // Headline figures (each is a live count from the server).
  const lifecycleOk = perms.can([P.HistoryRead, P.LifecycleReview, P.LifecycleApprove, P.LifecycleExecute, P.LifecycleRequest]);
  const one = { page: 1, pageSize: 1 };
  const done = useQuery({ ...lifecycleCasesQuery({ status: "Completed", ...one }), enabled: lifecycleOk });
  const q1 = useQuery({ ...lifecycleCasesQuery({ status: "Submitted", ...one }), enabled: lifecycleOk });
  const q2 = useQuery({ ...lifecycleCasesQuery({ status: "UnderReview", ...one }), enabled: lifecycleOk });
  const q3 = useQuery({ ...lifecycleCasesQuery({ status: "AwaitingExecution", ...one }), enabled: lifecycleOk });
  const queue = [q1, q2, q3];
  const queueValue = queue.some((x) => x.isPending) ? undefined : queue.some((x) => x.error) ? "—" : faNum(queue.reduce((n, x) => n + (x.data?.total ?? 0), 0));

  const nodes: TreeNode[] = useMemo(() => CATEGORIES.map((c) => {
    const items = available.filter((r) => r.category === c.id);
    return { id: `cat:${c.id}`, title: c.title, icon: c.icon, badge: faNum(items.length), children: items.map((r) => ({ id: r.id, title: r.title, icon: r.icon, hint: r.goal ? "شاخص اصلی" : undefined })) };
  }).filter((n) => n.children.length), [available]);

  if (!def) {
    return (<><PageHeader title="گزارش‌ها" /><div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">گزارشی برای نقش‌های شما تعریف نشده است.</div></>);
  }
  const latest = history[0];

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="گزارش‌ها" desc="گزارش موردنظر را از درخت انتخاب کنید، بازه و پارامترها را تعیین کنید و «تولید گزارش» را بزنید؛ همه اعداد مستقیم از اطلاعات ثبت‌شده در سامانه خوانده می‌شوند." />

        <section aria-label="خلاصه گزارش‌ها" className="rise-in mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={FileBarChart2} label="گزارش‌های در دسترس" value={faNum(available.length)} hint={`در ${faNum(nodes.length)} گروه`} accent />
          <Kpi icon={ListChecks} label="گزارش‌های تولیدشده شما" value={faNum(history.length)} hint={latest ? <>آخرین: <DateText value={latest.at} relative /></> : "هنوز گزارشی تولید نکرده‌اید"} />
          {lifecycleOk && <Kpi icon={CheckCircle2} tone="ok" label="درخواست‌های اجراشده" value={done.isPending ? undefined : done.error ? "—" : faNum(done.data?.total ?? 0)} hint="کل پرونده‌های تغییر وضعیت اجراشده" />}
          {lifecycleOk && <Kpi icon={Inbox} tone="warn" label="درخواست‌های در صف" value={queueValue} hint="ارسال‌شده، در حال بررسی و در انتظار اجرا" />}
        </section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] print:block">
        {/* report tree (right side in RTL) */}
        <aside className="overflow-hidden rounded-xl border bg-card shadow-card lg:sticky lg:top-20 print:hidden">
          <PanelHead icon={Layers} title="درخت گزارش‌ها" desc="گزارش‌ها به تفکیک موضوع" />
          <div className="p-3">
            <TreeView nodes={nodes} selected={def.id} maxHeight="none" searchPlaceholder="جستجو در گزارش‌ها…"
              onSelect={(n) => { const d = available.find((r) => r.id === n.id); if (d && d.id !== def.id) select(d); }} />
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <ParamsCard def={def} form={form} setForm={setForm} busy={q.isFetching} onGenerate={() => generate(def, form)}
            canExport={Boolean(q.data && run?.def.id === def.id)} onExcel={() => q.data && run && exportRows(run.def, q.data.rows)} onPrint={() => window.print()} />

          <div ref={resultsRef} className="scroll-mt-24">
            {!run && <Intro def={def} />}
            {run && q.isFetching && <Fetching title={run.def.title} progress={progress} />}
            {run && !q.isFetching && q.error && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
            {run && !q.isFetching && q.data && <Results def={run.def} params={run.params} res={q.data} groupBy={groupBy} setGroupBy={setGroupBy} />}
          </div>

          <HistoryCard history={history} onView={(h) => openRun(h)} onDownload={downloadRun} />
        </div>
      </div>
    </>
  );
}

/* ───────── pieces ───────── */

function PanelHead({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-0"><h2 className="truncate text-[0.9375rem] font-extrabold">{title}</h2>{desc && <p className="truncate text-xs text-muted-foreground">{desc}</p>}</div>
      </div>
      {children}
    </div>
  );
}

const KPI_TONE = { primary: "bg-primary-soft text-primary", ok: "bg-success-soft text-success-foreground", warn: "bg-warning-soft text-warning-foreground" };
function Kpi({ icon: Icon, label, value, hint, accent, tone = "primary" }: { icon: LucideIcon; label: string; value: string | undefined; hint?: React.ReactNode; accent?: boolean; tone?: keyof typeof KPI_TONE }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-5 shadow-card", accent ? "border-transparent bg-brand text-primary-foreground shadow-brand" : "bg-card")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-xs font-bold", accent ? "opacity-85" : "text-muted-foreground")}>{label}</div>
          <div className="mt-1.5 text-[1.75rem] font-black leading-none">{value ?? <Skeleton className="h-7 w-14" />}</div>
        </div>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", accent ? "bg-sidebar-accent" : KPI_TONE[tone])}><Icon className="size-5" aria-hidden /></span>
      </div>
      {hint && <div className={cn("mt-3 truncate text-xs", accent ? "opacity-80" : "text-muted-foreground")}>{hint}</div>}
      {accent && <span aria-hidden className="wave-divider absolute inset-x-0 bottom-1 opacity-30" />}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs font-bold text-muted-foreground">{label}</Label>{children}</div>;
}

function ParamsCard({ def, form, setForm, busy, onGenerate, canExport, onExcel, onPrint }: {
  def: Def; form: Form; setForm: (f: Form) => void; busy: boolean; onGenerate: () => void; canExport: boolean; onExcel: () => void; onPrint: () => void;
}) {
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-card print:hidden">
      <PanelHead icon={def.icon} title={def.title} desc={def.desc}>
        {def.goal && <Badge variant="success" size="sm"><Target />شاخص اصلی سامانه</Badge>}
      </PanelHead>
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {def.date && (
            <>
              <Field label={`از ${def.date.label}`}><JalaliDatePicker value={form.from} onChange={(d) => set({ from: d })} onClear={() => set({ from: undefined })} placeholder="از ابتدا" max={form.to} /></Field>
              <Field label={`تا ${def.date.label}`}><JalaliDatePicker value={form.to} onChange={(d) => set({ to: d })} onClear={() => set({ to: undefined })} placeholder="تا امروز" min={form.from} /></Field>
            </>
          )}
          {def.status && (
            <Field label={def.status.label}>
              <Select value={form.status} onValueChange={(v) => set({ status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>{def.status.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            </Field>
          )}
          {def.extra && (
            <Field label={def.extra.label}>
              <Select value={form.extra} onValueChange={(v) => set({ extra: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>همه</SelectItem>{def.extra.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            </Field>
          )}
          <Field label="گروه‌بندی">
            <Select value={form.groupBy} onValueChange={(v) => set({ groupBy: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{def.groupings.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent></Select>
          </Field>
        </div>

        {def.date && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 flex items-center gap-1 text-xs font-bold text-muted-foreground"><CalendarRange className="size-3.5" />بازه سریع:</span>
            {PRESETS.map((p) => {
              const f = p.from(), t = p.to();
              const on = (f?.getTime() ?? 0) === (form.from?.getTime() ?? 0) && (t?.getTime() ?? 0) === (form.to?.getTime() ?? 0);
              return <button key={p.label} type="button" onClick={() => set({ from: f, to: t })} aria-pressed={on}
                className={cn("h-7 rounded-full border px-3 text-xs font-semibold transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary")}>{p.label}</button>;
            })}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-soft/60 px-3.5 py-2.5 text-xs leading-6 text-foreground">
          <Info className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
          <span>منبع داده: <b>{def.source}</b>. پارامترها بر اساس نوع گزارش انتخاب‌شده نمایش داده می‌شوند.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="lg" variant="brand" className="min-w-44" onClick={onGenerate} loading={busy} loadingText="در حال تولید گزارش…"><Play />تولید گزارش</Button>
          <Button size="lg" variant="outline" className="border-success/40 text-success-foreground hover:border-success hover:text-success-foreground" onClick={onExcel} disabled={!canExport} title={canExport ? "دریافت ردیف‌های گزارش برای اکسل" : "ابتدا گزارش را تولید کنید"}><FileSpreadsheet />خروجی Excel</Button>
          <Button size="lg" variant="outline" className="border-destructive/35 text-destructive hover:border-destructive hover:text-destructive" onClick={onPrint} disabled={!canExport} title={canExport ? "چاپ یا ذخیره به‌صورت PDF" : "ابتدا گزارش را تولید کنید"}><Printer />چاپ / PDF</Button>
        </div>
      </div>
    </section>
  );
}

function Intro({ def }: { def: Def }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center print:hidden">
      <span className="grid size-16 place-items-center rounded-2xl bg-info-soft text-primary ring-8 ring-info-soft/50"><BarChart3 className="size-7" aria-hidden /></span>
      <div className="text-base font-extrabold">«{def.title}» آماده تولید است</div>
      <p className="max-w-md text-sm text-muted-foreground">پارامترها را تنظیم کنید و «تولید گزارش» را بزنید تا نمودارها، خلاصه اعداد و فهرست کامل رکوردها نمایش داده شوند.</p>
    </section>
  );
}

function Fetching({ title, progress }: { title: string; progress: { loaded: number; total: number } | null }) {
  const pct = progress?.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
  return (
    <section className="rounded-xl border bg-card p-6 shadow-card" aria-busy="true" aria-live="polite">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Loader2 className="size-5 animate-spin" /></span>
        <div><div className="font-extrabold">در حال تولید «{title}»</div>
          <div className="text-xs text-muted-foreground">{progress?.total ? `${faNum(progress.loaded)} از ${faNum(progress.total)} رکورد دریافت شد` : "در حال دریافت اطلاعات از سرور…"}</div></div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
    </section>
  );
}

function Results({ def, params, res, groupBy, setGroupBy }: { def: Def; params: RunParams; res: Result; groupBy: string; setGroupBy: (g: string) => void }) {
  const rows = res.rows;
  const { buckets, time } = useMemo(() => bucketsOf(def, rows, groupBy), [def, rows, groupBy]);
  const metrics = useMemo(() => def.metrics?.(rows, params) ?? [], [def, rows, params]);
  const top = time ? undefined : buckets[0];
  const grouping = def.groupings.find((g) => g.key === groupBy) ?? def.groupings[0];
  return (
    <div className="report-print rise-in space-y-5">
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-primary-soft/50 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-bold text-primary"><Sparkles className="size-3.5" />نتیجه گزارش{def.goal && <Badge variant="success" size="xs"><Target />شاخص اصلی</Badge>}</div>
            <h2 className="text-lg font-black">{def.title}</h2>
            <p className="mt-0.5 text-xs leading-6 text-muted-foreground">{describe(def, params)} · تولید در {toJalaliDateTime(res.at)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 print:hidden" role="group" aria-label="نمایش به تفکیک">
            {def.groupings.map((g) => (
              <button key={g.key} type="button" onClick={() => setGroupBy(g.key)} aria-pressed={g.key === grouping?.key}
                className={cn("h-8 rounded-lg px-3 text-xs font-bold transition-colors", g.key === grouping?.key ? "bg-primary text-primary-foreground shadow-brand" : "bg-card text-muted-foreground ring-1 ring-border hover:text-primary")}>{g.label.replace("به تفکیک ", "")}</button>
            ))}
          </div>
        </div>
        {res.truncated && (
          <div className="flex items-start gap-2 border-b bg-warning-soft px-5 py-2.5 text-xs text-warning-foreground"><TriangleAlert className="mt-0.5 size-4 shrink-0" />
            سرور {faNum(res.total)} رکورد دارد؛ برای سرعت، {faNum(res.fetched)} رکورد نخست بررسی شد. برای گزارش کامل، بازه یا فیلترها را محدودتر کنید.</div>
        )}
        <div className="-mb-px -me-px grid sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none [&>*]:min-w-0 [&>*]:border-b [&>*]:border-e">
          <Figure label="تعداد رکوردها" value={faNum(rows.length)} hint={res.fetched !== rows.length ? `از ${faNum(res.fetched)} رکورد دریافتی، در بازه انتخابی` : "مطابق پارامترهای گزارش"} accent />
          {top && <Figure label={`بیشترین سهم ${grouping?.label.replace("به تفکیک ", "") ?? ""}`} value={top.label} hint={`${faNum(top.count)} رکورد · ${faNum(rows.length ? Math.round((top.count / rows.length) * 100) : 0)}٪`} />}
          {metrics.map((m) => <Figure key={m.label} label={m.label} value={m.value} hint={m.hint} />)}
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-xl border bg-card py-14 text-center text-muted-foreground shadow-card">
          <span className="grid size-14 place-items-center rounded-2xl bg-info-soft text-primary"><Inbox className="size-6" /></span>
          <div className="font-bold text-foreground">با این پارامترها رکوردی پیدا نشد</div>
          <p className="text-sm">بازه تاریخ را بزرگ‌تر کنید یا فیلترها را بردارید.</p>
        </section>
      ) : time ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-card">
          <PanelHead icon={BarChart3} title={`روند ${time === "week" ? "هفتگی" : "ماهانه"}`} desc={`تعداد رکوردها در هر ${time === "week" ? "هفته" : "ماه"} بر اساس ${def.date?.label ?? "تاریخ"}`} />
          <div className="p-5"><TrendChart data={buckets} unitLabel={time === "week" ? "هفته" : "ماه"} /></div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-5 [&>*]:min-w-0">
          <section className="overflow-hidden rounded-xl border bg-card shadow-card xl:col-span-3">
            <PanelHead icon={BarChart3} title={grouping?.label ?? "توزیع"} desc={`${faNum(buckets.length)} گروه`} />
            <div className="max-h-[26rem] overflow-y-auto p-5"><BarList data={buckets} total={rows.length} /></div>
          </section>
          <section className="overflow-hidden rounded-xl border bg-card shadow-card xl:col-span-2">
            <PanelHead icon={Layers} title="سهم هر گروه" desc="پنج گروه بزرگ و سایر" />
            <div className="p-5"><Donut data={buckets} total={rows.length} /></div>
          </section>
        </div>
      )}

      {rows.length > 0 && (
        <DataTable<unknown> rows={rows} columns={def.columns} rowKey={def.rowKey} exportName={`report-${def.id}`} searchPlaceholder="جستجو در نتیجه گزارش…" pageSize={10}
          toolbar={<span className="flex items-center gap-2 text-sm font-extrabold"><ListChecks className="size-4 text-primary" />رکوردهای گزارش</span>} />
      )}
    </div>
  );
}

function Figure({ label, value, hint, accent }: { label: string; value: string; hint?: string | undefined; accent?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-2xl font-black leading-tight", accent && "text-primary")} title={value}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground" title={hint}>{hint}</div>}
    </div>
  );
}

function HistoryCard({ history, onView, onDownload }: { history: ReportRun[]; onView: (h: ReportRun) => void; onDownload: (h: ReportRun) => void }) {
  return (
    <section className="print:hidden">
      <DataTable<ReportRun>
        rows={history} rowKey={(r) => r.id} pageSize={5} hideSearch exportName="report-history"
        toolbar={<span className="flex items-center gap-2 text-sm font-extrabold"><Clock3 className="size-4 text-primary" />آخرین گزارش‌های تولیدشده</span>}
        emptyText="هنوز گزارشی تولید نشده است؛ گزارش‌هایی که تولید می‌کنید اینجا می‌مانند."
        onRowClick={onView}
        columns={[
          { key: "title", header: "عنوان گزارش", cell: (r) => <span className="font-bold">{r.title}</span> },
          { key: "summary", header: "پارامترها", className: "max-w-80 truncate", cell: (r) => <span className="text-muted-foreground" title={r.summary}>{r.summary}</span> },
          { key: "at", header: "تاریخ تولید", cell: (r) => <DateText value={r.at} time />, value: (r) => toJalaliDateTime(r.at) },
          { key: "by", header: "درخواست‌دهنده" },
          { key: "rows", header: "رکوردها", cell: (r) => <Badge variant="count" size="sm">{faNum(r.rows)}</Badge>, value: (r) => r.rows },
          { key: "state", header: "وضعیت", filter: false, cell: (r) => (r.truncated ? <Badge variant="warning" size="sm"><TriangleAlert />بخشی از رکوردها</Badge> : <Badge variant="success" size="sm"><CheckCircle2 />کامل</Badge>), value: (r) => (r.truncated ? "بخشی از رکوردها" : "کامل") },
          {
            key: "ops", header: "عملیات", filter: false, sortable: false, value: () => "",
            cell: (r) => (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Button size="sm" variant="soft" onClick={() => onView(r)}><Eye />مشاهده</Button>
                <Button size="sm" variant="outline" onClick={() => onDownload(r)}><Download />دانلود</Button>
                <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:bg-destructive-soft hover:text-destructive" aria-label="حذف از فهرست" title="حذف از فهرست" onClick={() => reportHistory.remove(r.id)}><Trash2 /></Button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
