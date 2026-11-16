# COOP-OS — Application Navigation Structure

Version 0.1 · Draft for approval

## 1. Surfaces

| Surface | URL root | Who |
|---|---|---|
| Public & auth | `/`, `/sign-in`, `/sign-up`, `/invite/[token]`, `/reset-password` | Everyone |
| Onboarding | `/onboarding` | New cooperative registrant |
| Tenant app | `/[org]/…` | Cooperative staff, officers, board, auditors |
| Member portal | `/[org]/me/…` | Members (MBR role) |
| SaaS admin | `/admin/…` | Platform staff only (separate session audience) |

## 2. Tenant app layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Org switcher ▾]   [ Global search ⌘K ...........]   (?) Help  🔔  [Avatar ▾] │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ Overview      │  Breadcrumbs                                                 │
│ Membership    │  Page title                         [Primary action]         │
│ Share Capital │  ─────────────────────────────────────────────────────────── │
│ Finance       │  Content: filters · table / form / detail tabs               │
│ Savings       │                                                              │
│ Loans         │                                                              │
│ Governance    │                                                              │
│ Gen. Assembly │                                                              │
│ Human Res.    │                                                              │
│ Documents     │                                                              │
│ Inventory     │                                                              │
│ Procurement   │                                                              │
│ Operations    │                                                              │
│ Reports       │                                                              │
│ ───────────── │                                                              │
│ Approvals (3) │                                                              │
│ Settings      │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

- Sidebar items render only if **module enabled for the org AND user holds ≥1 view
  permission in it**. The same registry (`navigation.ts`) drives both rendering and route
  guards, so a hidden item is also an inaccessible route.
- Mobile/tablet: sidebar collapses into a drawer; tables become stacked cards below 640 px;
  primary action stays in a bottom bar.
- Approvals inbox aggregates pending items from all modules for the current user.

## 3. Route map

| Section | Routes |
|---|---|
| Overview | `/[org]` — role-based dashboard (tabs if user has several dashboard views) |
| Membership | `/members` list · `/members/new` · `/members/[id]` (tabs: Profile, Capital, Savings, Loans, Documents, Attendance, History) · `/members/applications` · `/members/import` · `/members/settings` (classes, custom fields, numbering) |
| Share Capital | `/share-capital` summary · `/share-capital/transactions` · `/share-capital/transactions/new` · `/share-capital/withdrawals` · `/share-capital/reports` · `/share-capital/settings` (share types, policy) |
| Finance | `/finance` · `/finance/accounts` · `/finance/journal` (+ `/new`, `/[id]`) · `/finance/ledger` · `/finance/receipts` · `/finance/disbursements` · `/finance/receivables` · `/finance/payables` · `/finance/banks` · `/finance/budgets` · `/finance/periods` · `/finance/statements/{trial-balance,balance-sheet,income-statement,cash-flow}` · `/finance/settings` (posting rules, taxes) |
| Savings | `/savings` · `/savings/accounts` · `/savings/teller` · `/savings/interest-runs` · `/savings/products` · `/savings/reports` |
| Loans | `/loans` (pipeline board) · `/loans/applications` · `/loans/accounts` · `/loans/[id]` (schedule, payments, documents) · `/loans/collections` · `/loans/delinquency` · `/loans/products` · `/loans/reports` |
| Governance | `/governance` · `/governance/board` · `/governance/committees` · `/governance/meetings` (+`/[id]` agenda/attendance/minutes) · `/governance/resolutions` · `/governance/action-items` · `/governance/compliance` |
| General Assembly | `/assembly` · `/assembly/[id]` (setup, voters, check-in, quorum, agenda, voting, elections, minutes) |
| Human Resources | `/hr/employees` · `/hr/attendance` · `/hr/leave` · `/hr/reviews` · `/hr/trainings` |
| Documents | `/documents` (folder browser) · `/documents/[id]` · `/documents/expiring` · `/documents/templates` |
| Inventory | `/inventory/items` · `/inventory/stock` · `/inventory/movements` · `/inventory/transfers` · `/inventory/adjustments` · `/inventory/warehouses` |
| Procurement | `/procurement/requisitions` · `/procurement/orders` · `/procurement/receipts` · `/procurement/suppliers` |
| Operations | `/operations/business-units` · `/operations/projects` · `/operations/sales` · `/operations/kpis` |
| Reports | `/reports` catalogue · `/reports/[key]` with filters & export |
| Approvals | `/approvals` |
| Settings | `/settings/organization` · `/settings/branches` · `/settings/departments` · `/settings/users` · `/settings/roles` · `/settings/modules` · `/settings/approvals` · `/settings/numbering` · `/settings/notifications` · `/settings/privacy` (consents, DPO, retention) · `/settings/subscription` · `/settings/integrations` · `/settings/audit-log` · `/settings/support-access` |

All tenant routes are prefixed with `/[org]`.

## 4. Member portal

`/[org]/me` summary · `/me/capital` · `/me/savings` · `/me/loans` (+ apply) · `/me/assemblies`
(register, vote) · `/me/documents` (shared with members) · `/me/profile` (request corrections,
consents, download my data).

## 5. SaaS admin portal

`/admin` metrics · `/admin/tenants` (+`/[id]`: verification, modules, subscription, usage,
suspension) · `/admin/plans` · `/admin/modules` · `/admin/subscriptions` · `/admin/invoices` ·
`/admin/announcements` · `/admin/tickets` · `/admin/staff` · `/admin/audit`.

## 6. Global search

`⌘K / Ctrl-K` palette searching, within the active org and the user's permissions: members
(name, member no.), loans (loan no.), documents (title), resolutions (no., title), and
navigation commands ("New member", "Receive payment"). Results are permission-filtered on the
server.
