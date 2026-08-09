import { join } from "path"
import { tmpdir } from "os"
import { launchSession, connectSession, readSession } from "../session.js"
import { extractSnapshot } from "../snapshot-extract.js"
import { writeError } from "../helpers.js"

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
      ;({ page } = await connectSession())
      if (opts.url) await page.goto(opts.url, { waitUntil: "domcontentloaded" })
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
