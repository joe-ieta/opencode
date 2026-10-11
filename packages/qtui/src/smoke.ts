#!/usr/bin/env bun
/**
 * oc_core smoke test.
 *
 * Usage (from repo root):
 *   bun run oc:smoke                       # smoke artifacts/oc/oc_core[.exe]
 *   bun run oc:smoke --binary <path>       # smoke a specific binary
 *   bun run oc:smoke --port 4096           # fixed port instead of ephemeral
 *
 * Steps: start `oc_core serve` with a random password, wait for the listening
 * line, then verify: `GET /api/info` (auth 200 + version match), unauthenticated
 * 401, and `GET /api/event` yields `server.connected`. Exits non-zero on failure.
 */
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const args = process.argv.slice(2)
const value = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const extension = process.platform === "win32" ? ".exe" : ""
const binary = path.resolve(value("--binary") ?? path.join(ROOT, "artifacts/oc", `oc_core${extension}`))
if (!(await Bun.file(binary).exists())) {
  throw new Error(`oc smoke: binary not found at ${binary}; run oc:build first`)
}
const port = value("--port") ?? "0"
const password = crypto.randomUUID().replaceAll("-", "")
const auth = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`

console.log(`oc smoke: ${path.relative(ROOT, binary)} (port ${port})`)

const proc = Bun.spawn([binary, "serve", "--hostname", "127.0.0.1", "--port", port], {
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, OPENCODE_PASSWORD: password },
})

let stderr = ""
void (async () => {
  const reader = proc.stderr.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    stderr += decoder.decode(value)
  }
})()

try {
  const decoder = new TextDecoder()
  const reader = proc.stdout.getReader()
  let buffer = ""
  let url: string | undefined
  const deadline = Date.now() + 30_000
  while (!url && Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      Bun.sleep(Math.max(1, deadline - Date.now())).then(() => undefined),
    ])
    if (result === undefined || result.done) break
    buffer += decoder.decode(result.value, { stream: true })
    url = /server listening on (http:\/\/\S+)/.exec(buffer)?.[1]
  }
  if (!url) throw new Error(`server did not report a listening URL\n--- stdout ---\n${buffer}\n--- stderr ---\n${stderr}`)
  console.log(`oc smoke: listening at ${url}`)

  const versionOutput = await Bun.$`${binary} --version`.text()
  const expected = /v?(\d+\.\d+\.\d+)/.exec(versionOutput)?.[1]
  if (!expected) throw new Error(`could not parse --version output: ${versionOutput.trim()}`)

  const info = await fetch(`${url}/api/info`, { headers: { authorization: auth } })
  if (info.status !== 200) throw new Error(`GET /api/info with auth: expected 200, got ${info.status}`)
  const infoJson = (await info.json()) as { version?: string }
  if (infoJson.version !== expected) {
    throw new Error(`GET /api/info version ${infoJson.version} does not match --version ${expected}`)
  }
  console.log(`oc smoke: /api/info ok (version ${infoJson.version})`)

  const unauthorized = await fetch(`${url}/api/info`)
  if (unauthorized.status !== 401) throw new Error(`GET /api/info without auth: expected 401, got ${unauthorized.status}`)
  console.log("oc smoke: unauthenticated request rejected (401)")

  const controller = new AbortController()
  const sse = await fetch(`${url}/api/event`, { headers: { authorization: auth }, signal: controller.signal })
  if (sse.status !== 200 || !sse.body) throw new Error(`GET /api/event: expected 200 with a body, got ${sse.status}`)
  const sseReader = sse.body.getReader()
  const sseDecoder = new TextDecoder()
  let sseBuffer = ""
  const sseDeadline = Date.now() + 5_000
  while (!sseBuffer.includes("server.connected") && Date.now() < sseDeadline) {
    const result = await Promise.race([
      sseReader.read(),
      Bun.sleep(Math.max(1, sseDeadline - Date.now())).then(() => undefined),
    ])
    if (result === undefined || result.done) break
    sseBuffer += sseDecoder.decode(result.value, { stream: true })
  }
  controller.abort()
  if (!sseBuffer.includes("server.connected")) {
    throw new Error(`GET /api/event did not yield server.connected:\n${sseBuffer}`)
  }
  console.log("oc smoke: /api/event yielded server.connected")

  if (stderr.trim()) throw new Error(`unexpected stderr output:\n${stderr.trim()}`)
  console.log("oc smoke: PASS")
} finally {
  proc.kill()
}
