import { chromium } from "playwright"
import { join, dirname } from "path"
import { readFile } from "fs/promises"
import { setTimeout as delay } from "timers/promises"
import { writeSession } from "./session.ts"

/**
 * Owns the browser for the lifetime of a /fill-form run.
 *
 * Playwright closes every browser it launched when the launching process exits,
 * so a short-lived CLI invocation cannot hold one open for the next invocation.
 * This script is spawned detached by `launchSession` and stays alive, so the
 * browser — and the candidate's manual login, cookies, and page state — survives
 * across separate `snapshot`/`fill`/`upload`/`click` calls.
 *
 * argv: <session-file-path> <"headless"|"headed">
 */
const sessionFile = process.argv[2]
const headless = process.argv[3] === "headless"
const userDataDir = join(dirname(sessionFile), "user-data")

const context = await chromium.launchPersistentContext(userDataDir, {
  headless,
  // Port 0 = let Chromium pick a free one; it reports it back via the
  // DevToolsActivePort file. Subcommands attach over CDP rather than
  // Playwright's own connect(), because connect() scopes contexts to the
  // connection that created them — page state would vanish on every exit.
  args: ["--remote-debugging-port=0"],
})

await writeSession({ cdpEndpoint: `http://127.0.0.1:${await readDevToolsPort()}`, pid: process.pid }, sessionFile)

context.on("close", () => process.exit(0))

async function readDevToolsPort(): Promise<string> {
  const portFile = join(userDataDir, "DevToolsActivePort")
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const port = (await readFile(portFile, "utf-8")).split("\n")[0]?.trim()
      if (port) return port
    } catch {
      // Chromium has not written it yet.
    }
    await delay(100)
  }
  throw new Error("Chromium never reported a DevTools port")
}
