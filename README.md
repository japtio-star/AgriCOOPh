<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/54604a5c-c493-4ffe-842e-006b92fd1bde

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## CEO Command Center (executive layer)

A management layer on top of the membership database so the CEO can run the
federation from one screen while the COO post is vacant. Every department reports
the same way, so they can be compared side by side and later handed to a COO.

**Structure**

| Group | Departments | Reports to |
|---|---|---|
| Income services | Supply & Marketing (SMS), Training & Consultancy, Digital Services, Agribusiness Development, Credit | COO (vacant: CEO acting) |
| Support units | HR & Admin, Accounting & Finance, Knowledge Management, Member Relations & Development, Social & Health | CEO |

Category, reporting line, unit head, revenue target and which money figures a department reports
(revenue and expenses, expenses only, or none) can be changed per department in the app.
Income services report revenue and expenses. Support units report no money figures, so the
CEO's revenue, expense and net income totals cover the income services only.

**Screens**

- **Command Center** (`/`): revenue vs target, net income, year-to-date figures, which departments have reported, open issues, a "needs your attention" list, a scorecard of all 10 departments, and 12-month revenue/net income charts.
- **Departments** (`/departments`, `/departments/:id`): KPI cards with 12-month trends, revenue and expenses, the unit head's written report, issues and decisions. Each department page is the template that will be extended with department-specific tools.
- **Monthly update**: one form per department per month for KPI results, revenue/expenses (income services only), highlights, challenges and support needed.
- **Issues** (`/issues`): escalations with severity, owner, due date and status.
- **Decision log** (`/decisions`): each decision with the evidence used, the expected result, a review date and the actual outcome. This builds the record for data-driven decisions.

**How status works.** Each KPI has a monthly target and a direction (higher or lower is better).
At least 95% of target counts as on track, 80–95% as at risk, and below 80% as off track. A department's status is its worst KPI result.

**Roles**

| Role | Access |
|---|---|
| Executive (CEO/COO), Super Admin | Everything; sets KPIs and targets; appoints COO |
| Department Head | Own department only: monthly update, issues |
| Cooperative Admin / Data Encoder / Viewer | Membership screens (unchanged) |

### Knowledge Management (KM) tools

The KM department page has tabs for the unit's own work:

- **Knowledge library**: guides, market bulletins, policy briefs, training modules, success stories and other products, with commodity, topic, region, language, contributing unit, status (draft, under review, published, archived), views and people reached.
- **Dissemination**: each time knowledge reaches members, by channel (training, field visit, Facebook, SMS blast, radio, print, etc.) and region, with people reached, women and youth reached, and feedback scores.
- **Information requests**: questions for data, analysis or technical information from units, member coops, the board and partners, with due dates, answers and days taken to answer.
- **Market prices**: weekly farmgate, wholesale or retail prices of members' main commodities by region, with 4-week change and trend charts.
- **Member data quality**: checks the membership database for missing member details, incomplete coop profiles and coops without an M&E report in the last 12 months.

KM's KPIs are calculated from these records, so the unit head only writes the narrative part of the monthly update:
products published, requests answered, people reached, average days to answer a request, and member data completeness.
A KPI is calculated when it has a `source` and nobody typed a value for that month.

**Demo logins** (password `admin123`): `ceo@agricooph.com`, `sms.head@agricooph.com`, `km.head@agricooph.com`, `admin@agricooph.com`.

**Sample data.** A fresh database is filled with 12 months of sample figures, flagged by a banner on the dashboard.
To start with no sample figures, delete `amds.db` and start with `SEED_DEMO_DATA=false npm run dev`.

**Code**: `server/executive.ts` (schema, seed, API under `/api/exec/*`), `server/km.ts` (KM records and API under `/api/km/*`), `src/pages/km/KnowledgeManagement.tsx` (KM tabs), `src/lib/exec.tsx` (shared UI helpers), `src/pages/CommandCenter.tsx`, `Departments.tsx`, `DepartmentDetail.tsx`, `Issues.tsx`, `Decisions.tsx`.
