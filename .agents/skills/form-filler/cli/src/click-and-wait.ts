import type { Page } from "playwright"

export interface ClickResult {
  url: string
}

export async function clickAndWait(page: Page, selector: string): Promise<ClickResult> {
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {}),
    page.click(selector),
  ])
  return { url: page.url() }
}
