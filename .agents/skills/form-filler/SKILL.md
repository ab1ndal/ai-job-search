---
name: form-filler
version: 1.0.0
description: >
  Drives a real browser through an online job-application form, page by page,
  proposing field values from the candidate's profile and already-drafted
  form content, and waiting for approval before filling or clicking anything.
  Used by /fill-form. Not for unattended or bulk use — every page's values
  and the final submit are confirmed by the candidate.
context: fork
enabled: true
allowed-tools: Bash(node .agents/skills/form-filler/cli/src/cli.ts *)
---

# Form Filler Skill

Playwright-backed CLI that opens a **visible** browser window and lets `/fill-form`
read a form's fields, fill them, upload files, and click through pages — one
step at a time, with the candidate approving every value.

## Runtime: node, not bun

Unlike the repo's other CLI skills, this one runs under **node** (>= 22.6, for
native TypeScript type stripping): bun's websocket client cannot drive
Playwright's browser-server connection mechanism this skill depends on for
cross-process session persistence — it hangs indefinitely instead of connecting.

## Setup (one-time)

```bash
cd .agents/skills/form-filler/cli
npm install
npx playwright install chromium
```

## Commands

```bash
node .agents/skills/form-filler/cli/src/cli.ts snapshot [url]
node .agents/skills/form-filler/cli/src/cli.ts fill <field-map.json>
node .agents/skills/form-filler/cli/src/cli.ts upload <selector> <file-path>
node .agents/skills/form-filler/cli/src/cli.ts click <selector>
node .agents/skills/form-filler/cli/src/cli.ts close
```

- `snapshot [url]` — the first call requires a URL and opens a new visible
  browser window on it; later calls with no URL read the current page.
  Prints `{ url, screenshot, pageState, fields, buttons, headings }` —
  `pageState` is one of `form`, `login_wall`, `captcha`, `unknown`, and
  `headings` is the page's short heading-like text (`h1`–`h3`, ARIA headings,
  step/progress indicators), which is where a "Step 2 of 3" marker shows up.
- `fill <field-map.json>` — a JSON file of `{ "<selector>": "<value>" }`
  pairs, filled via Playwright's `fill`.
- `upload <selector> <file-path>` — sets a file-input field.
- `click <selector>` — clicks a button or link, then waits for whatever the
  click started — a navigation or an in-page submit request — to finish
  (`networkidle`, capped at 10s) before reporting the resulting URL.
- `close` — closes the browser and clears session state.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }`
and the process exits with code `1`.

## Session persistence

The browser stays open across separate CLI invocations within one
`/fill-form` run — `snapshot`'s first call spawns a detached daemon process
(`src/browser-daemon.ts`) that owns the browser and writes its CDP endpoint to a
git-ignored session file; every later subcommand attaches to the same running
browser via that file. Run `close` when done, or the browser window stays open.

**Recovering a stale session.** A crashed or Ctrl-C'd run can leave a session
file pointing at a browser that is gone. `snapshot <url>` handles this itself: if
attaching fails and a URL was given, it discards the dead session and starts a
fresh browser on that URL. `snapshot` with no URL cannot — there is nothing to
launch against — so it reports the attach error instead. `close` is the manual
reset: it always clears session state, even when the browser is already dead.

## Not for unattended use

This CLI has no "fill and submit everything automatically" mode. Every field
value and the final submit click are proposed and confirmed by a human via
`/fill-form`'s orchestration — see `.claude/commands/fill-form.md`.
