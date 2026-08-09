import type { Page } from "playwright"

export interface FillResult {
  filled: string[]
}

export async function fillFields(page: Page, map: Record<string, string>): Promise<FillResult> {
  const filled: string[] = []
  for (const [selector, value] of Object.entries(map)) {
    await page.fill(selector, value, { timeout: 2000 })
    filled.push(selector)
  }
  return { filled }
}
