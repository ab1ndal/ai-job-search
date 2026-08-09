import { describe, test, before, after, afterEach } from "node:test"
import assert from "node:assert/strict"
import { join } from "path"
import { tmpdir } from "os"
import { mkdtemp, rm } from "fs/promises"
import { readSession, writeSession, clearSession, connectSession, SessionError } from "../src/session.ts"

// Never the production session file — running the suite during a live
// /fill-form run must not destroy the candidate's open browser session.
let sessionFile: string
let dir: string

describe("session file management", () => {
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "form-filler-session-"))
    sessionFile = join(dir, "current.json")
  })

  after(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await clearSession(sessionFile)
  })

  test("readSession returns null when no session file exists", async () => {
    await clearSession(sessionFile)
    assert.equal(await readSession(sessionFile), null)
  })

  test("writeSession then readSession round-trips", async () => {
    await writeSession({ cdpEndpoint: "http://127.0.0.1:1", pid: process.pid }, sessionFile)
    const session = await readSession(sessionFile)
    assert.equal(session?.cdpEndpoint, "http://127.0.0.1:1")
  })

  test("clearSession removes the file", async () => {
    await writeSession({ cdpEndpoint: "http://127.0.0.1:1", pid: process.pid }, sessionFile)
    await clearSession(sessionFile)
    assert.equal(await readSession(sessionFile), null)
  })

  test("connectSession throws SessionError when no session exists", async () => {
    await clearSession(sessionFile)
    await assert.rejects(() => connectSession(sessionFile), SessionError)
  })
})
