---
name: career-ops-init
description: Set up a new career-ops workspace with directories, templates, and guided onboarding
---

# career-ops init -- Workspace Setup & Onboarding

This skill scaffolds a new career-ops workspace and walks the user through initial setup. Follow every step in order. Do NOT skip steps. Each step must complete before moving to the next.

---

## Resolve PLUGIN_ROOT

Before anything else, determine the plugin installation directory. This is where system files (templates, modes, scripts) live.

**Detection order:**

1. If the environment variable `CLAUDE_PLUGIN_ROOT` is set, use it.
2. Otherwise, locate the `.claude-plugin/plugin.json` file by walking up from the directory containing this skill file. The directory containing `.claude-plugin/plugin.json` is PLUGIN_ROOT.
3. As a last resort, check if the current working directory contains `.claude-plugin/plugin.json` or walk up from cwd.

Confirm you have found PLUGIN_ROOT by verifying that `{PLUGIN_ROOT}/.claude-plugin/plugin.json` exists. If it does not exist, stop and tell the user:

> "Cannot locate the career-ops plugin installation. Make sure the plugin is properly installed."

Store this path as `{PLUGIN_ROOT}` and use it for all template/system file references below.

---

## Step 1: Choose Workspace Location

Ask the user where to create the workspace:

> "Where would you like to create your career-ops workspace?
>
> 1. **Current directory** (`{cwd}`)
> 2. **~/career-ops** (recommended default)
> 3. **Custom path** -- tell me where
>
> The workspace holds your CV, profile, reports, and application data. The plugin's system files stay separate and can be updated independently."

- If the user picks option 1, set `WORKSPACE` to the current working directory.
- If the user picks option 2 (or just presses enter / says "default"), set `WORKSPACE` to `~/career-ops`.
- If the user provides a custom path, resolve it to an absolute path and set `WORKSPACE` to that.

**If `{WORKSPACE}/.career-ops.json` already exists**, warn the user:

> "A career-ops workspace already exists at `{WORKSPACE}`. Want me to:
> 1. Continue and fill in any missing files (safe -- won't overwrite existing data)
> 2. Pick a different location
> 3. Cancel"

If they choose option 1, proceed but skip creating files that already exist (never overwrite user data). If option 2, ask for a new path. If option 3, stop.

---

## Step 2: Check Prerequisites

Run these checks and report results:

### Node.js 18+

```bash
node --version
```

Parse the major version number. If Node.js is not installed or the version is below 18, tell the user:

> "Node.js 18+ is required for PDF generation and pipeline scripts. Install it from https://nodejs.org/ and re-run `/career-ops init`."

Stop here if Node.js is missing. Do NOT proceed without it.

### Playwright (optional but recommended)

```bash
npx playwright --version 2>/dev/null
```

If Playwright is not installed, tell the user:

> "Playwright is needed for PDF generation and job link verification. Want me to install it now?
>
> This will run: `npm install -g playwright && npx playwright install chromium`"

If the user agrees, run the install. If they decline, note that PDF generation and link verification will not be available and continue.

---

## Step 3: Scaffold Directories

Create the workspace directory structure. Run:

```bash
mkdir -p "{WORKSPACE}"/{config,modes,data,reports,output,jds,interview-prep,batch/{tracker-additions,logs}}
```

This creates:
- `config/` -- profile configuration
- `modes/` -- user overrides for archetypes and narrative
- `data/` -- application tracker, pipeline inbox, scan history
- `reports/` -- evaluation reports
- `output/` -- generated PDFs
- `jds/` -- saved job descriptions
- `interview-prep/` -- STAR+R story bank
- `batch/tracker-additions/` -- TSV files for tracker merge
- `batch/logs/` -- batch processing logs

---

## Step 4: Create Marker File

Write `.career-ops.json` to the workspace root. This marker file is how career-ops detects the workspace.

Write to `{WORKSPACE}/.career-ops.json`:

```json
{
  "version": "1.0.0",
  "created": "{today's date in YYYY-MM-DD format}",
  "pluginManaged": true
}
```

**Do NOT overwrite this file if it already exists.** Only create it if missing.

---

## Step 5: Save Workspace Location

Write the global config so career-ops can find this workspace from any directory.

Create the directory and file at `~/.config/career-ops/config.json`:

```bash
mkdir -p ~/.config/career-ops
```

Write to `~/.config/career-ops/config.json`:

```json
{
  "dataDir": "{absolute path to WORKSPACE}",
  "pluginVersion": "1.0.0",
  "configured": "{today's date in YYYY-MM-DD format}"
}
```

**If this file already exists**, read it first. If `dataDir` points to a different workspace, ask the user:

> "You already have a workspace configured at `{existing dataDir}`. Want me to:
> 1. Switch to the new workspace at `{WORKSPACE}`
> 2. Keep the existing workspace"

Only update if the user confirms switching.

---

## Step 6: Copy Templates

Copy template files from the plugin to the workspace. **NEVER overwrite files that already exist** -- user data is sacred.

For each file below, check if the destination exists BEFORE copying. Skip with a note if it does.

| Source (in PLUGIN_ROOT) | Destination (in WORKSPACE) |
|-------------------------|---------------------------|
| `templates/portals.example.yml` | `portals.yml` |
| `config/profile.example.yml` | `config/profile.yml` |
| `modes/_profile.template.md` | `modes/_profile.md` |

Create these files fresh if they do not exist:

### `{WORKSPACE}/data/applications.md`

```markdown
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
```

### `{WORKSPACE}/data/pipeline.md`

```markdown
# Pipeline -- URL Inbox

Add URLs here (one per line) and run `/career-ops pipeline` to process them.

```

### `{WORKSPACE}/interview-prep/story-bank.md`

```markdown
# Story Bank -- Master STAR+R Stories

Accumulated stories from evaluations and interview prep. Each entry uses the STAR+R format:
**S**ituation, **T**ask, **A**ction, **R**esult, **R**eflection.

---

```

After copying, tell the user what was created:

> "Workspace scaffolded at `{WORKSPACE}`:
> - config/profile.yml (your profile -- fill this in next)
> - modes/_profile.md (your customizations for archetypes and narrative)
> - portals.yml (job portal scanner config -- 45+ companies pre-configured)
> - data/applications.md (application tracker)
> - data/pipeline.md (URL inbox)
> - interview-prep/story-bank.md (STAR+R stories)"

---

## Step 7: Onboarding Flow

Now guide the user through personalization. This is interactive -- ask questions and wait for answers.

### Step 7a: CV (required)

Ask:

> "Let's set up your CV. You can either:
> 1. **Paste your CV** here and I'll convert it to clean markdown
> 2. **Paste your LinkedIn URL** and I'll extract the key info
> 3. **Tell me about your experience** and I'll draft a CV for you
>
> Which do you prefer?"

Based on their response:
- **Option 1 (paste):** Take whatever they paste and convert it to clean markdown with standard sections: Summary, Experience, Projects, Education, Skills. Remove formatting artifacts. Preserve all dates, metrics, and achievements.
- **Option 2 (LinkedIn URL):** Navigate to the URL using Playwright (`browser_navigate` then `browser_snapshot`). Extract name, headline, experience, education, skills. Convert to markdown CV format.
- **Option 3 (describe):** Ask follow-up questions as needed (years of experience, key roles, technical skills, notable achievements). Draft a professional CV in markdown.

Write the result to `{WORKSPACE}/cv.md`.

**IMPORTANT:** The CV must be clean markdown. No HTML tags, no special formatting. Standard sections with `##` headers.

### Step 7b: Profile (required)

Ask:

> "I need a few details to personalize the system:
> - Your **full name** and **email**
> - Your **location** and **timezone**
> - What **roles** are you targeting? (e.g., 'Senior Backend Engineer', 'AI Product Manager', 'Head of Engineering')
> - Your **salary target range** (e.g., '$150k-$200k' or 'EUR 80k-100k')
>
> I'll set everything up for you."

Take their answers and update `{WORKSPACE}/config/profile.yml`:
- Fill in `candidate.full_name`, `candidate.email`, `candidate.location`
- Set `targets.roles` to their target roles
- Set `targets.compensation` to their salary range
- Map their target roles to the closest archetypes and update `{WORKSPACE}/modes/_profile.md` if the defaults don't match

### Step 7c: Portals (recommended)

Ask:

> "I've set up the job scanner with 45+ pre-configured companies. Want me to customize the search keywords for your target roles?
>
> Current keywords will be based on generic tech roles. If you tell me your specific targets (e.g., 'machine learning engineer', 'backend lead'), I'll tune the filters so scans find relevant offers."

If they provide target keywords:
- Read `{WORKSPACE}/portals.yml`
- Update `title_filter.positive` to include their target role keywords
- Update `title_filter.negative` if they mention roles they want to exclude

If they decline, leave portals.yml as-is.

### Step 7d: Get to Know the User (important for quality)

Ask:

> "The basics are ready! But the system works much better when it knows you well. Can you tell me more about:
>
> - What makes you **unique**? What's your 'superpower' that other candidates don't have?
> - What kind of work **excites you**? What **drains you**?
> - Any **deal-breakers**? (e.g., no on-site, no startups under 20 people, no Java shops)
> - Your **best professional achievement** -- the one you'd lead with in an interview
> - Any **projects, articles, or case studies** you've published?
>
> The more context you give me, the better I filter. Think of it as onboarding a recruiter -- the first week I need to learn about you, then I become invaluable."

Store their answers:
- Professional narrative, superpowers, deal-breakers --> `{WORKSPACE}/config/profile.yml` under `narrative` section
- Update `{WORKSPACE}/modes/_profile.md` with archetype descriptions, framing, and proof points that reflect what they shared
- If they share published work (articles, case studies, projects) --> create or update `{WORKSPACE}/article-digest.md` with compact proof points

**This step is optional.** If the user wants to skip it, that's fine. Tell them they can always come back to it later by updating their profile.

---

## Step 8: Confirmation

Once all steps are complete, show the summary:

> "You're all set! Here's what was created:
>
> **Workspace:** `{WORKSPACE}`
>
> | File | Status |
> |------|--------|
> | cv.md | {created / skipped (already existed)} |
> | config/profile.yml | {created and personalized / skipped} |
> | modes/_profile.md | {created / skipped} |
> | portals.yml | {created / skipped} |
> | data/applications.md | {created / skipped} |
> | data/pipeline.md | {created / skipped} |
> | interview-prep/story-bank.md | {created / skipped} |
>
> **Available commands:**
> - **Paste a job URL** to evaluate it (full pipeline: evaluation + report + PDF + tracker)
> - `/career-ops scan` -- scan portals for new offers
> - `/career-ops pipeline` -- process pending URLs from your inbox
> - `/career-ops tracker` -- view application status
> - `/career-ops` -- see all commands
>
> Everything is customizable -- just ask me to change anything.
>
> **Tip:** Having a personal portfolio dramatically improves your job search. If you don't have one yet, the author's portfolio is also open source: [github.com/santifer/cv-santiago](https://github.com/santifer/cv-santiago) -- feel free to fork it and make it yours."

Then suggest automation:

> "Want me to scan for new offers automatically? I can set up a recurring scan every few days so you don't miss anything. Just say 'scan every 3 days' and I'll configure it."

If the user accepts, use the `/schedule` or `/loop` skill (if available) to set up a recurring `/career-ops scan`. If those aren't available, suggest adding a cron job or remind them to run `/career-ops scan` periodically.

---

## Error Handling

- If any `mkdir` or file write fails, report the error clearly and suggest the user check permissions.
- If the workspace path is inside the plugin directory, warn: "It's recommended to keep your workspace separate from the plugin installation so updates don't affect your data."
- If Playwright install fails, continue without it but note that PDF generation won't work until it's installed.
- Never leave the workspace in a half-created state. If a critical step fails, tell the user what succeeded and what needs to be retried.
