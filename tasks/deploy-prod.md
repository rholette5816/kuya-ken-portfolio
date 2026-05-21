# Task: deploy-prod

## Goal
Deploy the current state of `kuya-ken-portfolio/` to Vercel production via the Vercel CLI. Report the live URL.

## Why
The portfolio has been committed to git but is not auto-deploying from GitHub. We need the latest hero polish + funnel wiring live at `https://www.kradigital.site` immediately. CLI deploy is the fastest path because the project is already linked (`.vercel/project.json` exists with `projectId: prj_tmaA5pHtFiij3UzMF98nr5xqSGZK`).

## Files to modify
None.

## Files to create
None.

## Files to delete
None. Do not touch `.vercel/` contents.

## Constraints
- Inherits from `AGENTS.md`. Especially: do not modify `package.json`, `next.config.mjs`, `vercel.json`, or `middleware.ts`.
- Do not commit or push anything.
- Do not run `vercel login`. If the CLI is unauthenticated, stop and report — login requires browser interaction that cannot run in `--full-auto` mode.
- Do not create or modify env vars on Vercel via CLI. Env values were already set in the Vercel dashboard.
- Do not pass any flags to `vercel` other than the ones listed below.

## Execution plan

Run the steps below in order. If any step fails, **stop immediately** and report the failing step + the full error output. Do not retry, do not improvise, do not "try a different command."

### Step 1: Verify prerequisites

```bash
node --version
npm --version
```

Both must succeed. If `node` is missing, stop and report.

### Step 2: Ensure Vercel CLI is installed

```bash
vercel --version
```

If this command fails with "command not found" (or equivalent), install it:

```bash
npm install -g vercel
```

Then re-run `vercel --version` to confirm install succeeded.

### Step 3: Verify authentication

```bash
vercel whoami
```

- If this prints a username/email: authenticated, continue to Step 4.
- If this fails with an auth error or prompts for login: **stop and report**. Tell Claude that Ken needs to run `vercel login` manually once before the deploy can proceed.

### Step 4: Verify project link

From inside `kuya-ken-portfolio/`:

```bash
cat .vercel/project.json
```

Must contain `projectId: prj_tmaA5pHtFiij3UzMF98nr5xqSGZK`. If the file is missing or has a different projectId, **stop and report**. Do not run `vercel link`.

### Step 5: Deploy to production

From inside `kuya-ken-portfolio/`:

```bash
vercel --prod --yes
```

Capture the full stdout. The last line of output should be a URL (e.g. `https://kuya-ken-portfolio-abc123.vercel.app` or `https://www.kradigital.site`).

If the deploy fails:
- Build error: capture the full build log and report. Do not attempt to fix.
- Auth error: report — Ken needs to re-authenticate.
- Quota error: report — Ken needs to check Vercel plan limits.

### Step 6: Report

Output exactly this format:

```
SPEC: tasks/deploy-prod.md
DEPLOY:
  - vercel CLI version: <version>
  - authenticated as: <whoami output>
  - project: prj_tmaA5pHtFiij3UzMF98nr5xqSGZK
  - production URL: <URL from vercel --prod output>
  - canonical URL: https://www.kradigital.site
CHECKS:
  - cli installed: PASS
  - authenticated: PASS
  - project link: PASS
  - deploy: PASS
NOTES: <anything Claude should know on review, e.g. build warnings>
```

## Acceptance criteria
- [ ] `vercel --version` returns a version number
- [ ] `vercel whoami` succeeds without prompting for login
- [ ] `vercel --prod --yes` exits with status 0
- [ ] Final stdout from `vercel --prod` includes a `https://` URL
- [ ] No new files are created (other than CLI internal cache, which is fine)
- [ ] No git commits or pushes are made
- [ ] `.vercel/project.json` is unchanged

## Out of scope
- Do not configure environment variables. They are already set in the Vercel dashboard.
- Do not connect GitHub. That is a separate manual setup Ken will do later.
- Do not run `npm run build` first. `vercel --prod` builds remotely on Vercel's infrastructure.
- Do not modify any source files, even if you think the code has a bug. Deploys ship what is currently committed plus working-tree state.
- Do not deploy from any directory other than `kuya-ken-portfolio/`.

## Notes for Codex
- The project is already linked to Vercel via `.vercel/project.json`. Running `vercel --prod` from inside `kuya-ken-portfolio/` uses that link automatically.
- `--yes` accepts default deploy settings (skips the "Set up and deploy?" prompt). Required for non-interactive runs.
- The build runs on Vercel's servers, not locally. Local Node version does not affect the deploy.
- If you see a warning about `node_modules` being uploaded, that is fine — Vercel CLI uses `.vercelignore` and `.gitignore` to filter.
- Expected total runtime: 2-4 minutes (mostly remote build time).
- The canonical domain `www.kradigital.site` is set up via the `middleware.ts` file. The deploy URL Vercel returns may be the `*.vercel.app` URL; both should resolve to the same content.
