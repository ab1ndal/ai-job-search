import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { mkdir, unlink } from "fs/promises"

const SESSION_DIR = join(import.meta.dir, "../.session")
const SESSION_FILE = join(SESSION_DIR, "current.json")

export interface SessionInfo {
  wsEndpoint: string
}

export class SessionError extends Error {}

export async function readSession(): Promise<SessionInfo | null> {
  const file = Bun.file(SESSION_FILE)
  if (!(await file.exists())) return null
  try {
    return JSON.parse(await file.text()) as SessionInfo
  } catch {
    return null
  }
}

export async function writeSession(info: SessionInfo): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true })
  await Bun.write(SESSION_FILE, JSON.stringify(info, null, 2))
}

export async function clearSession(): Promise<void> {
  try {
    await unlink(SESSION_FILE)
  } catch {
    // already gone
  }
}

export async function launchSession(
  url: string,
  opts: { headless?: boolean } = {},
): Promise<{ browser: Browser; page: Page }> {
  const server = await chromium.launchServer({ headless: opts.headless ?? false })
  await writeSession({ wsEndpoint: server.wsEndpoint() })
  const browser = await chromium.connect(server.wsEndpoint())
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "domcontentloaded" })
  return { browser, page }
}

export async function connectSession(): Promise<{ browser: Browser; page: Page }> {
  const session = await readSession()
  if (!session) {
    throw new SessionError("No active form-filler session. Run `snapshot <url>` first.")
  }
  const browser = await chromium.connect(session.wsEndpoint)
  const contexts = browser.contexts()
  if (contexts.length === 0) throw new SessionError("Session browser has no open context.")
  const pages = contexts[0].pages()
  if (pages.length === 0) throw new SessionError("Session browser has no open page.")
  return { browser, page: pages[pages.length - 1] }
}
