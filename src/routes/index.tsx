import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ClipboardCheck, FileEdit, FileSearch, Inbox, Play, Search, Users, UserPlus, XCircle, Building2, Copy, Tags, Cable, Droplets, Gauge, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/cis/app-shell";
import { StatusBadge } from "@/components/cis/status-badge";
import { ErrorState } from "@/components/cis/query-state";
import { usePermissions } from "@/lib/auth/permissions";
import { P, type PermissionCode } from "@/lib/auth/permission-codes";
import { useSession } from "@/lib/api/session";
import { changeRequestsQuery, lifecycleCasesQuery, transitionLabel } from "@/features/lifecycle/api";
import { conflictsQuery } from "@/features/ownership/api";
import { mismatchesQuery } from "@/features/usage/api";
import { duplicatePartiesQuery, partiesQuery } from "@/features/parties/api";
import { customersQuery } from "@/features/customers/api";
import { premisesListQuery } from "@/features/premises/api";
import { foundationOutboxQuery } from "@/features/foundation/operations";
import { errorMessage } from "@/lib/api/messages";
import { faNum, toJalaliLong } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";
import { DateText } from "@/components/cis/date-text";

export const Route = createFileRoute("/")({
  head: () => seo("میز کار", "کارهای منتظر اقدام، هشدارهای کنترلی و دسترسی سریع به خدمات مشترکین"),
  component: Dashboard,
});

const one = { page: 1, pageSize: 1 };

type Tone = "primary" | "info" | "warn" | "bad" | "ok";
const TONE: Record<Tone, { icon: string; bar: string; text: string; fill: string }> = {
  primary: { icon: "bg-primary-soft text-primary", bar: "bg-primary", text: "text-foreground", fill: "bg-primary-soft" },
  info: { icon: "bg-info-soft text-logo-blue", bar: "bg-logo-blue-light", text: "text-foreground", fill: "bg-info-soft" },
  warn: { icon: "bg-warning-soft text-warning-foreground", bar: "bg-warning", text: "text-warning-foreground", fill: "bg-warning-soft" },
  bad: { icon: "bg-destructive-soft text-destructive", bar: "bg-destructive", text: "text-destructive", fill: "bg-destructive-soft" },
  ok: { icon: "bg-success-soft text-success-foreground", bar: "bg-success", text: "text-success-foreground", fill: "bg-success-soft" },
};

type CountQuery = { data?: { total: number } | unknown[]; isPending: boolean; error: unknown; fetchStatus?: string };
const totalOf = (q: CountQuery) => (Array.isArray(q.data) ? q.data.length : q.data?.total);
/** A disabled query (no permission) never resolves; treat it as "nothing to show". */
const idle = (q: CountQuery) => q.isPending && q.fetchStatus === "idle";

type Item = { title: string; icon: LucideIcon; query: CountQuery; to: string; tone?: Tone };

function Num({ q, className }: { q: CountQuery; className?: string }) {
  if (q.isPending) return <Skeleton className="h-7 w-12" />;
  if (q.error) return <span className="text-sm font-normal text-muted-foreground" title={errorMessage(q.error)}>نامشخص</span>;
  return <span className={className}>{faNum(totalOf(q) ?? 0)}</span>;
}

/** One cell of the work queue strip: number, label and a thin bar showing its share of the queue. */
function WorkCell({ title, icon: Icon, query, to, tone = "primary", max = 1 }: Item & { max?: number }) {
  const t = TONE[tone];
  const total = totalOf(query) ?? 0;
  const share = query.isPending || query.error ? 0 : Math.round((total / Math.max(1, max)) * 100);
  return (
    <Link to={to} className="group flex flex-col gap-3 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-md", t.icon)}><Icon className="size-3.5" aria-hidden /></span>
        <span className="truncate text-xs font-bold text-muted-foreground group-hover:text-foreground">{title}</span>
      </div>
      <Num q={query} className={cn("text-[1.75rem] font-black leading-none", total > 0 && (tone === "bad" || tone === "warn") ? t.text : "text-foreground")} />
      <div className="h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.bar)} style={{ width: `${share}%` }} /></div>
    </Link>
  );
}

/** One row in the control-alerts list. */
function AlertRow({ title, icon: Icon, query, to }: Item) {
  const total = totalOf(query) ?? 0;
  const clean = !query.isPending && !query.error && total === 0;
  return (
    <Link to={to} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", clean ? TONE.ok.icon : TONE.warn.icon)}><Icon className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-primary">{title}</span>
      {query.isPending ? <Skeleton className="h-6 w-8" /> : query.error ? <span className="text-xs text-muted-foreground">نامشخص</span>
        : clean ? <CheckCircle2 className="size-4 text-success" aria-label="بدون مورد" />
        : <span className="min-w-7 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-center text-xs font-black text-warning-foreground">{faNum(total)}</span>}
    </Link>
  );
}

/** One figure in the overview strip. */
function Figure({ label, icon: Icon, value, to, accent }: { label: string; icon: LucideIcon; value: ReactNode; to: string; accent?: boolean }) {
  return (
    <Link to={to} className="group relative flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", accent ? "bg-primary text-primary-foreground shadow-brand" : "bg-primary-soft text-primary")}><Icon className="size-[1.125rem]" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-muted-foreground">{label}</span>
        <span className="mt-0.5 block text-2xl font-black leading-tight text-foreground">{value}</span>
      </span>
      <ArrowLeft className="size-4 text-muted-foreground opacity-0 transition-all group-hover:-translate-x-0.5 group-hover:text-primary group-hover:opacity-100" aria-hidden />
    </Link>
  );
}

const PanelHead = ({ icon: Icon, title, desc, to }: { icon: LucideIcon; title: string; desc: string; to?: string }) => (
  <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0"><h2 className="truncate text-[0.9375rem] font-extrabold">{title}</h2><p className="truncate text-xs text-muted-foreground">{desc}</p></div>
    </div>
    {to && <Button variant="ghost" size="sm" asChild><Link to={to}>همه<ArrowLeft /></Link></Button>}
  </div>
);

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? "شب بخیر" : h < 12 ? "صبح بخیر" : h < 17 ? "روز بخیر" : h < 20 ? "عصر بخیر" : "شب بخیر";
}

function Dashboard() {
  const session = useSession();
  const perms = usePermissions();
  const can = (c: PermissionCode | PermissionCode[]) => perms.can(c);
  const toReview = useQuery({ ...lifecycleCasesQuery({ status: "Submitted", ...one }), enabled: can(P.LifecycleReview) });
  const toApprove = useQuery({ ...lifecycleCasesQuery({ status: "UnderReview", ...one }), enabled: can(P.LifecycleApprove) });
  const toExecute = useQuery({ ...lifecycleCasesQuery({ status: "AwaitingExecution", ...one }), enabled: can(P.LifecycleExecute) });
  const failed = useQuery({ ...lifecycleCasesQuery({ status: "Failed", ...one }), enabled: can([P.LifecycleRetry, P.LifecycleExecute]) });
  const changes = useQuery({ ...changeRequestsQuery({ status: "Submitted", ...one }), enabled: can([P.ChangeApprove, P.ChangeRead]) });
  const conflicts = useQuery({ ...conflictsQuery(one), enabled: can(P.OwnershipRead) });
  const mismatches = useQuery({ ...mismatchesQuery(one), enabled: can(P.UsageRead) });
  const dupes = useQuery({ ...duplicatePartiesQuery({ mode: "NationalId", ...one }), enabled: can(P.PartyRead) });
  const dead = useQuery({ ...foundationOutboxQuery("dead-letter"), enabled: can(P.IntegrationMonitor) });
  const queue = useQuery({ ...lifecycleCasesQuery({ status: can(P.LifecycleApprove) && !can(P.LifecycleReview) ? "UnderReview" : "Submitted", page: 1, pageSize: 6 }), enabled: can([P.LifecycleReview, P.LifecycleApprove]) });
  const customersCount = useQuery({ ...customersQuery(one), enabled: can(P.CustomerRead) });
  const partiesCount = useQuery({ ...partiesQuery(one), enabled: can(P.PartyRead) });
  const premisesCount = useQuery({ ...premisesListQuery(one), enabled: can(P.PremisesRead) });
  const recent = useQuery({ ...customersQuery({ page: 1, pageSize: 6 }), enabled: can(P.CustomerRead) });

  const quick: { to: string; label: string; icon: LucideIcon; perm: PermissionCode }[] = [
    { to: "/customers", label: "جستجوی مشترک", icon: Search, perm: P.CustomerRead },
    { to: "/registration", label: "ثبت مشترک جدید", icon: UserPlus, perm: P.CustomerCreate },
    { to: "/parties", label: "اشخاص", icon: Users, perm: P.PartyRead },
    { to: "/premises", label: "پرونده املاک", icon: Building2, perm: P.PremisesRead },
  ];
  const stats = [
    can(P.CustomerRead) && { label: "مشترکین", icon: Droplets, query: customersCount, to: "/customers" },
    can(P.PartyRead) && { label: "اشخاص", icon: Users, query: partiesCount, to: "/parties" },
    can(P.PremisesRead) && { label: "املاک", icon: Building2, query: premisesCount, to: "/premises" },
  ].filter(Boolean) as { label: string; icon: LucideIcon; query: CountQuery; to: string }[];
  const work = [
    can(P.LifecycleReview) && { title: "منتظر شروع بررسی", icon: Inbox, query: toReview, to: "/cases", tone: "info" as Tone },
    can(P.LifecycleApprove) && { title: "منتظر تأیید", icon: ClipboardCheck, query: toApprove, to: "/cases", tone: "primary" as Tone },
    can(P.LifecycleExecute) && { title: "آماده اجرا", icon: Play, query: toExecute, to: "/cases", tone: "ok" as Tone },
    can([P.LifecycleRetry, P.LifecycleExecute]) && { title: "اجرای ناموفق", icon: XCircle, query: failed, to: "/cases", tone: "bad" as Tone },
    can([P.ChangeApprove, P.ChangeRead]) && { title: "تغییر اطلاعات منتظر بررسی", icon: FileEdit, query: changes, to: "/cases", tone: "warn" as Tone },
  ].filter(Boolean) as Item[];
  const alerts = [
    can(P.OwnershipRead) && { title: "تعارض‌های تصرف", icon: AlertTriangle, query: conflicts, to: "/ownership" },
    can(P.UsageRead) && { title: "ناسازگاری کاربری", icon: Tags, query: mismatches, to: "/usage" },
    can(P.PartyRead) && { title: "اشخاص مشکوک به تکرار", icon: Copy, query: dupes, to: "/parties" },
    can(P.IntegrationMonitor) && { title: "پیام‌های ناموفق یکپارچه‌سازی", icon: Cable, query: dead, to: "/integration" },
  ].filter(Boolean) as Item[];

  const pending = work.reduce((n, w) => n + (totalOf(w.query) ?? 0), 0);
  const pendingLoading = work.some((w) => w.query.isPending && !idle(w.query));
  const alertCount = alerts.reduce((n, a) => n + (totalOf(a.query) ?? 0), 0);
  const maxWork = Math.max(1, ...work.map((w) => totalOf(w.query) ?? 0));
  const now = new Date();
  const name = session?.displayName;

  const figure = (q: CountQuery) => (q.isPending ? <Skeleton className="mt-1 h-7 w-14" /> : q.error ? "—" : faNum(totalOf(q) ?? 0));
  const summary = work.length === 0 ? "برای شروع، مشترک یا ملک موردنظر را جستجو کنید."
    : pendingLoading ? "در حال دریافت کارهای شما…"
    : pending > 0 ? `امروز ${faNum(pending)} کار منتظر اقدام شماست${alertCount > 0 ? ` و ${faNum(alertCount)} هشدار کنترلی نیاز به توجه دارد` : ""}.`
    : "همه کارها انجام شده؛ کار منتظری در صف شما نیست.";

  return (
    <>
      <PageHeader title={`${greeting(now)}${name ? `، ${name}` : ""}`} desc={`${toJalaliLong(now)} — ${summary}`}
        actions={quick.filter((x) => can(x.perm)).map((x) => (
          <Button key={x.to} asChild variant={x.to === "/customers" ? "default" : "outline"}><Link to={x.to}><x.icon />{x.label}</Link></Button>
        ))} />

      {/* Overview strip */}
      {(stats.length > 0 || work.length > 0) && (
        <section aria-label="خلاصه" className="rise-in mb-6 overflow-hidden rounded-xl border bg-card shadow-card">
          {/* every cell draws its own bottom/end hairline; the -1px margins hide the ones on the outer edge */}
          <div className="-mb-px -me-px grid sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none [&>*]:min-w-0 [&>*]:border-b [&>*]:border-e">
          {work.length > 0 && <Figure label="کارهای منتظر شما" icon={Inbox} value={pendingLoading ? <Skeleton className="mt-1 h-7 w-14" /> : faNum(pending)} to="/cases" accent />}
          {stats.map((x) => <Figure key={x.label} label={x.label} icon={x.icon} value={figure(x.query)} to={x.to} />)}
          {alerts.length > 0 && <Figure label="هشدارهای کنترلی" icon={ShieldAlert} value={alerts.some((a) => a.query.isPending) ? <Skeleton className="mt-1 h-7 w-14" /> : faNum(alertCount)} to={alerts[0]!.to} />}
          </div>
        </section>
      )}

      {/* Waiting work */}
      {work.length > 0 && (
        <section aria-labelledby="work-h" className="mb-6 overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 id="work-h" className="text-[0.9375rem] font-extrabold">کارهای منتظر اقدام</h2>
            {!pendingLoading && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{faNum(pending)} مورد در مجموع</span>}
          </div>
          <div className="-mb-px -me-px grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 [&>*]:min-w-0 [&>*]:border-b [&>*]:border-e">{work.map((w) => <WorkCell key={w.title} {...w} max={maxWork} />)}</div>
        </section>
      )}

      {/* Inbox + alerts */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        {can([P.LifecycleReview, P.LifecycleApprove]) ? (
          <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", alerts.length > 0 ? "lg:col-span-2" : "lg:col-span-3")}>
            <PanelHead icon={Inbox} title="کارتابل من" desc="قدیمی‌ترین درخواست‌ها را زودتر بررسی کنید" to="/cases" />
            {queue.isPending && <div className="space-y-2 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>}
            {queue.error && <div className="p-5"><ErrorState error={queue.error} onRetry={() => void queue.refetch()} compact /></div>}
            {queue.data?.items.length === 0 && <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground"><CheckCircle2 className="size-9 text-success/70" />کاری در صف شما نیست.</div>}
            {(queue.data?.items.length ?? 0) > 0 && (
              <ul className="divide-y">
                {queue.data!.items.map((c) => (
                  <li key={c.id}>
                    <Link to="/cases/$id" params={{ id: `lc-${c.id}` }} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-soft text-primary"><ClipboardCheck className="size-4" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold group-hover:text-primary">{transitionLabel(c.transitionType)} · مشترک #{faNum(c.customerId)}</div>
                        <div className="text-xs text-muted-foreground">{c.number || `#${c.id}`} · <DateText value={c.requestedAt} /></div>
                      </div>
                      <StatusBadge status={c.status} />
                      <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-12 text-center text-muted-foreground shadow-card lg:col-span-2"><FileSearch className="size-10 opacity-40" />برای شروع، مشترک یا ملک موردنظر را از نوار جستجوی بالا پیدا کنید.</section>
        )}

        {alerts.length > 0 && (
          <section className="overflow-hidden rounded-xl border bg-card shadow-card">
            <PanelHead icon={ShieldAlert} title="هشدارهای کنترلی" desc="موارد نیازمند رسیدگی در داده‌ها" />
            <div className="divide-y">{alerts.map((a) => <AlertRow key={a.title} {...a} />)}</div>
          </section>
        )}
      </div>

      {/* Recent customers + workload */}
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        {can(P.CustomerRead) && (
          <section className="overflow-hidden rounded-xl border bg-card shadow-card lg:col-span-2">
            <PanelHead icon={Droplets} title="آخرین مشترکین" desc="مشترکین اخیر ثبت‌شده در سامانه" to="/customers" />
            {recent.isPending && <div className="space-y-2 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>}
            {recent.error && <div className="p-5"><ErrorState error={recent.error} onRetry={() => void recent.refetch()} compact /></div>}
            {recent.data?.items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">هنوز مشترکی ثبت نشده است.</p>}
            {(recent.data?.items.length ?? 0) > 0 && (
              <ul className="divide-y">
                {recent.data!.items.map((c) => (
                  <li key={c.id}>
                    <Link to="/customers/$id" params={{ id: String(c.id) }} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-black text-primary">{(c.principalName || "؟").trim().charAt(0)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold group-hover:text-primary">{c.principalName || "بدون نام"}</div>
                        <div className="text-xs text-muted-foreground">اشتراک {c.number || `#${c.id}`}{c.nationalId && <> · کد ملی {c.nationalId}</>}</div>
                      </div>
                      <span className="hidden text-xs text-muted-foreground sm:block">{c.createdAt ? <DateText value={c.createdAt} relative /> : null}</span>
                      {c.status && <StatusBadge status={c.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {work.length > 0 && (
          <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", !can(P.CustomerRead) && "lg:col-span-3")}>
            <PanelHead icon={Gauge} title="توزیع بار کاری" desc="سهم هر نوع کار از صف شما" />
            <div className="space-y-4 p-5">
              {work.map((w) => {
                const n = totalOf(w.query) ?? 0;
                return (
                  <div key={w.title} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs"><span className="font-semibold text-muted-foreground">{w.title}</span><span className="font-black">{w.query.isPending ? "…" : faNum(n)}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", TONE[w.tone ?? "primary"].bar)} style={{ width: `${(n / maxWork) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
