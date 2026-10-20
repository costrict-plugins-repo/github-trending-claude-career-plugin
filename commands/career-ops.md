---
description: AI job search command center -- evaluate offers, generate CVs, scan portals, track applications
argument-hint: Paste a JD, URL, or sub-command (scan, pdf, batch, tracker, apply, pipeline, oferta, ofertas, contacto, deep, training, project, init, update)
---

# career-ops -- Plugin Command Router

This file is the single entry point for the career-ops plugin. It replaces both the old `.claude/skills/career-ops/SKILL.md` router and the agent instructions from `CLAUDE.md`. Everything Claude needs to operate career-ops is here.

---

## 1. Workspace Detection

Before doing anything, resolve two paths: **WORKSPACE** (user data) and **PLUGIN_ROOT** (system files).

### Detection order

1. **Env var:** `CAREER_OPS_WORKSPACE` → use as WORKSPACE.
2. **Walk-up:** Starting from the current working directory, walk up looking for a `.career-ops.json` marker file. The directory containing it is WORKSPACE.
3. **Global config:** Read `~/.config/career-ops/config.json`. If it has a `dataDir` key pointing to an existing directory, use that as WORKSPACE.
4. **Not found:** If none of the above yield a workspace, tell the user:
   > "No career-ops workspace found. Run `/career-ops init` to set one up, or `cd` into your workspace directory."

PLUGIN_ROOT is always the root of the career-ops plugin installation (the directory containing this `commands/` folder). Resolve it via `CLAUDE_PLUGIN_ROOT` env var, or by navigating one level up from the directory containing this file.

**Store these as `{WORKSPACE}` and `{PLUGIN_ROOT}` and use them as path prefixes for every file reference below.**

---

## 2. Update Check

Plugin updates are managed by Claude Code's plugin system. The user can update at any time with:

```bash
claude plugin update claude-career-plugin
```

If the user says "check for updates" or "update career-ops", tell them to run `claude plugin update claude-career-plugin` in their terminal.

---

## 3. Mode Routing

Determine the mode from `$ARGUMENTS`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- show command menu |
| JD text or URL (no sub-command) | **`auto-pipeline`** |
| `init` | `init` -- run `/career-ops init` skill |
| `update` | `update` -- run update checker |
| `oferta` | `oferta` |
| `ofertas` | `ofertas` |
| `contacto` | `contacto` |
| `deep` | `deep` |
| `pdf` | `pdf` |
| `training` | `training` |
| `project` | `project` |
| `tracker` | `tracker` |
| `pipeline` | `pipeline` |
| `apply` | `apply` |
| `scan` | `scan` |
| `batch` | `batch` |

**Auto-pipeline detection:** If `$ARGUMENTS` is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "about the role", "we're looking for", company name + role) or a URL to a JD, execute `auto-pipeline`.

If `$ARGUMENTS` is not a sub-command AND doesn't look like a JD, show discovery.

**Init routing:** If mode is `init`, invoke the `career-ops-init` skill at `{PLUGIN_ROOT}/skills/career-ops-init/SKILL.md`. That skill handles full workspace scaffolding and onboarding.

**Update routing:** If mode is `update`, tell the user to run `claude plugin update claude-career-plugin` in their terminal to update the plugin.

---

## 4. Discovery Menu (no arguments)

Show this menu, replacing path placeholders with actual resolved paths:

```
career-ops -- Command Center
Workspace: {WORKSPACE}

Available commands:
  /career-ops {JD}      -> AUTO-PIPELINE: evaluate + report + PDF + tracker (paste text or URL)
  /career-ops init      -> Set up a new workspace (first-time setup)
  /career-ops update    -> Check for and apply updates
  /career-ops pipeline  -> Process pending URLs from inbox ({WORKSPACE}/data/pipeline.md)
  /career-ops oferta    -> Evaluation only A-F (no auto PDF)
  /career-ops ofertas   -> Compare and rank multiple offers
  /career-ops contacto  -> LinkedIn power move: find contacts + draft message
  /career-ops deep      -> Deep research prompt about company
  /career-ops pdf       -> PDF only, ATS-optimized CV
  /career-ops training  -> Evaluate course/cert against North Star
  /career-ops project   -> Evaluate portfolio project idea
  /career-ops tracker   -> Application status overview
  /career-ops apply     -> Live application assistant (reads form + generates answers)
  /career-ops scan      -> Scan portals and discover new offers
  /career-ops batch     -> Batch processing with parallel workers

Inbox: add URLs to {WORKSPACE}/data/pipeline.md -> /career-ops pipeline
Or paste a JD directly to run the full pipeline.
```

---

## 5. Context Loading

After determining the mode, load the necessary files before executing.

### Resolve modes directory

Check `{WORKSPACE}/config/profile.yml` for `language.modes_dir`. If set (e.g., `modes/de` or `modes/fr`), use `{PLUGIN_ROOT}/{modes_dir}/` as the modes directory. Otherwise, default to `{PLUGIN_ROOT}/modes/`.

**Language auto-detection:** If you detect a German-language JD, suggest switching to `modes/de/`. If French, suggest `modes/fr/`. If the user applies to English-language roles (even at French/German companies), use default English modes.

### Modes that require `_shared.md` + their mode file

Read `{PLUGIN_ROOT}/modes/_shared.md` + `{PLUGIN_ROOT}/modes/{mode}.md`

Also read `{WORKSPACE}/modes/_profile.md` if it exists (user overrides for archetypes, narrative, negotiation scripts).

Applies to: `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file)

Read `{PLUGIN_ROOT}/modes/{mode}.md`

Applies to: `tracker`, `deep`, `training`, `project`

### Modes delegated to subagent

For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of {PLUGIN_ROOT}/modes/_shared.md]\n\n[content of {PLUGIN_ROOT}/modes/{mode}.md]\n\n[invocation-specific data]",
  description="career-ops {mode}"
)
```

Execute the instructions from the loaded mode file.

---

## 6. Data Contract (CRITICAL)

There are two layers. This contract determines where data lives and what can be auto-updated.

### User Layer -- lives in {WORKSPACE} (NEVER auto-updated)

| File | Purpose |
|------|---------|
| `{WORKSPACE}/cv.md` | User's CV in markdown |
| `{WORKSPACE}/config/profile.yml` | Identity, targets, comp range |
| `{WORKSPACE}/modes/_profile.md` | Archetypes, narrative, negotiation scripts |
| `{WORKSPACE}/article-digest.md` | Proof points from portfolio |
| `{WORKSPACE}/interview-prep/story-bank.md` | Accumulated STAR+R stories |
| `{WORKSPACE}/portals.yml` | Customized company list |
| `{WORKSPACE}/data/applications.md` | Application tracker |
| `{WORKSPACE}/data/pipeline.md` | URL inbox |
| `{WORKSPACE}/data/scan-history.tsv` | Scan dedup history |
| `{WORKSPACE}/reports/*` | Evaluation reports |
| `{WORKSPACE}/output/*` | Generated PDFs |
| `{WORKSPACE}/jds/*` | Saved job descriptions |

### System Layer -- lives in {PLUGIN_ROOT} (safe to auto-update)

| File | Purpose |
|------|---------|
| `{PLUGIN_ROOT}/modes/_shared.md` | Scoring system, global rules, tools |
| `{PLUGIN_ROOT}/modes/oferta.md` | Evaluation mode instructions |
| `{PLUGIN_ROOT}/modes/*.md` | All other mode instructions |
| `{PLUGIN_ROOT}/modes/de/*` | German language modes |
| `{PLUGIN_ROOT}/modes/fr/*` | French language modes |
| `{PLUGIN_ROOT}/templates/*` | Base templates (CV HTML, portals example, states) |
| `{PLUGIN_ROOT}/batch/*` | Batch prompt and runner |
| `{PLUGIN_ROOT}/scripts/*` | Utility scripts |
| `{PLUGIN_ROOT}/dashboard/*` | Go TUI dashboard |
| `{PLUGIN_ROOT}/commands/*` | Plugin command definitions |

### THE RULE

**When the user asks to customize anything (archetypes, narrative, negotiation scripts, proof points, location policy, comp targets), ALWAYS write to `{WORKSPACE}/modes/_profile.md` or `{WORKSPACE}/config/profile.yml`. NEVER edit `{PLUGIN_ROOT}/modes/_shared.md` for user-specific content.** This ensures system updates don't overwrite their customizations.

### Common customization requests

- "Change the archetypes to [backend/frontend/data/devops] roles" --> edit `{WORKSPACE}/modes/_profile.md`
- "Translate the modes to English" --> edit mode files in `{PLUGIN_ROOT}/modes/`
- "Add these companies to my portals" --> edit `{WORKSPACE}/portals.yml`
- "Update my profile" --> edit `{WORKSPACE}/config/profile.yml`
- "Change the CV template design" --> edit `{PLUGIN_ROOT}/templates/cv-template.html`
- "Adjust the scoring weights" --> edit `{PLUGIN_ROOT}/modes/_shared.md` and `{PLUGIN_ROOT}/batch/batch-prompt.md`

---

## 7. Pipeline Integrity Rules

### Report numbering

Sequential 3-digit zero-padded, always max existing + 1. Reports go in `{WORKSPACE}/reports/` with format: `{###}-{company-slug}-{YYYY-MM-DD}.md`.

### Tracker additions -- TSV format

Write one TSV file per evaluation to `{WORKSPACE}/batch/tracker-additions/{num}-{company-slug}.tsv`. Single line, 9 tab-separated columns:

```
{num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
```

**Column order (IMPORTANT -- status BEFORE score):**
1. `num` -- sequential number (integer)
2. `date` -- YYYY-MM-DD
3. `company` -- short company name
4. `role` -- job title
5. `status` -- canonical status (e.g., `Evaluated`)
6. `score` -- format `X.X/5` (e.g., `4.2/5`)
7. `pdf` -- checkmark or X
8. `report` -- markdown link `[num](reports/...)`
9. `notes` -- one-line summary

**Note:** In applications.md, score comes BEFORE status. The merge script handles this column swap automatically.

### Merge rule

**After each batch of evaluations, run:**

```bash
node {PLUGIN_ROOT}/scripts/merge-tracker.mjs --workspace {WORKSPACE}
```

### Tracker integrity

1. **NEVER edit `{WORKSPACE}/data/applications.md` to ADD new entries** -- Write TSV in `{WORKSPACE}/batch/tracker-additions/` and `merge-tracker.mjs` handles the merge.
2. **YES you can edit `{WORKSPACE}/data/applications.md` to UPDATE status/notes of existing entries.**
3. All reports MUST include `**URL:**` in the header (between Score and PDF).
4. All statuses MUST be canonical (see `{PLUGIN_ROOT}/templates/states.yml`).
5. **NEVER create new entries in applications.md if company+role already exists.** Update the existing entry.

### Health check scripts

```bash
node {PLUGIN_ROOT}/scripts/verify-pipeline.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/normalize-statuses.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/dedup-tracker.mjs --workspace {WORKSPACE}
```

### Canonical States

**Source of truth:** `{PLUGIN_ROOT}/templates/states.yml`

| State | When to use |
|-------|-------------|
| `Evaluated` | Report completed, pending decision |
| `Applied` | Application sent |
| `Responded` | Company responded |
| `Interview` | In interview process |
| `Offer` | Offer received |
| `Rejected` | Rejected by company |
| `Discarded` | Discarded by candidate or offer closed |
| `SKIP` | Doesn't fit, don't apply |

**RULES:**
- No markdown bold (`**`) in status field
- No dates in status field (use the date column)
- No extra text (use the notes column)

---

## 8. Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if an offer is still active.** ALWAYS use Playwright:
1. `browser_navigate` to the URL
2. `browser_snapshot` to read content
3. Only footer/navbar without JD = closed. Title + description + Apply = active.

**Exception for batch workers (`claude -p`):** Playwright is not available in headless pipe mode. Use WebFetch as fallback and mark the report header with `**Verification:** unconfirmed (batch mode)`. The user can verify manually later.

---

## 9. Script Execution

All career-ops scripts accept `--workspace {WORKSPACE}` to locate user data. When running any script, always pass the workspace path:

```bash
node {PLUGIN_ROOT}/scripts/generate-pdf.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/merge-tracker.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/verify-pipeline.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/normalize-statuses.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/dedup-tracker.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/check-liveness.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/cv-sync-check.mjs --workspace {WORKSPACE}
node {PLUGIN_ROOT}/scripts/doctor.mjs --workspace {WORKSPACE}
```

Scripts resolve paths internally using `{PLUGIN_ROOT}/scripts/resolve-paths.mjs`, which implements the same detection order as Section 1 above.

### Stack and conventions

- Node.js (mjs modules), Playwright (PDF + scraping), YAML (config), HTML/CSS (template), Markdown (data)
- Scripts in `.mjs`, configuration in YAML
- Output in `{WORKSPACE}/output/` (gitignored), Reports in `{WORKSPACE}/reports/`
- JDs in `{WORKSPACE}/jds/` (referenced as `local:jds/{file}` in pipeline.md)
- Batch in `{WORKSPACE}/batch/` (gitignored except scripts and prompt)

---

## 10. Ethical Use -- CRITICAL

**This system is designed for quality, not quantity.** The goal is to help the user find and apply to roles where there is a genuine match -- not to spam companies with mass applications.

- **NEVER submit an application without the user reviewing it first.** Fill forms, draft answers, generate PDFs -- but always STOP before clicking Submit/Send/Apply. The user makes the final call.
- **Strongly discourage low-fit applications.** If a score is below 4.0/5, explicitly recommend against applying. The user's time and the recruiter's time are both valuable. Only proceed if the user has a specific reason to override the score.
- **Quality over speed.** A well-targeted application to 5 companies beats a generic blast to 50. Guide the user toward fewer, better applications.
- **Respect recruiters' time.** Every application a human reads costs someone's attention. Only send what's worth reading.

---

## 11. Onboarding Check

If WORKSPACE is detected (`.career-ops.json` exists) but essential files are missing, guide the user through setup. Run these checks silently:

1. Does `{WORKSPACE}/cv.md` exist?
2. Does `{WORKSPACE}/config/profile.yml` exist (not just profile.example.yml)?
3. Does `{WORKSPACE}/modes/_profile.md` exist (not just _profile.template.md)?
4. Does `{WORKSPACE}/portals.yml` exist (not just portals.example.yml)?

If `{WORKSPACE}/modes/_profile.md` is missing, copy from `{PLUGIN_ROOT}/modes/_profile.template.md` silently.

**If ANY of the first three is missing, enter onboarding mode.** Do NOT proceed with evaluations, scans, or any other mode until the basics are in place. Guide the user step by step:

### Step 1: CV (required)
If `{WORKSPACE}/cv.md` is missing, ask:
> "I don't have your CV yet. You can either:
> 1. Paste your CV here and I'll convert it to markdown
> 2. Paste your LinkedIn URL and I'll extract the key info
> 3. Tell me about your experience and I'll draft a CV for you
>
> Which do you prefer?"

Create `{WORKSPACE}/cv.md` from whatever they provide.

### Step 2: Profile (required)
If `{WORKSPACE}/config/profile.yml` is missing, copy from `{PLUGIN_ROOT}/config/profile.example.yml` and then ask:
> "I need a few details to personalize the system:
> - Your full name and email
> - Your location and timezone
> - What roles are you targeting? (e.g., 'Senior Backend Engineer', 'AI Product Manager')
> - Your salary target range
>
> I'll set everything up for you."

Fill in `{WORKSPACE}/config/profile.yml` with their answers.

### Step 3: Portals (recommended)
If `{WORKSPACE}/portals.yml` is missing:
> "I'll set up the job scanner with 45+ pre-configured companies. Want me to customize the search keywords for your target roles?"

Copy `{PLUGIN_ROOT}/templates/portals.example.yml` -> `{WORKSPACE}/portals.yml`. Update `title_filter.positive` to match their target roles.

### Step 4: Tracker
If `{WORKSPACE}/data/applications.md` doesn't exist, create it:
```markdown
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
```

### Step 5: Get to know the user
After the basics are set up, proactively ask for more context:
> "The basics are ready. But the system works much better when it knows you well. Can you tell me more about:
> - What makes you unique? What's your 'superpower' that other candidates don't have?
> - What kind of work excites you? What drains you?
> - Any deal-breakers? (e.g., no on-site, no startups under 20 people, no Java shops)
> - Your best professional achievement -- the one you'd lead with in an interview
> - Any projects, articles, or case studies you've published?
>
> The more context you give me, the better I filter."

Store insights in `{WORKSPACE}/config/profile.yml` (under narrative) or in `{WORKSPACE}/article-digest.md` if they share proof points.

**After every evaluation, learn.** If the user says "this score is too high" or "you missed that I have experience in X", update your understanding. Adjust framing in `{WORKSPACE}/modes/_profile.md` or add notes to `{WORKSPACE}/config/profile.yml`.

### Step 6: Ready
Once all files exist, confirm:
> "You're all set! You can now:
> - Paste a job URL to evaluate it
> - Run `/career-ops scan` to search portals
> - Run `/career-ops` to see all commands
>
> Everything is customizable -- just ask me to change anything.
>
> Tip: Having a personal portfolio dramatically improves your job search. The author's portfolio is open source: github.com/santifer/cv-santiago -- feel free to fork it."

Then suggest automation:
> "Want me to scan for new offers automatically? I can set up a recurring scan every few days so you don't miss anything. Just say 'scan every 3 days' and I'll configure it."

---

## 12. CV Source of Truth

- `{WORKSPACE}/cv.md` is the canonical CV
- `{WORKSPACE}/article-digest.md` has detailed proof points (optional)
- **NEVER hardcode metrics** -- read them from these files at evaluation time

---

## 13. Main Files Reference

| File | Location | Purpose |
|------|----------|---------|
| Application tracker | `{WORKSPACE}/data/applications.md` | Track all applications |
| URL inbox | `{WORKSPACE}/data/pipeline.md` | Pending URLs to process |
| Scan history | `{WORKSPACE}/data/scan-history.tsv` | Scanner dedup |
| Portal config | `{WORKSPACE}/portals.yml` | Query and company config |
| CV template | `{PLUGIN_ROOT}/templates/cv-template.html` | HTML template for PDFs |
| PDF generator | `{PLUGIN_ROOT}/scripts/generate-pdf.mjs` | Playwright: HTML to PDF |
| Proof points | `{WORKSPACE}/article-digest.md` | Portfolio proof points (optional) |
| Story bank | `{WORKSPACE}/interview-prep/story-bank.md` | STAR+R stories |
| Reports | `{WORKSPACE}/reports/` | Format: `{###}-{company-slug}-{YYYY-MM-DD}.md` |
| Output PDFs | `{WORKSPACE}/output/` | Generated CV PDFs |
| Saved JDs | `{WORKSPACE}/jds/` | Referenced as `local:jds/{file}` in pipeline |
