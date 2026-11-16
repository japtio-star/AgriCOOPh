# COOP-OS — Security & Data Protection Architecture

Version 0.1 · Draft for approval

## 1. Threat model (top risks)

| Threat | Control |
|---|---|
| Cross-tenant data access (bug or malicious user) | App scoping + RLS (fail-closed) + composite FKs; isolation test suite; CI RLS coverage check |
| Privilege escalation inside a tenant | Server-side permission checks in services; guard-rail invariants; role-change audit + notification |
| Insider fraud (fictitious loans, altered ledgers) | Maker-checker, amount limits, immutable postings, reversals only, period locks, auditor read access, anomaly reports (e.g. back-dated entries) |
| Account takeover | Strong password policy (length + breached-password check), MFA for privileged roles, rate limiting and progressive delays, session revocation, login alerts |
| Data exfiltration via exports/APIs | Export permissions, audit + watermark, field-level redaction, API key scopes, rate limits |
| Exposed documents | Private bucket, signed URLs (~60 s), authorization per download, no public file route |
| Injection / XSS / CSRF | Prisma parameterized queries; raw SQL only via tagged templates; React escaping; strict CSP; CSRF tokens + SameSite cookies; uploads never rendered inline from our origin |
| Platform staff overreach | No default tenant access; tenant-granted, time-boxed support sessions; dual audit logs |
| Data loss | PITR backups, offsite logical dumps, object versioning, tested restores |

## 2. Identity & sessions

- Passwords hashed with **argon2id** (or scrypt where argon2 is unavailable), never bcrypt
  with low cost, never reversible.
- Sessions stored server-side; cookie `__Host-` prefixed, HttpOnly, Secure, SameSite=Lax;
  idle timeout 30 min (configurable), absolute 12 h; rotation on login and privilege change.
- MFA (TOTP + recovery codes) required for CA, GM, TRS, ACC and platform staff.
- Generic login errors (no account enumeration); lockout with exponential backoff.
- Invitations are single-use, expiring tokens, stored hashed.

## 3. Authorization

See [04-roles-permissions.md](04-roles-permissions.md). Enforcement points:

1. Middleware: authenticated session, org membership, module enabled.
2. Service: `authorize(ctx, permission, resource?)` incl. ABAC policies.
3. Database: RLS for tenant boundary; triggers for immutability.
4. Serializer: field-level redaction.

UI hiding is a convenience only and never the control.

## 4. Data protection (RA 10173 alignment)

Privacy by design measures built into the product (tenant cooperatives remain the personal
information controllers; COOP-OS acts as processor under a data processing agreement):

- **Data inventory**: every PII field tagged in the schema registry (`pii: true`, category).
- **Minimisation**: optional fields are optional; government ID numbers stored only if the
  coop enables them; masked by default in the UI (`•••• 1234`) with reveal audited.
- **Encryption**: TLS 1.2+ in transit; storage encryption at rest (managed DB/bucket);
  application-level encryption for high-sensitivity fields (government IDs, TIN, integration
  secrets) using envelope encryption.
- **Consent**: purpose-specific consent records with version of the privacy notice; withdrawal
  supported.
- **Data subject rights**: access export (JSON/PDF), correction requests workflow, erasure
  handled as anonymisation where legal retention applies.
- **Retention**: per-record-class policies; disposal review queue; legal hold flag.
- **Breach readiness**: incident log, affected-tenant identification query, notification
  templates; tenants are supported to meet NPC notification timelines.
- **DPO**: each tenant records its DPO contact; platform DPO for COOP-OS itself.
- **Logs**: no PII in application logs (structured logger with redaction); audit logs hold
  diffs and are access-restricted.

## 5. Application security controls

| Control | Implementation |
|---|---|
| Input validation | Zod at every boundary; size limits on bodies and uploads |
| Rate limiting | Postgres-backed token buckets at MVP (Redis optional later); stricter for auth, exports, money-moving endpoints |
| Security headers | CSP (nonce-based), HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none |
| CORS | Same-origin only for cookie auth; API keys used server-to-server only |
| File uploads | MIME sniffing, extension allowlist, size caps per plan, malware scan, `Content-Disposition: attachment` on download |
| Secrets | Env vars from a secret manager; validated at boot; no fallbacks; rotated |
| Dependencies | Lockfile, automated audit in CI, Renovate/Dependabot |
| Error handling | Problem+json to clients without stack traces; full error with `requestId` to error tracker |
| Admin monitoring | Alerts on: role escalation, bulk export, support access, failed-login spikes, RLS denials |

## 6. Financial integrity controls

- Double-entry balance enforced in the database at posting time.
- Posted records immutable (trigger); corrections by reversal with reference to the original.
- Closed periods reject postings; reopening requires approval and is audited.
- Gap-free numbering for official receipts and vouchers.
- Daily integrity job: subledger balances vs. GL control accounts; materialised balances vs.
  transaction sums; discrepancies notify ACC, GM and IA.

## 7. Infrastructure

- Separate DB roles: `coopos_owner` (migrations), `coopos_app` (RLS enforced),
  `coopos_platform` (admin portal tables), `coopos_readonly` (reporting replicas).
- Private networking between app, DB and storage; DB not publicly reachable.
- Backups: PITR (7–35 days by plan), nightly logical dump to a separate account, quarterly
  restore drill recorded in PROGRESS.
- Environments isolated (dev/staging/prod) with no production data copied to lower
  environments; demo data generated, never sampled from production.

## 8. Security testing

- Tenant isolation suite (every tenant table: read/write/FK cross-tenant attempts).
- Permission matrix suite (every role × permission).
- SoD suite (self-approval, subject-approval, limit, edit-after-post, closed period).
- Auth suite (enumeration, lockout, session fixation, CSRF).
- Pre-launch third-party penetration test; findings tracked in PROGRESS.
