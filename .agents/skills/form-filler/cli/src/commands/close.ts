import { chromium } from "playwright"
import { readSession, clearSession } from "../session.js"

export async function runClose(): Promise<number> {
  const session = await readSession()
  if (!session) {
    process.stdout.write(JSON.stringify({ closed: false, reason: "no active session" }, null, 2) + "\n")
    return 0
  }
  try {
    const browser = await chromium.connect(session.wsEndpoint)
    await browser.close()
  } catch {
    // Session may already be dead; clean up the file regardless.
  }
  await clearSession()
  process.stdout.write(JSON.stringify({ closed: true }, null, 2) + "\n")
  return 0
}
