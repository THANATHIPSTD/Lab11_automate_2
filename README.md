# Lab 2: Build your own CI/CD pipeline to Vercel 

In Lab 1 you filled the blanks in a workflow somebody else designed. In this lab nobody
designs it for you. You get a **Nuxt** application, a Playwright suite and a **pipeline
specification** (`./PIPELINE-SPEC.md`) written by the team's DevOps lead. Your job is to
deploy the application to **your own Vercel account**, build the GitHub Actions pipeline
that specification describes from an empty `.github/workflows/` folder, and then prove that
it works by trying to break it.

By the end, your repository will:

- test every pull request on a local build, deploy it to a **Vercel preview**, and test the
  preview — and block the merge if anything is red;
- on every merge, run the full suite and **deploy to Vercel production only if it passed**,
  then test the deployment it just made;
- every night, run the full three-browser matrix, sharded, against **a target you can
  choose** — production, any preview URL, or a local build;
- keep an unreliable test out of the gate without deleting it.

| What | Where |
|---|---|
| The specification (the grading oracle) | `./PIPELINE-SPEC.md`  |
| The repository you will push | `camt-bookshop/` in this folder |
| Evidence template | `camt-bookshop/PIPELINE.template.md` |
| Your references | Lecture 11 slides 5–29, your Lab 1 workflow, <https://playwright.dev/docs/ci>, <https://docs.github.com/actions>, <https://vercel.com/docs/cli> |

**What you need:** a GitHub account, a **Vercel account** (free Hobby plan — sign up at
<https://vercel.com/signup> with *Continue with GitHub*), and **Node 22.19+ or 24**
(`node -v`). Nuxt 4 refuses older versions.

**Demo account** for the application — keep it on this sheet, **not** in your repository:

| Email | Password |
|---|---|
| `reader@camt.example` | `Bookworm-2026!` |

### Rules of the lab

- **No skeletons are provided, on purpose.** You may reuse your own Lab 1 workflow and
  copy patterns from the lecture slides and the official docs. You may not copy another
  student's workflow files. AI assistants are allowed for *explaining* an error message;
  every line of YAML you submit, you must be able to explain in the viva.
- Every **Think first** box is answered *in writing, before you run the command or open
  the log*. A wrong prediction that you correct afterwards earns full marks; an empty box
  does not. The answers go into `PIPELINE.md`.
- Commit early, push often, and reference the requirement in the message:
  `git commit -m "PL-04: deploy a Vercel preview for every PR"`.

---

## Task 0 — Set up the repository 

1. On GitHub, create a new **public**, empty repository named `camt-bookshop`.
   No README, no `.gitignore` — you already have them.
2. Copy the **contents** of `camt-bookshop/` (including the hidden `.gitignore`) into a new
   folder outside this lab, and make it your repository:

   ```bash
   cd ~/work/camt-bookshop          # wherever you copied it
   git init -b main
   npm ci
   npx playwright install
   npx playwright test              # builds the app, then 16 tests x 3 browsers
   ```

   Look at the app by hand once with `npm run dev` → <http://localhost:3000>. While it is
   running, `npx playwright test` reuses it instead of building again — much faster.

3. Look at the report (`npx playwright show-report`). One test is not like the others.
   Run it on its own, ten times:

   ```bash
   npx playwright test tests/fx.spec.ts --project=chromium --repeat-each=10
   ```

> **Think first #1** — before the ten runs, predict how many will pass. After, open the
> trace of one failure (Network tab) and classify the failure as **regression**,
> **flaky test code** or **environment**. Name the single piece of evidence that decided it.
>
> Predicted passes: ______   Actual: ______   Classification: __________________
>
> Evidence: __________________________________________________________________

Do **not** push yet. Read Task 1 first.

## Task 1 — One suite, configured by the environment (PL-01, PL-02) 

`tests/helpers.ts` has the demo password typed into it, and `playwright.config.ts` knows
nothing about CI or Vercel. Fix both so that the configuration satisfies **every**
acceptance criterion of PL-01 and PL-02. Things you will need to decide for yourself:

- how the credentials reach the tests locally (a git-ignored `.env`) and in CI (secrets);
  Node can read a `.env` file with `process.loadEnvFile()`;
- what happens when a variable is missing;
- how one config both builds and starts the local app *and* tests a deployed URL that needs
  no server;
- how to send an extra HTTP header on every request when testing a protected deployment
  (look up `extraHTTPHeaders`; you will need it in Task 4);
- which settings differ in CI.

> **Think first #2** — the starter `.gitignore` is missing **three** entries that PL-01
> requires by the end of this lab. Name them, and for each say what would end up on GitHub
> without it.
>
> 1. ____________ → ________________________________________________
>
> 2. ____________ → ________________________________________________
>
> 3. ____________ → ________________________________________________

> **Think first #3** — open `app/pages/cart.vue` and find the call to `/api/rates`. It
> passes `{ retry: 0 }`. Find out what `$fetch` does without it, then predict the failure
> rate of the FX test if somebody deleted that option. Why is a retry hidden *inside the
> application* worse for a tester than `retries: 2` in the Playwright config?
>
> Failure rate without `retry: 0`: ______
>
> Why worse: _________________________________________________________________

When the suite is green locally with credentials from `.env` only, add the two repository
secrets (*Settings → Secrets and variables → Actions → New repository secret*):
`TEST_USER` and `TEST_PASS`. Then make your first commit and push to `main`.

> **Think first #4** — suppose that in Task 0 you had committed `helpers.ts` with the
> password in it and pushed. In Task 1 you remove it in a new commit. Is the password now
> safe? What would a real team have to do?
>
> Answer: ____________________________________________________________________

## Task 2 — Quarantine the unreliable test (PL-08) 

Using your triage from Think first #1:

1. Open a GitHub issue that records the triage (AC-08.2).
2. Tag the test `@quarantine` and annotate it with the issue link and an expiry date
   (AC-08.1). Lecture slide 28 shows the shape.
3. Every blocking job you write from now on must exclude `@quarantine` (AC-08.3). The
   non-blocking job that still runs it comes in Task 6.

> **Think first #5** — a teammate suggests "just set `retries: 5`, then it passes". With a
> 35 % failure rate per attempt, calculate the probability that the test still fails the
> run with `retries: 2`, and with `retries: 5`. Then give the reason the answer is still
> *no*, even though the numbers look good.
>
> P(fail) with 2 retries: ______   with 5 retries: ______
>
> Why still no: _______________________________________________________________

## Task 3 — Deploy to your own Vercel account (PL-03) 

In this task you deploy the app to Vercel **by hand, from your laptop**, using exactly the
commands your pipeline will run later. Once you have watched each command work, Tasks 4 and 5
are mostly about moving those commands into YAML.

You will deploy with the **Vercel CLI**, not by letting Vercel watch your repository. Work
in the repository root throughout.

### 3.1 Create the account and sign in from the terminal

1. Go to <https://vercel.com/signup>, choose the **Hobby** (free) plan, and sign up with
   **Continue with GitHub**. You do **not** need to import a repository from the Vercel
   dashboard — skip that screen if it appears.
2. Sign in from the terminal. We use `npx`, so nothing is installed globally:

   ```bash
   npx vercel --version          # first run downloads the CLI; prints e.g. "Vercel CLI 62.x"
   npx vercel login              # choose "Continue with GitHub"; a browser tab confirms it
   npx vercel whoami             # prints your Vercel username
   ```

### 3.2 Create the Vercel project and link this folder to it

```bash
npx vercel link
```

Answer the questions like this:

| The CLI asks | Answer |
|---|---|
| *Set up "~/work/camt-bookshop"?* | **yes** |
| *Which scope should contain your project?* | your own account (the only choice on Hobby) |
| *Link to existing project?* | **no** |
| *What's your project's name?* | `camt-bookshop` |
| *In which directory is your code located?* | `./` (press Enter) |
| *Auto-detected project settings (Nuxt.js) … modify these settings?* | **no** |
| *Connect your Git repository?* (newer CLIs may ask) | either answer is fine — step 3.3 makes sure Vercel never deploys from Git by itself |

The CLI writes a folder called `.vercel/`. Look inside:

```bash
cat .vercel/project.json      # {"projectId":"prj_…","orgId":"team_…" …}
```

Copy `orgId` and `projectId` somewhere safe; they become two of your secrets. Then make sure
`.vercel/` is in `.gitignore` **before** your next `git add` — it identifies your account
and, after `vercel pull`, also holds environment files.

### 3.3 Stop Vercel from ever deploying by itself (AC-03.2)

Create `vercel.json` in the repository root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

From now on, a deployment happens only when someone — your pipeline — runs the CLI.

> **Think first #6** — imagine you skipped step 3.3 and Vercel's Git integration were
> connected to your repository. Later, in Task 6, a pull request with a bug is merged and
> the main pipeline's test job turns red. Predict what Vercel does, and what your customers
> see.
>
> Vercel: ____________________________________________________________________
>
> Customers see: _____________________________________________________________

### 3.4 Your first deployment: a preview, by hand

Run the **three-step sequence** the pipeline will use. It builds on *your* machine and
uploads the finished build, so the files you tested are the files that are deployed:

```bash
npx vercel pull --yes --environment=preview   # download the project's settings into .vercel/
npx vercel build                              # build the Nuxt app for Vercel  -> .vercel/output/
npx vercel deploy --prebuilt                  # upload that build as a PREVIEW deployment
```

The last command prints progress to the screen and the **deployment URL** on its own last
line, for example:

```
https://camt-bookshop-3k9x2abcd-yourname.vercel.app
```

Open that URL in the browser where you are logged in to Vercel, sign in with the demo
account, add a book to the cart and check the footer says `Build dev`. Then open the Vercel
dashboard → **camt-bookshop → Deployments**: your deployment is listed as a *Preview*, with
source *CLI*.

> Every preview gets a new, unique URL. Production is different: it gets a stable domain.
> Find it now under **Settings → Domains** — something like
> `https://camt-bookshop-yourname.vercel.app`. It shows a *404: NOT_FOUND* page until your
> pipeline makes the first production deployment in Task 5. **Never** run
> `vercel deploy --prod` by hand: production belongs to the pipeline (AC-03.2).

> **Think first #7** — before you go on, open your preview URL in a **private** browser
> window. What do you see, and why? Predict what will happen to every test the first time
> your pipeline points Playwright at a preview URL without the bypass, and name the two
> possible fixes. Which one does PL-03 choose, and why is it the better one?
>
> Private window shows: _____________________________________________________
>
> Tests without the bypass: __________________________________________________
>
> Fixes: (a) ______________________  (b) ______________________   Chosen: ______

### 3.5 Keep previews private, but let your tests in (AC-03.4)

Vercel → **camt-bookshop → Settings → Deployment Protection**:

1. Check that **Vercel Authentication** is **enabled** (Standard Protection). Leave it on.
2. Under **Protection Bypass for Automation**, click **Add** / **Create**, and copy the
   generated secret.

Check that the bypass works before you build a pipeline on it:

```bash
URL=https://camt-bookshop-3k9x2abcd-yourname.vercel.app     # your preview URL
curl -s -o /dev/null -w "%{http_code}\n" "$URL/signin"
# not 200 — Vercel answers with its log-in page
curl -s -o /dev/null -w "%{http_code}\n" -H "x-vercel-protection-bypass: <your-secret>" "$URL/signin"
# 200
```

### 3.6 A token for the pipeline

Your laptop is logged in through the browser; a GitHub runner is not. It logs in with a
token instead. Go to **Vercel → Account Settings → Tokens** (<https://vercel.com/account/settings/tokens>):

- **Name:** `github-actions-camt-bookshop`
- **Scope:** your own account
- **Expiration:** after the end of the semester

Copy the token immediately — Vercel shows it only once.

### 3.7 Prove the CI recipe works without your login

A runner has no `.vercel/` folder (it is git-ignored) and no browser login. It gets the
project from **environment variables** and the login from **`--token`**. Simulate exactly
that on your laptop:

```bash
mv .vercel /tmp/vercel-backup                  # pretend this is a fresh runner
export VERCEL_ORG_ID=team_xxxxxxxx             # from 3.2
export VERCEL_PROJECT_ID=prj_xxxxxxxx          # from 3.2
export VERCEL_TOKEN=xxxxxxxxxxxxxxxx           # from 3.6

npx vercel pull --yes --environment=preview --token="$VERCEL_TOKEN"
npx vercel build --token="$VERCEL_TOKEN"
npx vercel deploy --prebuilt --token="$VERCEL_TOKEN"

unset VERCEL_TOKEN                             # do not leave a token in your shell
```

A second preview URL appears. If this works, your `deploy-preview` job in Task 4 is these
three lines plus the same environment variables. For **production** (Task 5 only, from the
pipeline) the sequence is the same with production flags:

```bash
vercel pull --yes --environment=production --token=…
vercel build --prod --token=…
vercel deploy --prebuilt --prod --token=…
```

### 3.8 Store everything in GitHub

GitHub → your repository → **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Value from |
|---|---|
| `VERCEL_TOKEN` | 3.6 |
| `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` (3.2) |
| `VERCEL_PROJECT_ID` | `projectId` in `.vercel/project.json` (3.2) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | 3.5 |

(`TEST_USER` and `TEST_PASS` are already there from Task 1.) If you have the GitHub CLI,
`gh secret set VERCEL_TOKEN` does the same and reads the value without echoing it.

Finally, commit `vercel.json` and the `.gitignore` change, and push to `main`. Check with
`git status` that nothing under `.vercel/` is staged.

## Task 4 — The pull-request gate and branch protection (PL-04, PL-05) 

Write `.github/workflows/pr-gate.yml` from scratch to satisfy PL-04: three jobs, `smoke` →
`deploy-preview` → `test-preview`. Your Lab 1 workflow is a starting point for `smoke`,
but it is not enough: it does not cache browsers, it runs every test on every browser, and
it never had credentials.

For `deploy-preview`, turn your Task 3.7 recipe into a job: install the CLI
(`npm install --global vercel`), provide `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` from secrets as
environment variables, pass the token with `--token`, and run the same three commands.
`vercel deploy` prints the deployment URL on standard output; capture it in the shell and
turn it into a **job output** (`$GITHUB_OUTPUT`, `outputs:`, `needs.<job>.outputs.<name>`) so
`test-preview` can use it as `BASE_URL`. Remember the bypass secret from 3.5: Playwright must
send it as a header on every request.

Push it on a branch and open a pull request into `main`, so that the workflow runs once.
Merge it when it is green, and open the preview URL from the run's summary. Then protect
`main` as PL-05 requires (*Settings → Rules → Rulesets*, or *Settings → Branches → Add
branch protection rule*). You are working alone, so set the number of required approvals to
**0** — the gate is the tests, not a reviewer.

> **Think first #8** — GitHub only lets you pick `smoke` and `test-preview` as required
> checks *after* the workflow has run once. Why? And predict what a pull request would show
> if you later broke the YAML so badly that the workflow never starts.
>
> Why: _______________________________________________________________________
>
> A PR with a broken workflow file shows: _______________________________________

**Prove the door locks (AC-05.4).** On a new branch, make a change that a smoke test must
catch — for example, rename the **Sign in** button in `app/pages/signin.vue`. Push it, open
a pull request, and take a screenshot of the merge box when the gate is red. Which job went
red, and did a preview get deployed? Then close that pull request **without merging** and
delete the branch.

## Task 5 — Deploy to production on green (PL-06) 

Write `.github/workflows/main.yml` with three jobs — full suite on a local build, deploy to
Vercel **production**, smoke the deployment — satisfying every AC of PL-06. The deploy job
uses the production sequence from the end of Task 3.7 (`--environment=production` on
`pull`, `--prod` on **both** `build` and `deploy`), and a GitHub **environment** named
`production` (look up `environment:` with a `url:`).

Because `main` is protected, this workflow must itself arrive through a pull request.

When the first run is green: open the production domain you found in Task 3.4 — the 404 is
gone — sign in, check the Vercel dashboard lists a *Production* deployment with source *CLI*,
and save that domain as
the repository **variable** `PRODUCTION_URL` (AC-03.5) — a variable, not a secret: it is not
sensitive, and you will want to see it in logs.

Viva questions to settle while you write it (no box): what does the Actions graph show when
the test job is red? Why does the post-deploy job run only the smoke set? Why must it not
build and start the app locally? Why must the deploy never be cancelled half-way?

## Task 6 — A teammate's pull request 

Your teammate Somchai sends a refactor. It is in `patches/pr-42-extract-pricing.patch`,
with his commit message. Apply it on a branch exactly as he wrote it:

```bash
git switch -c pr-42-extract-pricing
git am patches/pr-42-extract-pricing.patch
```

> **Think first #9** — read the diff (`git show`) **before** you push. Predict:
> (a) will your PR gate pass? (b) will the main pipeline pass? (c) if anything fails,
> which test, and why did Somchai's local check not catch it?
>
> (a) ______   (b) ______   (c) ______________________________________________

Push the branch, open the pull request, and — acting as the reviewer who trusts a green
check — **merge it** when the gate allows. Watch the main pipeline. Record in `PIPELINE.md`
the run where the test job is red and the deploy is skipped (AC-06.7), check the Vercel
dashboard's deployment list, and check what your production URL is serving.

Then restore `main` the way a team would: use the **Revert** button on the merged pull
request, let the gate pass, and merge the revert. Confirm the next main run deploys.

> **Think first #10** — the bug passed two smoke checks (local and preview) and was stopped
> one stage later. There are two cheap ways to catch it *before* merge: tag the boundary
> test `@smoke`, or make `test-preview` run the full suite. Argue for and against each using
> the timing budget in §2 of the specification, then decide.
>
> Tag it `@smoke`: for ______________________ / against ______________________
>
> Full suite on the preview: for ______________________ / against ______________________
>
> Decision and reason: ________________________________________________________

## Task 7 — Nightly full matrix against a selected target (PL-07, PL-08) 

Write `.github/workflows/nightly.yml`: the full suite on three browsers, three shards, blob
reports merged into one HTML report, on a schedule and by hand — plus the non-blocking job
that runs the quarantined test (AC-08.4). Lecture slides 23, 25 and 28 cover the sharding,
the schedule and the quarantine; combining them is your work.

The new part is the **target**. A run started by hand must ask what to test
(`workflow_dispatch` → `inputs:` with `type: choice`): `production`, `url`, or `local`. A
scheduled run has no inputs and must test production. One small first job that turns the
choice into a URL (as a job output) keeps the rest of the workflow simple.

Do not wait for 03:00. Start it from the Actions tab with **Run workflow** three times, once
per target. For `url`, paste a preview URL from one of your pull requests.

Viva questions (no box): what cron expression is 03:00 in Bangkok? What does
`fail-fast: false` protect? Why must the merge job run when a shard failed? What makes a job
non-blocking? Why must a pasted URL reach the script through `env:` rather than `${{ }}`?

## Task 8 — `PIPELINE.md` 

Copy `PIPELINE.template.md` to `PIPELINE.md` and complete every section. This is where the
grader looks first.

**Copy your finish code to this folder, then submit the code

---

## 
## Troubleshooting you will probably need

| Symptom | Likely cause |
|---|---|
| `npm warn EBADENGINE` during `npm ci`, or odd Nuxt build errors | Node older than 22.19 — use `node-version: lts/*` in CI, upgrade locally |
| The workflow never appears in the Actions tab | file not in `.github/workflows/`, or not on the branch you pushed |
| `Invalid workflow file` before any job starts | YAML indentation — two spaces, never tabs |
| Every test fails at sign-in in CI, passes locally | `TEST_USER` / `TEST_PASS` missing, misspelled, or not passed to the step with `env:` |
| `vercel pull` fails with *Project not found* or asks to link | `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` not set as environment variables for that job |
| `vercel` says *The specified token is not valid* | wrong or expired `VERCEL_TOKEN`, or `--token` missing |
| Every preview test fails; the screenshot shows a Vercel log-in page | Deployment Protection — the bypass secret is missing or not sent as a header |
| Pages work, but every `/api/*` call fails on the preview | the bypass header reached the page but not its own requests — see `x-vercel-set-bypass-cookie` |
| `test-preview` waits for a server and times out | the config still starts the local app when `BASE_URL` is set |
| Vercel deploys on every push by itself | `vercel.json` missing, or not at the repository root |
| `smoke` / `test-preview` not offered as a required check | the job has not run yet on this repository, or its name differs |
| A shard uploads nothing to merge | the blob reporter is not enabled in CI |
