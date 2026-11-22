import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/jalali";
import { DateText } from "./date-text";
import { StatusBadge } from "./status-badge";

export function InfoList({ items, cols = 1 }: { items: [string, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-sm", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map(([k, v]) => <div key={k} className="grid grid-cols-[minmax(6.5rem,40%)_1fr] items-baseline gap-3 rounded-lg border-b border-border/60 px-1 pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-start font-medium">{v}</dd></div>)}
    </dl>
  );
}

export function StatCard({ title, value, icon: Icon, hint, highlight }: { title: string; value: number | string; icon?: LucideIcon; hint?: string; highlight?: boolean }) {
  return (
    <Card className={cn("relative overflow-hidden", highlight && "border-transparent bg-primary text-primary-foreground shadow-brand")}>
      <span aria-hidden className={cn("absolute inset-y-0 start-0 w-1", highlight ? "bg-logo-blue-light" : "bg-primary/15")} />
      <CardContent className="flex items-start justify-between gap-3 p-4 ps-5">
        <div className="min-w-0"><div className={cn("text-xs font-semibold", highlight ? "opacity-85" : "text-muted-foreground")}>{title}</div><div className="mt-1.5 text-2xl font-black leading-none">{typeof value === "number" ? faNum(value) : value}</div>{hint && <div className={cn("mt-1.5 text-xs", highlight ? "opacity-75" : "text-muted-foreground")}>{hint}</div>}</div>
        {Icon && <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", highlight ? "bg-sidebar-accent" : "bg-primary-soft text-primary")}><Icon className="size-4" /></span>}
      </CardContent>
    </Card>
  );
}

export type TimelineItem = { date: string; title: string; by?: string; status?: string; note?: string | undefined };
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ms-1.5 border-s ps-6">
      {items.map((t, i) => (
        <li key={i} className="relative mb-5 last:mb-0">
          <span className="absolute -start-[1.95rem] top-1.5 size-3.5 rounded-full border-[3px] border-card bg-logo-blue-light ring-2 ring-primary/20" />
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.title}</span>{t.status && <StatusBadge status={t.status} />}</div>
          <div className="text-xs text-muted-foreground"><DateText value={t.date} relative />{t.by && ` · ${t.by}`}</div>
          {t.note && <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export { TreeView, TreeSkeleton, findNode, pathTo, type TreeNode } from "./tree-view";

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground"><span className="mb-1 grid size-14 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-6" /></span><div className="font-medium text-foreground">{title}</div>{children}</div>;
}

export function SharesBar({ parts }: { parts: { label: string; value: number }[] }) {
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">{parts.map((p, i) => <div key={p.label} className={colors[i % 5]} style={{ width: `${p.value}%` }} />)}</div>
      <div className="flex flex-wrap gap-3 text-xs">{parts.map((p, i) => <span key={p.label} className="flex items-center gap-1"><span className={cn("size-2.5 rounded-sm", colors[i % 5])} />{p.label} {faNum(p.value)}٪</span>)}</div>
    </div>
  );
}
