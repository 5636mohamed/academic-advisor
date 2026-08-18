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
- **Authentication**: login (`packages/web/src/auth/`) is a demo mechanism
  keyed off the seeded synthetic roster (`docs/LOGIN_CREDENTIALS.md`) —
  credentials are intentionally simple and published in the docs for
  demo purposes. This is **not** a production-grade auth system (no
  password hashing, no session tokens, no rate limiting), and the project
  should not be deployed with real user data without a proper auth layer
  first.
- **Role isolation mechanism (applies equally to every role)**: every
  role — student, professor, the 5 individual advisors, and the Vice
  President alike — is enforced the same two ways, and no role gets a
  stronger guarantee than any other: (1) client-side route guards
  (`packages/web/src/auth/RequireRole.tsx`) redirect a session that
  doesn't match a route's required role, verified to correctly bounce
  every other role away from every route (including a student typing
  another student's portal URL, and an advisor typing another advisor's
  student id directly into a URL); and (2) basic query-param-based
  server-side scoping (e.g. `GET /api/students?advisorId=...`) that is
  real filtering, not just what the UI happens to show — confirmed live
  by calling the API directly, bypassing the UI entirely. Neither of
  these is a session/token system: any raw API call can still ask for
  any id's data, exactly as documented in the Authentication point
  above. The advisor/Vice-President roles added later in the project's
  life were deliberately held to this *same* rigor, not a stronger one
  — so this isn't a silent, undocumented gap between older and newer
  roles.

Reports about either of the above being "insecure" are welcome as
discussion but are known, not novel — please focus reports on things like
injection, authorization bypass *between the app's own defined roles*
(e.g. a student endpoint returning another student's data, or a student
role reaching an advisor-only action), or dependency vulnerabilities.

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
