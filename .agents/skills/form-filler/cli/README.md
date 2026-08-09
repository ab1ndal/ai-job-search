# form-filler-cli

Playwright-backed CLI for driving a browser through an online application
form. See `../SKILL.md` for the skill-level description and `/fill-form`
(`.claude/commands/fill-form.md`) for how it's orchestrated.

## Development

Runs under **node** (>= 22.6, for native TypeScript type stripping), not bun
like the repo's other CLI skills: bun's websocket client cannot drive
Playwright's browser-connection mechanism this CLI needs for cross-process
session persistence — it hangs instead of connecting.

```bash
npm install
npx playwright install chromium
npm test
npm run typecheck
```

## Architecture

- `src/session.ts` + `src/browser-daemon.ts` — session persistence
  (`launchSession`/`connectSession`). Playwright closes any browser it launched
  when the launching process exits, so `launchSession` spawns the daemon
  detached to own the browser; the daemon records its CDP endpoint in a
  git-ignored `.session/current.json`, and later CLI invocations attach over CDP
  (`connectOverCDP`, which — unlike `connect()` — shares pages across clients).
  `snapshot <url>` discards a stale session and relaunches if attaching fails;
  `close` is the manual reset. Tests point `FORM_FILLER_SESSION_FILE` (or the
  `sessionFile` argument) at a temp path so they never disturb a live session.
- `src/snapshot-extract.ts`, `src/fill-fields.ts`, `src/upload-file.ts`,
  `src/click-and-wait.ts` — pure functions taking an already-open Playwright
  `Page`, each backing one subcommand. These are what the test suite
  exercises directly (via `chromium.launch({ headless: true })` against
  fixture HTML in `tests/fixtures/`, plus a small local HTTP server for
  navigation-timing coverage), decoupled from the session-persistence
  mechanism, which needs a visible browser and is verified by manual trace
  instead.
- `src/commands/*.ts` — thin CLI wrappers: parse args, call
  `connectSession`/`launchSession`, call the pure function, format output.
- `src/cli.ts` — argument parsing and subcommand dispatch, no CLI framework.
