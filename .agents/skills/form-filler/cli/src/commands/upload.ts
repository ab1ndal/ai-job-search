import { stat } from "fs/promises"
import { connectSession } from "../session.js"
import { uploadFile } from "../upload-file.js"
import { writeError } from "../helpers.js"

export interface UploadOpts {
  selector: string
  filePath: string
}

export async function runUpload(opts: UploadOpts): Promise<number> {
  try {
    await stat(opts.filePath)
  } catch {
    writeError(`File not found: "${opts.filePath}"`, "FILE_NOT_FOUND")
    return 1
  }
  try {
    const { page } = await connectSession()
    await uploadFile(page, opts.selector, opts.filePath)
    process.stdout.write(JSON.stringify({ uploaded: opts.filePath, selector: opts.selector }, null, 2) + "\n")
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "UPLOAD_FAILED")
    return 1
  }
}
