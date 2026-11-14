export * as ProviderDiscoveryHTTP from "./provider-discovery-http.js"

import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"
import { Effect, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { ConfigCustomProvider } from "./custom-provider.js"
const blocked = new BlockList()
blocked.addSubnet("169.254.0.0", 16, "ipv4")
blocked.addSubnet("fe80::", 10, "ipv6")
blocked.addAddress("fd00:ec2::254", "ipv6")
blocked.addAddress("168.63.129.16", "ipv4")
blocked.addAddress("100.100.100.200", "ipv4")

export class Error extends Schema.TaggedError<Error>()("ProviderDiscoveryFailure", {
  kind: CustomProvider.DiscoveryKind,
  httpStatus: Schema.optional(Schema.Int),
}) {}

export const target = Effect.fn("ProviderDiscoveryHTTP.target")(function* (input: CustomProvider.DiscoveryInput) {
  const saved = input.mode === "saved" ? yield* ConfigCustomProvider.discoveryTarget(input) : undefined
  if (saved?.credential && saved.credential.type !== "key") return yield* new Error({ kind: "unsupported-auth" })
  if (saved?.modelAuth || saved?.settings?.auth !== undefined) return yield* new Error({ kind: "unsupported-auth" })
  const baseURL = ConfigCustomProvider.safeURL(input.mode === "draft" ? input.baseURL : saved?.baseURL)
  if (!baseURL) return yield* new Error({ kind: "invalid-url" })
  const url = new URL(baseURL)
  yield* validate(url)
  const key =
    input.mode === "draft"
      ? input.key
      : saved?.credential?.type === "key"
        ? saved.credential.key
        : saved?.settings?.apiKey
  const headers = yield* Effect.try({
    try: () => {
      const headers = new Headers({ accept: "application/json" })
      if (typeof key === "string" && key) headers.set("authorization", `Bearer ${key}`)
      Object.entries(saved?.headers ?? {}).forEach(([key, value]) => headers.set(key, value))
      return headers
    },
    // Header validation errors can contain the secret value.
    catch: () => new Error({ kind: "unsupported-auth" }),
  })
  return { url, headers }
})

export const validate = Effect.fn("ProviderDiscoveryHTTP.validate")(function* (url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : yield* Effect.tryPromise({
        try: () => lookup(hostname, { all: true }),
        catch: () => new Error({ kind: "network" }),
      })
  if (
    !addresses.length ||
    addresses.some((item) => blocked.check(item.address, isIP(item.address) === 6 ? "ipv6" : "ipv4"))
  )
    return yield* new Error({ kind: "blocked-address" })
})

export const request = Effect.fn("ProviderDiscoveryHTTP.request")(function* (
  url: URL,
  headers: Headers,
  budget: { bytes: number },
  body?: Readonly<Record<string, unknown>>,
) {
  return yield* Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(url, {
        headers,
        signal,
        redirect: "manual",
        method: body ? "POST" : "GET",
        body: body ? JSON.stringify(body) : undefined,
      })
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel()
        throw new Error({ kind: "redirect", httpStatus: response.status })
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error({
          kind:
            response.status === 401 || response.status === 403
              ? "authentication"
              : response.status === 404 || response.status === 405
                ? "unsupported"
                : "http",
          httpStatus: response.status,
        })
      }
      if (budget.bytes + Number(response.headers.get("content-length")) > 2 * 1024 * 1024) {
        await response.body?.cancel()
        throw new Error({ kind: "too-large" })
      }
      if (!response.body) throw new Error({ kind: "invalid-response" })
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          budget.bytes += part.value.byteLength
          if (budget.bytes > 2 * 1024 * 1024) throw new Error({ kind: "too-large" })
          chunks.push(part.value)
        }
        return Buffer.concat(chunks).toString("utf8")
      } finally {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
      }
    },
    catch: (error) => (error instanceof Error ? error : new Error({ kind: "network" })),
  })
})
