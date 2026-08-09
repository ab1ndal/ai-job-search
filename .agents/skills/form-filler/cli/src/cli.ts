#!/usr/bin/env bun
import { runClick } from "./commands/click.js"
import { runClose } from "./commands/close.js"
import { runFill } from "./commands/fill.js"
import { runSnapshot } from "./commands/snapshot.js"
import { runUpload } from "./commands/upload.js"
import { writeError } from "./helpers.js"

const HELP = `form-filler-cli — drive a browser through an online application form

USAGE
  bun run src/cli.ts snapshot [url]        Start or read the current page. First call requires a URL.
  bun run src/cli.ts fill <field-map.json> Fill fields from a {selector: value} JSON file.
  bun run src/cli.ts upload <selector> <file-path>  Set a file-input field.
  bun run src/cli.ts click <selector>      Click a button/link and wait for navigation.
  bun run src/cli.ts close                 Close the browser session.

Requires Playwright's Chromium browser installed: bunx playwright install chromium
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]

  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "snapshot") {
    return runSnapshot({ url: argv[1] })
  }

  if (cmd === "fill") {
    if (!argv[1]) {
      writeError("fill requires a <field-map.json> path", "NO_FIELD_MAP")
      return 1
    }
    return runFill({ mapPath: argv[1] })
  }

  if (cmd === "upload") {
    if (!argv[1] || !argv[2]) {
      writeError("upload requires <selector> <file-path>", "BAD_ARGS")
      return 1
    }
    return runUpload({ selector: argv[1], filePath: argv[2] })
  }

  if (cmd === "click") {
    if (!argv[1]) {
      writeError("click requires a <selector>", "NO_SELECTOR")
      return 1
    }
    return runClick({ selector: argv[1] })
  }

  if (cmd === "close") {
    return runClose()
  }

  writeError(`Unknown command "${cmd}"`, "BAD_CMD")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    writeError(e instanceof Error ? e.message : String(e), "INTERNAL_ERROR")
    process.exit(1)
  })
