import type { ReactNode } from "react";
import logoUrl from "@/assets/abfa-logo.png";
import { useLoadingWindow } from "@/lib/section-loader";
import { cn } from "@/lib/utils";

/** Classic in-page loader: just the organization logo with a thin ring turning tightly around it (no box, no caption). */
export function SectionLoader({ className, small }: { className?: string; small?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("flex min-h-[18rem] items-center justify-center", small && "sl-sm", className)}>
      <span className="sl-stage" aria-hidden>
        <span className="sl-ring" />
        <img src={logoUrl} alt="" draggable={false} className="sl-logo" />
      </span>
      <span className="sr-only">در حال بارگذاری</span>
    </div>
  );
}

/**
 * Shows the loader in place of its content while a page area changes (route, tab, wizard step), then reveals the content.
 * Children stay mounted (hidden) during loading so their data requests run in the background.
 */
export function LoadingGate({ trigger, loadOnMount, className, children }: { trigger: unknown; loadOnMount?: boolean; className?: string; children: ReactNode }) {
  const loading = useLoadingWindow(trigger, loadOnMount);
  return (
    <>
      {loading && <SectionLoader className={className} />}
      <div hidden={loading} className={loading ? undefined : "sl-content"}>{children}</div>
    </>
  );
}
