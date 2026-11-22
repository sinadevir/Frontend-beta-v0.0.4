import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, Loader2, CalendarDays, ChevronUp, Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import { baseUrlOf } from "@/lib/api/config";
import logoUrl from "@/assets/abfa-logo.png";
import type { NavGroup } from "@/lib/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navFlat, navGroups } from "@/lib/nav";
import { toJalaliLong, faDigits } from "@/lib/jalali";
import { useSession } from "@/lib/api/session";
import { usePermissions } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";
import { LoadingGate } from "./section-loader";
import { useSectionBusy } from "@/lib/section-loader";

const PANEL_KEY = "cis.panel-collapsed";

/** The page the address points at, matched to the menu (longest path wins). */
function useCurrentNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = [...navFlat].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)));
  return { path, current };
}

/**
 * App frame: a narrow dark-blue strip of section icons on the right edge, next to it a light column
 * listing the chosen section's pages (with the account card at its foot), and the workspace with a
 * slim top bar for search.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { path, current } = useCurrentNav();
  const [cmd, setCmd] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const perms = usePermissions();
  const busy = useSectionBusy();
  const groups = navGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || perms.can(i.perm)) })).filter((g) => g.items.length);
  const currentGroup = current?.group ?? groups[0]?.label;
  const [shown, setShown] = useState(currentGroup);
  useEffect(() => { setShown(currentGroup); setMobile(false); }, [path, currentGroup]);
  useEffect(() => { setCollapsed(window.localStorage.getItem(PANEL_KEY) === "1"); }, []);
  const togglePanel = (v = !collapsed) => { setCollapsed(v); window.localStorage.setItem(PANEL_KEY, v ? "1" : "0"); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && (e.code === "KeyK" || ["k", "ن"].includes(e.key.toLowerCase()))) { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const group = groups.find((g) => g.label === shown) ?? groups[0];
  const pick = (label: string) => { setShown(label); if (collapsed) togglePanel(false); };

  const frame = (inSheet: boolean) => (
    <div className="flex h-full">
      <Rail groups={groups} shown={shown} current={currentGroup} onPick={pick} collapsed={!inSheet && collapsed} onToggle={inSheet ? undefined : () => togglePanel()} />
      <div className={cn("h-full overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", !inSheet && collapsed ? "w-0" : "w-[var(--panel-w)]")} aria-hidden={!inSheet && collapsed ? true : undefined}>
        {group && <SectionPanel group={group} activeTo={current?.to} busy={busy} />}
      </div>
    </div>
  );

  return (
    <div className="min-h-svh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:end-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">رفتن به محتوای اصلی</a>
      <aside aria-label="منوی سامانه" className="fixed inset-y-0 start-0 z-30 hidden lg:block print:hidden">{frame(false)}</aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="right" className="w-auto max-w-none gap-0 border-0 p-0 sm:max-w-none [&>button:last-child]:hidden">
          <SheetTitle className="sr-only">منوی سامانه</SheetTitle>
          {frame(true)}
        </SheetContent>
      </Sheet>
      <div className={cn("flex min-h-svh min-w-0 flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", collapsed ? "lg:ms-[var(--rail-w)]" : "lg:ms-[calc(var(--rail-w)+var(--panel-w))]", "print:!ms-0")}>
        <TopBar onMenu={() => setMobile(true)} onSearch={() => setCmd(true)} />
        <main id="main" dir="rtl" className="relative mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-10 pt-6 lg:px-8 lg:pt-7 print:max-w-none print:p-0"><LoadingGate trigger={path} className="min-h-[60vh]">{children}</LoadingGate></main>
      </div>
      <GlobalSearch open={cmd} onOpenChange={setCmd} />
    </div>
  );
}

/** Narrow dark strip: logo, one icon per section, and the button that folds the pages column. */
function Rail({ groups, shown, current, onPick, collapsed, onToggle }: { groups: NavGroup[]; shown?: string; current?: string; onPick: (label: string) => void; collapsed: boolean; onToggle?: () => void }) {
  return (
    <nav aria-label="بخش‌های سامانه" className="relative flex h-full w-[var(--rail-w)] flex-col items-center bg-sidebar py-4 text-sidebar-foreground">
      <Link to="/" aria-label="میز کار" className="grid size-12 place-items-center rounded-full bg-card ring-4 ring-sidebar-border transition-transform hover:scale-105">
        <img src={logoUrl} alt="نشان آب و فاضلاب" className="size-full rounded-full object-contain p-0.5" />
      </Link>
      <span aria-hidden className="my-4 h-px w-10 bg-sidebar-border" />
      <ul className="flex flex-1 flex-col items-center gap-1">
        {groups.map((g) => {
          const on = g.label === shown && !collapsed;
          const here = g.label === current;
          return (
            <li key={g.label} className="relative">
              {here && <span aria-hidden className="absolute -start-1.5 top-3 h-8 w-1 rounded-e-full bg-sidebar-primary" />}
              <button type="button" onClick={() => onPick(g.label)} aria-pressed={on} title={g.label}
                className="group flex w-[4.75rem] flex-col items-center gap-1 rounded-xl py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <span className={cn("grid size-10 place-items-center rounded-xl transition-all duration-200", on ? "bg-sidebar-active text-sidebar-active-foreground shadow-brand" : here ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground")}>
                  <g.icon className="size-5" aria-hidden />
                </span>
                <span className={cn("text-[0.6875rem] font-semibold leading-tight transition-colors", on || here ? "text-sidebar-accent-foreground" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground")}>{g.short}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {onToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onToggle} aria-label={collapsed ? "باز کردن ستون صفحه‌ها" : "جمع کردن ستون صفحه‌ها"} className="grid size-10 place-items-center rounded-xl text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              {collapsed ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{collapsed ? "باز کردن ستون صفحه‌ها" : "جمع کردن ستون صفحه‌ها"}</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}

/** Light column next to the strip: system name, the chosen section's pages, and the account card at the foot. */
function SectionPanel({ group, activeTo, busy }: { group: NavGroup; activeTo?: string; busy: boolean }) {
  const session = useSession();
  const perms = usePermissions();
  const displayName = session?.displayName ?? "کارشناس سامانه";
  const roleText = perms.roles.length ? perms.roles.join("، ") : session?.mode === "dev" ? "ورود حالت توسعه" : "کاربر سازمان";
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex h-full w-[var(--panel-w)] flex-col border-e border-panel-border bg-panel text-panel-foreground">
      <div className="px-5 pt-5">
        <div className="text-sm font-extrabold text-primary">سامانه امور مشترکین</div>
        <div className="text-xs text-muted-foreground">شرکت آب و فاضلاب</div>
      </div>
      <div key={group.label} className="panel-swap flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-3 pt-6">
          <h2 className="text-lg font-black leading-snug">{group.label}</h2>
          <p className="mt-0.5 text-xs leading-6 text-muted-foreground">{group.about}</p>
        </div>
        <ul className={cn("min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 transition-opacity", busy && "pointer-events-none opacity-70")}>
          {group.items.map((it) => {
            const on = it.to === activeTo;
            return (
              <li key={it.to}>
                <Link to={it.to} aria-current={on ? "page" : undefined} className={cn("group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", on ? "bg-panel-active" : "hover:bg-muted")}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-primary")}><it.icon className="size-4" aria-hidden /></span>
                  <span className="min-w-0 leading-tight">
                    <span className={cn("block truncate text-sm font-bold", on ? "text-panel-active-foreground" : "text-foreground")}>{it.title}</span>
                    {it.hint && <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">{it.hint}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-panel-border p-3">
        {perms.status === "loading" && <div className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />دریافت دسترسی‌ها…</div>}
        <AccountCard displayName={displayName} roleText={roleText} initials={initials} />
      </div>
    </div>
  );
}

/** Slim bar atop the workspace: menu button on small screens, the global search, and connection/tenant chips. */
function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const session = useSession();
  const [connected, setConnected] = useState(true);
  useEffect(() => { setConnected(Boolean(baseUrlOf("property") || baseUrlOf("foundation"))); }, []);
  return (
    <header className="sticky top-0 z-20 print:hidden border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 lg:px-8">
        <button type="button" onClick={onMenu} aria-label="باز کردن منو" className="grid size-10 place-items-center rounded-xl border border-border bg-card text-foreground lg:hidden"><Menu className="size-5" /></button>
        <button type="button" onClick={onSearch} aria-label="جستجو در سامانه" className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-sm text-muted-foreground shadow-card transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:max-w-md">
          <Search className="size-4 shrink-0 text-primary" /><span className="flex-1 truncate text-start">جستجوی مشترک، شخص، ملک یا صفحه…</span>
        </button>
        <div className="ms-auto flex items-center gap-2">
          {session && <Tooltip><TooltipTrigger asChild><span className="hidden h-8 items-center rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary md:inline-flex">سازمان {faDigits(session.tenantId)}</span></TooltipTrigger><TooltipContent>شناسه سازمان نشست فعلی</TooltipContent></Tooltip>}
        </div>
      </div>
    </header>
  );
}

/**
 * Account card at the foot of the pages column. A click unfolds the user's details above the card,
 * which pushes today's date up; a click anywhere else (or Escape) folds it back.
 */
function AccountCard({ displayName, roleText, initials }: { displayName: string; roleText: string; initials: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const connected = Boolean(baseUrlOf("property") || baseUrlOf("foundation"));
  const rows: [string, string][] = [
    ["نام", displayName],
    ...(session?.userName ? [["نام کاربری", session.userName] as [string, string]] : []),
    ["نقش", roleText],
    ...(session ? [["شناسه سازمان", faDigits(session.tenantId)] as [string, string], ["نوع ورود", session.mode === "dev" ? "حالت توسعه" : "ورود سازمانی"] as [string, string]] : []),
    ["وضعیت اتصال", connected ? "متصل به سرور" : "نسخه آزمایشی"],
  ];
  return (
    <div ref={box} className="flex flex-col">
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground">
        <CalendarDays className="size-3.5 shrink-0 text-primary" /><span className="truncate">{toJalaliLong(new Date())}</span>
      </div>
      {/* rows grow from 0fr to 1fr, so the panel opens smoothly and lifts the date with it */}
      <div id="account-details" aria-hidden={!open} className={`grid transition-[grid-template-rows,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "mt-2 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <dl className={`space-y-2 rounded-xl border border-border bg-background p-3 text-xs transition-[opacity,transform] duration-300 ${open ? "translate-y-0 opacity-100 delay-75" : "translate-y-3 opacity-0"}`}>
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="truncate font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <button type="button" aria-expanded={open} aria-controls="account-details" onClick={() => setOpen((v) => !v)}
        className={`mt-2 flex items-center gap-2.5 rounded-xl p-2 text-start transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${open ? "bg-panel-active ring-1 ring-primary/20" : "hover:bg-muted"}`}>
        <Avatar className="size-9"><AvatarFallback className="bg-brand text-xs font-bold text-primary-foreground">{initials}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-bold text-foreground">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{roleText}</span>
        </span>
        <ChevronUp aria-hidden className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}

/** Page title block: section name as a small eyebrow, title and description on the right, page actions on the left, a hairline below. */
export function PageHeader({ title, desc, code, actions, children }: { title: string; desc?: string; code?: string; actions?: ReactNode; children?: ReactNode }) {
  const { current } = useCurrentNav();
  return (
    <div className="rise-in mb-6 border-b border-border/80 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-primary">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-logo-blue-light" />
            {current?.group ?? "سامانه امور مشترکین"}
            {code && <span className="rounded-full border border-primary/15 bg-primary-soft px-2.5 py-0.5 font-semibold">{code}</span>}
          </div>
          <h1 className="text-2xl font-black leading-snug text-foreground md:text-[1.75rem]">{title}</h1>
          {desc && <p className="mt-1.5 max-w-3xl text-sm leading-7 text-muted-foreground">{desc}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
