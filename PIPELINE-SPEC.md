# CAMT Bookshop — Delivery Pipeline Specification

| | |
|---|---|
| **Document ID** | PIPE-BOOKSHOP-001 |
| **Version** | 2.0 |
| **System** | CAMT Bookshop (Nuxt 4 / Vue 3 / TypeScript) and its Playwright suite |
| **Hosting** | Vercel — each student's own Hobby account |
| **Owner** | 495 — Automated Test, teaching team (acting as the DevOps lead) |
| **Release Date** | 05-10-2026 |
| **Status** | Approved for implementation |

> **How to use this document in the lab.** This specification says **what** the pipeline
> must guarantee. It does not say how. Nothing in this lab hands you a workflow skeleton:
> the lecture slides, Lab 1 and the official documentation are your references, and you
> design the files yourself. Every requirement has an ID (`PL-nn`) and every acceptance
> criterion an ID (`AC-nn.m`). Quote them in your commit messages and in `PIPELINE.md`.
> The grader checks the acceptance criteria and nothing else.

---

## 1. Context

The CAMT Bookshop team has a working Nuxt application and a Playwright suite of sixteen
tests, and both currently run only on a developer's laptop. Last month a pricing change
reached the live site because someone ran `vercel --prod` from their laptop without
running the suite. The team wants every change to `main` to go through an automated gate,
and Vercel to receive a deployment **only from a pipeline that has just proved the build
works**.

The application is hosted on **Vercel**. GitHub Actions builds it, tests it, deploys it with
the Vercel CLI, and then tests the deployment it created. Vercel itself never deploys
anything on its own.

### 1.1 Definitions

| Term | Meaning |
|---|---|
| **Smoke set** | the tests tagged `@smoke` — one per user journey, a few seconds in total |
| **Full suite** | every test except those tagged `@quarantine` |
| **Full matrix** | the full suite on Chromium, Firefox and WebKit |
| **Local build** | the app built and started on the CI runner (`npm run build && npm start`, port 3000) |
| **Preview deployment** | a Vercel deployment of a pull request's code, with its own `https://…vercel.app` URL |
| **Production** | the Vercel production deployment; its stable address is the **production URL** |
| **Target** | the address a test run is pointed at: a local build, a preview, or production |
| **Gate** | a required status check that must be green before a pull request can merge |
| **Secret / variable** | values stored under *Settings → Secrets and variables → Actions*; secrets for anything sensitive, variables for plain configuration |

### 1.2 Conventions

*shall* = mandatory; *should* = desirable. Priorities use MoSCoW (**M**ust / **S**hould /
**C**ould). Times are the wall-clock duration of a workflow run as shown in the Actions tab.

---

## 2. Pipeline overview

| Moment | Workflow | What runs | Budget | On red |
|---|---|---|---|---|
| Every pull request to `main` | PR gate | smoke set on a local build → deploy a **preview** → smoke set on the preview | ≤ 8 min | merge blocked |
| Every push to `main` | Main pipeline | full suite on a local build → deploy to **production** → smoke set on that deployment | ≤ 10 min | production deploy skipped |
| Daily 03:00 Bangkok time, and on demand | Nightly | full matrix, sharded × 3, against a **selected target**; quarantine watch | ≤ 20 min | morning triage |

---

## 3. Requirements

### PL-01 Repository hygiene — **M**

- **AC-01.1** The repository is **public** on GitHub (branch protection on a free account
  requires it).
- **AC-01.2** `package-lock.json` is committed, and every workflow installs with `npm ci`.
- **AC-01.3** `.gitignore` excludes `node_modules/`, `.nuxt/`, `.output/`, `.vercel/`,
  `test-results/`, `playwright-report/`, `blob-report/` and `.env`. None of these is present
  in any commit on `main`.
- **AC-01.4** The demo password does not appear in any file on the tip of `main`.
- **AC-01.5** `.env.example` is committed and lists every environment variable the suite
  reads, with empty values.

### PL-02 One suite, configured by the environment — **M**

There shall be exactly one `playwright.config.ts`, and its behaviour shall be chosen by
environment variables only.

- **AC-02.1** Credentials are read from `TEST_USER` and `TEST_PASS`. A missing value stops
  the run with a message that names the variable.
- **AC-02.2** Locally, the variables come from a git-ignored `.env` file. In CI they come
  from repository **secrets** of the same names.
- **AC-02.3** `BASE_URL`, when set and not empty, is the target **and** no local server is
  started. When unset or empty, the configuration builds and starts the app itself.
- **AC-02.4** When `BASE_URL` is set and `VERCEL_AUTOMATION_BYPASS_SECRET` is present, every
  request carries Vercel's protection-bypass header.
- **AC-02.5** In CI only: `retries: 2`, `forbidOnly: true`, an explicit `workers` value.
  Locally: `retries: 0`.
- **AC-02.6** `trace: 'on-first-retry'`. In CI, the reporters produce an HTML report and a
  blob report.

### PL-03 Vercel project — **M**

- **AC-03.1** A Vercel project exists on the student's **own** Vercel account (Hobby plan)
  and is linked to the repository with the Vercel CLI.
- **AC-03.2** Vercel deploys nothing by itself: `vercel.json` disables Git deployments
  (`"git": { "deploymentEnabled": false }`). Every deployment listed in the Vercel
  dashboard after Task 3 was created by a GitHub Actions run.
- **AC-03.3** `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are repository
  secrets. `VERCEL_TOKEN` is read only by the jobs that deploy.
- **AC-03.4** Preview deployments stay protected (Vercel Authentication on). The pipeline
  gets through with **Protection Bypass for Automation**; its value is the repository secret
  `VERCEL_AUTOMATION_BYPASS_SECRET`.
- **AC-03.5** The production URL is stored as the repository **variable** `PRODUCTION_URL`.

### PL-04 Pull-request gate with a preview deployment — **M**

- **AC-04.1** A workflow runs on every `pull_request` targeting `main`.
- **AC-04.2** Job **`smoke`** runs the smoke set on Chromium against a local build, and
  excludes `@quarantine`.
- **AC-04.3** Job **`deploy-preview`** runs only if `smoke` succeeded. It builds the app on
  the runner and deploys it to Vercel as a **preview**, and exposes the preview URL as a
  job output.
- **AC-04.4** Job **`test-preview`** runs the smoke set on Chromium against the URL taken
  from `deploy-preview`'s output — not typed into the YAML.
- **AC-04.5** The jobs that run Playwright cache npm downloads **and** the Playwright browser
  download, and upload the HTML report as an artifact, also when tests fail.
- **AC-04.6** A run on a warm cache finishes within the 8-minute budget.

### PL-05 Branch protection — **M**

- **AC-05.1** `main` requires a pull request before merging; direct pushes are rejected.
- **AC-05.2** The status checks **`smoke`** and **`test-preview`** are required to pass.
- **AC-05.3** Force pushes to and deletion of `main` are blocked.
- **AC-05.4** Evidence: one pull request whose merge was blocked by a red required check.

### PL-06 Main pipeline: deploy to production on green — **M**

- **AC-06.1** A workflow runs on every `push` to `main` and can be started by hand.
- **AC-06.2** Job 1 runs the full suite on Chromium against a local build.
- **AC-06.3** Job 2 deploys to Vercel **production**, and **runs only if Job 1 succeeded**.
  It uses a GitHub environment named `production` whose URL is the new deployment.
- **AC-06.4** Job 3 runs the smoke set against the URL that Job 2 deployed, taken from Job
  2's output.
- **AC-06.5** Two runs of this workflow never deploy at the same time, and a running
  deployment is never cancelled.
- **AC-06.6** Workflows grant `contents: read` and nothing more unless a job needs it.
- **AC-06.7** Evidence: one run in which Job 1 failed, Job 2 shows as **skipped**, and the
  Vercel dashboard shows no new production deployment.

### PL-07 Nightly full matrix against a selected target — **M**

- **AC-07.1** A workflow runs every day at **03:00 Asia/Bangkok**, and can be started by hand.
- **AC-07.2** Started by hand, it asks for a **target**: `production`, `url` (any deployment
  URL, e.g. a preview from a pull request) or `local`. The scheduled run tests production.
- **AC-07.3** The production address comes from the variable `PRODUCTION_URL`. Inputs reach
  shell scripts through `env:`, never by `${{ }}` inside a `run:` script.
- **AC-07.4** It runs the full suite on all three browsers, split into **3 shards** on
  separate machines; one failing shard does not cancel the others.
- **AC-07.5** A final job merges the shards' blob reports into one HTML report artifact, and
  runs even when a shard failed.

### PL-08 Quarantine — **M**

A test that fails for reasons outside our code shall leave the gate without leaving the
repository.

- **AC-08.1** The unreliable test is tagged `@quarantine` and carries two annotations: a
  link to a GitHub issue, and an expiry date no more than 14 days ahead.
- **AC-08.2** The issue records the triage: symptom, classification, evidence, owner.
- **AC-08.3** No blocking job runs quarantined tests.
- **AC-08.4** A **non-blocking** job in the nightly workflow runs them against the selected
  target, so the team can see when the cause is fixed.
- **AC-08.5** `retries` is never raised above 2 to make the test pass.

### PL-09 Evidence — **M**

- **AC-09.1** `PIPELINE.md` in the repository root, completed from the provided template.

### PL-10 Prove which build is live — **C**

- **AC-10.1** The deploy jobs build with `NUXT_PUBLIC_APP_VERSION` set to the commit SHA.
- **AC-10.2** The post-deploy job asserts that the deployment's footer shows that SHA.

### PL-11 Cure the quarantine — **C**

- **AC-11.1** The quarantined test is replaced by tests that control `/api/rates` with
  `page.route`: one for a successful answer, one for an outage.
- **AC-11.2** The `@quarantine` tag, the issue and the original test are then removed, and
  the issue is closed with a link to the fixing commit.

---

## 4. Constraints

- GitHub-hosted runners only (`ubuntu-latest`). Vercel's free **Hobby** plan only.
- No third-party marketplace actions except those published under `actions/`. The Vercel
  CLI (`npm install --global vercel`) is allowed.
- No secret, password or token in any YAML, test or configuration file.
- Vercel's Git integration may be connected, but must never deploy (AC-03.2).
- The application code in `app/` and `server/` may be changed only by the pull requests the
  lab sheet describes.
