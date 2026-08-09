import { connectSession } from "../session.ts"
import { clickAndWait } from "../click-and-wait.ts"
import { writeError } from "../helpers.ts"

export interface ClickOpts {
  selector: string
}

export async function runClick(opts: ClickOpts): Promise<number> {
  try {
    const { page } = await connectSession()
    const result = await clickAndWait(page, opts.selector)
    process.stdout.write(JSON.stringify({ clicked: opts.selector, url: result.url }, null, 2) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "CLICK_FAILED")
    return 1
  }
}
