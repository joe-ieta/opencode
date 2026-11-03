import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { LiveService } from "./live-service"

test.each([
  { name: "adopts an existing older server", registration: true, status: 200, password: "test-secret", succeeds: true },
  {
    name: "fails when no server is registered",
    registration: false,
    status: 200,
    password: "test-secret",
    succeeds: false,
  },
  {
    name: "fails when the server is not ready",
    registration: true,
    status: 503,
    password: "test-secret",
    succeeds: false,
  },
  { name: "requires the server credential", registration: true, status: 200, password: undefined, succeeds: false },
])("live desktop $name without changing the registration", async (row) => {
  const root = await mkdtemp(join(tmpdir(), "opencode-desktop-live-"))
  if (!resolve(root).startsWith(join(resolve(tmpdir()), "opencode-desktop-live-")))
    throw new Error("Unexpected live-service fixture directory")
  const previous = process.env.XDG_STATE_HOME
  const file = join(root, "opencode", "service.json")
  const requests: string[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      if (
        row.password &&
        request.headers.get("authorization") !== `Basic ${Buffer.from(`opencode:${row.password}`).toString("base64")}`
      )
        return new Response(null, { status: 401 })
      return Response.json({ version: "2.2.5-installed", pid: process.pid }, { status: row.status })
    },
  })
  const registration = JSON.stringify({
    version: "2.2.5-installed",
    pid: process.pid,
    url: server.url.origin,
    password: row.password,
  })
  try {
    process.env.XDG_STATE_HOME = root
    if (row.registration) await Bun.write(file, registration)
    if (row.succeeds) {
      expect(await LiveService.connect()).toEqual({ url: server.url.origin, password: row.password })
    } else {
      await expect(LiveService.connect()).rejects.toThrow(
        row.password ? "No running compatible OpenCode service" : "did not provide authentication",
      )
    }
    expect(await Bun.file(file).exists()).toBe(row.registration)
    if (row.registration) expect(await Bun.file(file).text()).toBe(registration)
    expect(requests).toEqual(row.registration ? ["GET /api/info"] : [])
  } finally {
    if (previous === undefined) delete process.env.XDG_STATE_HOME
    if (previous !== undefined) process.env.XDG_STATE_HOME = previous
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})
