# Forma

A calm, local-first personal workspace for **Learning, Goals, and Financials**.

## Run locally

Requires Node.js **18.20+** and npm. Node 22+ is recommended. Vite 6 is used to remain compatible with Node 18.

```powershell
Set-Location 'Q:\productivity-app'
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The Node API runs at **http://127.0.0.1:3001**.

Copy `.env.example` to `.env` and set `MONGODB_URI` before starting the app. The `.env` file is ignored by Git and must never be committed.

Vite's generated dependency cache lives outside the project, under `%LOCALAPPDATA%\Forma\vite-cache\<project-hash>` on Windows (or the OS temporary directory elsewhere). This avoids OneDrive locking `node_modules\.vite\deps` during cache refreshes. Each project path has its own cache. Cached dependencies are excluded from the React/Babel source transform. The old in-project cache is no longer used; there is no need to delete it or reinstall dependencies.

For a production build served entirely by Node:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Both frontend and API are served from the same process.

## Deploy to Vercel

The Vite frontend is deployed as static output from `dist`, while `api/[...path].ts` runs the existing Express API as one Vercel Function. The local `server/index.ts` entry remains unchanged.

In the Vercel project, use the Vite preset and configure these environment variables for both Preview and Production:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/
MONGODB_DB=forma
MONGODB_WORKSPACE_ID=default
```

Use a different `MONGODB_WORKSPACE_ID`, such as `preview`, for Preview deployments if their test data should remain separate. Do not configure `DATA_FILE` on Vercel.

The repository includes `vercel.json`, so the build command, `dist` output directory, and API function duration are configured automatically. After deployment, verify `/api/health`, create a record, refresh, and confirm that it remains.

## Your workspace

- **Overview:** current learning, focused goals, upcoming deadlines, recent activity, and net wealth.
- **Learning:** create any named subsection, such as Books, Courses, or Languages. Every subsection has Active, Planned, and Past phases. Move any item in either direction using its phase menu or drag-and-drop. Each item has a description and dated, editable/deletable thought logs.
- **Goals:** create named subsections, such as Health or Career. Every subsection has Current, Future, and Achieved phases. Goals have descriptions, reversible checklist steps, an editable start date, an optional adjustable deadline, and their own progress journals. Completion and time elapsed are separate progress bars.
- **Board scrolling:** Learning and Goals phase columns show up to three cards before scrolling. Each column scrolls independently with a slim, styled scrollbar; the phase heading and add button stay outside the scrolling area. The height adapts to the first three cards and screen width, with keyboard scrolling and reduced-motion support.
- **Subsection journals:** Learning and Goals both have a description and a dated journal at the subsection level, separate from individual item journals.
- **Financials:** add assets and liabilities; net wealth is assets minus liabilities. Configure currency, first earning month, monthly savings, and an additional amount for the current benchmark. A month's savings increment is included only from salary day, the **28th**. Create any number of date-sorted financial milestones with directly entered amounts, independent of the savings formula.

There is **no fictional/demo data** in your actual database. The default first earning month is **August 2023**; initial amounts are zero and the default display currency is **INR**, displayed with Indian digit grouping (for example, ₹30,00,000.00). Change these in Financials → Configure. Existing configured currencies are preserved.

### Savings and deadlines

```
inclusive months = (current year - start year) × 12 + current month - start month + 1
salary months = max(0, inclusive months - (current day < 28 ? 1 : 0))
current benchmark = monthly savings × salary months + additional amount
milestone progress = max(0, net wealth / entered milestone amount × 100)
```

August 2023 is month **1**, counted from **August 28, 2023**. Before the 28th, the benchmark excludes that month's increment. On **October 14, 2026**, it uses **38 months**; on **October 28, 2026**, it increases to **39 months**. December 2027 reaches month **53** on **December 28, 2027**. Dates before the first salary payment have zero salary months; the additional amount is still included. Milestone months are independent of the earning start month.

The current benchmark uses the server's local calendar date and the salary-day rule above. It shows the exact currency amount **ahead of or behind target** (net wealth minus benchmark, rounded to two decimal places). The increment changes the benchmark, not your account balances; you update those separately. Milestones store an explicit amount and are sorted by their selected month, earliest first. For a **30 lakh milestone in December 2026**, enter **3000000** and select **2026-12**. Changes to monthly savings, the additional amount, or the earning start month never change milestone amounts. A zero target displays 0% instead of dividing by zero. Percentage labels may exceed 100%, but bars are visually capped at 100%. Negative wealth is allowed through liabilities, while individual balances and milestone amounts must be nonnegative, finite, and use at most two decimal places. Currency is a display unit, not an exchange-rate conversion.

Goal completion is completed steps / total steps. An achieved goal with no steps shows 100%; other empty goals show 0%. Phase changes are manual and do not silently complete or undo checklist steps. The deadline bar shows **elapsed time** between start and deadline, not work completion. Past deadlines show days overdue. Clearing the deadline removes the time constraint. Dates are treated as calendar days, avoiding timezone-induced day shifts.

## Architecture

```text
src/                         React + TypeScript UI, native hash navigation, API client
shared/models.ts             Zod models, request schemas, shared types
shared/calculations.ts       Financial and progress calculations
server/routes.ts             REST routing
server/controllers/          HTTP response mapping
server/services/             Validation, business rules, relational/cascade operations
server/repositories/         MongoDB runtime adapter and isolated JSON test adapter
server/app.ts                Express composition, same-origin protection, structured errors
tests/                       API, repository, calculation, and browser workflow coverage
```

**Every application read/write uses the backend API.** There is no application-data localStorage and no direct frontend file access. The UI refreshes the API snapshot after successful mutations. The repository can be replaced with SQL or another store without changing the UI or REST routes.

Runtime data is stored in MongoDB Atlas in the `workspaces` collection. The current workspace is one validated document containing the application's related entities and settings. Writes use revision-based optimistic concurrency, so concurrent server instances cannot silently overwrite one another. Failed validation or database writes return errors and do not claim success.

### Persistence and backups

Configure the runtime database with:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/
MONGODB_DB=forma
MONGODB_WORKSPACE_ID=default
```

The database and workspace names default to `forma` and `default`. Startup creates an empty workspace when it does not exist. Export a complete JSON snapshot using the sidebar **Export data** link, the About dialog, or `GET /api/export`.

This is a **single-user application with no authentication**. The API accepts deployment hosts, rejects foreign browser origins, and requires JSON for mutations. Anyone who can directly reach the API can read or change its data. Set `ALLOWED_ORIGINS` to a comma-separated list only when an additional frontend origin is required.

## REST API

JSON request bodies use `Content-Type: application/json`. Successful responses are `{ "data": ... }`, deletes return `204`, and errors are `{ "error": { "message": "...", "details": [...] } }` (details appear for schema errors). Unknown endpoints/entities return `404`; invalid input `400`; duplicate subsection names `409`; invalid origins `403`; non-JSON mutations `415`.

| Resource | Endpoints |
|---|---|
| Health and snapshot | `GET /api/health`, `GET /api/state` |
| Backup | `GET /api/export` (raw downloadable JSON) |
| Subsections | `GET /api/sections?kind=learning\|goals`, `POST /api/sections`, `GET/PATCH/DELETE /api/sections/:id` |
| Items | `GET/POST /api/sections/:id/items`, `GET/PATCH/DELETE /api/items/:id` |
| Goal steps | `GET/POST /api/items/:id/steps`, `PATCH/DELETE /api/steps/:id` |
| Subsection logs | `GET/POST /api/sections/:id/logs` |
| Item logs | `GET/POST /api/items/:id/logs` |
| Log editing | `PATCH/DELETE /api/logs/:id` |
| Financial summary | `GET /api/finance` |
| Financial configuration | `GET/PATCH /api/finance/settings` |
| Wealth accounts | `GET/POST /api/finance/accounts`, `PATCH/DELETE /api/finance/accounts/:id` |
| Milestones | `GET/POST /api/finance/targets`, `PATCH/DELETE /api/finance/targets/:id` |

Create-body examples:

```json
{
  "subsection": { "kind": "learning", "name": "Books", "description": "My reading space" },
  "learningItem": { "title": "Atomic Habits", "phase": "planned", "description": "Small changes compound" },
  "goal": { "title": "Run a half marathon", "phase": "current", "startedOn": "2026-10-01", "deadline": "2027-04-01" },
  "step": { "title": "Run 5 km", "completed": false },
  "log": { "content": "A thought worth keeping", "date": "2026-10-13" },
  "account": { "name": "Savings", "type": "asset", "amount": 25000 },
  "settings": { "currency": "INR", "earningsStartMonth": "2023-08", "monthlySavings": 50000, "additionalAmount": 800000 },
  "target": { "name": "December 2026 - 30 lakh", "month": "2026-12", "amount": 3000000 }
}
```

Send the relevant inner object to its endpoint, not the whole example. PATCH accepts any editable subset, except subsection kind cannot change. Names/titles are limited to 120 characters, descriptions to 10,000, and logs to 20,000. Deleting a subsection cascades to its items, goal steps, and journals; deleting an item only deletes that item's steps and journals.

## Checks

```powershell
npm run build
npm test
npm audit
```

Browser workflows use the isolated JSON test adapter at `tests\.ui-data\db.json`, never your MongoDB workspace:

```powershell
npx playwright install chromium
npm run build
npm run test:ui
```

Alternatively use an installed browser without a download:

```powershell
$env:BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:ui
```

The browser suite starts its own production server on port 3107 and covers learning phases/journals, reversible goal steps/deadlines, financial targets, persistence after reload, and mobile layout.
