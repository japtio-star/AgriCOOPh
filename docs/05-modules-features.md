# COOP-OS — Module & Feature Breakdown

Version 0.1 · Draft for approval

Each feature carries the phase in which it is delivered (**P1–P5**) and its dependencies.
Shared engines referenced below are defined in
[00-architecture-review.md §3](00-architecture-review.md#3-module-analysis-overlaps-and-shared-engines).

## Platform core (P1)

| Feature | Notes |
|---|---|
| Sign-up, email verification, sign-in, password reset, optional Google sign-in, TOTP MFA | MFA mandatory for CA, GM, TRS, ACC, platform staff (configurable for others) |
| Cooperative registration & onboarding wizard | Legal name, type, CDA reg. no., TIN, address (PSGC), fiscal year, logo; selects modules; status `pending_verification` until platform verifies |
| Organization profile, branches, departments | Single-branch default; multi-branch per plan |
| User invitations & management | Invite by email, assign roles (optionally per branch), suspend, revoke sessions |
| Roles & permissions editor | Clone templates, toggle permissions, view effective access per user |
| Organization switcher | For users in multiple orgs |
| Module enablement | Within plan + add-ons |
| Audit log viewer | Filter by actor, entity, action, date; export |
| Notification center | In-app list, unread badge, preferences |
| Numbering configuration | Patterns for member no., receipts, etc. |
| Approval policy configuration | Steps, roles, thresholds |
| Custom field definitions | Members first |
| SaaS admin portal | Tenants list/verification/suspension, plans & module bundles, subscriptions, trials, usage (users, members, storage), billing records & payment status (manual entry until a gateway adapter exists), announcements, support tickets, platform audit |
| Demo tenant seeding | Isolated `is_demo` tenant, "Sample Agricultural Cooperative" |

## A. Membership (MVP)

| Feature | Phase |
|---|---|
| Member registration (staff) with PSGC address, E.164 mobile, photo, emergency contacts, custom fields | P2 |
| Membership application → review → approve/reject (approval engine), auto member number | P2 |
| Membership classes (regular/associate/…, configurable rights) | P2 |
| Member profile dashboard: summary, status history, capital, documents, (later) savings/loans/attendance | P2, extended in P3 |
| Status changes with reason & effective date: inactive, suspended, terminated, withdrawn, deceased | P2 |
| Search (name trigram, member no., mobile), filters (status, class, branch, barangay, sex, age band, date joined) | P2 |
| Directory export CSV/XLSX, printable list | P2 |
| CSV import with dry-run validation report | P2 |
| Data privacy: consent capture, DSAR export, correction log | P2 |
| Duplicate detection (name + birthdate + mobile) | P2 |
| Member self-registration / online application | P5 |

## B. Share capital (MVP)

| Feature | Phase |
|---|---|
| Share types (par value, min subscription, max holding % cap, voting) | P2 |
| Subscriptions (initial and additional) | P2 |
| Payments, adjustments, transfers between members (approval), reversals | P2 |
| Member capital ledger and statement (print/PDF) | P2 |
| Paid-up vs. unpaid subscription, aging of unpaid subscriptions | P2 |
| Withdrawal requests with approval workflow and policy checks | P2 |
| Organization-wide share capital reports | P2 |
| GL posting via posting engine (queued until Finance enabled) | P3 |
| Interest on share capital / patronage refund computation (configurable allocation) | P3 |

## C. Finance

| Feature | Phase |
|---|---|
| Chart of accounts (template per coop type, editable; CPA review required) | P3 |
| Journal entries: draft → approval → post; attachments; reversal | P3 |
| General ledger and subsidiary ledger views with drill-down | P3 |
| Cash receipts (official receipt numbering) and disbursement vouchers | P3 |
| AR / AP documents, aging | P3 |
| Bank accounts, deposits, bank reconciliation | P3 |
| Financial periods: open, soft close, close, reopen (approval) | P3 |
| Trial balance, balance sheet, income statement, cash flow (indirect) | P3 |
| Budgets and budget vs. actual | P4 |
| Revenue / expense monitoring by branch, department, business unit | P4 |
| Net surplus allocation (statutory funds per configured percentages) | P3 |
| Tax codes (configurable) | P3 |

## D. Savings & deposits (optional module)

| Feature | Phase |
|---|---|
| Deposit products (regular savings, time deposit, special purpose) | P3 |
| Account opening, dormancy, closure | P3 |
| Deposits, withdrawals (threshold approval), teller screen | P3 |
| Interest configuration and computation runs (preview → approve → post) | P3 |
| Passbook-style statement, transaction history | P3 |
| Savings reports (balances, movement, dormant accounts) | P3 |

## E. Loans (optional module)

| Feature | Phase |
|---|---|
| Loan products: interest methods (diminishing, straight-line, add-on, balloon), frequencies incl. harvest-based, fees, penalties, eligibility rules (e.g. capital multiple) | P3 |
| Application with co-makers, collateral, documents | P3 |
| Evaluation: member credit profile (capital, savings, past loans, delinquency), assessment provider (manual / AniTala adapter) | P3 (adapter mock), P5 (real AniTala) |
| Credit committee review (quorum) and approval limits | P3 |
| Release with deductions (fees, CBU retention, prior loan offset) | P3 |
| Amortization schedule generation (golden-tested) | P3 |
| Payments with allocation order (penalty → interest → principal, configurable) | P3 |
| Overdue monitoring, aging buckets, PAR 1/30/60/90, delinquency and collection reports | P3 |
| Restructuring, write-off (BOD approval) | P3 |

## F. Governance

| Feature | Phase |
|---|---|
| Board & officer directory with positions and terms | P2 |
| Committees (Audit, Election, Credit, Mediation & Conciliation, Education & Training, Ethics, custom) | P2 |
| Meetings: schedule, notify, agenda, attendance, quorum, minutes (draft → approve) | P2 |
| Resolutions with configurable numbering, voting records, effective dates, supersession | P2 |
| Action items with owners and due dates | P2 |
| Governance document repository with confidentiality levels | P2 |
| Compliance calendar (configurable obligations and due dates, e.g. annual reports) | P2 |
| Board performance dashboard (attendance, resolutions, action item closure) | P4 |

## G. General assembly

| Feature | Phase |
|---|---|
| Assembly setup (regular/special), notice & invitations (in-app; email/SMS via adapters) | P2 |
| Configurable eligibility rules → snapshotted voter list | P2 |
| Registration/check-in (search or QR on member ID), live quorum indicator | P2 |
| Agenda, motions, voting (show of hands tally entry or electronic), resolutions | P2 |
| Elections: positions, candidates, secret ballots, canvass, results | P2 |
| Minutes and attendance reports | P2 |

## H. Human resources

Employee profiles (linked to persons), department/position assignment, employment records,
attendance, leave types/balances/requests (approval), performance evaluations, trainings,
staff directory, employee documents — **P4**. Payroll: separate extension, not planned.

## I. Documents

| Feature | Phase |
|---|---|
| Upload/download via signed URLs, folders, categories (CDA/SEC registration, Articles, By-laws, GA minutes, board resolutions, financial reports, membership records, permits & licences, contracts, audit, operational reports) | P2 |
| Versioning, activity history, search (title, tags, full text later) | P2 |
| Access permissions (inherit from folder / record, confidentiality) | P2 |
| Expiry tracking with reminders (permits, contracts) | P2 |
| Approval workflow | P2 |
| Retention policies with disposal review queue | P4 |
| Templates | P4 |

## J. Inventory & procurement

Items (agri produce with lots/moisture/grade attributes, farm inputs, equipment, consumer
goods), UoM conversions, multi-warehouse stock ledger, transfers, adjustments (approval),
low-stock alerts, valuation (weighted average/FIFO), suppliers, requisitions → POs → goods
receipts → supplier invoice (3-way match) — **P4**.

## K. Operations

Business units (configurable: rice trading, milling, input distribution, production,
marketing, consumer store, lending), projects & milestones, activities, sales records,
purchase records, cost allocation, business-unit P&L from GL dimensions, KPI definitions and
values — **P4**.

## L. Reporting & intelligence

| Feature | Phase |
|---|---|
| Basic dashboard (members, share capital) | P2 |
| Financial & portfolio dashboards | P3 |
| Role-specific dashboards, date/branch/department/BU filters, historical comparison | P4 |
| Report builder (saved filters), scheduled reports, XLSX/CSV/PDF | P4–P5 |
| Federation consolidated view (data-sharing grants) | P5 |
| Public API, webhooks, integration logs | P5 |
