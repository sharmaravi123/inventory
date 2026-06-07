# FY invoice migration (INV-2026-000001, Apr–Mar)

Two ways to run the **same** migration (renumber all bills + sync `InvoiceCounter`).

## 1) CLI script (best for production)

Uses `MONGODB_URI` from the environment. Locally, `scripts/migrate-fy-invoices.ts` loads **`.env.local`** first (same folder as `package.json`).

```bash
# From project root — development DB (.env.local must contain MONGODB_URI)
npm run migrate:invoices
```

**Production** (set URI in the shell; never commit it):

```powershell
# PowerShell
$env:MONGODB_URI = "mongodb+srv://USER:PASS@cluster/DBNAME"
npm run migrate:invoices
```

```bash
# bash
export MONGODB_URI="mongodb+srv://USER:PASS@cluster/DBNAME"
npm run migrate:invoices
```

After it finishes, you should see JSON with `totalBills`, `counts` (e.g. `INV-2026`), and `message`.

---

## 2) HTTP API (development with `npm run dev`)

1. Start the app: `npm run dev`
2. Log in as **admin** in the browser and copy the JWT from `localStorage` → `adminToken` (or use your login API to get a Bearer token).
3. Call:

```powershell
$token = "<paste admin JWT>"
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/admin/migrate-fy-invoices" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"confirm":true}'
```

Body **must** include `"confirm": true`.

---

**Note:** Run migration **once per database** after deploy, or when you intentionally want to re-sequence all invoice numbers. Back up the DB first if unsure.
