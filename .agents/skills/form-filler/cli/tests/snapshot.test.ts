import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { chromium, type Browser, type Page } from "playwright"
import { join } from "path"
import { tmpdir } from "os"
import { extractSnapshot } from "../src/snapshot-extract"

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

describe("extractSnapshot", () => {
  test("detects text fields, textarea, and file input on a plain form", async () => {
    await page.goto(`file://${join(FIXTURES, "form.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "form-snap.png"))
    expect(result.pageState).toBe("form")
    const labels = result.fields.map((f) => f.label)
    expect(labels).toContain("Full Name")
    expect(labels).toContain("Email")
    const nameField = result.fields.find((f) => f.label === "Full Name")
    expect(nameField?.required).toBe(true)
    expect(result.buttons.some((b) => b.text === "Next")).toBe(true)
  })

  test("detects a login wall", async () => {
    await page.goto(`file://${join(FIXTURES, "login.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-snap.png"))
    expect(result.pageState).toBe("login_wall")
  })

  test("detects a login wall with an email-type username field", async () => {
    await page.goto(`file://${join(FIXTURES, "login-email.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "login-email-snap.png"))
    expect(result.pageState).toBe("login_wall")
  })

  test("detects a captcha", async () => {
    await page.goto(`file://${join(FIXTURES, "captcha.html")}`)
    const result = await extractSnapshot(page, join(tmpdir(), "captcha-snap.png"))
    expect(result.pageState).toBe("captcha")
  })
})
