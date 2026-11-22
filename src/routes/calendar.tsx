import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { calendarsQuery, holidaysQuery, isWorkingDay } from "@/features/foundation/operations";
import { PageHeader } from "@/components/cis/app-shell";
import { DataTable } from "@/components/cis/data-table";
import { InfoList } from "@/components/cis/blocks";
import { ErrorState } from "@/components/cis/query-state";
import { JalaliCalendar, JalaliDatePicker, useJalaliCursor } from "@/components/cis/jalali-date-picker";
import { YesNo } from "@/components/cis/status-badge";
import { Button } from "@/components/ui/button";
import { Badge, BadgeDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { fieldLabel } from "@/lib/field-labels";
import { useApiMutation } from "@/lib/api/hooks";
import { faNum, gToJ, jToDate, jMonthLength, toDateOnly } from "@/lib/jalali";
import { seo } from "@/lib/seo";
import { DateText } from "@/components/cis/date-text";

export const Route = createFileRoute("/calendar")({
  head: () => seo("تقویم کاری", "تقویم‌ها، تعطیلات و بررسی روز کاری"),
  component: CalendarPage,
});

function CalendarPage() {
  const calendars = useQuery(calendarsQuery());
  const [selected, setSelected] = useState<{ code: string; name: string }>();

  return (
    <div className="space-y-6">
      <PageHeader title="تقویم کاری" desc="این بخش فقط‌خواندنی است و از سرور مرکزی تغذیه می‌شود" />
      <DataTable
        rows={calendars.data ?? []}
        loading={calendars.isPending}
        error={calendars.error ?? undefined}
        onRetry={() => void calendars.refetch()}
        rowKey={(r) => r.code}
        onRowClick={setSelected}
        columns={[
          { key: "code", header: "کد" },
          { key: "name", header: "نام" },
          { key: "description", header: "توضیح" },
        ]}
        emptyText="تقویمی از سامانه مرکزی دریافت نشد."
        exportName="work-calendars"
      />
      {selected ? (
        <CalendarMonth key={selected.code} calendar={selected} />
      ) : (
        <p className="text-sm text-muted-foreground">
          برای مشاهده تعطیلات و بررسی روز کاری، یک تقویم را انتخاب کنید.
        </p>
      )}
    </div>
  );
}

function CalendarMonth({ calendar }: { calendar: { code: string; name: string } }) {
  const cursor = useJalaliCursor();
  const from = toDateOnly(jToDate(cursor.y, cursor.m, 1));
  const to = toDateOnly(jToDate(cursor.y, cursor.m, jMonthLength(cursor.y, cursor.m)));
  const holidays = useQuery(holidaysQuery(calendar.code, from, to));
  const [date, setDate] = useState<Date>();
  const checker = useApiMutation((d: Date) => isWorkingDay(calendar.code, toDateOnly(d)), {
    success: "نتیجه بررسی دریافت شد",
    invalidate: [],
  });
  const rows = holidays.data ?? [];
  const noteOf = (d: Date) => rows.filter((r) => r.date.slice(0, 10) === toDateOnly(d)).map((r) => r.title).join("، ") || undefined;
  const choose = (d: Date) => { setDate(d); checker.reset(); };
  const goToday = () => { const j = gToJ(new Date()); cursor.set({ y: j.jy, m: j.jm }); };
  const working = checker.data ? Object.entries(checker.data).find(([k, v]) => typeof v === "boolean" && /work/i.test(k))?.[1] as boolean | undefined : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><CalendarDays className="size-5" /></span>
        <div><h2 className="text-lg font-extrabold">{calendar.name}</h2><p className="text-xs text-muted-foreground">کد تقویم <span className="font-mono">{calendar.code}</span></p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="gap-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-[0.6875rem] text-muted-foreground" aria-label="راهنما">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-full ring-[1.5px] ring-inset ring-primary/55" />امروز</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary" />انتخاب‌شده</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-destructive/20 bg-destructive-soft" />تعطیل</span>
              <span className="flex items-center gap-1.5"><span className="font-bold text-destructive">ج</span>جمعه</span>
            </div>
            <div className="flex items-center gap-2">
              {holidays.isFetching && <span className="text-xs text-muted-foreground">در حال دریافت تعطیلات…</span>}
              {!holidays.isFetching && <Badge variant={rows.length ? "destructive" : "neutral"} size="sm">{rows.length ? `${faNum(rows.length)} تعطیلی در این ماه` : "بدون تعطیلی"}</Badge>}
              <Button size="sm" variant="soft" onClick={goToday}>امروز</Button>
            </div>
          </div>
          <JalaliCalendar size="lg" month={{ y: cursor.y, m: cursor.m }} onMonthChange={cursor.set} selected={date} onSelect={choose} marked={noteOf} />
          {holidays.error ? <ErrorState error={holidays.error} onRetry={() => void holidays.refetch()} compact className="mt-3" /> : null}
        </Card>
        <div className="space-y-4">
          <Card className="gap-0 p-4">
            <h3 className="mb-1 font-extrabold">روز کاری است؟</h3>
            <p className="mb-3 text-xs text-muted-foreground">روزی را در تقویم یا با انتخابگر برگزینید و بررسی کنید.</p>
            <div className="flex flex-wrap gap-2">
              <JalaliDatePicker value={date} onChange={choose} onClear={() => { setDate(undefined); checker.reset(); }} className="min-w-52 flex-1" />
              <Button className="h-11" disabled={!date} loading={checker.isPending} loadingText="در حال بررسی…" onClick={() => { if (date) checker.mutate(date); }}>
                بررسی
              </Button>
            </div>
            {date && noteOf(date) && <p className="mt-3 flex items-center gap-2 text-sm"><Badge variant="destructive" size="sm"><BadgeDot />تعطیل</Badge>{noteOf(date)}</p>}
            {checker.data && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
                {working !== undefined && (
                  <div className="flex items-center gap-2">
                    <Badge variant={working ? "success" : "destructive"} size="lg"><BadgeDot />{working ? "روز کاری" : "تعطیل"}</Badge>
                    {date && <span className="text-sm text-muted-foreground"><DateText value={date} relative /></span>}
                  </div>
                )}
                <InfoList cols={1} items={Object.entries(checker.data).map(([key, v]) => [
                  fieldLabel(key),
                  typeof v === "boolean" ? <YesNo key={key} value={v} /> : v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v),
                ])} />
              </div>
            )}
          </Card>
          <DataTable
            rows={rows}
            loading={holidays.isPending}
            error={holidays.error ?? undefined}
            onRetry={() => void holidays.refetch()}
            rowKey={(r) => `${r.date}:${r.title}:${r.type}`}
            onRowClick={(r) => { const d = new Date(r.date); if (!Number.isNaN(d.getTime())) choose(d); }}
            hideSearch dense
            columns={[
              { key: "date", header: "تاریخ", cell: (r) => <DateText value={r.date} /> },
              { key: "title", header: "عنوان" },
              { key: "type", header: "نوع" },
              { key: "recurring", header: "تکرار سالانه", cell: (r) => <YesNo value={r.recurring} />, value: (r) => (r.recurring ? "بله" : "خیر") },
            ]}
            emptyText="در این ماه تعطیلی ثبت نشده است."
            exportName="month-holidays"
          />
        </div>
      </div>
    </section>
  );
}
