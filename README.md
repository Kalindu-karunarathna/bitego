# BiteGo

A mobile marketplace that helps local food shops sell surplus food before it is wasted.
Shops post surplus items near closing time, nearby users are notified and can reserve them,
and other shops can be notified and buy them too.

SE5104 mini project, Faculty of Computing, Sabaragamuwa University of Sri Lanka (Group 01).

## Tech stack

| Part | Technology |
| --- | --- |
| Mobile app | React Native (Expo), TypeScript |
| Backend API + admin dashboard | Next.js (App Router), TypeScript |
| Shared code | `packages/shared` (types and validation) |
| Database / auth | Supabase (Postgres), Prisma |
| Notifications | Push notifications |
| Hosting | Vercel (web) |

## Repository structure

```
bitego/
├─ apps/
│  ├─ mobile/        # Expo + React Native app
│  └─ web/           # Next.js: API (/api/v1) and admin dashboard
├─ packages/
│  └─ shared/        # types and validation shared by mobile and web
├─ docs/             # architecture, API notes, diagrams
├─ .github/          # CI workflow, PR template, CODEOWNERS
├─ .nvmrc            # Node version
└─ package.json      # npm workspaces root
```

This is a monorepo managed with **npm workspaces**.

## Prerequisites

- [Node.js 22](https://nodejs.org/) (check with `node -v`; the project pins the version in `.nvmrc`)
- npm (comes with Node)
- Git
- Expo Go app on your phone (to run the mobile app), or an Android emulator

## Getting started

```bash
# 1. Install dependencies (run this ONLY at the repo root)
npm install

# 2. Create your local env files, then fill in the values you receive from the team
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

On Windows PowerShell use `Copy-Item` instead of `cp`.

Never commit `.env` files. Secrets are shared privately, never in this repo.

## Running the project

```bash
npm run dev:web      # Next.js at http://localhost:3000
npm run dev:mobile   # Expo dev server (scan the QR code with Expo Go)
```

Testing on a physical phone: set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your
computer's LAN IP (for example `http://192.168.1.10:3000`), with both on the same Wi-Fi.

## Useful commands

```bash
npm run lint         # lint all packages
npm run typecheck    # TypeScript check for all packages

# add a dependency to one package (run from the root)
npm install axios -w @bitego/mobile
```

Rules for npm in this repo:

- Run `npm install` only at the root, never inside `apps/*`.
- Always commit `package-lock.json`.
- If `package-lock.json` conflicts during a merge, do not edit it by hand: resolve
  `package.json` first, then run `npm install` to regenerate it.

## Team workflow (fork and pull request)

The original repository has `main` (final code) plus one branch per team member.
Members work in their own fork and send changes by pull request.

### One-time setup (each member)

1. Fork this repository on GitHub. Untick "Copy the main branch only" so the member branches come with it.
2. Clone **your fork** and add the original as `upstream`:

   ```bash
   git clone https://github.com/<your-username>/bitego.git
   cd bitego
   git remote add upstream https://github.com/<owner-username>/bitego.git
   git checkout <your-branch-name>
   npm install
   ```

### Daily workflow

```bash
# 1. Sync first
git fetch upstream
git checkout <your-branch-name>
git merge upstream/<your-branch-name>
git merge upstream/main
npm install

# 2. Work on a short feature branch
git checkout -b <your-name>/<short-feature-name>
# ... code, then commit
git add .
git commit -m "feat(listings): add create listing endpoint"
git push -u origin <your-name>/<short-feature-name>
```

3. On GitHub, open a pull request:
   - base repository: the original repo
   - **base branch: your member branch** (not `main`)
   - head: your feature branch in your fork
4. After review and merge into your member branch, the repo owner reviews your member branch
   and merges it into `main`.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
`chore:`, `refactor:`. Keep each PR small and focused on one feature or fix.

### Database schema changes

Only one PR touching `apps/web/prisma/` should be open at a time. Tell the team, get it merged
first, and everyone syncs before running migrations.

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Final, working code (owner merges here) |
| `kajanika` | Member branch |
| `nistha` | Member branch |
| `sachira` | Member branch |
| `karunarathna` | Member branch |

## Security notes

- Never commit `.env` files, API keys, signing keys or database URLs.
- The Supabase service-role key is server-only and must never appear in the mobile app.
  Anything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by users.
- Do not commit real personal data (contact details, survey or interview responses).

## License

Add a license here (for example MIT) or state "All rights reserved" for coursework.
