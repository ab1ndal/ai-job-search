import { readFile } from "fs/promises"
import { connectSession } from "../session.js"
import { fillFields } from "../fill-fields.js"
import { writeError } from "../helpers.js"

export interface FillOpts {
  mapPath: string
}

export async function runFill(opts: FillOpts): Promise<number> {
  let map: Record<string, string>
  try {
    const raw = await readFile(opts.mapPath, "utf-8")
    map = JSON.parse(raw)
  } catch (e) {
    writeError(
      `Could not read/parse field map at "${opts.mapPath}": ${e instanceof Error ? e.message : String(e)}`,
      "BAD_FIELD_MAP",
    )
    return 1
  }
  try {
    const { page } = await connectSession()
    const result = await fillFields(page, map)
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "FILL_FAILED")
    return 1
  }
}
