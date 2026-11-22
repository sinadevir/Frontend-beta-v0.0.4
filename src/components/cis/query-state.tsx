import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock, PlugZap, RefreshCw, SearchX, ServerCrash, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import { errorMessage, traceIdOf } from "@/lib/api/messages";
import { cn } from "@/lib/utils";

/** One consistent error block for every failed read: plain message, tracking code, retry. */
export function ErrorState({ error, onRetry, className, compact }: { error: unknown; onRetry?: () => void; className?: string; compact?: boolean }) {
  const e = isApiError(error) ? error : undefined;
  const Icon = e?.kind === "config" ? PlugZap : e?.kind === "network" ? WifiOff : e?.status === 403 ? Lock : e?.status === 404 ? SearchX : e && e.status >= 500 ? ServerCrash : AlertTriangle;
  const trace = traceIdOf(error);
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-destructive/30 bg-destructive-soft/40 p-6 text-center", compact && "p-4", className)}>
      <span className="grid size-12 place-items-center rounded-xl bg-destructive-soft text-destructive"><Icon className="size-6" aria-hidden /></span>
      <p className="max-w-lg text-sm">{errorMessage(error)}</p>
      {trace && <p className="text-xs text-muted-foreground">کد پیگیری: <span dir="ltr" className="font-mono">{trace}</span></p>}
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw />تلاش دوباره</Button>}
      </div>
    </div>
  );
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

/** Renders loading / error / content for a TanStack query result. */
export function QueryBoundary<T>({ query, children, loading, rows }: { query: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown }; children: (data: T) => ReactNode; loading?: ReactNode; rows?: number }) {
  if (query.isPending) return <>{loading ?? <LoadingBlock rows={rows} />}</>;
  if (query.error || query.data === undefined) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}

export function ForbiddenState({ title = "دسترسی به این بخش برای شما تعریف نشده است" }: { title?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-warning-soft text-warning-foreground"><Lock className="size-8" aria-hidden /></span>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">اگر برای انجام وظایف خود به این بخش نیاز دارید، از مدیر سامانه بخواهید نقش مناسب را به شما بدهد.</p>
      <Button asChild variant="outline"><Link to="/">بازگشت به میز کار</Link></Button>
    </div>
  );
}
