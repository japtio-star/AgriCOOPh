# COOP-OS — API Architecture

Version 0.1 · Draft for approval

## 1. Principles

- One domain layer, two transports: the web UI uses server components/server actions; the
  REST API uses route handlers. **Both call the same service functions**, so rules and
  permissions cannot diverge.
- REST, JSON, versioned under `/api/v1`. OpenAPI 3.1 generated from Zod schemas
  (`zod-to-openapi`) and published at `/api/v1/openapi.json` with a docs page.
- Tenant is part of the path: `/api/v1/orgs/{orgSlug}/…`. Never accepted in a body.
- Resource IDs are UUIDs; human numbers (`member_no`) are filterable fields.

## 2. Authentication

| Client | Mechanism |
|---|---|
| Browser (first-party) | HttpOnly, Secure, SameSite=Lax session cookie + CSRF token header on mutations |
| Server-to-server (tenant integrations) | Org-scoped API keys (`coop_live_…`), hashed at rest, with explicit permission scopes and optional IP allowlist; Enterprise plan |
| Third-party apps (later) | OAuth 2.1 authorization code + PKCE, org-scoped consent |
| Platform admin | Separate session audience; MFA required |

API keys act as a *service principal* with a role — they go through the same permission and
audit pipeline as users.

## 3. Conventions

```
GET    /api/v1/orgs/{org}/members?status=active&branch=…&q=dela%20cruz&sort=-membership_date&limit=50&cursor=…
POST   /api/v1/orgs/{org}/members
GET    /api/v1/orgs/{org}/members/{id}
PATCH  /api/v1/orgs/{org}/members/{id}
POST   /api/v1/orgs/{org}/members/{id}:archive          # state transitions are explicit actions
POST   /api/v1/orgs/{org}/membership-applications/{id}:approve
POST   /api/v1/orgs/{org}/journal-entries/{id}:post
POST   /api/v1/orgs/{org}/journal-entries/{id}:reverse
```

- **Pagination**: cursor-based (`limit` ≤ 200, `next_cursor`).
- **Filtering/sorting**: whitelisted fields per resource.
- **Idempotency**: `Idempotency-Key` header required on money-moving POSTs (payments,
  deposits, withdrawals, releases); stored 24 h per org.
- **Concurrency**: `ETag`/`If-Match` (row version) on PATCH and state transitions to prevent
  lost updates.
- **Money** as decimal strings (`"1250.00"`), never JSON numbers; dates as `YYYY-MM-DD`;
  instants ISO-8601 with offset.
- **Errors**: RFC 9457 problem+json:

```json
{
  "type": "https://docs.coop-os.ph/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "errors": [{ "path": "mobile", "message": "Enter a valid PH mobile number, e.g. 0917 123 4567" }],
  "request_id": "01J…"
}
```

  Status usage: 400 malformed · 401 unauthenticated · 403 forbidden · 404 not found *or* not in
  your tenant/module disabled (no existence leak) · 409 state conflict (e.g. posting a posted
  entry) · 412 ETag mismatch · 422 validation · 429 rate limited.

- **Rate limits**: per IP for auth endpoints; per user and per API key for the rest; headers
  `RateLimit-Limit/Remaining/Reset`.
- **Field-level redaction**: response serializers drop fields the caller lacks permission for
  (e.g. member government IDs).

## 4. Resource catalogue (v1, by phase)

| Phase | Resources |
|---|---|
| P1 | `me`, `orgs`, `branches`, `departments`, `users`, `invitations`, `roles`, `permissions`, `modules`, `audit-logs`, `notifications`, `approval-policies`, `approvals`, `files` (`:upload-intent`, `:confirm`, `:download-url`), `number-sequences`; admin: `admin/tenants`, `admin/plans`, `admin/subscriptions`, `admin/invoices`, `admin/announcements`, `admin/tickets` |
| P2 | `members`, `membership-applications`, `membership-classes`, `custom-fields`, `member-imports`, `share-types`, `share-subscriptions`, `share-transactions`, `capital-withdrawals`, `documents`, `folders`, `committees`, `officer-terms`, `meetings`, `agenda-items`, `attendance`, `minutes`, `resolutions`, `action-items`, `assemblies`, `elections`, `ballots` |
| P3 | `accounts`, `journal-entries`, `ledger`, `cash-receipts`, `disbursements`, `bank-accounts`, `periods`, `statements/*`, `posting-rules`, `deposit-products`, `savings-accounts`, `savings-transactions`, `interest-runs`, `loan-products`, `loan-applications`, `loans`, `loan-payments`, `reports/par` |
| P4 | `employees`, `leave-requests`, `items`, `warehouses`, `stock-movements`, `requisitions`, `purchase-orders`, `goods-receipts`, `suppliers`, `business-units`, `projects`, `sales`, `kpis`, `budgets` |
| P5 | `webhooks`, `api-keys`, `integrations/*`, `federation/*` |

## 5. Webhooks (outbound, P5)

- Event types from the outbox, e.g. `member.created`, `loan.released`,
  `share_transaction.posted`.
- Payload contains IDs and minimal fields; receivers fetch details with their API key
  (limits PII spread).
- Signed with HMAC-SHA256 (`COOPOS-Signature: t=…,v1=…`), 5-minute tolerance, retries with
  exponential backoff, delivery log visible to tenant admins.

## 6. Integration layer

```
src/server/integrations/
  email/        EmailProvider        → smtp (dev: Mailpit), provider adapters later
  sms/          SmsProvider          → mock; PH aggregator adapter when contracted
  payments/     PaymentGateway       → mock; PH gateway adapter when contracted
  credit/       CreditAssessmentProvider → manual (default), anitala (when spec available)
  knowledge/    KnowledgeHubClient   → mock (AgriCOOPh Knowledge Management Hub)
  google/       Google OAuth sign-in (P1); Workspace APIs later
```

Rules:

- Each adapter implements a typed interface; the active implementation is chosen per org in
  `/settings/integrations`. Mock implementations are clearly labelled in the UI.
- **No third-party endpoints are invented.** Real adapters are written only against published
  documentation or a provided specification.
- Credentials stored encrypted (envelope encryption with a KMS-managed key); never returned
  by the API after save.
- Inbound webhooks verify signatures per provider spec and are idempotent by event ID.
- Every outbound/inbound call writes an `integration_logs` row (status, latency, redacted
  payload).
