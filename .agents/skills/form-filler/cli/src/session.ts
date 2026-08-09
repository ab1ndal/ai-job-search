import { chromium, type Browser, type Page } from "playwright"
import { join, dirname } from "path"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import { spawn } from "child_process"
import { setTimeout } from "timers/promises"

const DEFAULT_SESSION_FILE = join(import.meta.dirname, "../.session/current.json")

/**
 * Tests (and any other caller that must not disturb a live `/fill-form` run)
 * point this at a throwaway path via the `FORM_FILLER_SESSION_FILE` env var or
 * the explicit `sessionFile` argument, so they never touch the real session.
 */
export function sessionFilePath(sessionFile?: string): string {
  return sessionFile ?? process.env.FORM_FILLER_SESSION_FILE ?? DEFAULT_SESSION_FILE
}

export interface SessionInfo {
  /** CDP endpoint of the running browser, e.g. `http://127.0.0.1:51234`. */
  cdpEndpoint: string
  /** PID of the browser-owning daemon, so `close` can reap it. */
  pid: number
}

export class SessionError extends Error {}

export async function readSession(sessionFile?: string): Promise<SessionInfo | null> {
  try {
    return JSON.parse(await readFile(sessionFilePath(sessionFile), "utf-8")) as SessionInfo
  } catch {
    return null
  }
}

export async function writeSession(info: SessionInfo, sessionFile?: string): Promise<void> {
  const path = sessionFilePath(sessionFile)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(info, null, 2))
}

export async function clearSession(sessionFile?: string): Promise<void> {
  try {
    await unlink(sessionFilePath(sessionFile))
  } catch {
    // already gone
  }
}

const DAEMON_SCRIPT = join(import.meta.dirname, "browser-daemon.ts")
const DAEMON_STARTUP_TIMEOUT_MS = 60_000

export async function launchSession(
  url: string,
  opts: { headless?: boolean; sessionFile?: string } = {},
): Promise<{ browser: Browser; page: Page }> {
  const path = sessionFilePath(opts.sessionFile)
  await clearSession(path)
  // Detached on purpose: Playwright closes every browser it launched when the
  // launching process exits, so the browser has to be owned by a process that
  // outlives this CLI invocation. See src/browser-daemon.ts.
  const daemon = spawn(process.execPath, [DAEMON_SCRIPT, path, opts.headless ? "headless" : "headed"], {
    detached: true,
    stdio: "ignore",
  })
  daemon.unref()

  const session = await waitForSession(path)
  const { browser, page } = await attach(session)
  await page.goto(url, { waitUntil: "domcontentloaded" })
  return { browser, page }
}

async function waitForSession(path: string): Promise<SessionInfo> {
  const deadline = Date.now() + DAEMON_STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const session = await readSession(path)
    if (session?.cdpEndpoint) return session
    await setTimeout(100)
  }
  throw new SessionError(
    `Browser did not start within ${DAEMON_STARTUP_TIMEOUT_MS / 1000}s. ` +
      "Check that Playwright's Chromium is installed (`npx playwright install chromium`).",
  )
}

export async function connectSession(sessionFile?: string): Promise<{ browser: Browser; page: Page }> {
  const session = await readSession(sessionFile)
  if (!session) {
    throw new SessionError("No active form-filler session. Run `snapshot <url>` first.")
  }
  return attach(session)
}

async function attach(session: SessionInfo): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(session.cdpEndpoint)
  const contexts = browser.contexts()
  if (contexts.length === 0) throw new SessionError("Session browser has no open context.")
  const pages = contexts[0].pages()
  if (pages.length === 0) throw new SessionError("Session browser has no open page.")
  return { browser, page: pages[pages.length - 1] }
}
