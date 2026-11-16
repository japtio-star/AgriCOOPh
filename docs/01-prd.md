# COOP-OS — Product Requirements Document

Version 0.1 · Draft for approval · 2026-11-16

## 1. Product summary

COOP-OS is a multi-tenant SaaS platform that lets Philippine cooperatives run membership,
capital, finance, lending, governance, people, documents and operations in one system.

> "Everything your cooperative needs to operate, manage, monitor, and grow — in one platform."

## 2. Problem

Most small and mid-sized Philippine cooperatives run on paper ledgers, spreadsheets and
disconnected tools. Consequences:

- The member register, share capital records and loan ledgers disagree with each other.
- Preparing financial statements and regulatory reports takes weeks of manual reconciliation.
- Board resolutions and assembly minutes are hard to find, and decisions are hard to trace.
- Managers and boards lack a timely view of cash, delinquency, and business-unit performance.
- Personal data of members is stored without access controls (a Data Privacy Act exposure).

## 3. Target customers

| Segment | Typical size | Modules most needed |
|---|---|---|
| Agricultural / producers' coops | 50–2,000 members | Membership, Share Capital, Inventory (inputs/produce), Operations, Loans |
| Multipurpose coops (MPC) | 200–10,000 | All |
| Credit coops | 500–50,000 | Membership, Share Capital, Savings, Loans, Finance |
| Marketing coops | 50–1,000 | Membership, Inventory, Operations, Finance |
| Consumers' coops | 100–5,000 | Membership, Inventory, Operations (store), Finance |
| Federations | 5–200 member coops | Federation view, Documents, Reports (Phase 5) |

## 4. Personas

| Persona | Goals | Pain today | Key screens |
|---|---|---|---|
| **General Manager** | Know cash, collections and business performance today | Reports arrive weeks late | Manager dashboard, approvals inbox |
| **Board Director / Chair** | Oversight, approve policy, trace decisions | Minutes lost, no data between meetings | Board dashboard, resolutions, meeting packs |
| **Treasurer** | Control cash, approve disbursements | Paper vouchers | Cash position, approvals |
| **Bookkeeper / Accountant** | Accurate books, timely statements | Re-keying from subledgers | Journal, GL, trial balance, period close |
| **Membership Officer** | Register and maintain members | Duplicate/incomplete records | Member list, applications, profile |
| **Loan Officer** | Process applications, collect | Manual amortization tables | Loan pipeline, collections |
| **Credit Committee member** | Decide on loans fairly | Incomplete files | Review queue with member credit profile |
| **Cashier** | Record receipts and payments fast | Long queues at payday | Teller screen: receive payment, issue receipt |
| **HR Officer** | Staff records, leave | Paper 201 files | Employee profiles, leave |
| **Inventory Officer** | Stock accuracy | Stockouts, shrinkage | Stock levels, movements |
| **Internal Auditor / Audit Committee** | Independent verification | No audit trail | Read-only access + audit log |
| **Member** | See own capital, savings, loans; participate in assembly | Must visit office | Member portal |
| **Platform operator (COOP-OS staff)** | Onboard and bill tenants, support them | — | SaaS admin portal |

## 5. Goals and non-goals

### Goals (first 12 months)

1. A cooperative can onboard itself (with platform verification) and be operating its member
   register and share capital ledger within one day, with CSV import from spreadsheets.
2. Every financial movement is traceable to a user, a time, an approval and a source document.
3. Data of one cooperative is never visible to another, verified by automated tests.
4. Managers and boards see current, permission-appropriate indicators without asking staff.
5. Modules are optional and configurable so that a 60-member farmers' coop and a 10,000-member
   MPC both find the product fits.

### Non-goals (explicitly out of scope until revisited)

- Payroll computation (separate extension later; HR keeps employee records only).
- BIR e-filing or e-invoicing submission; tax settings are configurable, not filed by us.
- Direct submission to CDA systems; we produce reports for human review and submission.
- Agricultural credit scoring (AniTala.online's domain — integrated, not rebuilt).
- Native mobile apps (responsive web first; PWA later).
- Offline-first data capture (candidate for Phase 5).

## 6. Functional requirements

Module-level features are enumerated in [05-modules-features.md](05-modules-features.md). This
section lists cross-cutting requirements that every module must satisfy.

| ID | Requirement |
|---|---|
| FR-1 | Every tenant record carries `organization_id`; all reads/writes are scoped to the active organization. |
| FR-2 | A user may belong to several organizations; they choose an active organization; permissions are evaluated per organization (and branch where scoped). |
| FR-3 | Every module can be enabled/disabled per organization, constrained by the subscription plan. Disabled modules disappear from navigation and their APIs return 404 for that tenant. |
| FR-4 | Every create/update/delete/approve/reject/export action writes an audit log entry with actor, time, IP, before/after values. |
| FR-5 | Records needing history are archived (soft-deleted), never hard-deleted. Posted financial transactions are immutable; corrections use reversal entries. |
| FR-6 | Approval workflows are configurable per document type: number of steps, approver roles, amount thresholds; the maker cannot approve their own record. |
| FR-7 | All lists support search, filter, sort, pagination, CSV/XLSX export (permission-gated), and print-friendly views. |
| FR-8 | All money is PHP by default, stored in exact decimal; dates displayed in Asia/Manila; date format configurable (default `MMM d, yyyy` / `MM/DD/YYYY`). |
| FR-9 | Philippine addresses use the PSGC hierarchy (Region → Province → City/Municipality → Barangay) plus street/purok/sitio text. |
| FR-10 | Philippine mobile numbers are validated and stored in E.164 (`+639XXXXXXXXX`); input accepts `09XX XXX XXXX`. |
| FR-11 | Numbering (member no., OR no., JV no., resolution no., loan account no.) is configurable per organization and concurrency-safe. |
| FR-12 | Every module offers attachments through the shared document service with the same access rules as the parent record. |
| FR-13 | Notifications are delivered in-app; email/SMS when an adapter is configured. |
| FR-14 | Demonstration tenants are flagged `is_demo` and are excluded from all platform metrics and billing; demo data is never written into a production tenant. |

## 7. Non-functional requirements

| Area | Target |
|---|---|
| Availability | 99.5% monthly (MVP), 99.9% target for paid Enterprise |
| Performance | p95 < 500 ms for list pages up to 50k members; dashboard < 2 s |
| Usability | Core tasks (register member, record share payment, receive loan payment) in ≤ 3 screens; usable at 360 px width; WCAG 2.2 AA |
| Language | English UI at launch; i18n-ready strings for Filipino later |
| Connectivity | Usable on 3G-class connections: server rendering, < 200 KB initial JS per route target |
| Security | See [09-security-architecture.md](09-security-architecture.md) |
| Backups | Daily full + continuous WAL (PITR 7–35 days by plan); restore tested quarterly |
| Data retention | Configurable per record class; defaults agreed with counsel |
| Auditability | Every financial figure on a report drills down to journal lines and source documents |

## 8. Philippine context requirements

- **Regulatory references** the design accounts for: Philippine Cooperative Code of 2008
  (RA 9520) and CDA issuances; Data Privacy Act of 2012 (RA 10173) and NPC issuances;
  applicable financial reporting frameworks for cooperatives as issued/adopted by CDA; BIR
  rules for tax-exempt and non-exempt transactions.
- **Configurable, not hardcoded**: statutory fund allocation of net surplus, interest on share
  capital and patronage refund computation, voting eligibility rules, share capital limits per
  member, membership classes (regular/associate), fiscal year, tax rates and exemptions.
- **No compliance claims**: report templates are labelled as templates; each has a version,
  an effective date, and a "reviewed by" field to be filled by a qualified professional.
- **Privacy by design**: consent capture at member registration (purpose-specific), data
  subject access export, correction requests, retention schedules, DPO contact per tenant,
  breach-incident log.

## 9. Commercial model

Plans (Starter / Professional / Enterprise), prices, user limits, storage limits, and the
modules each plan unlocks are **data** managed in the SaaS admin portal — nothing is hardcoded.
Add-ons let a tenant enable a single module beyond its plan. Trials have a configurable
duration and convert or expire into read-only mode (data is never deleted on expiry without
the retention process).

Indicative packaging (configurable):

| | Starter | Professional | Enterprise |
|---|---|---|---|
| Membership, Documents, basic dashboard | ✓ | ✓ | ✓ |
| Share Capital, Finance, Governance, GA, Reporting | — | ✓ | ✓ |
| Savings, Loans | add-on | add-on | ✓ |
| HR, Inventory, Procurement, Operations | — | add-on | ✓ |
| Multiple branches, advanced permissions, API access | — | — | ✓ |

## 10. Success metrics

- Time from signup to first 100 members imported: < 1 day.
- % of share capital and loan transactions entered by coop staff (vs. support): > 95%.
- Monthly active staff users per tenant; % of tenants closing a financial period monthly.
- Zero cross-tenant access incidents.
- Net revenue retention; trial-to-paid conversion.

## 11. Assumptions and open questions

1. Pilot cooperatives will supply sample ledgers and amortization schedules for golden tests.
2. A Philippine CPA familiar with cooperative accounting will review the default chart of
   accounts, posting rules and statement templates before Phase 3 goes live.
3. Counsel / DPO will confirm retention defaults and hosting region.
4. AniTala.online will provide an API specification and credentials before E-integration work.
5. Is the first production tenant a federation or a primary cooperative? (See review §6.)
