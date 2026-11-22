import { LayoutDashboard, Network, MapPinned, Database, Scale, ShieldCheck, History, CalendarDays, Cable, Users, UserPlus, IdCard, Building2, KeyRound, Handshake, Tags, Inbox, Landmark, FileClock, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { P, type PermissionCode } from "@/lib/auth/permission-codes";

export type NavItem = { to: string; title: string; icon: LucideIcon; perm?: PermissionCode | PermissionCode[]; keywords?: string; /** one short line shown under the title in the section column */ hint?: string };
export type NavGroup = { label: string; /** short label under the icon in the narrow strip */ short: string; icon: LucideIcon; /** one line describing the section, shown atop its pages column */ about: string; items: NavItem[] };

/** Menus follow what staff do day to day, not the backend module names. */
export const navGroups: NavGroup[] = [
  { label: "میز کار", short: "میز کار", icon: LayoutDashboard, about: "کارهای امروز و درخواست‌های در جریان", items: [
    { to: "/", title: "میز کار من", icon: LayoutDashboard, hint: "نمای کلی کارها و هشدارها", keywords: "داشبورد" },
    { to: "/cases", title: "کارتابل درخواست‌ها", icon: Inbox, hint: "بررسی، تأیید و اجرای درخواست‌ها", perm: [P.HistoryRead, P.ChangeRead, P.LifecycleReview, P.LifecycleApprove, P.LifecycleRequest], keywords: "پرونده تغییر وضعیت" },
    { to: "/reports", title: "گزارش‌ها", icon: BarChart3, hint: "آمار، نمودار و خروجی اکسل", keywords: "گزارش آمار نمودار اکسل چاپ" },
  ] },
  { label: "خدمات مشترکین", short: "مشترکین", icon: Users, about: "جستجو، ثبت و پرونده مشترکین", items: [
    { to: "/customers", title: "جستجوی مشترک", icon: Users, hint: "یافتن پرونده با شماره یا کد ملی", perm: P.CustomerRead, keywords: "اشتراک" },
    { to: "/registration", title: "ثبت مشترک جدید", icon: UserPlus, hint: "ثبت مرحله‌ای متقاضی و اشتراک", perm: P.CustomerCreate },
    { to: "/parties", title: "اشخاص حقیقی و حقوقی", icon: IdCard, hint: "پرونده افراد و شرکت‌ها", perm: P.PartyRead, keywords: "کد ملی" },
  ] },
  { label: "املاک", short: "املاک", icon: Building2, about: "پرونده ملک، مالکیت، کاربری و روابط", items: [
    { to: "/premises", title: "پرونده املاک", icon: Building2, hint: "مشخصات، نشانی و کد پستی", perm: P.PremisesRead, keywords: "نشانی کد پستی" },
    { to: "/ownership", title: "مالکیت و تصرف", icon: KeyRound, hint: "مالکان، متصرفان و تعارض‌ها", perm: P.OwnershipRead, keywords: "مالک مستأجر تعارض" },
    { to: "/usage", title: "کاربری املاک", icon: Tags, hint: "مسکونی، تجاری و سایر کاربری‌ها", perm: P.UsageRead, keywords: "مسکونی تجاری ناسازگاری" },
    { to: "/relationships", title: "روابط و اختیارات", icon: Handshake, hint: "وکالت، نمایندگی و اختلاف‌ها", perm: P.RelationshipRead, keywords: "وکالت نماینده اختلاف" },
  ] },
  { label: "اطلاعات پایه", short: "اطلاعات پایه", icon: Database, about: "ساختار، کدها، مقررات و تقویم", items: [
    { to: "/organization", title: "ساختار سازمانی", icon: Network, hint: "واحدها، پست‌ها و انتصاب‌ها", perm: [P.OrganizationRead, P.OrganizationManage] },
    { to: "/service-areas", title: "محدوده‌های خدمات", icon: MapPinned, hint: "مناطق و محدوده‌های جغرافیایی", perm: P.GeographyManage },
    { to: "/reference", title: "کدها و اطلاعات پایه", icon: Database, hint: "فهرست کدهای مشترک سامانه", perm: P.ReferenceManage },
    { to: "/regulations", title: "مقررات و پارامترها", icon: Scale, hint: "قواعد و مقادیر قابل تنظیم", perm: P.RegulationManage },
    { to: "/calendar", title: "تقویم کاری", icon: CalendarDays, hint: "روزهای کاری و تعطیلات", perm: P.CalendarRead },
    { to: "/banking", title: "بانک‌ها و درگاه‌ها", icon: Landmark, hint: "بانک‌ها، شعب و درگاه پرداخت", perm: P.BankingRead },
  ] },
  { label: "راهبری سامانه", short: "راهبری", icon: ShieldCheck, about: "دسترسی‌ها، ممیزی و پایش سامانه", items: [
    { to: "/access", title: "کاربران و نقش‌ها", icon: ShieldCheck, hint: "دسترسی کارکنان سامانه", perm: P.AccessManage },
    { to: "/audit", title: "ردگیری تغییرات", icon: History, hint: "سابقه تغییرات و ممیزی", perm: P.AuditRead, keywords: "ممیزی لاگ" },
    { to: "/integration", title: "پایش یکپارچه‌سازی", icon: Cable, hint: "صف پیام‌ها میان سامانه‌ها", perm: P.IntegrationMonitor, keywords: "صف پیام" },
  ] },
];
export const navFlat = navGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
export const FileClockIcon = FileClock;
