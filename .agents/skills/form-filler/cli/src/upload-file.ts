import type { Page } from "playwright"

export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
  await page.setInputFiles(selector, filePath)
}
