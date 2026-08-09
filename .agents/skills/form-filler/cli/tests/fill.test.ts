import { describe, test, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { fillFields } from "../src/fill-fields.ts"

const FIXTURES = join(import.meta.dirname, "fixtures")
let browser: Browser
let page: Page

describe("fillFields", () => {
  before(async () => {
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
  })

  after(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    await page.goto(`file://${join(FIXTURES, "form.html")}`)
  })

  test("fills text and textarea fields by selector", async () => {
    const result = await fillFields(page, {
      "#fullname": "Ada Lovelace",
      "#email": "ada@example.test",
      'textarea[name="cover_note"]': "Excited to apply.",
    })
    assert.deepEqual(result.filled, ["#fullname", "#email", 'textarea[name="cover_note"]'])
    assert.equal(await page.inputValue("#fullname"), "Ada Lovelace")
    assert.equal(await page.inputValue("#email"), "ada@example.test")
    assert.equal(await page.inputValue('textarea[name="cover_note"]'), "Excited to apply.")
  })

  test("throws when a selector does not match any element", async () => {
    await assert.rejects(() => fillFields(page, { "#does-not-exist": "value" }))
  })
})
