# FY invoice migration (INV-2026-000001, Apr–Mar)

## Default behaviour (1 Apr 2026 / FY 2026 onwards)

- **CLI** (`npm run migrate:invoices`): only bills whose **Indian FY ≥ 2026** are renumbered in date order → **`INV-2026-000001`**, `INV-2026-000002`, … Bills in FY 2025 or earlier keep their current `invoiceNumber`.
- **HTTP** `POST /api/admin/migrate-fy-invoices` with `{ "confirm": true }`: same (**FY ≥ 2026**).  
  Use `{ "confirm": true, "full": true }` to renumber **every** bill in **every** FY.

## 1) CLI

Loads `.env.local` first, then needs **`MONGODB_URI`**.

```bash
npm run migrate:invoices
```

All financial years:

```bash
MIGRATE_MIN_FY=all npm run migrate:invoices
```

Production (URI only in shell — do not commit):

```powershell
$env:MONGODB_URI = "mongodb+srv://..."
npm run migrate:invoices
```

Output includes `totalBills`, `skippedBills`, `counts` (e.g. `INV-2026`).

## 2) HTTP (local or Vercel)

Admin Bearer token required.

**FY ≥ 2026 only:**

```json
{ "confirm": true }
```

**All FYs:**

```json
{ "confirm": true, "full": true }
```

**Custom floor:**

```json
{ "confirm": true, "minFinancialYear": 2025 }
```

---

Back up the database first. Run once per DB unless you intentionally re-sequence again.
