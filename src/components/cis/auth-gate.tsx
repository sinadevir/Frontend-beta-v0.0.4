import { useEffect, useState, type ReactNode } from "react";
import logoUrl from "@/assets/abfa-logo.png";
import { PermissionProvider } from "@/lib/auth/permissions";
import { AppShell } from "./app-shell";

function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center" aria-busy="true">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="sl-stage" aria-hidden><span className="sl-ring" /><img src={logoUrl} alt="" className="sl-logo" /></span>
        <div>
          <div className="text-base font-extrabold text-foreground">سامانه امور مشترکین</div>
          <div className="mt-1 text-sm text-muted-foreground">در حال آماده‌سازی سامانه…</div>
        </div>
      </div>
    </div>
  );
}

/** No sign-in step for now: the workspace opens directly once the browser has hydrated. */
export function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <Splash />;
  return <PermissionProvider><AppShell>{children}</AppShell></PermissionProvider>;
}
