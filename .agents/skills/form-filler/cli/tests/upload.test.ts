import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { writeFile, mkdtemp } from "fs/promises"
import { tmpdir } from "os"
import { uploadFile } from "../src/upload-file"

const FIXTURES = join(import.meta.dir, "fixtures")
let browser: Browser
let page: Page
let testFilePath: string

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  const dir = await mkdtemp(join(tmpdir(), "form-filler-upload-"))
  testFilePath = join(dir, "resume.pdf")
  await writeFile(testFilePath, "fake pdf content")
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  await page.goto(`file://${join(FIXTURES, "form.html")}`)
})

describe("uploadFile", () => {
  test("sets a file-input field", async () => {
    await uploadFile(page, "#resume", testFilePath)
    const fileCount = await page.locator("#resume").evaluate((el: HTMLInputElement) => el.files?.length ?? 0)
    expect(fileCount).toBe(1)
    const fileName = await page.locator("#resume").evaluate((el: HTMLInputElement) => el.files?.[0]?.name)
    expect(fileName).toBe("resume.pdf")
  })

  test(
    "throws when the selector does not match a file input",
    async () => {
      await expect(uploadFile(page, "#fullname", testFilePath)).rejects.toThrow()
    },
    35000,
  )
})
