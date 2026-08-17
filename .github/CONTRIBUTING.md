# Contributing to Academic Advising & Early-Warning System

Thanks for your interest in contributing! This document covers how the
project is organized, how to get a local environment running, and what's
expected of a pull request.

By participating in this project you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Table of contents

- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Running the app locally](#running-the-app-locally)
- [Tests and type-checking](#tests-and-type-checking)
- [Making changes](#making-changes)
- [Coding conventions](#coding-conventions)
- [Commit messages](#commit-messages)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Security issues](#security-issues)

## Project structure

This is an npm-workspaces monorepo:

```
packages/
  api/      Express + TypeScript backend, in-memory data store, business rules
  web/      React + Vite frontend (student portal, advisor console, faculty console)
  shared/   Types shared between api and web
docs/
  BUILD_SPEC.md       The functional specification — source of truth for behavior
  HANDBOOK_RULES.md    Academic bylaws the advising logic must follow
  DECISION_TREE.md     The advising-cycle decision flow
```

`docs/BUILD_SPEC.md` and `docs/HANDBOOK_RULES.md` are the two documents
every advising/grading/registration rule is expected to satisfy — **when a
rule looks wrong or a bug looks like a business-logic question, check these
first** before assuming intended behavior one way or the other.

For the full dependency list (what's used, what version, and why) and how
the live deployment (GitHub Pages + Railway) fits together, see the
[README's Tech Stack section](../README.md#tech-stack) rather than this
file duplicating it.

## Getting started

Prerequisites: Node.js 18+ and npm.

```bash
git clone https://github.com/5636mohamed/academic-advisor.git
cd academic-advisor
npm install --workspaces
```

## Running the app locally

Two dev servers, run in separate terminals:

```bash
# Terminal 1 — API (port 3001)
cd packages/api
npm run dev

# Terminal 2 — Web (port 5173, proxies /api to the server above)
cd packages/web
npm run dev
```

Then open `http://localhost:5173`. Demo login credentials for every role
(student, advisor, professor) are documented in `docs/LOGIN_CREDENTIALS.md`.

## Tests and type-checking

Before opening a pull request, make sure these all pass:

```bash
# Backend unit tests
cd packages/api
npm run test

# Frontend type-checking
cd packages/web
npm run typecheck
```

New backend logic (grading, probation/dismissal, transfer rules, venture
matching, prediction) should come with unit tests under
`packages/api/test/unit/`, following the structure already there — most
modules have a `describe` block per rule with named test cases mapped to
specific spec examples.

## Making changes

1. Fork the repository and create a branch off `master`:
   ```bash
   git checkout -b feature/short-description
   ```
2. Make your changes, keeping them focused — a PR that does one thing is
   much easier to review than one that mixes an unrelated refactor with a
   bug fix.
3. Run the tests/type-check above.
4. Push your branch and open a pull request against `master`.

## Coding conventions

- **TypeScript everywhere** — avoid `any`; prefer the types already defined
  in `packages/shared`.
- **Business logic belongs in `packages/api/src/modules/`**, not in route
  handlers or React components — routes should stay thin, components should
  stay presentational.
- **Frontend styling** uses a shared `.su-*` design-token system
  (`packages/web/src/portal/student-theme.css`) across the student portal,
  advisor console, and faculty console — reuse existing `.su-*` classes
  before adding new CSS, and make sure any new rule has both a light-mode
  and dark-mode value (see the existing `--su-*` custom properties).
- **Responsive by default** — grid/flex containers that hold a wide table
  or card need `min-width: 0` on every level between the container and the
  overflowing content (a flex/grid item's default `min-width: auto` blocks
  shrinking below its content's natural width — this has bitten this
  project before).
- Match the style of the surrounding code (naming, comment density, file
  organization) rather than introducing a new pattern in one spot.

## Commit messages

Write a clear, specific summary line, followed by a blank line and a body
explaining *why* the change was made when it isn't obvious from the diff
alone (root cause of a bug, the spec section a rule maps to, a trade-off
you considered). Reference the relevant `docs/BUILD_SPEC.md` /
`docs/HANDBOOK_RULES.md` section when a change implements or fixes a
business rule.

## Submitting a pull request

- Describe **what** changed and **why** in the PR description.
- Link any related issue.
- Include screenshots or a short clip for UI changes — this project cares
  about visual consistency across the three portals.
- Note which tests you ran and confirm the full suite passes.
- Keep the PR scoped — unrelated fixes should be their own PR.

A maintainer will review and may ask for changes before merging.

## Reporting bugs

Open a GitHub issue with:
- What you expected to happen vs. what actually happened
- Steps to reproduce (which role/portal, which page, which action)
- Whether the behavior contradicts a specific rule in `docs/BUILD_SPEC.md`
  or `docs/HANDBOOK_RULES.md`, if applicable

## Suggesting features

Open a GitHub issue describing the use case and, if it changes advising
behavior, which section of the handbook/spec it should be consistent with.
This project deliberately avoids adding features that aren't grounded in
the spec/handbook, so a proposal that changes behavior should explain how
it fits.

## Security issues

**Do not open a public issue for a security vulnerability.** See
[SECURITY.md](SECURITY.md) for how to report it privately.
