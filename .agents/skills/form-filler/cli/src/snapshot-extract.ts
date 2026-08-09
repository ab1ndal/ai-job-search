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
  headings: string[]
}

const BUTTON_SELECTOR = "button, input[type=submit], input[type=button], a[href], a[role=button]"
const HEADING_SELECTOR = 'h1, h2, h3, [role="heading"], .step-indicator, .progress'
const EXCLUDED_INPUT_TYPES = ["hidden", "submit", "button", "reset"]

export async function extractSnapshot(page: Page, screenshotPath: string): Promise<SnapshotResult> {
  const { fields, buttons, headings } = await page.evaluate(
    ({ buttonSelector, headingSelector, excludedInputTypes }) => {
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

      // A flat-list index is meaningless to CSS `:nth-of-type`, which counts
      // siblings under a shared parent — so walk the real ancestry instead and
      // build an nth-child chain that is unique no matter how the form nests.
      function structuralSelector(el: Element): string {
        const parts: string[] = []
        let node: Element | null = el
        while (node && node !== document.documentElement) {
          const parent: Element | null = node.parentElement
          if (!parent) {
            parts.unshift(node.tagName.toLowerCase())
            break
          }
          const position = Array.prototype.indexOf.call(parent.children, node) + 1
          parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${position})`)
          if (parent === document.body) {
            parts.unshift("body")
            break
          }
          node = parent
        }
        return parts.join(" > ")
      }

      function selectorFor(el: Element): string {
        const id = el.getAttribute("id")
        if (id) return `#${CSS.escape(id)}`
        const name = el.getAttribute("name")
        if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`
        return structuralSelector(el)
      }

      const fields = Array.from(document.querySelectorAll("input, select, textarea"))
        .filter((el) => {
          const type = (el as HTMLInputElement).type
          return el.tagName !== "INPUT" || !excludedInputTypes.includes(type)
        })
        .map((el) => {
          const tag = el.tagName.toLowerCase()
          const type = tag === "input" ? (el as HTMLInputElement).type : tag
          return {
            selector: selectorFor(el),
            label: labelFor(el),
            tag,
            type,
            required: el.hasAttribute("required"),
            currentValue: (el as HTMLInputElement).value || "",
          }
        })

      const buttons = Array.from(document.querySelectorAll(buttonSelector)).map((el) => ({
        selector: selectorFor(el),
        text: (el.textContent || (el as HTMLInputElement).value || "").trim(),
      }))

      const headings = Array.from(document.querySelectorAll(headingSelector))
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
        .filter((text) => text.length > 0 && text.length <= 100)
        .filter((text, index, all) => all.indexOf(text) === index)

      return { fields, buttons, headings }
    },
    {
      buttonSelector: BUTTON_SELECTOR,
      headingSelector: HEADING_SELECTOR,
      excludedInputTypes: EXCLUDED_INPUT_TYPES,
    },
  )

  const hasCaptcha = await page
    .$$eval(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, [data-sitekey]',
      (els) => els.length > 0,
    )
    .catch(() => false)

  const hasPassword = fields.some((f) => f.type === "password")
  // A login wall is "a password field with no application-form fields alongside
  // it". Incidental login controls (a "remember me" checkbox, a radio) do not
  // make a page an application form, so they must not suppress the hard stop.
  const hasOtherFormField = fields.some((f) => {
    if (f.tag === "textarea" || f.tag === "select") return true
    if (f.tag !== "input") return false
    if (f.type === "checkbox" || f.type === "radio") return false
    return !["text", "password", "email", "tel"].includes(f.type)
  })

  let pageState: SnapshotResult["pageState"]
  if (hasCaptcha) pageState = "captcha"
  else if (hasPassword && !hasOtherFormField) pageState = "login_wall"
  else if (fields.length > 0) pageState = "form"
  else pageState = "unknown"

  await page.screenshot({ path: screenshotPath })

  return { url: page.url(), screenshot: screenshotPath, pageState, fields, buttons, headings }
}
