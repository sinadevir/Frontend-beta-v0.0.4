import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, CalendarCheck2, Cable, Clock4, FileEdit, Handshake, History, IdCard, Inbox, Building2, Droplets, Tags, Users, ShieldCheck, UserCog } from "lucide-react";
import type { Column } from "@/components/cis/data-table";
import { StatusBadge } from "@/components/cis/status-badge";
import { DateText } from "@/components/cis/date-text";
import { P, type PermissionCode } from "@/lib/auth/permission-codes";
import { statusLabel } from "@/lib/status";
import { addDays, faNum, toDateOnly, toJalali } from "@/lib/jalali";
import { CASE_STATUS, TRANSITIONS, mapChangeRequest, mapLifecycleCase, transitionLabel, type ChangeRequest, type LifecycleCase } from "@/features/lifecycle/api";
import { CUSTOMER_STATUS, mapCustomer, type Customer } from "@/features/customers/api";
import { mapParty, type Party } from "@/features/parties/api";
import { mapPremises, type Premises } from "@/features/premises/api";
import { mapConflict, type Conflict } from "@/features/ownership/api";
import { mapMismatch, type Mismatch } from "@/features/usage/api";
import { mapDispute, type Dispute } from "@/features/relationships/api";
import { mapAudit, mapMessage, type AuditEntry, type Message } from "@/features/foundation/operations";
import { mapUser, type User } from "@/features/foundation/access";
import { AGE_BUCKETS, ageBucket, ageDays, daysText, fetchAllPages, fetchList, mean, type FetchCtx, type Fetched, type TimeUnit } from "./engine";

/** Parameters the user sets in «پارامترهای گزارش». Dates are local calendar days. */
export type RunParams = { from?: Date | undefined; to?: Date | undefined; status?: string | undefined; extra?: string | undefined; groupBy: string };
export type Option = { value: string; label: string };
export type Grouping<R> = { key: string; label: string; of?: (r: R) => string; text?: (k: string) => string; order?: string[]; time?: TimeUnit };
export type Metric = { label: string; value: string; hint?: string };

export type ReportDef<R> = {
  id: string; category: string; title: string; desc: string; icon: LucideIcon; perm?: PermissionCode | PermissionCode[];
  /** Where the numbers come from, in plain words. */
  source: string;
  /** Date the range filters on and timelines use. `server` = also sent to the endpoint as from/to. */
  date?: { label: string; of: (r: R) => string; server?: boolean };
  /** Days back the date range starts at by default (none = all time). */
  defaultDays?: number;
  status?: { label: string; options: Option[] };
  extra?: { label: string; options: Option[] };
  groupings: Grouping<R>[];
  fetch: (p: RunParams, ctx: FetchCtx) => Promise<Fetched<R>>;
  columns: Column<R>[];
  rowKey: (r: R) => string | number;
  metrics?: (rows: R[], p: RunParams) => Metric[];
  /** Report that tracks the system's main goal (service requests reaching «done»). */
  goal?: boolean;
};
const define = <R,>(d: ReportDef<R>) => d as unknown as ReportDef<unknown>;

export const CATEGORIES: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "requests", title: "درخواست‌های خدماتی", icon: Inbox },
  { id: "customers", title: "مشترکین و اشخاص", icon: Users },
  { id: "premises", title: "املاک", icon: Building2 },
  { id: "admin", title: "راهبری سامانه", icon: ShieldCheck },
];

/* ───────── shared cells ───────── */
const dateCol = <R,>(key: string, header: string, of: (r: R) => string): Column<R> => ({ key, header, cell: (r) => <DateText value={of(r)} />, value: (r) => toJalali(of(r)) });
const statusCol = <R,>(of: (r: R) => string, header = "وضعیت"): Column<R> => ({ key: "status", header, cell: (r) => <StatusBadge status={of(r)} />, value: (r) => statusLabel(of(r)) });
const codeCol = <R,>(key: string, header: string, of: (r: R) => string | number): Column<R> => ({ key, header, cell: (r) => <span className="font-mono text-primary">{of(r) || "—"}</span>, value: (r) => String(of(r) || "") });

/** Server date params: `to` is sent one day later so a server that compares with midnight still includes the last day; rows are trimmed to the exact range afterwards. */
const range = (p: RunParams, on: boolean) => (on ? { from: p.from ? toDateOnly(p.from) : undefined, to: p.to ? toDateOnly(addDays(p.to, 1)) : undefined } : {});
const caseDone = (c: LifecycleCase) => c.executedAt || c.effectiveAt || "";
const OPEN = ["Draft", "Submitted", "UnderReview", "Approved", "AwaitingExecution", "Failed"];
const caseStatusOrder = CASE_STATUS.map((s) => s.value);

export const REPORTS: ReportDef<unknown>[] = [
  /* ═════ درخواست‌های خدماتی ═════ */
  define<LifecycleCase>({
    id: "completed-trend", category: "requests", goal: true, icon: CalendarCheck2, perm: [P.HistoryRead, P.LifecycleReview, P.LifecycleApprove, P.LifecycleExecute, P.LifecycleRequest],
    title: "روند انجام درخواست‌ها", desc: "درخواست‌های تغییر وضعیت مشترک که به «اجراشده» رسیده‌اند، هفته به هفته، با مدت انجام هر کدام",
    source: "پرونده‌های تغییر وضعیت مشترک با وضعیت «اجراشده»",
    date: { label: "تاریخ اجرا", of: caseDone }, defaultDays: 90,
    extra: { label: "نوع تغییر", options: TRANSITIONS },
    groupings: [
      { key: "week", label: "به تفکیک هفته", time: "week" }, { key: "month", label: "به تفکیک ماه", time: "month" },
      { key: "type", label: "به تفکیک نوع تغییر", of: (r) => r.transitionType, text: transitionLabel },
      { key: "speed", label: "به تفکیک مدت انجام", of: (r) => { const d = ageDays(r.requestedAt, caseDone(r)); return d === undefined ? "" : ageBucket(d); }, order: [...AGE_BUCKETS] },
    ],
    fetch: (p, ctx) => fetchAllPages("property", "/api/v1/customer-lifecycle-cases", { status: "Completed", transitionType: p.extra }, mapLifecycleCase, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره پرونده", (r) => r.number || `#${r.id}`),
      { key: "transitionType", header: "نوع تغییر", value: (r) => transitionLabel(r.transitionType) },
      codeCol("customerId", "مشترک", (r) => r.customerId),
      dateCol("requestedAt", "تاریخ درخواست", (r) => r.requestedAt),
      dateCol("executedAt", "تاریخ اجرا", caseDone),
      { key: "days", header: "مدت انجام", value: (r) => daysText(ageDays(r.requestedAt, caseDone(r))) },
    ],
    metrics: (rows, p) => {
      const days = rows.map((r) => ageDays(r.requestedAt, caseDone(r)));
      const weeks = p.from ? Math.max(1, Math.ceil(((p.to ?? new Date()).getTime() - p.from.getTime()) / (7 * 86_400_000))) : undefined;
      return [
        { label: "میانگین مدت انجام", value: daysText(mean(days)), hint: "از ثبت درخواست تا اجرا" },
        { label: "میانگین در هفته", value: weeks ? faNum(Math.round((rows.length / weeks) * 10) / 10) : "—", hint: weeks ? `در ${faNum(weeks)} هفته بازه` : "برای این عدد بازه تاریخ را تعیین کنید" },
        { label: "انجام‌شده در یک هفته", value: rows.length ? `${faNum(Math.round((days.filter((d) => d !== undefined && d <= 7).length / rows.length) * 100))}٪` : "—", hint: "سهم درخواست‌هایی که تا ۷ روز اجرا شدند" },
      ];
    },
  }),
  define<LifecycleCase>({
    id: "lifecycle", category: "requests", icon: Activity, perm: [P.HistoryRead, P.LifecycleReview, P.LifecycleApprove, P.LifecycleExecute, P.LifecycleRequest],
    title: "درخواست‌های تغییر وضعیت مشترک", desc: "همه درخواست‌های فعال‌سازی، تعلیق، رفع تعلیق، بستن و بازگشایی اشتراک",
    source: "پرونده‌های تغییر وضعیت مشترک",
    date: { label: "تاریخ درخواست", of: (r) => r.requestedAt, server: true }, defaultDays: 30,
    status: { label: "وضعیت درخواست", options: CASE_STATUS }, extra: { label: "نوع تغییر", options: TRANSITIONS },
    groupings: [
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "type", label: "به تفکیک نوع تغییر", of: (r) => r.transitionType, text: transitionLabel },
      { key: "week", label: "به تفکیک هفته", time: "week" }, { key: "month", label: "به تفکیک ماه", time: "month" },
    ],
    fetch: (p, ctx) => fetchAllPages("property", "/api/v1/customer-lifecycle-cases", { status: p.status, transitionType: p.extra, ...range(p, true) }, mapLifecycleCase, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره پرونده", (r) => r.number || `#${r.id}`),
      { key: "transitionType", header: "نوع تغییر", value: (r) => transitionLabel(r.transitionType) },
      codeCol("customerId", "مشترک", (r) => r.customerId),
      { key: "reason", header: "دلیل", className: "max-w-64 truncate" },
      dateCol("requestedAt", "تاریخ درخواست", (r) => r.requestedAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => {
      const done = rows.filter((r) => /completed|executed/i.test(r.status)).length;
      const stopped = rows.filter((r) => /rejected|cancel/i.test(r.status)).length;
      const pct = (n: number) => (rows.length ? `${faNum(Math.round((n / rows.length) * 100))}٪` : "—");
      return [
        { label: "اجراشده", value: faNum(done), hint: `${pct(done)} از درخواست‌ها` },
        { label: "ردشده یا لغوشده", value: faNum(stopped), hint: `${pct(stopped)} از درخواست‌ها` },
        { label: "اجرای ناموفق", value: faNum(rows.filter((r) => /failed/i.test(r.status)).length) },
      ];
    },
  }),
  define<LifecycleCase>({
    id: "backlog", category: "requests", icon: Clock4, perm: [P.HistoryRead, P.LifecycleReview, P.LifecycleApprove, P.LifecycleExecute, P.LifecycleRequest],
    title: "درخواست‌های باز و مدت انتظار", desc: "درخواست‌هایی که هنوز به پایان نرسیده‌اند و چند روز است در صف مانده‌اند",
    source: "پرونده‌های تغییر وضعیت در وضعیت‌های پیش‌نویس، ارسال‌شده، در حال بررسی، تأییدشده، در انتظار اجرا و ناموفق",
    date: { label: "تاریخ درخواست", of: (r) => r.requestedAt },
    extra: { label: "نوع تغییر", options: TRANSITIONS },
    groupings: [
      { key: "age", label: "به تفکیک مدت انتظار", of: (r) => { const d = ageDays(r.requestedAt); return d === undefined ? "" : ageBucket(d); }, order: [...AGE_BUCKETS] },
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel, order: caseStatusOrder },
      { key: "type", label: "به تفکیک نوع تغییر", of: (r) => r.transitionType, text: transitionLabel },
    ],
    fetch: async (p, ctx) => {
      const out: Fetched<LifecycleCase> = { rows: [], total: 0, truncated: false };
      for (const status of OPEN) {
        const base = out.rows.length;
        const part = await fetchAllPages("property", "/api/v1/customer-lifecycle-cases", { status, transitionType: p.extra }, mapLifecycleCase, { ...ctx, onProgress: (n, t) => ctx.onProgress?.(base + n, out.total + t) });
        out.rows.push(...part.rows); out.total += part.total; out.truncated ||= part.truncated;
      }
      return out;
    },
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره پرونده", (r) => r.number || `#${r.id}`),
      { key: "transitionType", header: "نوع تغییر", value: (r) => transitionLabel(r.transitionType) },
      codeCol("customerId", "مشترک", (r) => r.customerId),
      dateCol("requestedAt", "تاریخ درخواست", (r) => r.requestedAt),
      { key: "wait", header: "مدت انتظار", value: (r) => daysText(ageDays(r.requestedAt)) },
      statusCol((r) => r.status),
    ],
    metrics: (rows) => {
      const days = rows.map((r) => ageDays(r.requestedAt));
      const known = days.filter((d): d is number => d !== undefined);
      return [
        { label: "میانگین انتظار", value: daysText(mean(days)) },
        { label: "قدیمی‌ترین درخواست", value: known.length ? daysText(Math.max(...known)) : "—", hint: "در صف" },
        { label: "بیش از ۳۰ روز", value: faNum(known.filter((d) => d > 30).length), hint: "نیازمند پیگیری" },
      ];
    },
  }),
  define<ChangeRequest>({
    id: "changes", category: "requests", icon: FileEdit, perm: [P.ChangeRead, P.ChangeApprove, P.ChangeRequest],
    title: "درخواست‌های تغییر اطلاعات", desc: "درخواست‌های اصلاح اطلاعات مشترکین و تعداد اقلام هر درخواست",
    source: "درخواست‌های تغییر اطلاعات مشترک",
    date: { label: "تاریخ درخواست", of: (r) => r.requestedAt, server: true }, defaultDays: 30,
    status: { label: "وضعیت درخواست", options: CASE_STATUS },
    groupings: [
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "week", label: "به تفکیک هفته", time: "week" }, { key: "month", label: "به تفکیک ماه", time: "month" },
    ],
    fetch: (p, ctx) => fetchAllPages("property", "/api/v1/customer-information-change-requests", { status: p.status, ...range(p, true) }, mapChangeRequest, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره درخواست", (r) => r.number || `#${r.id}`),
      codeCol("customerId", "مشترک", (r) => r.customerId),
      { key: "reason", header: "موضوع", className: "max-w-64 truncate" },
      { key: "items", header: "اقلام", value: (r) => faNum(r.items.length) },
      dateCol("requestedAt", "تاریخ درخواست", (r) => r.requestedAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [
      { label: "مجموع اقلام تغییر", value: faNum(rows.reduce((n, r) => n + r.items.length, 0)) },
      { label: "اجراشده", value: faNum(rows.filter((r) => /completed|executed/i.test(r.status)).length) },
      { label: "میانگین مدت انجام", value: daysText(mean(rows.filter((r) => r.completedAt).map((r) => ageDays(r.requestedAt, r.completedAt)))), hint: "درخواست‌های پایان‌یافته" },
    ],
  }),

  /* ═════ مشترکین و اشخاص ═════ */
  define<Customer>({
    id: "customers", category: "customers", icon: Droplets, perm: P.CustomerRead,
    title: "وضعیت مشترکین", desc: "تعداد مشترکین به تفکیک وضعیت اشتراک و ماه ثبت",
    source: "پرونده مشترکین",
    date: { label: "تاریخ ثبت", of: (r) => r.createdAt },
    status: { label: "وضعیت اشتراک", options: CUSTOMER_STATUS },
    groupings: [
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "month", label: "به تفکیک ماه ثبت", time: "month" },
    ],
    fetch: (p, ctx) => fetchAllPages("property", "/api/v1/customers", { Status: p.status }, mapCustomer, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره اشتراک", (r) => r.number),
      { key: "principalName", header: "مشترک اصلی" },
      { key: "nationalId", header: "کد ملی", cell: (r) => <span className="font-mono">{r.nationalId || "—"}</span>, value: (r) => r.nationalId },
      dateCol("createdAt", "تاریخ ثبت", (r) => r.createdAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [
      { label: "فعال", value: faNum(rows.filter((r) => /^active$/i.test(r.status)).length) },
      { label: "معلق", value: faNum(rows.filter((r) => /suspend/i.test(r.status)).length) },
      { label: "ادغام‌شده", value: faNum(rows.filter((r) => /merged/i.test(r.status) || r.mergedInto).length) },
    ],
  }),
  define<Party>({
    id: "parties", category: "customers", icon: IdCard, perm: P.PartyRead,
    title: "اشخاص حقیقی و حقوقی", desc: "اشخاص ثبت‌شده به تفکیک نوع، وضعیت و ماه ثبت",
    source: "پرونده اشخاص",
    date: { label: "تاریخ ثبت", of: (r) => r.createdAt },
    groupings: [
      { key: "kind", label: "به تفکیک نوع شخص", of: (r) => (r.isOrganization ? "حقوقی" : "حقیقی") },
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "month", label: "به تفکیک ماه ثبت", time: "month" },
    ],
    fetch: (_p, ctx) => fetchAllPages("property", "/api/v1/parties", {}, mapParty, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("code", "کد شخص", (r) => r.code || `#${r.id}`),
      { key: "name", header: "نام" },
      { key: "kind", header: "نوع", value: (r) => (r.isOrganization ? "حقوقی" : "حقیقی") },
      { key: "nationalId", header: "شناسه/کد ملی", cell: (r) => <span className="font-mono">{r.nationalId || "—"}</span>, value: (r) => r.nationalId },
      dateCol("createdAt", "تاریخ ثبت", (r) => r.createdAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [
      { label: "حقیقی", value: faNum(rows.filter((r) => !r.isOrganization).length) },
      { label: "حقوقی", value: faNum(rows.filter((r) => r.isOrganization).length) },
      { label: "بدون کد ملی", value: faNum(rows.filter((r) => !r.nationalId).length), hint: "نیازمند تکمیل" },
    ],
  }),

  /* ═════ املاک ═════ */
  define<Premises>({
    id: "premises", category: "premises", icon: Building2, perm: P.PremisesRead,
    title: "وضعیت پرونده املاک", desc: "املاک ثبت‌شده به تفکیک وضعیت و ماه ثبت، با کامل‌بودن نشانی و کد پستی",
    source: "پرونده املاک",
    date: { label: "تاریخ ثبت", of: (r) => r.createdAt },
    groupings: [
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "postal", label: "به تفکیک کد پستی", of: (r) => (r.postalCode ? "دارای کد پستی" : "بدون کد پستی") },
      { key: "month", label: "به تفکیک ماه ثبت", time: "month" },
    ],
    fetch: (_p, ctx) => fetchAllPages("property", "/api/v1/premises", {}, mapPremises, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("code", "کد ملک", (r) => r.code || `#${r.id}`),
      { key: "name", header: "عنوان" },
      { key: "address", header: "نشانی", className: "max-w-72 truncate" },
      { key: "postalCode", header: "کد پستی", cell: (r) => <span className="font-mono">{r.postalCode || "—"}</span>, value: (r) => r.postalCode },
      dateCol("createdAt", "تاریخ ثبت", (r) => r.createdAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [
      { label: "بدون کد پستی", value: faNum(rows.filter((r) => !r.postalCode).length) },
      { label: "بدون نشانی", value: faNum(rows.filter((r) => !r.address).length) },
    ],
  }),
  define<Conflict>({
    id: "conflicts", category: "premises", icon: AlertTriangle, perm: P.OwnershipRead,
    title: "تعارض‌های تصرف", desc: "املاکی که بیش از یک متصرف هم‌زمان یا تصرف ناسازگار دارند",
    source: "تعارض‌های تصرف ثبت‌شده در سامانه",
    date: { label: "تاریخ شناسایی", of: (r) => r.detectedAt },
    groupings: [
      { key: "type", label: "به تفکیک نوع تعارض", of: (r) => r.type },
      { key: "premises", label: "به تفکیک ملک", of: (r) => r.premisesCode || (r.premisesId ? `#${r.premisesId}` : "") },
    ],
    fetch: (_p, ctx) => fetchAllPages("property", "/api/v1/occupancy-conflicts", {}, mapConflict, ctx),
    rowKey: (r) => r.key,
    columns: [
      codeCol("premisesCode", "ملک", (r) => r.premisesCode || `#${r.premisesId}`),
      { key: "type", header: "نوع تعارض" },
      { key: "parties", header: "اشخاص", className: "max-w-64 truncate" },
      { key: "description", header: "شرح", className: "max-w-72 truncate" },
      dateCol("detectedAt", "تاریخ شناسایی", (r) => r.detectedAt),
    ],
    metrics: (rows) => [{ label: "املاک درگیر", value: faNum(new Set(rows.map((r) => r.premisesId || r.premisesCode)).size) }],
  }),
  define<Mismatch>({
    id: "mismatches", category: "premises", icon: Tags, perm: P.UsageRead,
    title: "ناسازگاری کاربری", desc: "بخش‌هایی که کاربری قانونی با کاربری اظهارشده یا فعالیت مشاهده‌شده یکی نیست",
    source: "ناسازگاری‌های کاربری شناسایی‌شده",
    date: { label: "تاریخ شناسایی", of: (r) => r.detectedAt },
    groupings: [
      { key: "legal", label: "به تفکیک کاربری قانونی", of: (r) => r.legal },
      { key: "declared", label: "به تفکیک کاربری اظهارشده", of: (r) => r.declared },
      { key: "month", label: "به تفکیک ماه شناسایی", time: "month" },
    ],
    fetch: (_p, ctx) => fetchAllPages("property", "/api/v1/usage-mismatches", {}, mapMismatch, ctx),
    rowKey: (r) => r.key,
    columns: [
      codeCol("premisesId", "ملک", (r) => `#${r.premisesId}`),
      codeCol("segmentCode", "بخش", (r) => r.segmentCode || `#${r.segmentId}`),
      { key: "legal", header: "کاربری قانونی" },
      { key: "declared", header: "کاربری اظهارشده" },
      { key: "observed", header: "فعالیت مشاهده‌شده" },
      dateCol("detectedAt", "تاریخ شناسایی", (r) => r.detectedAt),
    ],
    metrics: (rows) => [{ label: "املاک درگیر", value: faNum(new Set(rows.map((r) => r.premisesId)).size) }],
  }),
  define<Dispute>({
    id: "disputes", category: "premises", icon: Handshake, perm: P.RelationshipRead,
    title: "اختلاف‌های روابط و اختیارات", desc: "اختلاف‌های ثبت‌شده درباره وکالت، نمایندگی و روابط اشخاص با ملک و مشترک",
    source: "اختلاف‌های روابط",
    date: { label: "تاریخ ثبت اختلاف", of: (r) => r.openedAt },
    groupings: [
      { key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel },
      { key: "type", label: "به تفکیک نوع", of: (r) => r.type },
      { key: "month", label: "به تفکیک ماه", time: "month" },
    ],
    fetch: (_p, ctx) => fetchAllPages("property", "/api/v1/relationship-disputes", {}, mapDispute, ctx),
    rowKey: (r) => r.id,
    columns: [
      codeCol("number", "شماره", (r) => r.number || `#${r.id}`),
      { key: "type", header: "نوع" },
      { key: "description", header: "شرح", className: "max-w-72 truncate" },
      dateCol("openedAt", "تاریخ ثبت", (r) => r.openedAt),
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [
      { label: "باز", value: faNum(rows.filter((r) => /open|pending|review/i.test(r.status)).length) },
      { label: "حل‌شده", value: faNum(rows.filter((r) => /resolved|closed/i.test(r.status)).length) },
    ],
  }),

  /* ═════ راهبری سامانه ═════ */
  define<AuditEntry>({
    id: "audit", category: "admin", icon: History, perm: P.AuditRead,
    title: "فعالیت کاربران", desc: "تغییرات ثبت‌شده در سامانه به تفکیک بخش، نوع عملیات و کاربر",
    source: "ردگیری تغییرات (ممیزی)",
    date: { label: "تاریخ تغییر", of: (r) => r.at, server: true }, defaultDays: 7,
    groupings: [
      { key: "module", label: "به تفکیک بخش", of: (r) => r.module },
      { key: "action", label: "به تفکیک عملیات", of: (r) => r.action },
      { key: "actor", label: "به تفکیک کاربر", of: (r) => r.actor },
      { key: "week", label: "به تفکیک هفته", time: "week" },
    ],
    fetch: (p, ctx) => fetchAllPages("foundation", "/api/v1/audit/entries", range(p, true), mapAudit, ctx),
    rowKey: (r) => r.id,
    columns: [
      { key: "at", header: "زمان", cell: (r) => <DateText value={r.at} time />, value: (r) => toJalali(r.at) },
      { key: "module", header: "بخش" }, { key: "entityType", header: "موضوع" }, { key: "action", header: "عملیات" }, { key: "actor", header: "کاربر" },
    ],
    metrics: (rows) => [
      { label: "کاربران فعال", value: faNum(new Set(rows.map((r) => r.actor).filter(Boolean)).size), hint: "که در بازه تغییری ثبت کرده‌اند" },
      { label: "بخش‌های درگیر", value: faNum(new Set(rows.map((r) => r.module).filter(Boolean)).size) },
    ],
  }),
  define<User>({
    id: "users", category: "admin", icon: UserCog, perm: P.AccessManage,
    title: "کاربران سامانه", desc: "کارکنانی که به سامانه دسترسی دارند، به تفکیک وضعیت",
    source: "کاربران و نقش‌ها",
    groupings: [{ key: "status", label: "به تفکیک وضعیت", of: (r) => r.status, text: statusLabel }],
    fetch: (_p, ctx) => fetchAllPages("foundation", "/api/v1/access/users", {}, mapUser, ctx),
    rowKey: (r) => r.id,
    columns: [
      { key: "userName", header: "نام کاربری", cell: (r) => <span className="font-mono">{r.userName || "—"}</span>, value: (r) => r.userName },
      { key: "displayName", header: "نام" }, { key: "email", header: "ایمیل" }, { key: "mobile", header: "تلفن همراه" },
      statusCol((r) => r.status),
    ],
    metrics: (rows) => [{ label: "فعال", value: faNum(rows.filter((r) => /^active$/i.test(r.status)).length) }],
  }),
  define<Message>({
    id: "dead-letter", category: "admin", icon: Cable, perm: P.IntegrationMonitor,
    title: "پیام‌های ناموفق یکپارچه‌سازی", desc: "پیام‌هایی که میان سامانه‌ها ارسال نشدند و به رسیدگی نیاز دارند",
    source: "صف پیام‌های ناموفق اطلاعات پایه",
    date: { label: "تاریخ پیام", of: (r) => r.occurredAt },
    groupings: [
      { key: "type", label: "به تفکیک نوع پیام", of: (r) => r.type },
      { key: "source", label: "به تفکیک مبدأ", of: (r) => r.source },
      { key: "week", label: "به تفکیک هفته", time: "week" },
    ],
    fetch: (_p, ctx) => fetchList("foundation", "/api/v1/integration/outbox/dead-letter", undefined, mapMessage, ctx),
    rowKey: (r) => r.id,
    columns: [
      { key: "type", header: "نوع پیام" }, { key: "source", header: "مبدأ" },
      dateCol("occurredAt", "زمان", (r) => r.occurredAt),
      { key: "attempts", header: "تلاش‌ها", value: (r) => faNum(r.attempts ?? 0) },
      { key: "error", header: "خطا", className: "max-w-72 truncate" },
    ],
    metrics: (rows) => [{ label: "میانگین تلاش", value: faNum(Math.round((mean(rows.map((r) => r.attempts)) ?? 0) * 10) / 10) }],
  }),
];

export const reportById = (id: string | undefined) => REPORTS.find((r) => r.id === id);
