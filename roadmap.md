# Roadmap

- [x] Import uploaded project
- [x] API layer: config, client, errors, paging, session, OIDC + dev login, permissions
- [x] Shared components: DataTable (server paging), FormSheet (async + validation + pickers), Confirm, states, 404/403
- [x] Task-based navigation + shell with real user/tenant
- [x] B05 customers, B07 lifecycle cases & change requests, registration wizard, dashboard
- [x] B01 parties
- [x] B03 premises, B02 ownership/occupancy, B04 usage
- [x] B06 relationships & authorizations
- [x] Foundation: organization, service areas, reference, regulations, access, calendar, banking, integration, audit
- [x] Connection settings page with server health check
- [x] Remove mock data
- [x] Tests: API client, validation, permissions, list normalization
- [x] Full RTL: tables inside tabs, tabs, menus, fields, detail lists, form close button, switches
- [x] Persian dates in Persian order (weekday day month year), Persian comma
- [x] Smaller search bars (page header and tables)
- [x] Per-column filters in the first table row (type fits the column / what the server accepts); audit filter box moved into the table
- [x] System blue = logo blue (#004FAC, light #29A4DD)

- [x] Re-check after import (Nov 2026): logo re-uploaded, dates laid out right-to-left, header path arrow, smaller search boxes, folded-menu logo, checkbox spacing, demo columns showing dates, filter in every column, sidebar in logo blue

- [x] Nov 2026 redesign: imported again, whole UI Persian, completely new look («روشن و آرام آبی»), same flows, logo kept, colours in one named file

- [x] Form windows: blue header no longer squeezes; required-fields counter shown as a badge on the blue area
- [x] Add/edit windows redesigned to match the system look (white header like page titles, pages-column style section list); ownership page no longer spills past the screen
- [x] Trees, dates and badges redesigned (Nov 2026): tree guide lines + highlighted path + hide inactive; new Jalali calendar for every date field, range filter with presets, date hover card; status badge colours fixed (inactive no longer green), yes/no badges; organisation chart no longer stuck loading
- [x] Reports page: report tree, parameters, charts, Excel/print, local history; in the side menu; menu and top bar hidden on paper; calculation tests

Open (need the customer / backend team):
- [ ] Real server addresses and identity-provider settings (entered in «تنظیمات اتصال»); backend must allow the app's origin (CORS)
- [ ] Official code lists (relationship policies, occupancy right types, etc.) — forms read them from reference data

- [x] Typed date fields + busy buttons (Nov 22): confirm app opens cleanly, try typing dates and busy buttons in the browser, tests for date rules (month 13, month lengths, auto «/»), longer demo save delay so the spinner is visible
