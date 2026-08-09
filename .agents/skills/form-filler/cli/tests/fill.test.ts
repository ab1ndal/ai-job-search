import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { fillFields } from "../src/fill-fields"

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
  await page.goto(`file://${join(FIXTURES, "form.html")}`)
})

describe("fillFields", () => {
  test("fills text and textarea fields by selector", async () => {
    const result = await fillFields(page, {
      "#fullname": "Ada Lovelace",
      "#email": "ada@example.test",
      'textarea[name="cover_note"]': "Excited to apply.",
    })
    expect(result.filled).toEqual(["#fullname", "#email", 'textarea[name="cover_note"]'])
    expect(await page.inputValue("#fullname")).toBe("Ada Lovelace")
    expect(await page.inputValue("#email")).toBe("ada@example.test")
    expect(await page.inputValue('textarea[name="cover_note"]')).toBe("Excited to apply.")
  })

  test("throws when a selector does not match any element", async () => {
    await expect(fillFields(page, { "#does-not-exist": "value" })).rejects.toThrow()
  })
})
