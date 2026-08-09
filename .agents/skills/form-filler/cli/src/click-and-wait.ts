import type { Page } from "playwright"

export interface ClickResult {
  url: string
}

/**
 * Clicks, then waits for whatever the click started to finish. `waitForLoadState`
 * must come *after* the click: raced against it, it resolves instantly on the
 * state the page already reached before the click, so `page.url()` could be read
 * mid-navigation — and `/fill-form`'s submit path closes the browser right after
 * this returns.
 */
export async function clickAndWait(page: Page, selector: string): Promise<ClickResult> {
  await page.click(selector)
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  return { url: page.url() }
}
