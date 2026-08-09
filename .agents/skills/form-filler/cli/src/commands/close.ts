import { chromium } from "playwright"
import { readSession, clearSession } from "../session.ts"

export async function runClose(): Promise<number> {
  const session = await readSession()
  if (!session) {
    process.stdout.write(JSON.stringify({ closed: false, reason: "no active session" }, null, 2) + "\n")
    return 0
  }
  try {
    const browser = await chromium.connectOverCDP(session.cdpEndpoint)
    await browser.close()
  } catch {
    // Session may already be dead; clean up regardless.
  }
  try {
    // The daemon exits by itself once the browser closes; this only reaps it in
    // the case where the browser was already gone and it is still sitting there.
    process.kill(session.pid)
  } catch {
    // Already gone.
  }
  await clearSession()
  process.stdout.write(JSON.stringify({ closed: true }, null, 2) + "\n")
  return 0
}
