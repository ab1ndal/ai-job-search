import { describe, test, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { writeFile, mkdtemp } from "fs/promises"
import { tmpdir } from "os"
import { uploadFile } from "../src/upload-file.ts"

const FIXTURES = join(import.meta.dirname, "fixtures")
let browser: Browser
let page: Page
let testFilePath: string

describe("uploadFile", () => {
  before(async () => {
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
    const dir = await mkdtemp(join(tmpdir(), "form-filler-upload-"))
    testFilePath = join(dir, "resume.pdf")
    await writeFile(testFilePath, "fake pdf content")
  })

  after(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    await page.goto(`file://${join(FIXTURES, "form.html")}`)
  })

  test("sets a file-input field", async () => {
    await uploadFile(page, "#resume", testFilePath)
    const fileCount = await page.locator("#resume").evaluate((el: HTMLInputElement) => el.files?.length ?? 0)
    assert.equal(fileCount, 1)
    const fileName = await page.locator("#resume").evaluate((el: HTMLInputElement) => el.files?.[0]?.name)
    assert.equal(fileName, "resume.pdf")
  })

  test("throws when the selector does not match a file input", async () => {
    await assert.rejects(() => uploadFile(page, "#fullname", testFilePath))
  })
})
