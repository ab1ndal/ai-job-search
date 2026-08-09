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
allowed-tools: Bash(bun run .agents/skills/form-filler/cli/src/cli.ts *)
---

# Form Filler Skill

Playwright-backed CLI that opens a **visible** browser window and lets `/fill-form`
read a form's fields, fill them, upload files, and click through pages — one
step at a time, with the candidate approving every value.

## Setup (one-time)

```bash
cd .agents/skills/form-filler/cli
bun install
bunx playwright install chromium
```

## Commands

```bash
bun run .agents/skills/form-filler/cli/src/cli.ts snapshot [url]
bun run .agents/skills/form-filler/cli/src/cli.ts fill <field-map.json>
bun run .agents/skills/form-filler/cli/src/cli.ts upload <selector> <file-path>
bun run .agents/skills/form-filler/cli/src/cli.ts click <selector>
bun run .agents/skills/form-filler/cli/src/cli.ts close
```

- `snapshot [url]` — the first call requires a URL and opens a new visible
  browser window on it; later calls with no URL read the current page.
  Prints `{ url, screenshot, pageState, fields, buttons }` — `pageState` is
  one of `form`, `login_wall`, `captcha`, `unknown`.
- `fill <field-map.json>` — a JSON file of `{ "<selector>": "<value>" }`
  pairs, filled via Playwright's `fill`.
- `upload <selector> <file-path>` — sets a file-input field.
- `click <selector>` — clicks a button or link and waits for the page to
  settle.
- `close` — closes the browser and clears session state.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }`
and the process exits with code `1`.

## Session persistence

The browser stays open across separate CLI invocations within one
`/fill-form` run — `snapshot`'s first call launches it via
`chromium.launchServer()` and writes its connection endpoint to a git-ignored
session file; every later subcommand reconnects to the same running browser
via that file. Run `close` when done, or the browser window stays open.

## Not for unattended use

This CLI has no "fill and submit everything automatically" mode. Every field
value and the final submit click are proposed and confirmed by a human via
`/fill-form`'s orchestration — see `.claude/commands/fill-form.md`.
