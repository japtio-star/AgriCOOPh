# COOP-OS — Roles & Permission Matrix

Version 0.1 · Draft for approval

## 1. Model

Authorization has two layers, both evaluated server-side in the service layer:

1. **RBAC** — a role is a named set of permission keys within one organization.
   Permission key format: `module.resource.action`, e.g. `loans.application.approve`.
   Actions: `view`, `create`, `edit`, `delete` (archive), `approve`, `reject`, `export`,
   `print`, `manage` (settings).
2. **Policies (ABAC)** — rules that look at the record and the actor, applied after RBAC:
   - **Scope**: a role assignment may be limited to branch(es); records outside are invisible.
   - **Ownership**: `self` scope (member portal sees only the linked member's records).
   - **Segregation of duties**: maker ≠ checker; subject ≠ approver.
   - **Amount limits**: approval authority per role per document type (`approval_policies`).
   - **State**: posted / approved records cannot be edited — only reversed through a new,
     separately approved transaction.
   - **Confidentiality**: governance items flagged `board_only` / `restricted`.

System roles are **templates**. On tenant creation they are copied into the tenant, where the
Cooperative Administrator can adjust them or create new roles — except that a small set of
**guard-rail invariants** (below) can't be overridden by configuration.

A user can hold several roles; effective permissions are the union, but SoD policies are
evaluated per record, so holding both "Accountant" and "Treasurer" still does not let a user
approve an entry they prepared.

## 2. Role catalogue

| Code | Role | Scope | Purpose |
|---|---|---|---|
| PSA | SaaS Super Administrator | Platform only | Tenants, plans, billing, platform health. **No tenant data access** by default |
| CA | Cooperative Administrator | Org | Configure org, users, roles, modules. Not a financial approver by default |
| GM | General Manager | Org | Run operations, approve within limits |
| BOD | Board of Directors | Org | Oversight, governance, approve policy-level items |
| TRS | Treasurer | Org | Cash custody approvals, disbursement approval |
| ACC | Accountant / Bookkeeper | Org/branch | Prepare and post financial records |
| MO | Membership Officer | Org/branch | Member register, applications, share capital entry |
| LO | Loan Officer | Org/branch | Loan applications, evaluation, collections |
| CC | Credit Committee | Org | Decide loan applications per policy |
| CSH | Cashier / Teller | Branch | Receive and pay out cash against approved documents |
| HR | HR Officer | Org | Employee records, leave |
| INV | Inventory Officer | Branch/warehouse | Stock, receiving, transfers |
| DM | Department Manager | Department | Own department's operations and staff |
| IA | Internal Auditor / Audit Committee | Org | Read-only across modules + audit logs |
| MBR | Cooperative Member | Self | Own records via portal |

## 3. Guard-rail invariants (not configurable)

1. Nobody approves a record they created, or a record where they are the subject (own loan,
   own withdrawal, own leave).
2. Posted journal entries, posted subledger transactions and approved resolutions are
   immutable; corrections are new reversal/amendment records with their own approval.
3. The `IA` template can never receive `create/edit/delete/approve` on operational records.
   (A tenant may assign an auditor a second role, which is then visible in the access review.)
4. `PSA` has no tenant-data permissions; tenant access only through a tenant-granted,
   time-boxed, audited support session.
5. At least one active `CA` must exist per org; the last `CA` cannot remove themselves.
6. Role and permission changes are audited and notify all other `CA`s.
7. Exports of personal data are permission-gated, audited and watermarked with user + time.

## 4. Matrix

Letters: **V** view · **C** create · **E** edit · **D** archive · **A** approve · **R** reject ·
**X** export · **P** print · **M** manage settings. `own` = only records linked to self.
`br` = limited to assigned branch(es). `agg` = aggregated figures only, no personal records.
`ltd` = within configured amount limit. Blank = none.

### 4.1 Platform & administration

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Organization profile, branches, departments | VCEM | V | V | V | V | V | V | V | V | V | V | V | V | |
| Users & invitations | VCED | V | | | | | | | | | | | V | |
| Roles & permissions | VCEDM | V | V | | | | | | | | | | V | |
| Module enablement (within plan) | VM | V | V | | | | | | | | | | V | |
| Subscription & billing (tenant view) | VM | V | V | V | | | | | | | | | V | |
| Audit log | V | V | V | | | | | | | | | | VXP | |
| Approval policies & limits | VM | V | VA | | | | | | | | | | V | |

### 4.2 Membership & share capital

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Member profiles | V | V | V | V | V | VCED br | V | V | V | | | | VXP | V own |
| Member PII (gov IDs, documents) | | V | | | | VCE br | V | V | | | | | V | V own |
| Membership applications | V | VAR | VAR | | | VCE | | | | | | | V | C own |
| Member status changes (terminate etc.) | | VC | VAR | | | VC | | | | | | | V | |
| Member directory export | | VX | V agg | | | VXP | | | | | | | VXP | |
| Membership config (classes, fields, numbering) | VM | V | V | | | V | | | | | | | V | |
| Share types & policy | V | V | VAM | V | V | V | | | | | | | V | |
| Share capital transactions | | V | V agg | V | VC | VC br | V | V | VC br | | | | VXP | V own |
| Capital withdrawal requests | | VA ltd | VAR | VA | V | VC | | | | | | | V | C own |
| Capital statements & reports | | VXP | VXP | VXP | VXP | VXP | V | V | | | | | VXP | VP own |

### 4.3 Finance

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chart of accounts | V | V | V | V | VCEM | | | | | | | | V | |
| Journal entries (draft) | | V | | V | VCED | | | | | | | | V | |
| Journal approval / posting | | VA ltd | | VA ltd | | | | | | | | | V | |
| Reversals | | VA | | VA | VC | | | | | | | | V | |
| Cash receipts | | V | | V | VC | | | | VC br | | | | V | |
| Disbursement vouchers | | VA ltd | VA | VA ltd | VC | | | | VC br pay | | | VC dept | V | |
| Bank accounts & reconciliation | | V | | VCE | VCE | | | | | | | | V | |
| Budgets | | VCEA | VA | V | VCE | | | | | | | VC dept | V | |
| Financial periods (close) | | VA | | V | VC | | | | | | | | V | |
| Financial statements & TB | | VXP | VXP | VXP | VXP | | | | | | | V dept | VXP | |
| Posting rules / tax settings | | V | | | VM | | | | | | | | V | |

### 4.4 Savings & loans

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deposit / loan products | V | VCE | VA | V | V | | V | V | | | | | V | V |
| Savings accounts | | V | V agg | V | V | VC | V | | V br | | | | VXP | V own |
| Deposits | | V | | V | V | | | | VC br | | | | V | V own |
| Withdrawals | | VA ltd | | VA ltd | V | | | | VC br | | | | V | C own |
| Interest computation run | | VA | | V | VC | | | | | | | | V | |
| Loan applications | | V | V agg | V | V | | VCE | V | | | | | VXP | C own |
| Loan evaluation / credit assessment | | V | | | | | VCE | V | | | | | V | |
| Loan approval | | VAR ltd | VAR ltd | | | | | VAR ltd | | | | | V | |
| Loan release | | VA | | VA | V | | VC | | VC br | | | | V | |
| Loan payments | | V | | V | V | | VC | | VC br | | | | V | V own |
| Restructure / write-off | | VC | VAR | V | VC | | VC | VR | | | | | V | |
| Portfolio, PAR, delinquency reports | | VXP | VXP | VXP | VXP | | VXP br | VXP | | | | | VXP | |

### 4.5 Governance & general assembly

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Board & officer directory | VCE | V | V | V | V | V | V | V | V | V | V | V | V | V |
| Committees | VCE | V | VCE | V | | | | V own | | | | | V | |
| Board meetings, agenda, minutes | | V | VCEAP | V | | | | | | | | | V | |
| Board-only / restricted docs | | | V | | | | | | | | | | V | |
| Resolutions | | V | VCEA | V | V | V | V | V | | | | | VXP | V public |
| Action items | | VCE | VCE | V own | V own | V own | V own | V own | | V own | V own | V own | V | |
| General assembly setup | | VC | VCEA | | | VC | | | | | | | V | |
| GA registration & quorum | | V | V | | | VC | | | | | | | V | C own |
| Voting & elections | | V | V | | | VC | | | | | | | V | C own (vote) |
| Election committee functions | Assigned via the configured Election Committee role (custom) | | | | | | | | | | | | | |

### 4.6 HR, documents, inventory, procurement, operations

| Resource | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Employee profiles | | V | V agg | | | | | | | VCED | | V dept | V | |
| Leave requests | | VA | | | | | | | | VCE | | VA dept | V | |
| Performance reviews | | VCEA | | | | | | | | VCE | | VCE dept | V | |
| Documents (general) | VCED | VCED | V | V | VC | VC | VC | V | | VC | VC | VC dept | V | V shared |
| Document categories, retention | VM | V | V | | | | | | | | | | V | |
| Document approval | | VA | VA | | | | | | | | | VA dept | V | |
| Items, warehouses | | V | | | V | | | | | | VCEM | V | V | |
| Stock movements / adjustments | | VA | | | V | | | | | | VC | V | V | |
| Requisitions | | VA ltd | | | | | | | | | VC | VCA dept | V | |
| Purchase orders | | VA ltd | VA | VA | V | | | | | | VC | V | V | |
| Goods receipts | | V | | | V | | | | | | VC | V | V | |
| Business units, projects, KPIs | | VCEM | V | V | V | | | | | | | VCE dept | V | |
| Sales records | | V | | V | V | | | | VC br | | V | VC dept | V | |

### 4.7 Reports & dashboards

| Dashboard | CA | GM | BOD | TRS | ACC | MO | LO | CC | CSH | HR | INV | DM | IA | MBR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Manager dashboard | | ✓ | | | | | | | | | | | ✓ | |
| Board dashboard | | ✓ | ✓ | | | | | | | | | | ✓ | |
| Treasurer dashboard | | ✓ | | ✓ | | | | | | | | | ✓ | |
| Accountant dashboard | | ✓ | | ✓ | ✓ | | | | | | | | ✓ | |
| Department dashboard | | ✓ | | | | | | | | | | ✓ dept | ✓ | |
| Admin dashboard (users, usage) | ✓ | ✓ | | | | | | | | | | | ✓ | |
| Member portal summary | | | | | | | | | | | | | | ✓ own |

Each dashboard widget declares the permission it needs and the module it depends on; widgets
for disabled modules or unpermitted data are not rendered (and their API calls are not made).

## 5. Platform (SaaS admin) roles

| Role | Capabilities |
|---|---|
| Platform Owner | Everything below + manage platform staff |
| Platform Operations | Tenant verification, activation/suspension, plans, announcements |
| Billing | Subscriptions, invoices, payment status |
| Support | Tickets; request support access (requires tenant grant) |
| Read-only Analyst | Aggregated platform metrics only (excludes demo tenants) |

All platform staff require MFA. Platform actions affecting a tenant are written to both the
platform audit log and the tenant's audit log.

## 6. Testing the matrix

The matrix is encoded in `src/server/platform/rbac/templates.ts`. An automated test generates
one case per (role × permission) and asserts the API returns 403 for every permission the
role does not hold, plus dedicated SoD tests (self-approval, subject-approval, limit
exceeded, edit-after-post).
