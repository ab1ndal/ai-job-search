# form-filler-cli

Playwright-backed CLI for driving a browser through an online application
form. See `../SKILL.md` for the skill-level description and `/fill-form`
(`.claude/commands/fill-form.md`) for how it's orchestrated.

## Development

```bash
bun install
bunx playwright install chromium
bun test
bun run typecheck
```

## Architecture

- `src/session.ts` — session persistence (`launchSession`/`connectSession`)
  via `chromium.launchServer()` and a git-ignored `.session/current.json`
  file, so separate CLI process invocations reconnect to the same running
  browser.
- `src/snapshot-extract.ts`, `src/fill-fields.ts`, `src/upload-file.ts`,
  `src/click-and-wait.ts` — pure functions taking an already-open Playwright
  `Page`, each backing one subcommand. These are what the test suite
  exercises directly (via `chromium.launch({ headless: true })` against
  fixture HTML in `tests/fixtures/`), decoupled from the session-persistence
  mechanism, which needs a visible browser and is verified by manual trace
  instead.
- `src/commands/*.ts` — thin CLI wrappers: parse args, call
  `connectSession`/`launchSession`, call the pure function, format output.
- `src/cli.ts` — argument parsing and subcommand dispatch, no CLI framework.
