import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Effect, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { Provider } from "@opencode/schema/provider"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"

const nativeServer = Effect.fnUntraced(function* (respond: (request: Request) => Response | Promise<Response>) {
  const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-native-")))
  const endpoint = yield* Effect.acquireRelease(
    Effect.sync(() => Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: respond })),
    (server) => Effect.promise(() => server.stop(true)),
  )
  const baseURL = new URL("/proxy/team/v1/", endpoint.url).href
  const original = JSON.stringify({
    providers: {
      native: { package: "@opencode/ai/providers/openai-compatible", settings: { baseURL }, models: { alias: {} } },
    },
  })
  const file = path.join(tmp.path, "opencode.jsonc")
  yield* Effect.promise(() => fs.writeFile(file, original))
  const server = yield* startServer(tmp.path)
  const request = (route: string, body?: unknown) => {
    const url = new URL(route, server.base)
    return fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        ...server.headers,
        "content-type": "application/json",
        "x-opencode-directory": encodeURIComponent(tmp.path),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }
  const discover = async (body: CustomProvider.DiscoveryRequest) => {
    const response = await request("/api/experimental/config/providers/discover", body)
    const result: unknown = await response.json()
    expect({ status: response.status, result }).toMatchObject({ status: 200 })
    return Schema.decodeUnknownSync(CustomProvider.Discovery)(result)
  }
  return { endpoint, baseURL, request, discover, file, original }
})

it.live("Ollama reads only selected details and separates model maxima from allocated contexts", () =>
  Effect.gen(function* () {
    const calls: { path: string; method: string; authorization: string | null; model?: string }[] = []
    const view = yield* nativeServer(async (request) => {
      const pathname = new URL(request.url).pathname
      const body =
        request.method === "POST"
          ? Schema.decodeUnknownSync(Schema.Struct({ model: Schema.String }))(await request.json())
          : undefined
      calls.push({
        path: pathname,
        method: request.method,
        authorization: request.headers.get("authorization"),
        model: body?.model,
      })
      if (pathname.endsWith("/api/tags"))
        return Response.json({
          models: [
            { name: "Coder", model: "org/coder:latest", remote_host: "http://169.254.169.254" },
            { name: "text-only" },
            { name: "broken" },
            { name: "embedding-only" },
            { name: "not-selected" },
            { name: "old-model" },
          ],
        })
      if (pathname.endsWith("/api/ps"))
        return Response.json({
          models: [
            { name: "org/coder:latest", context_length: 4096 },
            { name: "broken", context_length: 0 },
          ],
        })
      if (body?.model === "org/coder:latest")
        return Response.json({
          capabilities: ["completion", "tools", "vision"],
          parameters: "num_ctx 2048",
          model_info: {
            "general.architecture": "llama",
            "llama.context_length": 32768,
            "vision.context_length": 99999,
          },
          template: "secret-template",
        })
      if (body?.model === "text-only")
        return Response.json({
          capabilities: ["completion"],
          model_info: { "general.architecture": "gemma", "gemma.context_length": 131072 },
        })
      if (body?.model === "embedding-only") return Response.json({ capabilities: ["embedding"] })
      if (body?.model === "old-model") return Response.json({ model_info: { "other.context_length": 262144 } })
      return new Response("secret body", { status: 404 })
    })
    yield* Effect.promise(async () => {
      const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(
        await (await view.request("/api/experimental/config/providers")).json(),
      )
      expect(
        (
          await view.request("/api/credential", {
            id: "cred_native",
            integrationID: "native",
            value: { type: "key", key: "saved-native-key" },
          })
        ).status,
      ).toBe(200)
      const initial = await view.discover({
        target: { mode: "saved", providerID: Provider.ID.make("native"), revision: listing.revision },
        api: "ollama",
      })
      expect(initial.status).toBe("success")
      expect(calls).toEqual([
        { path: "/proxy/team/api/tags", method: "GET", authorization: "Bearer saved-native-key", model: undefined },
      ])
      if (initial.status !== "success") throw new Error("Expected inventory")
      expect(initial.models).toHaveLength(6)
      expect(initial.models[0]).toMatchObject({ id: "org/coder:latest", metadataPending: true })
      expect(initial.models[0]?.context).toBeUndefined()
      expect(initial.models[0]?.tools).toBeUndefined()
      const detailed = await view.discover({
        target: { mode: "draft", baseURL: view.baseURL, key: "explicit-native-key" },
        api: "ollama",
        metadata: ["org/coder:latest", "text-only", "broken", "embedding-only", "old-model"],
      })
      if (detailed.status !== "success") throw new Error("Expected metadata")
      expect(detailed.models.map((item) => item.id)).toEqual(["org/coder:latest", "text-only", "broken", "old-model"])
      expect(detailed.models[0]).toMatchObject({
        context: 4096,
        maxContext: 32768,
        tools: true,
        image: true,
        loaded: true,
        metadataPending: false,
        sources: {
          context: "/api/ps.models.context_length",
          maxContext: "/api/show.model_info.llama.context_length",
          tools: "/api/show.capabilities",
        },
      })
      expect(detailed.models[0]?.input).toBeUndefined()
      expect(detailed.models[0]?.output).toBeUndefined()
      expect(detailed.models[1]).toMatchObject({ maxContext: 131072, loaded: false, tools: false, image: false })
      expect(detailed.models[1]?.context).toBeUndefined()
      expect(detailed.models[2]?.tools).toBeUndefined()
      expect(detailed.models[2]?.context).toBeUndefined()
      expect(detailed.models[2]?.warnings).toContain("metadata-unavailable")
      expect(detailed.models[3]?.tools).toBeUndefined()
      expect(detailed.models[3]?.image).toBeUndefined()
      expect(detailed.models[3]?.maxContext).toBeUndefined()
      expect(detailed.warnings).toContain("filtered-models")
      expect(JSON.stringify(detailed)).not.toContain("secret")
      expect(
        calls
          .filter((item) => item.method === "POST")
          .map((item) => item.model)
          .toSorted(),
      ).toEqual(["org/coder:latest", "text-only", "broken", "embedding-only", "old-model"].toSorted())
      expect(calls.slice(1).every((item) => item.authorization === "Bearer explicit-native-key")).toBe(true)
      expect(calls.every((item) => item.path.startsWith("/proxy/team/api/"))).toBe(true)
      const count = calls.length
      expect(
        await view.discover({ target: { mode: "draft", baseURL: view.baseURL }, api: "ollama", metadata: ["missing"] }),
      ).toMatchObject({ status: "error", kind: "model-not-found" })
      expect(calls).toHaveLength(count + 1)
      for (const body of [
        { target: { mode: "draft", baseURL: view.baseURL }, api: "lmstudio", metadata: ["x"] },
        {
          target: { mode: "draft", baseURL: view.baseURL },
          api: "ollama",
          metadata: Array.from({ length: 21 }, (_, index) => `id-${index}`),
        },
        { target: { mode: "draft", baseURL: view.baseURL }, api: "ollama", metadata: [] },
      ])
        expect((await view.request("/api/experimental/config/providers/discover", body)).status).toBe(400)
      expect(await fs.readFile(view.file, "utf8")).toBe(view.original)
    })
  }),
)

it.live("LM Studio preserves loaded instance IDs and leaves unloaded context unknown", () =>
  Effect.gen(function* () {
    const calls: { path: string; method: string }[] = []
    const view = yield* nativeServer((request) => {
      calls.push({ path: new URL(request.url).pathname, method: request.method })
      return Response.json({
        models: [
          {
            type: "llm",
            key: "org/base",
            display_name: "Base model",
            max_context_length: 32768,
            loaded_instances: [
              { id: "alias-small", config: { context_length: 4096 } },
              { id: "alias-large", config: { context_length: 8192 } },
            ],
            capabilities: { vision: true, trained_for_tool_use: false },
          },
          {
            type: "llm",
            key: "org/unloaded",
            max_context_length: 131072,
            loaded_instances: [],
            capabilities: { vision: false, trained_for_tool_use: true },
          },
          { type: "llm", key: "unknown", max_context_length: null, loaded_instances: [] },
          {
            type: "llm",
            key: "invalid",
            max_context_length: 0,
            loaded_instances: [{ id: "invalid-context", config: { context_length: "4096" } }],
          },
          { type: "embedding", key: "embed", loaded_instances: [] },
          { type: "decision", key: "decision", loaded_instances: [] },
        ],
      })
    })
    yield* Effect.promise(async () => {
      const result = await view.discover({ target: { mode: "draft", baseURL: view.baseURL }, api: "lmstudio" })
      if (result.status !== "success") throw new Error("Expected models")
      expect(result.models.map((item) => item.id)).toEqual([
        "alias-small",
        "alias-large",
        "org/unloaded",
        "unknown",
        "invalid-context",
      ])
      expect(result.models[0]).toMatchObject({
        context: 4096,
        maxContext: 32768,
        tools: false,
        image: true,
        loaded: true,
        sources: {
          id: "/api/v1/models.loaded_instances.id",
          context: "/api/v1/models.loaded_instances.config.context_length",
        },
      })
      expect(result.models[1]?.context).toBe(8192)
      expect(result.models[2]).toMatchObject({ maxContext: 131072, loaded: false })
      expect(result.models[2]?.context).toBeUndefined()
      expect(result.models[3]?.tools).toBeUndefined()
      expect(result.models[3]?.image).toBeUndefined()
      expect(result.models[3]?.maxContext).toBeUndefined()
      expect(result.models[4]?.warnings).toContain("invalid-limits")
      expect(result.models[4]?.context).toBeUndefined()
      expect(result.warnings).toContain("filtered-models")
      expect(calls).toEqual([{ path: "/proxy/team/api/v1/models", method: "GET" }])
      expect(await fs.readFile(view.file, "utf8")).toBe(view.original)
    })
  }),
)

// The slow-detail case waits for the real shared five-second discovery deadline.
it.live("native metadata keeps shared response limits, redirect rejection and deadline", () =>
  Effect.gen(function* () {
    const mode = { value: "redirect" }
    const calls: string[] = []
    const view = yield* nativeServer((request) => {
      const pathname = new URL(request.url).pathname
      calls.push(pathname)
      if (pathname.endsWith("/api/tags"))
        return Response.json({
          models: [{ name: "sample" }],
          padding: mode.value === "large" ? "x".repeat(20000) : undefined,
        })
      if (pathname.endsWith("/api/ps"))
        return mode.value === "optional" ? new Response(null, { status: 404 }) : Response.json({ models: [] })
      if (mode.value === "redirect")
        return new Response(null, { status: 302, headers: { location: new URL("/trap", request.url).href } })
      if (mode.value === "large") return Response.json({ padding: "x".repeat(2 * 1024 * 1024 - 10000) })
      if (mode.value === "slow")
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("{"))
            },
          }),
        )
      return Response.json({
        capabilities: ["completion", "tools"],
        model_info: { "general.architecture": "llama", "llama.context_length": 32768 },
        parameters: "num_ctx 65536",
      })
    })
    yield* Effect.promise(async () => {
      const body: CustomProvider.DiscoveryRequest = {
        target: { mode: "draft", baseURL: view.baseURL, key: "bounded-key" },
        api: "ollama",
        metadata: ["sample"],
      }
      expect(await view.discover(body)).toMatchObject({ status: "error", kind: "redirect", httpStatus: 302 })
      expect(calls).not.toContain("/trap")
      mode.value = "large"
      expect(await view.discover(body)).toMatchObject({ status: "error", kind: "too-large" })
      mode.value = "optional"
      const partial = await view.discover(body)
      if (partial.status !== "success") throw new Error("Expected partial metadata")
      expect(partial.warnings).toContain("running-unavailable")
      expect(partial.models[0]).toMatchObject({ maxContext: 32768, tools: true })
      expect(partial.models[0]?.context).toBeUndefined()
      expect(partial.models[0]?.loaded).toBeUndefined()
      mode.value = "slow"
      expect(await view.discover(body)).toMatchObject({ status: "error", kind: "timeout" })
    })
  }),
)
