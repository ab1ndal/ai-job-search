import { describe, test, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { chromium, type Browser, type Page } from "playwright"
import { createServer, type Server } from "node:http"
import { setTimeout as delay } from "node:timers/promises"
import { join } from "path"
import { clickAndWait } from "../src/click-and-wait.ts"

const FIXTURES = join(import.meta.dirname, "fixtures")
let browser: Browser
let page: Page

describe("clickAndWait", () => {
  before(async () => {
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
  })

  after(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    await page.goto(`file://${join(FIXTURES, "form-with-link.html")}`)
  })

  test("clicks a link and lands on the next page", async () => {
    const result = await clickAndWait(page, "#next-link")
    assert.ok(result.url.includes("page-two.html"))
    assert.equal(await page.locator("#marker").textContent(), "arrived")
  })

  test("throws when the selector does not match anything", async () => {
    await assert.rejects(() => clickAndWait(page, "#does-not-exist"))
  })
})

// A file:// link navigates instantly, so it cannot show whether the wait is
// real. This server holds every submit response back for 400ms. The XHR case is
// the one that actually distinguishes the fix: `page.click` internally awaits a
// navigation it triggers, but nothing waits for a submit that stays on the page
// — exactly the in-flight request /fill-form's submit path would close the
// browser on top of.
describe("clickAndWait against a slow-responding server", () => {
  let server: Server
  let baseUrl: string
  let slowBrowser: Browser
  let slowPage: Page

  before(async () => {
    slowBrowser = await chromium.launch({ headless: true })
    server = createServer(async (req, res) => {
      if (req.url?.startsWith("/next")) {
        await delay(400)
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end('<!DOCTYPE html><html><body><p id="marker">arrived</p></body></html>')
        return
      }
      if (req.url?.startsWith("/api/submit")) {
        await delay(400)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end('{"ok":true}')
        return
      }
      if (req.url?.startsWith("/xhr-form")) {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(
          '<!DOCTYPE html><html><body><button id="submit-btn">Submit Application</button>' +
            "<script>document.getElementById('submit-btn').addEventListener('click', () => {" +
            "fetch('/api/submit').then(() => " +
            "document.body.insertAdjacentHTML('beforeend', '<p id=\"done\">submitted</p>'))" +
            "})</script></body></html>",
        )
        return
      }
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(
        '<!DOCTYPE html><html><body><form action="/next" method="GET">' +
          '<button id="submit-btn" type="submit">Submit Application</button></form></body></html>',
      )
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (address === null || typeof address === "string") throw new Error("server has no port")
    baseUrl = `http://127.0.0.1:${address.port}`
    slowPage = await slowBrowser.newPage()
  })

  after(async () => {
    await slowBrowser.close()
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
  })

  test("returns the post-navigation URL and a loaded next page", async () => {
    await slowPage.goto(`${baseUrl}/form`)
    const result = await clickAndWait(slowPage, "#submit-btn")
    assert.ok(result.url.includes("/next"), `expected the /next URL, got ${result.url}`)
    assert.equal(await slowPage.locator("#marker").textContent(), "arrived")
  })

  test("returns only once an in-flight XHR submit has completed", async () => {
    await slowPage.goto(`${baseUrl}/xhr-form`)
    await clickAndWait(slowPage, "#submit-btn")
    // No extra waiting here on purpose: if clickAndWait returned early, the
    // submit request would still be in flight and this marker absent.
    assert.equal(await slowPage.locator("#done").count(), 1)
  })
})
