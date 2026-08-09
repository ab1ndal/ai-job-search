import type { Page } from "playwright"

export interface FieldInfo {
  selector: string
  label: string
  tag: string
  type: string
  required: boolean
  currentValue: string
}

export interface ButtonInfo {
  selector: string
  text: string
}

export interface SnapshotResult {
  url: string
  screenshot: string
  pageState: "form" | "login_wall" | "captcha" | "unknown"
  fields: FieldInfo[]
  buttons: ButtonInfo[]
}

export async function extractSnapshot(page: Page, screenshotPath: string): Promise<SnapshotResult> {
  const fields = await page.$$eval("input, select, textarea", (elements) => {
    function labelFor(el: Element): string {
      const id = el.getAttribute("id")
      if (id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        if (lbl?.textContent) return lbl.textContent.trim()
      }
      const wrapping = el.closest("label")
      if (wrapping?.textContent) return wrapping.textContent.trim()
      const aria = el.getAttribute("aria-label")
      if (aria) return aria
      const placeholder = el.getAttribute("placeholder")
      if (placeholder) return placeholder
      return ""
    }
    function selectorFor(el: Element, index: number): string {
      const id = el.getAttribute("id")
      if (id) return `#${CSS.escape(id)}`
      const name = el.getAttribute("name")
      if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`
      return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`
    }
    return elements
      .filter((el) => {
        const type = (el as HTMLInputElement).type
        return el.tagName !== "INPUT" || !["hidden", "submit", "button"].includes(type)
      })
      .map((el, index) => {
        const tag = el.tagName.toLowerCase()
        const type = tag === "input" ? (el as HTMLInputElement).type : tag
        return {
          selector: selectorFor(el, index),
          label: labelFor(el),
          tag,
          type,
          required: el.hasAttribute("required"),
          currentValue: (el as HTMLInputElement).value || "",
        }
      })
  })

  const buttons = await page.$$eval(
    "button, input[type=submit], input[type=button], a[role=button]",
    (elements) =>
      elements.map((el, index) => {
        const id = el.getAttribute("id")
        const selector = id ? `#${CSS.escape(id)}` : `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`
        const text = (el.textContent || (el as HTMLInputElement).value || "").trim()
        return { selector, text }
      }),
  )

  const hasCaptcha = await page
    .$$eval(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, [data-sitekey]',
      (els) => els.length > 0,
    )
    .catch(() => false)

  const hasPassword = fields.some((f) => f.type === "password")
  const onlyIdentityFields = fields.every(
    (f) => f.tag === "input" && (f.type === "text" || f.type === "password" || f.type === "email" || f.type === "tel"),
  )

  let pageState: SnapshotResult["pageState"]
  if (hasCaptcha) pageState = "captcha"
  else if (hasPassword && onlyIdentityFields) pageState = "login_wall"
  else if (fields.length > 0) pageState = "form"
  else pageState = "unknown"

  await page.screenshot({ path: screenshotPath })

  return { url: page.url(), screenshot: screenshotPath, pageState, fields, buttons }
}
