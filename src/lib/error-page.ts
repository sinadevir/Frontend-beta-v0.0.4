import { FALLBACK_PAGE as C } from "@/theme/brand";

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>نمایش صفحه با خطا روبه‌رو شد</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.8 Vazirmatn, Tahoma, system-ui, sans-serif; background: ${C.mist}; color: ${C.ink}; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; direction: rtl; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: ${C.white}; border: 1px solid ${C.line}; border-radius: 1.25rem; }
      h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
      p { color: ${C.slate}; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.55rem 1.1rem; border-radius: 0.7rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: ${C.logoBlue}; color: ${C.white}; }
      .secondary { background: ${C.white}; color: ${C.ink}; border-color: ${C.line}; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>نمایش این صفحه با خطا روبه‌رو شد</h1>
      <p>مشکلی در سامانه پیش آمد. صفحه را دوباره بارگذاری کنید یا به میز کار برگردید.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">تلاش دوباره</button>
        <a class="secondary" href="/">میز کار</a>
      </div>
    </div>
  </body>
</html>`;
}
