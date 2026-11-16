# COOP-OS — Database Design & ERD

Version 0.1 · Draft for approval · PostgreSQL 16

## Conventions

- Primary keys: `id uuid` (UUIDv7, time-ordered).
- Every tenant-owned table: `organization_id uuid NOT NULL`, RLS enabled + forced,
  `UNIQUE (organization_id, id)` to support composite foreign keys.
- Timestamps: `created_at`, `updated_at` (`timestamptz`), `created_by`, `updated_by`.
- Archival: `archived_at`, `archived_by` on records that must be retained (no hard delete).
- Money: `numeric(18,2)`; rates `numeric(9,6)`; quantities `numeric(18,4)`.
- Status columns are Postgres enums or `text` + `CHECK`.
- Business dates (`posting_date`, `membership_date`) use `date`; instants use `timestamptz`.
- Names in `snake_case`; Prisma models map with `@@map`.

Legend in diagrams: **(T)** = tenant table with RLS. Platform tables have no `organization_id`.

---

## 1. Platform core

```mermaid
erDiagram
  PLANS ||--o{ PLAN_MODULES : includes
  MODULES ||--o{ PLAN_MODULES : ""
  ORGANIZATIONS ||--o{ SUBSCRIPTIONS : has
  PLANS ||--o{ SUBSCRIPTIONS : ""
  SUBSCRIPTIONS ||--o{ INVOICES : bills
  INVOICES ||--o{ PAYMENTS : ""
  ORGANIZATIONS ||--o{ ORGANIZATION_MODULES : enables
  MODULES ||--o{ ORGANIZATION_MODULES : ""
  ORGANIZATIONS ||--o{ BRANCHES : has
  ORGANIZATIONS ||--o{ DEPARTMENTS : has
  BRANCHES ||--o{ DEPARTMENTS : "optional"
  USERS ||--o{ ORGANIZATION_MEMBERSHIPS : "belongs to"
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : ""
  ORGANIZATION_MEMBERSHIPS ||--o{ ROLE_ASSIGNMENTS : ""
  ROLES ||--o{ ROLE_ASSIGNMENTS : ""
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : ""
  USERS ||--o{ SESSIONS : ""
  USERS ||--o{ AUTH_ACCOUNTS : "password / google"
  ORGANIZATIONS ||--o{ AUDIT_LOGS : ""
  ORGANIZATIONS ||--o{ NOTIFICATIONS : ""

  ORGANIZATIONS {
    uuid id PK
    text slug UK
    text legal_name
    text coop_type "agri|mpc|credit|producers|marketing|consumers|federation|other"
    text cda_registration_no
    date registration_date
    text tin
    text status "pending_verification|active|suspended|closed"
    bool is_demo
    text timezone "Asia/Manila"
    text currency "PHP"
    int fiscal_year_start_month
    jsonb settings
  }
  PLANS {
    uuid id PK
    text code UK
    text name
    numeric price_monthly
    numeric price_yearly
    int max_users
    int max_members
    bigint storage_bytes
    bool is_active
  }
  MODULES {
    text key PK "membership|share_capital|finance|savings|loans|governance|assembly|hr|documents|inventory|procurement|operations|reports|api"
    text name
  }
  ORGANIZATION_MODULES {
    uuid organization_id FK
    text module_key FK
    bool enabled
    text source "plan|addon|trial"
  }
  SUBSCRIPTIONS {
    uuid id PK
    uuid organization_id FK
    uuid plan_id FK
    text status "trialing|active|past_due|read_only|cancelled"
    date current_period_start
    date current_period_end
    date trial_ends_on
  }
  USERS {
    uuid id PK
    citext email UK
    text full_name
    text mobile_e164
    bool email_verified
    bool mfa_enabled
    timestamptz disabled_at
  }
  ORGANIZATION_MEMBERSHIPS {
    uuid id PK
    uuid organization_id FK
    uuid user_id FK
    uuid member_id FK "nullable - links portal user to member"
    uuid employee_id FK "nullable"
    text status "invited|active|suspended"
  }
  ROLES {
    uuid id PK
    uuid organization_id FK "null = system template"
    text key
    text name
    bool is_system
  }
  PERMISSIONS {
    text key PK "e.g. membership.member.approve"
    text module_key
    text description
  }
  ROLE_ASSIGNMENTS {
    uuid id PK
    uuid membership_id FK
    uuid role_id FK
    uuid branch_id FK "null = all branches"
    date valid_from
    date valid_to
  }
  AUDIT_LOGS {
    uuid id PK
    uuid organization_id FK
    uuid actor_user_id
    text action
    text entity_type
    uuid entity_id
    jsonb before
    jsonb after
    inet ip
    text request_id
    timestamptz at
  }
```

Additional platform-core tables: `branches` (T), `departments` (T), `approval_policies` (T),
`approval_requests` (T), `approval_actions` (T), `number_sequences` (T),
`custom_field_definitions` (T), `files` (T), `notifications` (T), `notification_preferences`
(T), `outbox_events` (T), `support_access_grants` (T), `platform_users`,
`platform_announcements`, `support_tickets`, `api_keys` (T), `webhook_endpoints` (T),
`integration_logs` (T), `psgc_regions/provinces/cities/barangays` (reference),
`data_sharing_grants` (T, for federations), `consent_records` (T), `dsar_requests` (T).

`audit_logs` is append-only: the app role has `INSERT, SELECT` only; a trigger blocks
`UPDATE/DELETE`. Partitioned by month.

---

## 2. Membership & share capital

```mermaid
erDiagram
  PERSONS ||--o| MEMBERS : "is"
  MEMBERS ||--o{ MEMBER_STATUS_HISTORY : ""
  MEMBERSHIP_APPLICATIONS ||--o| MEMBERS : "approved into"
  MEMBERSHIP_CLASSES ||--o{ MEMBERS : classifies
  MEMBERS ||--o{ MEMBER_CONTACTS : "emergency/next of kin"
  MEMBERS ||--o{ MEMBER_DOCUMENTS : ""
  MEMBERS ||--o{ SHARE_SUBSCRIPTIONS : subscribes
  SHARE_TYPES ||--o{ SHARE_SUBSCRIPTIONS : ""
  SHARE_SUBSCRIPTIONS ||--o{ SHARE_CAPITAL_TRANSACTIONS : ""
  MEMBERS ||--o{ SHARE_CAPITAL_TRANSACTIONS : ""
  MEMBERS ||--o{ CAPITAL_WITHDRAWAL_REQUESTS : ""

  PERSONS {
    uuid id PK
    uuid organization_id FK
    text first_name
    text middle_name
    text last_name
    text suffix
    date birth_date
    text sex
    text civil_status
    text mobile_e164
    text email
    text tin
    text psgc_barangay_code
    text address_line
    uuid photo_file_id
  }
  MEMBERS {
    uuid id PK
    uuid organization_id FK
    uuid person_id FK
    text member_no UK "per org"
    uuid membership_class_id FK
    uuid branch_id FK
    date membership_date
    text status "applicant|active|inactive|suspended|terminated|deceased|withdrawn"
    jsonb custom_fields
    timestamptz archived_at
  }
  MEMBERSHIP_CLASSES {
    uuid id PK
    uuid organization_id FK
    text name "e.g. Regular, Associate"
    bool has_voting_rights
    bool can_borrow
    bool can_hold_office
  }
  SHARE_TYPES {
    uuid id PK
    uuid organization_id FK
    text name "e.g. Common, Preferred"
    numeric par_value
    numeric min_subscription
    numeric max_holding_pct "configurable cap"
    bool voting
  }
  SHARE_SUBSCRIPTIONS {
    uuid id PK
    uuid organization_id FK
    uuid member_id FK
    uuid share_type_id FK
    int shares_subscribed
    numeric amount_subscribed
    date subscribed_on
    text status "active|fully_paid|cancelled"
  }
  SHARE_CAPITAL_TRANSACTIONS {
    uuid id PK
    uuid organization_id FK
    uuid member_id FK
    uuid subscription_id FK
    text type "payment|adjustment|transfer_in|transfer_out|withdrawal|dividend_capitalization|reversal"
    numeric amount
    date posting_date
    text reference_no
    uuid reverses_id FK
    uuid journal_entry_id FK "nullable until GL"
    text status "posted|reversed"
  }
```

Balances (paid-up, unpaid subscription) are derived from transactions and materialised in
`member_share_balances` (updated in the same transaction) for fast reads; a nightly job
re-verifies them.

---

## 3. Finance (double entry)

```mermaid
erDiagram
  ACCOUNTS ||--o{ ACCOUNTS : "parent"
  ACCOUNTS ||--o{ JOURNAL_LINES : ""
  FINANCIAL_PERIODS ||--o{ JOURNAL_ENTRIES : ""
  JOURNAL_ENTRIES ||--|{ JOURNAL_LINES : "2..n"
  JOURNAL_ENTRIES ||--o| JOURNAL_ENTRIES : "reverses"
  POSTING_RULES }o--|| ACCOUNTS : "debit/credit"
  BANK_ACCOUNTS }o--|| ACCOUNTS : "GL link"
  BUDGETS ||--o{ BUDGET_LINES : ""
  BUDGET_LINES }o--|| ACCOUNTS : ""
  PARTIES ||--o{ AR_AP_DOCUMENTS : ""

  ACCOUNTS {
    uuid id PK
    uuid organization_id FK
    text code UK "per org"
    text name
    text type "asset|liability|equity|revenue|expense"
    text normal_balance "debit|credit"
    uuid parent_id FK
    bool is_postable
    bool is_active
  }
  FINANCIAL_PERIODS {
    uuid id PK
    uuid organization_id FK
    int fiscal_year
    int period_no
    date starts_on
    date ends_on
    text status "open|soft_closed|closed"
  }
  JOURNAL_ENTRIES {
    uuid id PK
    uuid organization_id FK
    text entry_no UK
    date posting_date
    uuid period_id FK
    uuid branch_id FK
    text source "manual|share_capital|savings|loans|inventory|operations|cash_receipt|disbursement"
    uuid source_id
    text memo
    text status "draft|pending_approval|posted|reversed"
    uuid reverses_entry_id FK
    uuid posted_by
    timestamptz posted_at
  }
  JOURNAL_LINES {
    uuid id PK
    uuid organization_id FK
    uuid journal_entry_id FK
    uuid account_id FK
    numeric debit
    numeric credit
    uuid branch_id
    uuid business_unit_id
    uuid department_id
    uuid member_id "subsidiary ref"
  }
  POSTING_RULES {
    uuid id PK
    uuid organization_id FK
    text event_type "e.g. share_capital.payment"
    uuid product_id "nullable"
    uuid debit_account_id FK
    uuid credit_account_id FK
  }
```

DB-level guarantees: `CHECK (debit >= 0 AND credit >= 0 AND (debit = 0) <> (credit = 0))`
per line; deferred constraint trigger for balance at posting; immutability trigger for posted
entries; period status check on insert. Other tables: `cash_receipts`, `disbursement_vouchers`,
`bank_accounts`, `bank_transactions`, `parties` (customers/suppliers/others),
`ar_ap_documents`, `budgets`, `budget_lines`, `tax_codes`, `pending_postings`.

Financial statements are computed from `journal_lines` grouped by account type/period, with
`account_period_balances` snapshots written at period close.

---

## 4. Savings & loans

```mermaid
erDiagram
  DEPOSIT_PRODUCTS ||--o{ SAVINGS_ACCOUNTS : ""
  MEMBERS ||--o{ SAVINGS_ACCOUNTS : owns
  SAVINGS_ACCOUNTS ||--o{ SAVINGS_TRANSACTIONS : ""
  LOAN_PRODUCTS ||--o{ LOAN_APPLICATIONS : ""
  MEMBERS ||--o{ LOAN_APPLICATIONS : applies
  LOAN_APPLICATIONS ||--o{ LOAN_COMAKERS : ""
  LOAN_APPLICATIONS ||--o{ CREDIT_ASSESSMENTS : "manual or AniTala"
  LOAN_APPLICATIONS ||--o| LOANS : "released as"
  LOANS ||--|{ LOAN_SCHEDULE_LINES : ""
  LOANS ||--o{ LOAN_PAYMENTS : ""
  LOAN_PAYMENTS ||--|{ LOAN_PAYMENT_ALLOCATIONS : "penalty/interest/principal"
  LOANS ||--o{ LOAN_AGING_SNAPSHOTS : "daily PAR"

  DEPOSIT_PRODUCTS {
    uuid id PK
    uuid organization_id FK
    text name
    numeric annual_rate
    text interest_method "daily_balance|average_daily|minimum_monthly"
    text posting_frequency
    numeric min_balance
    numeric withdrawal_approval_threshold
  }
  LOAN_PRODUCTS {
    uuid id PK
    uuid organization_id FK
    text name
    numeric annual_rate
    text interest_method "diminishing|straight_line|add_on|interest_only_balloon"
    text repayment_frequency "weekly|semi_monthly|monthly|quarterly|harvest_based|lump_sum"
    int min_term
    int max_term
    numeric max_amount
    numeric max_multiple_of_share_capital
    jsonb fees_and_charges
    jsonb penalty_policy
    text day_count "30_360|actual_365"
  }
  LOANS {
    uuid id PK
    uuid organization_id FK
    text loan_no UK
    uuid member_id FK
    uuid product_id FK
    numeric principal
    date released_on
    date maturity_date
    text status "active|paid|restructured|written_off"
    numeric outstanding_principal
    int days_past_due
  }
```

---

## 5. Governance & general assembly

```mermaid
erDiagram
  COMMITTEES ||--o{ COMMITTEE_MEMBERSHIPS : ""
  OFFICER_TERMS }o--|| PERSONS : ""
  MEETINGS ||--o{ AGENDA_ITEMS : ""
  MEETINGS ||--o{ MEETING_ATTENDANCE : ""
  MEETINGS ||--o| MINUTES : ""
  MEETINGS ||--o{ RESOLUTIONS : ""
  RESOLUTIONS ||--o{ VOTES : ""
  MEETINGS ||--o{ ACTION_ITEMS : ""
  ELECTIONS ||--o{ CANDIDATES : ""
  ELECTIONS ||--o{ BALLOTS : ""

  MEETINGS {
    uuid id PK
    uuid organization_id FK
    text kind "board|committee|general_assembly|special_ga"
    uuid committee_id FK "nullable"
    timestamptz scheduled_at
    text venue
    text mode "in_person|online|hybrid"
    text quorum_rule "configured snapshot"
    int eligible_count
    text status "scheduled|in_session|adjourned|cancelled"
    text confidentiality "public_to_members|board_only|restricted"
  }
  RESOLUTIONS {
    uuid id PK
    uuid organization_id FK
    text resolution_no UK
    uuid meeting_id FK
    text title
    text body
    text status "draft|approved|rejected|superseded"
    date effective_on
  }
  VOTES {
    uuid id PK
    uuid organization_id FK
    uuid resolution_id FK
    uuid voter_member_id
    text choice "yes|no|abstain"
    numeric weight "1 by default; configurable"
  }
```

Voting eligibility is evaluated by a configurable rule set (membership class, good standing
criteria such as paid-up capital or no delinquent loans, attendance requirements) and the
evaluated eligible voter list is **snapshotted** per meeting/election so results stay
reproducible. Secret ballots store `ballots` without a link to the voter; a separate
`ballot_issuance` records who voted.

---

## 6. HR, documents, inventory, procurement, operations

Listed as tables; diagrams to be expanded when the phase starts.

| Domain | Tables (all T) |
|---|---|
| HR | `employees` (→ persons), `positions`, `employment_records`, `attendance_records`, `leave_types`, `leave_balances`, `leave_requests`, `performance_reviews`, `trainings`, `training_attendance` |
| Documents | `folders`, `documents`, `document_versions` (→ files), `document_categories`, `document_permissions`, `document_approvals`, `document_templates`, `retention_policies`, `document_activity` |
| Inventory | `items`, `item_categories`, `units_of_measure`, `warehouses`, `stock_ledger` (append-only movements), `stock_balances`, `stock_transfers`, `stock_adjustments`, `item_lots` (for produce/inputs with expiry) |
| Procurement | `suppliers` (→ parties), `purchase_requisitions`, `purchase_orders`, `po_lines`, `goods_receipts`, `gr_lines`, `supplier_invoices` |
| Operations | `business_units`, `projects`, `project_milestones`, `activities`, `sales_documents`, `sales_lines`, `kpi_definitions`, `kpi_values`, `cost_allocations` |
| Federation | `federation_affiliations`, `data_sharing_grants`, `shared_report_submissions` |

Inventory valuation: weighted average by default, FIFO optional per org; `stock_ledger` is the
source of truth and `stock_balances` a maintained projection.

---

## 7. Indexing & scale notes

- Every tenant table: leading `organization_id` in its primary lookup indexes.
- Member search: `pg_trgm` GIN index on normalised full name; btree on `member_no`.
- `journal_lines (organization_id, account_id, posting_date)` for ledger and statements.
- `audit_logs` and `stock_ledger` partitioned by month.
- 500-member demo tenant and a 50k-member synthetic tenant used in performance tests.
