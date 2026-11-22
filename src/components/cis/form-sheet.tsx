import { useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AlertCircle, Check, FilePlus2, Loader2, X, type LucideIcon } from "lucide-react";
import * as D from "@radix-ui/react-dialog";
import { navFlat } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JalaliDatePicker } from "./jalali-date-picker";
import { Badge } from "@/components/ui/badge";
import { EntityPicker, RefCodeSelect } from "./entity-picker";
import type { EntityKind } from "@/features/pickers";
import type { FormValue, FormValues } from "@/lib/form-values";
import { checkRule, type Rule } from "@/lib/validation";
import { errorMessage, fieldErrors } from "@/lib/api/messages";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/jalali";
import { toast } from "sonner";

export type Option = string | { value: string; label: string };
export type Field = {
  name: string; label: string;
  type?: "text" | "number" | "select" | "date" | "textarea" | "switch" | "entity" | "ref";
  options?: Option[]; entity?: EntityKind; entityLabel?: string; refGroup?: string; numeric?: boolean;
  required?: boolean; ltr?: boolean; full?: boolean; placeholder?: string; hint?: string;
  rule?: Rule; validate?: (v: FormValue, all: FormValues) => string | undefined; show?: (all: FormValues) => boolean; section?: string;
};
const optVal = (o: Option) => (typeof o === "string" ? o : o.value);
const optLabel = (o: Option) => (typeof o === "string" ? o : o.label);
const empty = (v: FormValue) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export function FieldsGrid({ fields, values, setValues, errors }: { fields: Field[]; values: FormValues; setValues: (v: FormValues) => void; errors?: Record<string, string> }) {
  const set = (n: string, v: FormValue) => setValues({ ...values, [n]: v });
  const visible = fields.filter((f) => !f.show || f.show(values));
  const renderField = (f: Field) => {
    const id = `f-${f.name}`;
    const err = errors?.[f.name];
    const describedBy = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
    return (
      <div key={f.name} className={cn("group/field space-y-2", (f.full || f.type === "textarea") && "sm:col-span-2")}>
        <Label htmlFor={id} className="flex items-center gap-1 text-[0.8rem] font-bold text-foreground/80 transition-colors group-focus-within/field:text-primary">{f.label}{f.required && <span className="text-destructive" aria-hidden>*</span>}</Label>
        {f.type === "select" ? (
          <Select value={(values[f.name] as string) ?? ""} onValueChange={(v) => set(f.name, v)}>
            <SelectTrigger id={id} aria-invalid={Boolean(err)} aria-describedby={describedBy}><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
            <SelectContent>{f.options?.map((o) => <SelectItem key={optVal(o)} value={optVal(o)}>{optLabel(o)}</SelectItem>)}</SelectContent>
          </Select>
        ) : f.type === "date" ? (
          <JalaliDatePicker id={id} value={values[f.name] as Date | undefined} onChange={(d) => set(f.name, d)} onClear={f.required ? undefined : () => set(f.name, undefined)} invalid={Boolean(err)} aria-describedby={describedBy} placeholder={f.placeholder ?? "انتخاب تاریخ"} />
        ) : f.type === "entity" && f.entity ? (
          <EntityPicker id={id} kind={f.entity} value={values[f.name] as string | undefined} label={f.entityLabel} invalid={Boolean(err)} onChange={(v) => set(f.name, v)} />
        ) : f.type === "ref" && f.refGroup ? (
          <RefCodeSelect id={id} group={f.refGroup} numeric={f.numeric} value={values[f.name] as string | undefined} invalid={Boolean(err)} onChange={(v) => set(f.name, v)} />
        ) : f.type === "textarea" ? (
          <Textarea id={id} value={(values[f.name] as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} aria-invalid={Boolean(err)} aria-describedby={describedBy} />
        ) : f.type === "switch" ? (
          <div className="flex h-9 items-center"><Switch id={id} checked={!!values[f.name]} onCheckedChange={(v) => set(f.name, v)} /></div>
        ) : (
          <Input id={id} inputMode={f.type === "number" || f.rule === "nationalId" || f.rule === "mobile" || f.rule === "postalCode" ? "numeric" : undefined}
            dir="rtl" value={(values[f.name] as string) ?? ""} onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder} aria-invalid={Boolean(err)} aria-describedby={describedBy} className={cn(err && "border-destructive")} />
        )}
        {err ? <p id={`${id}-err`} className="text-xs text-destructive">{err}</p> : f.hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{f.hint}</p>}
      </div>
    );
  };
  // Consecutive fields sharing a `section` form one group; a form with sections is drawn as numbered cards.
  const groups: { section?: string; items: Field[] }[] = [];
  for (const f of visible) {
    const last = groups[groups.length - 1];
    if (last && last.section === f.section) last.items.push(f); else groups.push({ section: f.section, items: [f] });
  }
  if (!groups.some((g) => g.section)) return <div className="grid gap-x-4 gap-y-5 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">{visible.map(renderField)}</div>;
  const numbered = groups.filter((g) => g.section).length > 1;
  let n = 0;
  return (
    <div className="space-y-4">
      {groups.map((g, i) => {
        const req = g.items.filter((f) => f.required);
        const done = req.filter((f) => !empty(values[f.name])).length;
        return (
          <section id={g.section ? `fs-sec-${i}` : undefined} key={`${g.section ?? "-"}-${i}`} aria-label={g.section} className="scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors focus-within:border-ring/50">
            {g.section && (
              <header className="flex items-center gap-3 border-b border-border/80 px-5 py-3.5">
                {numbered && <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-extrabold text-primary">{faNum(++n)}</span>}
                <h3 className="flex-1 text-sm font-extrabold text-foreground">{g.section}</h3>
                {req.length > 0 && <Badge size="sm" variant={done === req.length ? "success" : "neutral"}>{done === req.length && <Check strokeWidth={3} />}{faNum(done)} از {faNum(req.length)} الزامی</Badge>}
              </header>
            )}
            <div className="grid gap-x-4 gap-y-5 p-5 sm:grid-cols-2">{g.items.map(renderField)}</div>
          </section>
        );
      })}
    </div>
  );
}

export function validate(fields: Field[], values: FormValues) {
  const e: Record<string, string> = {};
  for (const f of fields) {
    if (f.show && !f.show(values)) continue;
    const v = values[f.name];
    if (f.required && empty(v)) { e[f.name] = `${f.label} الزامی است`; continue; }
    if (f.type === "number" && typeof v === "string" && v && Number.isNaN(Number(v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))))) e[f.name] = "فقط عدد مجاز است";
    const r = f.rule && typeof v === "string" ? checkRule(f.rule, v) : undefined;
    const c = f.validate?.(v, values);
    if (r || c) e[f.name] = (r ?? c)!;
  }
  return e;
}

/** Maps server validation errors (ProblemDetails.errors) onto form fields by name. */
export function serverFieldErrors(fields: Field[], err: unknown) {
  const fe = fieldErrors(err);
  const out: Record<string, string> = {};
  for (const f of fields) { const m = fe[f.name.toLowerCase()]; if (m) out[f.name] = m; }
  return out;
}

/** Section name of the current page (same match as the shell menu), shown as the window's eyebrow. */
function useSectionName() {
  const path = useRouterState({ select: (st) => st.location.pathname });
  const cur = [...navFlat].sort((a, b) => b.to.length - a.to.length).find((nv) => (nv.to === "/" ? path === "/" : path.startsWith(nv.to)));
  return cur?.group ?? "سامانه امور مشترکین";
}

function RequiredChip({ filled, total, className }: { filled: number; total: number; className?: string }) {
  const complete = filled === total;
  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold", complete ? "bg-success-soft text-success-foreground" : "bg-primary-soft text-primary", className)}>
      {complete && <Check className="size-3.5" aria-hidden />}{faNum(filled)} از {faNum(total)} فیلد الزامی
    </span>
  );
}

/**
 * Header of every create/edit window, built like the page title block: icon tile, section eyebrow,
 * title and description, the required-fields chip and a thin progress line on the hairline below.
 * Title/description are Radix Dialog parts, so it works inside FormSheet and inside ui/dialog.
 */
export function FormWindowHeader({ title, description, icon: Icon = FilePlus2, progress, close }: {
  title: ReactNode; description?: ReactNode; icon?: LucideIcon; progress?: { filled: number; total: number }; close?: ReactNode;
}) {
  const eyebrow = useSectionName();
  const pct = progress && progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
  return (
    <header className="relative shrink-0 border-b border-border bg-card px-6 pb-5 pt-5">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-primary"><span aria-hidden className="h-0.5 w-5 rounded-full bg-logo-blue-light" />{eyebrow}</div>
          <D.Title className="text-lg font-black leading-8 text-foreground">{title}</D.Title>
          {description && <D.Description className="mt-0.5 text-sm leading-6 text-muted-foreground">{description}</D.Description>}
          {progress && progress.total > 0 && <RequiredChip filled={progress.filled} total={progress.total} className="mt-3 sm:hidden" />}
        </div>
        {progress && progress.total > 0 && <RequiredChip filled={progress.filled} total={progress.total} className="hidden sm:inline-flex" />}
        {close}
      </div>
      {progress && progress.total > 0 && (
        <div className="absolute inset-x-0 -bottom-px h-[3px]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تکمیل فرم">
          <div className="absolute inset-y-0 start-0 rounded-e-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}

/** Close button shared by the create/edit windows. */
export const windowCloseClass = "grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-card transition-colors hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

const windowClass = "form-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[min(92vh,56rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-raised focus:outline-none";
const overlayClass = "fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

/** The bare create/edit window (overlay + white frame) for custom forms that cannot use FormSheet's field list. */
export function FormWindow({ open, onOpenChange, wide, children }: { open: boolean; onOpenChange: (v: boolean) => void; wide?: boolean; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlayClass} />
        <D.Content dir="rtl" onInteractOutside={(e) => e.preventDefault()} className={cn(windowClass, wide ? "max-w-4xl" : "max-w-2xl")}>{children}</D.Content>
      </D.Portal>
    </D.Root>
  );
}
export function WindowClose({ disabled }: { disabled?: boolean }) {
  return <D.Close type="button" disabled={disabled} className={windowCloseClass}><X className="size-4" /><span className="sr-only">بستن</span></D.Close>;
}
/** Scrolling body and footer of a create/edit window. */
export const windowBodyClass = "min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-4 sm:p-6";
export const windowFooterClass = "flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-6 py-3.5";

/** Centered create/edit dialog: validates locally, waits for the server, keeps the user's input on failure. */
export function FormSheet({ title, description, trigger, fields, initial = {}, submitLabel = "ثبت", successMessage = "با موفقیت ثبت شد", onSubmit, open: o, onOpenChange, children }: {
  title: string; description?: string; trigger?: ReactNode; fields: Field[]; initial?: FormValues; submitLabel?: string; successMessage?: string | null;
  onSubmit: (v: FormValues) => unknown | Promise<unknown>; open?: boolean; onOpenChange?: (v: boolean) => void; children?: ReactNode;
}) {
  const [inner, setInner] = useState(false);
  const open = o ?? inner;
  const setOpen = onOpenChange ?? setInner;
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const visible = fields.filter((f) => !f.show || f.show(values));
  const required = visible.filter((f) => f.required);
  const filled = required.filter((f) => !empty(values[f.name])).length;
  // section index list (matches FieldsGrid grouping) for the section navigator
  const sections: { title: string; idx: number; req: number; filled: number; bad: boolean }[] = [];
  {
    let prev: string | undefined | null = null; let gi = -1;
    for (const f of visible) {
      if (f.section !== prev) { gi++; prev = f.section; if (f.section) sections.push({ title: f.section, idx: gi, req: 0, filled: 0, bad: false }); }
      const cur = sections[sections.length - 1];
      if (f.section && cur) { if (f.required) { cur.req++; if (!empty(values[f.name])) cur.filled++; } if (errors[f.name]) cur.bad = true; }
    }
  }
  const stepped = sections.length > 1;
  // highlight the section currently in view, like the current page in the shell's pages column
  const spy = () => {
    const b = bodyRef.current; if (!b || !stepped) return;
    const top = b.getBoundingClientRect().top;
    let cur = sections[0]?.idx ?? 0;
    for (const sec of sections) { const el = document.getElementById(`fs-sec-${sec.idx}`); if (el && el.getBoundingClientRect().top - top <= 48) cur = sec.idx; }
    if (b.scrollTop + b.clientHeight >= b.scrollHeight - 4) cur = sections[sections.length - 1]?.idx ?? cur;
    setActive(cur);
  };
  const submit = async () => {
    const e = validate(fields, values);
    setErrors(e); setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSubmit(values);
      if (successMessage) toast.success(successMessage);
      setOpen(false);
    } catch (err) {
      setErrors(serverFieldErrors(fields, err));
      setFormError(errorMessage(err));
    } finally { setBusy(false); }
  };
  const errCount = Object.keys(errors).length;
  return (
    <D.Root open={open} onOpenChange={(v) => { if (busy) return; setOpen(v); if (v) { setValues(initial); setErrors({}); setFormError(null); setActive(0); } }}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className={overlayClass} />
        <D.Content dir="rtl" onInteractOutside={(e) => e.preventDefault()}
          className={cn(windowClass, stepped ? "max-w-4xl" : "max-w-2xl")}>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex min-h-0 flex-1 flex-col">
            <FormWindowHeader title={title} description={description ?? "اطلاعات را با دقت وارد کنید؛ فیلدهای ستاره‌دار الزامی هستند."}
              progress={{ filled, total: required.length }}
              close={<WindowClose disabled={busy} />} />
            <div className="flex min-h-0 flex-1">
              {stepped && (
                <nav aria-label="بخش‌های فرم" className="hidden w-60 shrink-0 flex-col border-e border-panel-border bg-panel md:flex">
                  <div className="px-5 pb-3 pt-5">
                    <h3 className="text-sm font-black text-foreground">بخش‌های فرم</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{faNum(sections.length)} بخش برای تکمیل</p>
                  </div>
                  <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
                    {sections.map((sec, k) => {
                      const on = sec.idx === active;
                      const done = sec.req > 0 && sec.filled === sec.req;
                      return (
                        <li key={sec.idx}>
                          <button type="button" aria-current={on ? "step" : undefined}
                            onClick={() => { setActive(sec.idx); document.getElementById(`fs-sec-${sec.idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                            className={cn("group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", on ? "bg-panel-active" : "hover:bg-muted")}>
                            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold transition-colors",
                              sec.bad ? "bg-destructive-soft text-destructive" : done ? "bg-success-soft text-success-foreground" : on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-primary")}>
                              {sec.bad ? <AlertCircle className="size-4" /> : done ? <Check className="size-4" /> : faNum(k + 1)}
                            </span>
                            <span className="min-w-0 leading-tight">
                              <span className={cn("block truncate text-sm font-bold", sec.bad ? "text-destructive" : on ? "text-panel-active-foreground" : "text-foreground")}>{sec.title}</span>
                              <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">{sec.bad ? "نیاز به اصلاح" : sec.req ? `${faNum(sec.filled)} از ${faNum(sec.req)} فیلد الزامی` : "فیلدهای اختیاری"}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
              <div ref={bodyRef} onScroll={spy} className={windowBodyClass}>
                {children}
                <fieldset disabled={busy} aria-busy={busy || undefined} className="min-w-0 transition-opacity disabled:opacity-70"><FieldsGrid fields={fields} values={values} setValues={setValues} errors={errors} /></fieldset>
                {formError && <Alert variant="destructive" role="alert"><AlertDescription>{formError}</AlertDescription></Alert>}
              </div>
            </div>
            <footer className={windowFooterClass}>
              <Button type="submit" loading={busy} loadingText={`در حال ${submitLabel}…`} className="min-w-28 rounded-xl font-bold"><Check />{submitLabel}</Button>
              <Button type="button" variant="outline" disabled={busy} className="rounded-xl" onClick={() => setOpen(false)}>انصراف</Button>
              <p className={cn("ms-auto text-xs", errCount ? "font-bold text-destructive" : "text-muted-foreground")} aria-live="polite">
                {errCount ? <span className="inline-flex items-center gap-1.5"><AlertCircle className="size-3.5" aria-hidden />{faNum(errCount)} مورد نیاز به اصلاح دارد</span> : <span>فیلدهای دارای <span className="text-destructive">*</span> الزامی هستند</span>}
              </p>
            </footer>
          </form>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
