#!/usr/bin/env bun

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const catalog = process.env.OPENCODE_MODELS_SNAPSHOT
// Resolved before spawning: the binary runs from a temporary directory.
const binary = process.argv[2] && path.resolve(process.argv[2])
// Cross-architecture runs under qemu can exceed the 5 s plugin activation timeout. Starting the
// server separately lets the request retry after activation instead of failing the first attempt.
const viaServer = process.argv.includes("--via-server")
if (!catalog || !binary) throw new Error("Usage: OPENCODE_MODELS_SNAPSHOT=<catalog> catalog-smoke.ts <binary>")

const providers: Record<string, { env?: string[] }> = await Bun.file(catalog).json()
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "opencode-catalog-smoke-")))
// Credentials for every provider make the model list cover the whole catalog.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OPENCODE_MODELS"))),
  ...Object.fromEntries(
    Object.values(providers).flatMap((provider) => (provider.env ?? []).map((key) => [key, "smoke"])),
  ),
  HOME: root,
  USERPROFILE: root,
  OPENCODE_DB: path.join(root, "opencode.db"),
  OPENCODE_DISABLE_MODELS_FETCH: "1",
  XDG_CACHE_HOME: path.join(root, "cache"),
  XDG_CONFIG_HOME: path.join(root, "config"),
  XDG_DATA_HOME: path.join(root, "data"),
  XDG_STATE_HOME: path.join(root, "state"),
}

const bundled = await models({})
const fetched = await models({ OPENCODE_MODELS_PATH: path.resolve(catalog) })
await fs.rm(root, { recursive: true, force: true })
if (bundled.length === 0) throw new Error(`${binary} listed no models`)
if (bundled.join("\n") !== fetched.join("\n")) {
  const missing = fetched.filter((model) => !bundled.includes(model))
  const extra = bundled.filter((model) => !fetched.includes(model))
  throw new Error(
    `${binary} bundles a different models.dev catalog than ${catalog}: missing ${missing.slice(0, 5).join(", ")}; extra ${extra.slice(0, 5).join(", ")}`,
  )
}
console.log(`${binary} bundles ${catalog} (${bundled.length} models)`)

async function models(extra: Record<string, string>) {
  if (viaServer) return modelsViaServer(extra)
  const result = Bun.spawnSync([binary, "models", "--standalone"], { cwd: root, env: { ...env, ...extra } })
  if (result.exitCode !== 0) throw new Error(`${binary} models exited with ${result.exitCode}: ${result.stderr}`)
  return result.stdout.toString().trim().split(/\r?\n/)
}

async function modelsViaServer(extra: Record<string, string>) {
  const home = path.join(root, crypto.randomUUID())
  const serverEnv = {
    ...env,
    ...extra,
    HOME: home,
    USERPROFILE: home,
    OPENCODE_DB: path.join(home, "opencode.db"),
    OPENCODE_PASSWORD: crypto.randomUUID(),
    XDG_CACHE_HOME: path.join(home, "cache"),
    XDG_CONFIG_HOME: path.join(home, "config"),
    XDG_DATA_HOME: path.join(home, "data"),
    XDG_STATE_HOME: path.join(home, "state"),
  }
  const server = Bun.spawn([binary, "serve", "--stdio", "--port", "0"], {
    cwd: root,
    env: serverEnv,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  })
  try {
    if (!server.stdout) throw new Error("Expected the smoke server to expose stdout")
    const url = await readURL(server.stdout)
    void server.stdout.pipeTo(new WritableStream()).catch(() => {})
    const deadline = Date.now() + 120_000
    let failure = ""
    while (Date.now() < deadline) {
      const result = Bun.spawnSync([binary, "models", "--server", url], { cwd: root, env: serverEnv })
      if (result.exitCode === 0) return result.stdout.toString().trim().split(/\r?\n/)
      failure = result.stderr.toString()
      await Bun.sleep(1_000)
    }
    throw new Error(`${binary} models via ${url} did not finish: ${failure}`)
  } finally {
    server.kill()
    await server.exited
    await fs.rm(home, { recursive: true, force: true })
  }
}

async function readURL(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const deadline = Date.now() + 120_000
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) throw new Error("Smoke server exited before reporting readiness")
      buffer += decoder.decode(value, { stream: true })
      for (const line of buffer.split("\n")) {
        if (!line.startsWith("{")) continue
        const message: unknown = JSON.parse(line)
        if (typeof message !== "object" || message === null || !("url" in message)) continue
        if (typeof message.url === "string") return message.url
      }
      const newline = buffer.lastIndexOf("\n")
      if (newline !== -1) buffer = buffer.slice(newline + 1)
    }
    throw new Error("Smoke server did not report readiness")
  } finally {
    reader.releaseLock()
  }
}
