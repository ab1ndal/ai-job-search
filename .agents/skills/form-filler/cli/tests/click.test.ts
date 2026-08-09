import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { clickAndWait } from "../src/click-and-wait"

const FIXTURES = join(import.meta.dir, "fixtures")
let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  await page.goto(`file://${join(FIXTURES, "form-with-link.html")}`)
})

describe("clickAndWait", () => {
  test("clicks a link and lands on the next page", async () => {
    const result = await clickAndWait(page, "#next-link")
    expect(result.url).toContain("page-two.html")
    expect(await page.locator("#marker").textContent()).toBe("arrived")
  })

  test("throws when the selector does not match anything", async () => {
    await expect(clickAndWait(page, "#does-not-exist")).rejects.toThrow()
  }, 35000)
})
