import { describe, test, before, after } from "node:test"
import assert from "node:assert/strict"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { tmpdir } from "os"
import { extractSnapshot } from "../src/snapshot-extract.ts"

const FIXTURES = join(import.meta.dirname, "fixtures")
let browser: Browser
let page: Page

describe("extractSnapshot", () => {
  before(async () => {
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
  })

  after(async () => {
    await browser.close()
  })

  test("detects text fields, textarea, and file input on a plain form", async () => {
    await page.goto(`file://${join(FIXTURES, "form.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "form-snap.png"))
    assert.equal(result.pageState, "form")
    const labels = result.fields.map((f) => f.label)
    assert.ok(labels.includes("Full Name"))
    assert.ok(labels.includes("Email"))
    const nameField = result.fields.find((f) => f.label === "Full Name")
    assert.equal(nameField?.required, true)
    assert.ok(result.buttons.some((b) => b.text === "Next"))
  })

  test("detects a login wall", async () => {
    await page.goto(`file://${join(FIXTURES, "login.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-snap.png"))
    assert.equal(result.pageState, "login_wall")
  })

  test("detects a login wall with an email-type username field", async () => {
    await page.goto(`file://${join(FIXTURES, "login-email.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-email-snap.png"))
    assert.equal(result.pageState, "login_wall")
  })

  test("detects a login wall that also has a 'remember me' checkbox", async () => {
    await page.goto(`file://${join(FIXTURES, "login-remember-me.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-remember-snap.png"))
    assert.equal(result.pageState, "login_wall")
    assert.ok(result.fields.some((f) => f.type === "checkbox"))
  })

  test("excludes reset inputs from the fillable field list", async () => {
    await page.goto(`file://${join(FIXTURES, "login-remember-me.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-reset-snap.png"))
    assert.equal(
      result.fields.some((f) => f.type === "reset"),
      false,
    )
  })

  test("detects a captcha", async () => {
    await page.goto(`file://${join(FIXTURES, "captcha.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "captcha-snap.png"))
    assert.equal(result.pageState, "captcha")
  })

  test("gives anonymous inputs in sibling wrappers distinct, correctly-targeted selectors", async () => {
    await page.goto(`file://${join(FIXTURES, "nested-form.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "nested-snap.png"))
    const anonymous = result.fields.filter((f) => f.tag === "input")
    assert.equal(anonymous.length, 2)
    const [first, second] = anonymous
    assert.notEqual(first.selector, second.selector)

    // Filling each selector must reach exactly one element — the one the
    // candidate was shown — with no cross-contamination between the two.
    await page.fill(first.selector, "first value")
    await page.fill(second.selector, "second value")
    assert.equal(await page.inputValue(first.selector), "first value")
    assert.equal(await page.inputValue(second.selector), "second value")
    assert.equal(first.label, "First reference")
    assert.equal(second.label, "Second reference")
  })

  test("reports step-indicator headings", async () => {
    await page.goto(`file://${join(FIXTURES, "nested-form.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "headings-snap.png"))
    assert.ok(result.headings.includes("Step 2 of 3"))
  })

  test("reports plain anchor links as clickable controls", async () => {
    await page.goto(`file://${join(FIXTURES, "form-with-link.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "link-snap.png"))
    assert.ok(result.buttons.some((b) => b.text === "Next" && b.selector === "#next-link"))
  })
})
