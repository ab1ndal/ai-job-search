export function writeError(message: string, code: string): void {
  process.stderr.write(JSON.stringify({ error: message, code }) + "\n")
}
