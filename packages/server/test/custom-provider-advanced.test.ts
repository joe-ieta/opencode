import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Effect, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { Model } from "@opencode/schema/model"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"

const setup = Effect.fnUntraced(function* (definition: (baseURL: string) => object) {
  const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-advanced-")))
  const calls: Record<string, Schema.Json>[] = []
  const endpoint = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Json))(await request.json())
          calls.push(body)
          const response = {
            id: "chatcmpl-advanced",
            object: "chat.completion",
            created: 1,
            model: body.model,
            choices: [{ index: 0, message: { role: "assistant", content: "Advanced OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }
          if (!body.stream) return Response.json(response)
          return new Response(
            `data: ${JSON.stringify({ ...response, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "Advanced OK" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      }),
    ),
    (server) => Effect.promise(() => server.stop(true)),
  )
  const file = path.join(tmp.path, "opencode.jsonc")
  const original = `// preserve the global note\n${JSON.stringify({ providers: { advanced: definition(new URL("/nested/v1", endpoint.url).href) } }, null, 2)}\n`
  yield* Effect.promise(() => fs.writeFile(file, original))
  const server = yield* startServer(tmp.path)
  const request = (route: string, body?: unknown) =>
    fetch(new URL(route, server.base), {
      method: body === undefined ? "GET" : route === "/api/experimental/config/providers/advanced" ? "PATCH" : "POST",
      headers: {
        ...server.headers,
        "content-type": "application/json",
        "x-opencode-directory": encodeURIComponent(tmp.path),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const list = async () =>
    Schema.decodeUnknownSync(CustomProvider.Listing)(await (await request("/api/experimental/config/providers")).json())
  const update = async (patch: CustomProvider.Patch) => {
    const listing = await list()
    const response = await request("/api/experimental/config/providers/advanced", {
      mode: "edit",
      revision: listing.revision,
      patch,
    })
    const result: unknown = await response.json()
    expect({ status: response.status, result }).toMatchObject({ status: 200 })
    return Schema.decodeUnknownSync(CustomProvider.Saved)(result)
  }
  return { file, original, calls, request, list, update }
})

it.live("advanced leaf edits preserve hidden JSONC values and reach the resolved model and variant request", () =>
  Effect.gen(function* () {
    const view = yield* setup((baseURL) => ({
      package: "@opencode/ai/providers/openai-compatible",
      settings: {
        baseURL,
        timeout: 3000,
        encoding: "none",
        reasoningEffort: "low",
        hidden: "SECRET_provider_settings",
      },
      headers: { Authorization: "Bearer SECRET_header" },
      body: { vendor_flag: "SECRET_provider_body" },
      compatibility: { streamUsage: true, maxTokensField: "max_tokens", private: "SECRET_compatibility" },
      models: {
        "alias/key.v1": {
          modelID: "org/coder",
          settings: { reasoningEffort: "medium", hidden: "SECRET_model_settings" },
          compatibility: { requireFinishReason: true },
          cost: {
            input: 1,
            output: 2,
            cache: { read: 0.1, write: 0.2, private: "SECRET_cache" },
            private: "SECRET_cost",
          },
          variants: [
            {
              id: "edit.me",
              settings: { reasoningEffort: "low", private: "SECRET_variant_settings" },
              headers: { "X-Private": "SECRET_variant_header" },
              body: { variant_flag: "SECRET_variant_body" },
            },
            { id: "remove", settings: { reasoningEffort: "low" } },
            { id: "keep", body: { flag: "SECRET_retained_variant" } },
          ],
        },
      },
    }))
    yield* Effect.promise(async () => {
      const before = await view.list()
      expect(JSON.stringify(before)).not.toContain("SECRET_")
      expect(before.providers[0]?.settings).toMatchObject({ timeout: 3000, encoding: "none", reasoningEffort: "low" })
      expect(before.providers[0]?.models["alias/key.v1"]?.cost).toEqual([
        { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.2 },
      ])
      await view.update({
        settings: { timeout: null, headerTimeout: false, chunkTimeout: 60000 },
        compatibility: { streamUsage: false },
        models: {
          "alias/key.v1": {
            settings: { reasoningEffort: "high", textVerbosity: "low", parallelToolCalls: false, encoding: "none" },
            compatibility: { maxTokensField: "max_completion_tokens", requireFinishReason: false },
            cost: { "0": { input: 0, cacheRead: null }, "1": { input: 4, output: 8, tierSize: 128000 } },
            variants: {
              "edit.me": { settings: { reasoningEffort: "high", parallelToolCalls: false } },
              remove: null,
              "new/one": { settings: { reasoningEffort: "medium" } },
            },
          },
        },
      })
      const text = await fs.readFile(view.file, "utf8")
      expect(text).toContain("// preserve the global note")
      for (const secret of [
        "provider_settings",
        "header",
        "provider_body",
        "compatibility",
        "model_settings",
        "cache",
        "cost",
        "variant_settings",
        "variant_header",
        "variant_body",
        "retained_variant",
      ])
        expect(text).toContain(`SECRET_${secret}`)
      const after = await view.list()
      expect(JSON.stringify(after)).not.toContain("SECRET_")
      expect(after.providers[0]?.settings?.timeout).toBeUndefined()
      expect(after.providers[0]?.models["alias/key.v1"]?.cost).toEqual([
        { input: 0, output: 2, cacheWrite: 0.2 },
        { input: 4, output: 8, tierSize: 128000 },
      ])
      expect(after.providers[0]?.models["alias/key.v1"]?.variants?.map((item) => item.id)).toEqual([
        "edit.me",
        "keep",
        "new/one",
      ])
      const runtime = Schema.decodeUnknownSync(Schema.Struct({ data: Schema.Array(Model.Info) }))(
        await (await view.request("/api/model")).json(),
      )
      expect(runtime.data.find((item) => item.providerID === "advanced" && item.id === "alias/key.v1")).toMatchObject({
        settings: { reasoningEffort: "high", parallelToolCalls: false },
        compatibility: { streamUsage: false, requireFinishReason: false, maxTokensField: "max_completion_tokens" },
        cost: [
          { input: 0, output: 2, cache: { read: 0, write: 0.2 } },
          { input: 4, output: 8, tier: { type: "context", size: 128000 } },
        ],
      })
      const generated = await view.request("/api/experimental/generate/text", {
        prompt: "Reply",
        model: { providerID: "advanced", id: "alias/key.v1", variant: "new/one" },
      })
      expect({ status: generated.status, result: await generated.json() }).toEqual({
        status: 200,
        result: { data: { text: "Advanced OK" } },
      })
      expect(view.calls).toHaveLength(1)
      expect(view.calls[0]).toMatchObject({
        model: "org/coder",
        reasoning_effort: "medium",
        verbosity: "low",
        vendor_flag: "SECRET_provider_body",
      })
      expect(view.calls[0]?.parallel_tool_calls).toBeUndefined()
      const stale = await view.request("/api/experimental/config/providers/advanced", {
        mode: "edit",
        revision: before.revision,
        patch: { settings: { encoding: "gzip" } },
      })
      expect(stale.status).toBe(409)
      expect(await fs.readFile(view.file, "utf8")).toBe(text)
      await view.update({
        settings: { headerTimeout: null },
        models: {
          "alias/key.v1": {
            settings: { reasoningEffort: null },
            cost: { "0": null, "1": null },
            variants: { "edit.me": null, keep: null, "new/one": null },
          },
        },
      })
      const cleared = await view.list()
      expect(cleared.providers[0]?.models["alias/key.v1"]?.cost).toBeUndefined()
      expect(cleared.providers[0]?.models["alias/key.v1"]?.variants).toEqual([])
      expect(cleared.providers[0]?.models["alias/key.v1"]?.settings?.reasoningEffort).toBeUndefined()
    })
  }),
)

it.live("advanced edits reject unsafe or ambiguous values without writing and preserve basic editing", () =>
  Effect.gen(function* () {
    const view = yield* setup((baseURL) => ({
      package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL },
      models: {
        chat: {
          cost: [
            { input: 1, output: 2 },
            { input: 3, output: 4, tier: { type: "context", size: 1000 } },
          ],
        },
        ambiguous: {
          variants: [
            { id: "same", settings: { reasoningEffort: "low" } },
            { id: "same", body: { token: "SECRET_ambiguous" } },
          ],
        },
      },
    }))
    yield* Effect.promise(async () => {
      const listing = await view.list()
      expect(listing.providers[0]?.models.ambiguous?.variantsReadonly).toBe(true)
      expect(JSON.stringify(listing)).not.toContain("SECRET_")
      for (const patch of [
        { settings: { apiKey: "no" } },
        { settings: { baseURL: "http://localhost:99" } },
        { settings: { timeout: 0 } },
        { settings: { timeout: "false" } },
        { compatibility: { reasoningField: "content" } },
        { compatibility: { unknown: true } },
        { headers: { private: "no" } },
        { models: { chat: { body: { private: "no" } } } },
        { models: { chat: { settings: { timeout: 1 } } } },
        { models: { chat: { cost: { "0": { input: -1 } } } } },
        { models: { chat: { cost: { "1": { tierSize: null } } } } },
        { models: { chat: { cost: { "2": { input: 1 } } } } },
        { models: { chat: { cost: { "4": { input: 1, output: 2 } } } } },
        { models: { chat: { cost: { "-1": null } } } },
        { models: { chat: { cost: { "99999999999999999999": null } } } },
        { models: { chat: { variants: { " ": {} } } } },
        { models: { chat: { variants: { default: {} } } } },
        { models: { chat: { variants: { "ambiguous#id": {} } } } },
        { models: { chat: { variants: { high: { settings: { apiKey: "no" } } } } } },
        { models: { ambiguous: { variants: { same: { settings: { reasoningEffort: "high" } } } } } },
      ]) {
        const response = await view.request("/api/experimental/config/providers/advanced", {
          mode: "edit",
          revision: listing.revision,
          patch,
        })
        expect({ patch, status: response.status }).toMatchObject({ status: 400 })
        expect(await fs.readFile(view.file, "utf8")).toBe(view.original)
      }
      await view.update({
        name: "Basic edits remain available",
        models: { chat: { cost: { "0": null, "1": { input: 0 }, "2": { input: 5, output: 6, tierSize: 2000 } } } },
      })
      const next = await view.list()
      expect(next.providers[0]?.name).toBe("Basic edits remain available")
      expect(next.providers[0]?.models.chat?.cost).toEqual([
        { input: 0, output: 4, tierSize: 1000 },
        { input: 5, output: 6, tierSize: 2000 },
      ])
      await view.update({
        models: {
          fresh: {
            settings: { textVerbosity: "low" },
            cost: { "0": { input: 0, output: 0 } },
            variants: { fresh: { settings: { reasoningEffort: "high" } } },
          },
        },
      })
      expect((await view.list()).providers[0]?.models.fresh).toMatchObject({
        settings: { textVerbosity: "low" },
        cost: [{ input: 0, output: 0 }],
        variants: [{ id: "fresh", settings: { reasoningEffort: "high" } }],
      })
    })
  }),
)
