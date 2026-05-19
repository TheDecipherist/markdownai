@markdownai v1.0

# MarkdownAI Realistic Workflow: API Service Build

This document represents a real development workflow across 6 phases. It is intentionally
verbose to demonstrate the token cost of loading a full document vs. a single phase.

The entire document is {{ @count test-phase-realistic.md }} lines. When Claude resolves
any single phase, it receives only that phase's body plus this global header - typically
20-30% of the total document size.

@constraint[critical] Never expose credentials or secrets in any output
@constraint[critical] All database operations must use parameterized queries
@constraint[high] API endpoints must validate input before processing
@constraint[high] Error responses must not leak internal implementation details
@constraint[medium] All new code paths must have corresponding test coverage
@constraint[medium] Follow the existing naming conventions throughout

@define section_header(title)
---
## {{ title }}
@end

@define status_block(phase_name, state)
**Phase:** {{ phase_name }} | **Status:** {{ state }}
@end

---

@phase discovery

## Phase 1: Discovery and Requirements

@call status_block(discovery, active)

### What We Are Building

A REST API service that manages user-owned resource collections. Users authenticate
via JWT, own collections of items, and can share collections with other users using
granular permission levels (read, write, admin).

### Stakeholder Requirements

**Product requirements gathered from stakeholder meetings:**

1. Users must be able to register and log in with email/password
2. Each user has a personal collection namespace
3. Collections contain typed items (documents, images, links)
4. Sharing: owner can grant read, write, or admin access to other users
5. Admin-level access allows the grantee to invite additional collaborators
6. All actions are audit-logged with timestamps and actor IDs
7. Collections can be exported as ZIP archives
8. Rate limiting: 100 req/min authenticated, 10 req/min unauthenticated

### Technical Constraints

- Must integrate with existing SSO infrastructure (SAML 2.0)
- Data must stay within the EU region (GDPR compliance)
- Response time SLA: p99 < 500ms for list operations
- Must support concurrent access from up to 10 collaborators per collection
- Soft-delete only - no hard deletes, everything is recoverable for 30 days

### Data Model Sketch

```
User { id, email, display_name, sso_id, created_at, deleted_at }
Collection { id, owner_id, name, description, visibility, created_at, deleted_at }
CollectionItem { id, collection_id, type, content_ref, metadata, created_at }
CollectionAccess { id, collection_id, user_id, role, granted_by, created_at }
AuditLog { id, actor_id, action, resource_type, resource_id, timestamp, details }
```

### Open Questions (to resolve before architecture phase)

- [ ] What is the expected collection size limit? (current proposal: 10,000 items)
- [ ] Should exports be synchronous or async with webhook callback?
- [ ] Do we need real-time collaboration notifications? (websockets?)
- [ ] Is there a retention policy for audit logs?
- [ ] SAML integration - do we own the SP metadata or does platform team?

@on complete -> @phase architecture

@prompt
You are in the Discovery phase. Your job is to:
1. Review the requirements above and identify any gaps or contradictions
2. Flag open questions that must be answered before architecture can begin
3. Draft clarifying questions for the stakeholder meeting
4. Propose a priority order for the open questions above

Do NOT design the system yet - this phase is purely about understanding what to build.
@end

@end

@phase architecture

## Phase 2: Architecture and Design

@call status_block(architecture, active)

### System Architecture

Based on the discovery phase requirements, here is the chosen architecture:

**Service topology:**
```
Client -> API Gateway -> Auth Service -> Resource API
                                    -> Collection Service
                                    -> Audit Service
         API Gateway -> Export Worker (async)
```

**Technology decisions:**
- Runtime: Node.js 20 (TypeScript) - matches existing platform
- Framework: Fastify (chosen over Express for performance profile)
- Database: PostgreSQL 15 (existing infrastructure, GDPR-compliant EU region)
- Cache: Redis 7 (session tokens, rate limiting counters)
- Queue: BullMQ (export jobs)
- Auth: fastify-jwt (JWT RS256, 1h access token, 7d refresh token)
- Object storage: MinIO (EU endpoint) for collection exports

### API Surface

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
DELETE /auth/logout

GET    /collections                  - list owned + accessible
POST   /collections                  - create
GET    /collections/:id              - get details
PATCH  /collections/:id              - update metadata
DELETE /collections/:id              - soft delete

GET    /collections/:id/items        - list items
POST   /collections/:id/items        - add item
GET    /collections/:id/items/:item  - get item
PATCH  /collections/:id/items/:item  - update item
DELETE /collections/:id/items/:item  - soft delete item

GET    /collections/:id/access       - list collaborators
POST   /collections/:id/access       - grant access
PATCH  /collections/:id/access/:uid  - change role
DELETE /collections/:id/access/:uid  - revoke access

POST   /collections/:id/export       - trigger export
GET    /exports/:job_id              - check export status
GET    /exports/:job_id/download     - stream archive
```

### Database Schema (Final)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  sso_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id),
  type TEXT NOT NULL,
  content_ref TEXT,
  metadata JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE collection_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('read', 'write', 'admin')),
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collection_id, user_id)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB
);
```

### Security Architecture

- JWT RS256: private key in Vault, rotated quarterly
- Rate limiting: per-IP for unauthenticated, per-user-ID for authenticated
- Input validation: Zod schemas on all request bodies and query params
- SQL: parameterized queries only - ORM is Drizzle (type-safe, no raw strings)
- Audit log: written synchronously in the same DB transaction as the action
- Export downloads: pre-signed URLs with 15min TTL, no direct S3 access

@on complete -> @phase implementation

@prompt
You are in the Architecture phase. Review the design above and:
1. Identify any gaps between the discovery requirements and this architecture
2. Flag any security concerns in the proposed design
3. Confirm the API surface covers all stakeholder requirements from Discovery
4. Note any performance risks that might violate the p99 SLA requirement

Focus on design validation. Do not write code yet.
@end

@end

@phase implementation

## Phase 3: Implementation

@call status_block(implementation, active)

### Sprint 1 Scope

Implementing the auth and collection core. Items, access management, and export
are in Sprint 2.

### File Structure

```
src/
  auth/
    register.ts       - POST /auth/register handler
    login.ts          - POST /auth/login handler
    refresh.ts        - POST /auth/refresh handler
    middleware.ts     - JWT verify middleware
  collections/
    list.ts           - GET /collections
    create.ts         - POST /collections
    get.ts            - GET /collections/:id
    update.ts         - PATCH /collections/:id
    delete.ts         - DELETE /collections/:id
  db/
    client.ts         - Drizzle client init
    schema.ts         - Table definitions
    migrations/       - Drizzle migration files
  lib/
    audit.ts          - writeAuditLog helper
    rate-limit.ts     - Redis rate limiter
    errors.ts         - Standard error factory
  app.ts              - Fastify instance, plugin registration
  main.ts             - Entry point
```

### Key Implementation Details

**Error factory (`src/lib/errors.ts`):**
All errors return `{ error: string, code: string }` - never expose stack traces
or internal messages. Map internal codes to user-safe messages at the boundary.

**Audit log (`src/lib/audit.ts`):**
Every write operation calls `writeAuditLog(tx, { actorId, action, resourceType, resourceId, details })`
inside the same transaction. If the audit write fails, the whole transaction rolls back.

**Rate limiter (`src/lib/rate-limit.ts`):**
Uses Redis INCR + EXPIRE sliding window. Key format:
- Authenticated: `rl:uid:<userId>:<minuteTimestamp>`
- Unauthenticated: `rl:ip:<hashedIp>:<minuteTimestamp>`
IP is hashed with SHA-256 before storage (PII consideration).

### Environment Variables Required

```
DATABASE_URL=          # PostgreSQL connection string
REDIS_URL=             # Redis connection string
JWT_PRIVATE_KEY=       # RS256 private key (base64)
JWT_PUBLIC_KEY=        # RS256 public key (base64)
MINIO_ENDPOINT=        # MinIO endpoint
MINIO_BUCKET=          # Bucket name for exports
PORT=3000
LOG_LEVEL=info
```

### Completed in Sprint 1

- [x] Drizzle schema and first migration
- [x] Auth register/login/refresh/logout
- [x] JWT middleware (attach user to request)
- [x] Collection CRUD (list, create, get, update, soft-delete)
- [x] Audit log helper
- [x] Redis rate limiter
- [x] Zod validation schemas for all endpoints
- [x] Error factory and boundary mapping

@on complete -> @phase testing

@prompt
You are in the Implementation phase. Your job is to:
1. Review the file structure and confirm it is complete for Sprint 1 scope
2. Flag any missing implementations based on the architecture design
3. Check that the error factory, audit log, and rate limiter patterns are consistent
4. Identify any environment variables that are missing from the list
5. Write or review specific handler implementations if asked

This phase has access to the implementation details above but NOT to the architecture
diagrams or discovery requirements - use your phase content only.
@end

@end

@phase testing

## Phase 4: Testing

@call status_block(testing, active)

### Test Strategy

Three test layers:
1. **Unit tests** - pure functions (error factory, rate limiter math, schema validation)
2. **Integration tests** - handlers with real Postgres (testcontainers) and mocked Redis
3. **E2E tests** - full request/response cycle against a running service instance

### Test Coverage Targets

| Layer | Target | Blocker? |
|-------|--------|----------|
| Unit | 90%+ branch coverage | Yes |
| Integration | All happy paths + key error paths | Yes |
| E2E | All auth flows + collection CRUD | Yes |

### Critical Test Cases

**Auth flow:**
- Register with valid email/password -> 201 + user object (no password_hash)
- Register with duplicate email -> 409 Conflict
- Register with invalid email format -> 400 with field error
- Login with correct credentials -> 200 + access/refresh tokens
- Login with wrong password -> 401 (NOT 404 - do not leak user existence)
- Refresh with expired access token + valid refresh -> 200 + new tokens
- Refresh with expired refresh token -> 401

**Collection access control:**
- Owner can always read/write/delete their own collection
- User with 'read' role cannot modify items
- User with 'write' role can add/edit items but not delete the collection
- User with 'admin' role can grant access to others
- User with no access gets 404 (not 403 - do not leak collection existence)
- Soft-deleted collection returns 404 for all operations

**Rate limiting:**
- Authenticated user making 101 requests/min -> 429 on request 101
- Rate limit keys must be per-user-ID, not per-IP for authenticated requests
- Unauthenticated IP hitting 11 requests/min -> 429 on request 11
- Rate limit resets correctly after the minute window

**Audit log:**
- Every write operation creates an audit entry in the same transaction
- If audit write fails, the entire operation rolls back
- Audit entries include correct actorId, action, resourceType, resourceId

### Test Infrastructure

```typescript
// testcontainers setup
import { PostgreSqlContainer } from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer
let db: DrizzleClient

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15').start()
  db = createClient(container.getConnectionUri())
  await runMigrations(db)
}, 60_000)

afterAll(async () => {
  await container.stop()
})
```

### Current Test Status

- [x] Unit tests: error factory, rate limiter, Zod schemas - PASSING
- [x] Integration: auth register, login, refresh - PASSING
- [x] Integration: collection CRUD happy paths - PASSING
- [ ] Integration: access control matrix - IN PROGRESS
- [ ] Integration: rate limiting - BLOCKED (Redis mock interface mismatch)
- [ ] E2E: full auth + collection flow - NOT STARTED

@on complete -> @phase review

@prompt
You are in the Testing phase. Your job is to:
1. Review the test coverage targets and identify any gaps in the test case list
2. Diagnose the Redis mock interface mismatch blocking rate limit tests
3. Draft the missing access control matrix integration tests
4. Propose an E2E test structure for the auth + collection flow
5. Identify any edge cases in the critical test cases list that are missing

You have access to the test strategy and test cases above. You do NOT have access
to the implementation code or architecture design - work from what is here.
@end

@end

@phase review

## Phase 5: Code Review

@call status_block(review, active)

### Review Checklist

All items below must be checked before this phase is marked complete.

**Security review:**
- [ ] No raw SQL strings - confirm all queries go through Drizzle
- [ ] No internal error details in API responses - verify error factory coverage
- [ ] JWT private key never logged - check all log statements
- [ ] Rate limiter IP hashing is SHA-256 (not MD5) - verify in rate-limit.ts
- [ ] Soft-delete returns 404 not 403 for access-denied cases - verified
- [ ] Audit log cannot be bypassed - every write path goes through audit helper
- [ ] No secrets in environment variable defaults - confirm all envs have no defaults

**Performance review:**
- [ ] Collection list query uses index on owner_id and (collection_id, user_id) pair
- [ ] Item list uses cursor pagination (no OFFSET) for large collections
- [ ] Export job does not block the request handler thread
- [ ] Redis rate limiter uses pipelining (not individual INCR + EXPIRE calls)

**Code quality:**
- [ ] No file exceeds 300 lines
- [ ] No function exceeds 50 lines
- [ ] All handlers follow the same error boundary pattern
- [ ] TypeScript strict mode enabled, no `any` usage
- [ ] All exported types have explicit signatures (no inferred exports)

### Review Findings (so far)

**BLOCKER - rate-limit.ts line 47:**
Using two separate Redis commands (INCR then EXPIRE) instead of a pipeline.
Under high concurrency, the EXPIRE might not execute if the process crashes
after INCR, creating keys that never expire. Fix: use a Lua script or pipeline.

**WARNING - collections/list.ts line 23:**
The query joins collection_access for the "accessible collections" case but
does not have a covering index for (user_id, role) on collection_access.
Under load with many collaborators, this will be a full table scan.

**INFO - auth/register.ts:**
The `display_name` field silently trims whitespace but does not validate
minimum length after trimming. A display name of "   " (spaces) becomes "".
Add a post-trim length check (min 1 character).

### Sign-off Requirements

This phase is complete when:
1. All BLOCKER findings are resolved and re-reviewed
2. All WARNING findings are either fixed or documented with accepted risk
3. The full test suite passes (from testing phase)
4. A second reviewer has approved the PR

@on complete -> @phase deployment

@prompt
You are in the Code Review phase. Your job is to:
1. Work through the review checklist above - mark each item as passed or flagged
2. Investigate the BLOCKER finding for rate-limit.ts and propose the fix
3. Propose an index strategy for the collection_access table performance issue
4. Draft the display_name validation fix for auth/register.ts
5. Identify any review findings that are not yet captured above

You have access to the review findings and checklist. You do NOT have access to
the implementation phase content or test results.
@end

@end

@phase deployment

## Phase 6: Deployment

@call status_block(deployment, active)

### Deployment Target

Kubernetes cluster in EU-West-1 region. Existing GitOps pipeline - push to main
triggers ArgoCD sync. Helm chart in `deploy/charts/api-service/`.

### Pre-Deployment Checklist

**Infrastructure:**
- [ ] Database migration applied to staging - verified with `drizzle-kit migrate`
- [ ] Redis cluster has sufficient memory for rate limit keyspace (estimate: 50MB peak)
- [ ] MinIO bucket created with lifecycle policy (30-day auto-delete for exports)
- [ ] Secrets loaded into Vault - JWT keys, database URL, Redis URL
- [ ] Kubernetes secrets sync'd via External Secrets Operator

**Application:**
- [ ] Docker image built and pushed to registry
- [ ] Image tag pinned in Helm values (not `latest`)
- [ ] Health check endpoint `/health` returns 200 with correct content-type
- [ ] Readiness probe configured (waits for DB connection before serving traffic)
- [ ] Liveness probe configured (restarts if handler loop hangs)
- [ ] HPA configured: min 2 replicas, max 10, target CPU 70%

**Rollout:**
- [ ] Deploy to staging first, smoke test against staging data
- [ ] Load test staging with k6: 500 concurrent users, 5min sustained
- [ ] Confirm p99 < 500ms under load test conditions
- [ ] Canary: deploy to 10% of prod traffic, monitor for 30min
- [ ] Full rollout: promote to 100% if error rate stays below 0.1%

### Rollback Plan

If error rate exceeds 0.5% within 30min of full rollout:
1. `kubectl rollout undo deployment/api-service` (immediate)
2. Verify old version is serving traffic
3. Check if the DB migration needs reverting (new columns are additive - safe to leave)
4. Open incident, notify on-call

### Post-Deployment Verification

```bash
# Smoke test sequence
curl -X POST https://api.example.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"Test1234!","display_name":"Smoke"}'

# Verify: 201 Created, no password_hash in response

curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"Test1234!"}'

# Verify: 200 OK, access_token and refresh_token in response
# Save access_token as $TOKEN for next steps

curl https://api.example.com/collections \
  -H "Authorization: Bearer $TOKEN"

# Verify: 200 OK, empty array []
```

@prompt
You are in the Deployment phase. Your job is to:
1. Work through the pre-deployment checklist and flag any missing items
2. Verify the rollback plan covers the database migration scenario
3. Draft the k6 load test script for the 500-concurrent-user test
4. Propose monitoring alerts to configure before the canary rollout
5. Identify any gaps in the post-deployment verification steps

You have access ONLY to the deployment content above. You do NOT have access to
implementation details, test results, or architecture decisions from other phases.
@end

@end

---

@prompt
## Full Document MCP Verification

list_phases("MDs/tests/test-phase-realistic.md")
Expected: discovery, architecture, implementation, testing, review, deployment

resolve_phase("MDs/tests/test-phase-realistic.md", "discovery")
Expected: discovery body + global header only. MUST NOT contain architecture
database schema, implementation file structure, or deployment checklists.

Each resolve_phase call should return roughly 15-25% of the full document size.
This is the token saving that MarkdownAI phases provide.
@end
