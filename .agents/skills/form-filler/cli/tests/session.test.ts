import { describe, test, expect, afterEach } from "bun:test"
import { readSession, writeSession, clearSession, connectSession, SessionError } from "../src/session"

describe("session file management", () => {
  afterEach(async () => {
    await clearSession()
  })

  test("readSession returns null when no session file exists", async () => {
    await clearSession()
    const session = await readSession()
    expect(session).toBeNull()
  })

  test("writeSession then readSession round-trips", async () => {
    await writeSession({ wsEndpoint: "ws://example.test/fake" })
    const session = await readSession()
    expect(session?.wsEndpoint).toBe("ws://example.test/fake")
  })

  test("clearSession removes the file", async () => {
    await writeSession({ wsEndpoint: "ws://example.test/fake" })
    await clearSession()
    const session = await readSession()
    expect(session).toBeNull()
  })

  test("connectSession throws SessionError when no session exists", async () => {
    await clearSession()
    await expect(connectSession()).rejects.toThrow(SessionError)
  })
})
