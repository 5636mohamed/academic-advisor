# Security Policy

## Supported Versions

This project does not yet publish tagged releases — `master` is the only
actively maintained line, and security fixes are applied there.

| Version | Supported          |
| ------- | ------------------ |
| `master` | :white_check_mark: |
| older commits / forks | :x: |

## Project scope and known limitations

This is a demonstration/academic-project implementation of an advising
system, built to match `docs/BUILD_SPEC.md`. Before reporting an issue,
please note what's already a known, intentional limitation rather than a
vulnerability to fix:

- **Data store**: `packages/api` uses an in-memory data store
  (`db/memory/inMemoryDb.ts`) seeded with synthetic data on startup —
  nothing is persisted to disk, and there is no real student data anywhere
  in this repository.
- **Authentication (updated — real as of v1.3.0)**: login
  (`POST /api/auth/login`) now does real, server-side password
  verification and issues a real session token, replacing the earlier
  client-only demo login (a plain `localStorage` blob with no server
  round-trip at all). Concretely: passwords are hashed server-side
  (Node's built-in `scrypt` + `timingSafeEqual`, `packages/api/src/
  modules/auth/authPassword.service.ts` — no new dependency), sessions
  are real opaque tokens (`crypto.randomUUID()`) stored server-side with
  a 24h TTL, and every request carries the token via `Authorization:
  Bearer <token>`. What's **still** a deliberate demo simplification, not
  a gap: the passwords themselves remain shared, publicly-documented
  constants (`docs/LOGIN_CREDENTIALS.md`) — one per role, not real
  per-user secrets — and there's no rate limiting on login attempts.
  Sessions live in the same in-memory store as everything else in this
  demo (`db/memory/inMemoryDb.ts`) and reset on every server restart/
  redeploy, same as every other collection there. The project should
  still not be deployed with real user data without swapping in real
  per-user credentials first — the hashing/session primitives this
  introduces are what a real deployment would reuse, but the passwords
  behind them are not real secrets.
- **Role isolation and per-request authorization (real, server-enforced
  as of v1.3.0)**: every route in `server.ts` now composes a real guard
  (`packages/api/src/modules/auth/guards.ts`) in front of its handler,
  checked against the authenticated session, not a client-supplied
  id/role that was previously trusted at face value. Concretely: a
  student can only ever reach their own record; an advisor can only
  reach a student who is *really* on their own roster (checked against
  the student's actual `advisorId` — this specific check did not exist
  at all before v1.3.0: any advisor could previously reach any student
  purely because nothing verified the URL parameter against who was
  asking) or their own advisor-scoped routes; the Vice President can
  reach everything, matching the VP's institution-wide oversight role
  everywhere else in the app. Client-side route guards
  (`packages/web/src/auth/RequireRole.tsx`) still exist as a first line
  of UX (bouncing a session toward its own pages before a request is
  even made), but the real enforcement is now server-side and verified
  by directly calling the API with another role's token, bypassing the
  UI entirely — not just what the UI happens to show.
  A few narrower, explicitly documented residual gaps remain (not
  silently inconsistent with the rest): `PUT /api/admin/prediction-
  weights` still uses an older single `x-role` header rather than a real
  session, since no login identity for that role exists in the app at
  all; two proposal-approval routes keyed only by a proposal id (no
  student/advisor id in the URL to check ownership against) get a
  role-only check rather than a full ownership chain; marking a single
  notification read (no role/recipient parameter at all) requires a
  valid session but can't verify the notification belongs to the caller.

Reports about the remaining documented gaps above are welcome as
discussion but are known, not novel — please focus reports on things like
injection, authorization bypass *between the app's own defined roles*
(e.g. a student endpoint returning another student's data, or a student
role reaching an advisor-only action) that ISN'T one of the documented
exceptions above, session/token handling flaws, or dependency
vulnerabilities.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

Instead, report it privately using one of these two channels:

1. **GitHub Security Advisories** (preferred): go to the
   [Security tab](https://github.com/5636mohamed/academic-advisor/security/advisories)
   of this repository and click **"Report a vulnerability"**.
2. **Email**: send details to **mohamed.e.elhariry@gmail.com** with a subject
   line starting with `[SECURITY]`.

Please include, as applicable:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- The affected file(s)/endpoint(s)
- Any suggested fix, if you have one

### What to expect

- **Acknowledgement**: within 5 business days of your report.
- **Assessment**: we'll confirm whether it's a valid issue and its
  severity, and let you know our plan.
- **Fix and disclosure**: once a fix is available, we'll coordinate with
  you on disclosure timing. We ask that you give us a reasonable window to
  fix the issue before any public disclosure.

We don't currently run a bug bounty program, but genuine, responsibly
disclosed reports will be credited (with your permission) in the fix's
commit message or release notes.

Thank you for helping keep this project and its users safe.
