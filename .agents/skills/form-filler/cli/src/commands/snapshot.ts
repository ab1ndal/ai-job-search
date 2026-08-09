import { join } from "path"
import { tmpdir } from "os"
import { launchSession, connectSession, readSession, clearSession } from "../session.ts"
import { extractSnapshot } from "../snapshot-extract.ts"
import { writeError } from "../helpers.ts"

export interface SnapshotOpts {
  url?: string
}

export async function runSnapshot(opts: SnapshotOpts): Promise<number> {
  try {
    const existing = await readSession()
    let page
    if (!existing) {
      if (!opts.url) {
        writeError("No active session and no URL given — snapshot requires a URL to start", "NO_URL")
        return 1
      }
      ;({ page } = await launchSession(opts.url))
    } else {
      try {
        ;({ page } = await connectSession())
        if (opts.url) await page.goto(opts.url, { waitUntil: "domcontentloaded" })
      } catch (e) {
        // A crashed or Ctrl-C'd run leaves a session file pointing at a dead
        // browser. With a URL in hand the candidate is starting over anyway, so
        // discard the stale session and launch fresh rather than dead-ending.
        if (!opts.url) throw e
        await clearSession()
        ;({ page } = await launchSession(opts.url))
      }
    }
    const screenshotPath = join(tmpdir(), `form-filler-${Date.now()}.png`)
    const result = await extractSnapshot(page, screenshotPath)
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SNAPSHOT_FAILED")
    return 1
  }
}
