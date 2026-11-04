import { Credential } from "@opencode/core/credential"
import { Database } from "@opencode/core/database/database"
import { HttpEffect, HttpRouter, HttpServer } from "effect/http"
import { createEmbeddedRoutes } from "../src/routes"
import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Context, Effect, Layer, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { Model } from "@opencode/schema/model"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"

it.live("saves custom providers, preserves JSONC, rotates keys and refreshes runtime models", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("custom-provider-")))
    const global = path.join(tmp.path, "global")
    const project = path.join(tmp.path, "project")
    const file = path.join(global, "opencode.jsonc")
    yield* Effect.promise(async () => {
      await fs.mkdir(global)
      await fs.mkdir(project)
      await fs.writeFile(file, '{\n  // keep my shell\n  "shell": "bash"\n}\n')
    })
    const server = yield* startServer(global)
    yield* Effect.promise(async () => {
      const request = (route: string, body?: unknown, method = "PATCH", directory = project) => {
        const url = new URL(route, server.base)
        url.searchParams.set("location[directory]", directory)
        return fetch(url, {
          method: body === undefined ? "GET" : method,
          headers: { ...server.headers, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      }
      const list = async () =>
        Schema.decodeUnknownSync(CustomProvider.Listing)(
          await (await request("/api/experimental/config/providers")).json(),
        )
      const save = async (input: CustomProvider.Update) => {
        const response = await request("/api/experimental/config/providers/private-gateway", input)
        const body: unknown = await response.json()
        expect({ status: response.status, body }).toMatchObject({ status: 200 })
        return Schema.decodeUnknownSync(CustomProvider.Saved)(body)
      }
      const first = await list()
      const created = await save({
        mode: "create",
        revision: first.revision,
        patch: {
          name: "Private gateway",
          baseURL: "http://127.0.0.1:8080/v1",
          models: {
            alias: { modelID: "upstream-name", context: 16000, input: 12000, output: 4000, tools: true, image: true },
          },
        },
        credential: { id: Credential.ID.make("cred_custom_first"), key: "secret-first" },
      })
      expect(created).toMatchObject({ config: "saved", credential: "saved", catalog: "ready" })
      const listing = await list()
      expect(listing.providers).toHaveLength(1)
      expect(listing.providers[0]).toMatchObject({
        id: "private-gateway",
        models: {
          alias: { modelID: "upstream-name", context: 16000, input: 12000, output: 4000, tools: true, image: true },
        },
        credentials: [{ id: "cred_custom_first", active: true }],
      })
      expect(JSON.stringify(listing)).not.toContain("secret-first")
      const original = await fs.readFile(file, "utf8")
      expect(original).toContain("// keep my shell")
      expect(original).not.toContain("secret-first")
      const edited = original
        .replace('"alias": {', '"alias": {"type": "chat",')
        .replace('"tools": true', '"tools": true, "temperature": true')
        .replace('"settings": {', '"body": {"vendor_flag": "untouched"}, "settings": {')
      await fs.writeFile(file, edited)
      expect(
        (
          await request("/api/experimental/config/providers/private-gateway", {
            mode: "edit",
            revision: listing.revision,
            patch: { name: "Stale edit" },
          })
        ).status,
      ).toBe(409)
      const current = await list()
      const updated = await save({
        mode: "edit",
        revision: current.revision,
        patch: { models: { alias: { context: 32000, input: null, image: false } } },
        credential: { id: Credential.ID.make("cred_custom_second"), key: "secret-second" },
      })
      const next = await list()
      expect(next.providers[0]?.credentials).toEqual([
        { id: Credential.ID.make("cred_custom_first"), label: "Private gateway", active: false },
        { id: Credential.ID.make("cred_custom_second"), label: "Private gateway", active: true },
      ])
      const text = await fs.readFile(file, "utf8")
      expect(text).toContain("// keep my shell")
      expect(text).toContain('"vendor_flag": "untouched"')
      expect(text).toContain('"temperature": true')
      expect(text).not.toContain("secret-second")
      expect(next.providers[0]?.models.alias).toMatchObject({ context: 32000, output: 4000, image: false })
      expect(next.providers[0]?.models.alias?.input).toBeUndefined()
      // Retrying the credential phase with the same ID must not add another saved key.
      await save({
        mode: "edit",
        revision: updated.revision,
        patch: {},
        credential: { id: Credential.ID.make("cred_custom_second"), key: "secret-second" },
      })
      expect((await list()).providers[0]?.credentials).toHaveLength(2)
      const runtime = Schema.decodeUnknownSync(Schema.Struct({ data: Schema.Array(Model.Info) }))(
        await (await request("/api/model")).json(),
      )
      expect(
        runtime.data.find((model) => model.providerID === "private-gateway" && model.id === "alias"),
      ).toMatchObject({
        modelID: "upstream-name",
        limit: { context: 32000, output: 4000 },
        capabilities: { tools: true, input: ["text"] },
      })
      const deleted = await request("/api/credential/cred_custom_second", {}, "DELETE")
      expect(deleted.status).toBe(204)
      expect((await list()).providers[0]?.credentials).toEqual([
        { id: Credential.ID.make("cred_custom_first"), label: "Private gateway", active: true },
      ])
      const race = await list()
      const responses = await Promise.all(
        ["First edit", "Second edit"].map((name, index) =>
          request(
            "/api/experimental/config/providers/private-gateway",
            {
              mode: "edit",
              revision: race.revision,
              patch: { name },
            },
            "PATCH",
            index === 0 ? project : global,
          ),
        ),
      )
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
      expect(await fs.readdir(project)).toEqual([])
    })
  }),
)

it.live("rejects unsafe patches and edits to ambiguous or non-global definitions without writing", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("custom-provider-guards-")))
    const global = path.join(tmp.path, "global")
    const project = path.join(tmp.path, "project")
    const file = path.join(global, "opencode.jsonc")
    const provider = {
      package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL: "http://localhost:8080/v1" },
      models: { local: {} },
    }
    yield* Effect.promise(async () => {
      await fs.mkdir(global)
      await fs.mkdir(project)
      await fs.writeFile(
        file,
        JSON.stringify({
          providers: {
            shared: provider,
            protected: { ...provider, headers: { Authorization: "Bearer config-secret" } },
            unusual: { ...provider, models: { local: { name: "", limit: { context: 0 } } } },
          },
        }),
      )
      await fs.writeFile(
        path.join(project, "opencode.json"),
        JSON.stringify({ providers: { shared: provider, project: provider } }),
      )
    })
    const server = yield* startServer(global)
    yield* Effect.promise(async () => {
      const request = (id?: string, body?: unknown) => {
        const url = new URL(`/api/experimental/config/providers${id ? `/${id}` : ""}`, server.base)
        url.searchParams.set("location[directory]", project)
        return fetch(url, {
          method: id ? "PATCH" : "GET",
          headers: { ...server.headers, "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        })
      }
      const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(await (await request()).json())
      expect(listing.providers.find((item) => item.id === "shared")?.reason).toBe("multiple-sources")
      expect(listing.providers.find((item) => item.id === "project")?.reason).toBe("readonly-source")
      expect(listing.providers.find((item) => item.id === "protected")?.keyReadonly).toBe(true)
      expect(JSON.stringify(listing)).not.toContain("config-secret")
      expect(listing.providers.find((item) => item.id === "unusual")?.models.local).toMatchObject({
        name: "",
        context: 0,
      })
      const original = await fs.readFile(file, "utf8")
      for (const id of ["shared", "project", "openai"]) {
        expect(
          (await request(id, { mode: "edit", revision: listing.revision, patch: { name: "Changed" } })).status,
        ).toBe(409)
      }
      expect(
        (
          await request("protected", {
            mode: "edit",
            revision: listing.revision,
            patch: {},
            credential: { id: "cred_no", key: "blocked" },
          })
        ).status,
      ).toBe(409)
      for (const patch of [
        { baseURL: "file:///tmp/key" },
        { baseURL: "https://user:secret@example.com/v1" },
        { baseURL: "https://example.com/v1?api_key=secret" },
        { headers: { Authorization: "unsupported" } },
        { models: { local: { context: -1 } } },
        { models: { local: { settings: { apiKey: "unsupported" } } } },
        { models: { local: null } },
      ]) {
        const response = await request("protected", { mode: "edit", revision: listing.revision, patch })
        expect({ patch, status: response.status }).toMatchObject({ status: 400 })
      }
      expect(await fs.readFile(file, "utf8")).toBe(original)
      await fs.writeFile(file, '{"providers":{},"providers":{}}')
      const invalid = Schema.decodeUnknownSync(CustomProvider.Listing)(await (await request()).json())
      expect(invalid.reason).toBe("invalid-config")
      expect((await request("new-provider", { mode: "create", revision: invalid.revision, patch: {} })).status).toBe(
        409,
      )
      expect(await fs.readFile(file, "utf8")).toBe('{"providers":{},"providers":{}}')
    })
  }),
)

it.live("reports a real credential database failure after saving config and supports an idempotent retry", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("custom-provider-partial-")))
    const calls: { path: string; model: string; authorization: string | null }[] = []
    const endpoint = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(request) {
            const body = Schema.decodeUnknownSync(
              Schema.Struct({ model: Schema.String, stream: Schema.optional(Schema.Boolean) }),
            )(await request.json())
            calls.push({
              path: new URL(request.url).pathname,
              model: body.model,
              authorization: request.headers.get("authorization"),
            })
            if (!body.stream)
              return Response.json({
                id: "chatcmpl-fixture",
                object: "chat.completion",
                created: 1,
                model: body.model,
                choices: [{ index: 0, message: { role: "assistant", content: "Connected" }, finish_reason: "stop" }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              })
            return new Response(
              [
                {
                  id: "chatcmpl-fixture",
                  object: "chat.completion.chunk",
                  created: 1,
                  model: body.model,
                  choices: [{ index: 0, delta: { role: "assistant", content: "Connected" }, finish_reason: null }],
                },
                {
                  id: "chatcmpl-fixture",
                  object: "chat.completion.chunk",
                  created: 1,
                  model: body.model,
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                },
              ]
                .map((part) => `data: ${JSON.stringify(part)}\n\n`)
                .join("") + "data: [DONE]\n\n",
              { headers: { "content-type": "text/event-stream" } },
            )
          },
        }),
      ),
      (server) => Effect.promise(() => server.stop(true)),
    )
    const context = yield* Layer.build(
      createEmbeddedRoutes({
        database: { path: ":memory:" },
        config: { directory: tmp.path, project: false },
        models: { fetch: false },
        fs: { filewatcher: false },
      }).pipe(Layer.provide(HttpServer.layerServices)),
    )
    const db = Context.get(context, Database.Service).db
    const handler = Context.get(context, HttpRouter.HttpRouter)
      .asHttpEffect()
      .pipe(HttpEffect.toWebHandlerWith(context))
    const request = (body?: CustomProvider.Update) =>
      Effect.promise(() => {
        const url = new URL(`/api/experimental/config/providers${body ? "/partial" : ""}`, "http://opencode.local")
        url.searchParams.set("location[directory]", tmp.path)
        return handler(
          new Request(url, {
            method: body ? "PATCH" : "GET",
            headers: { "content-type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          }),
        )
      })
    const response = yield* request()
    const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(yield* Effect.promise(() => response.json()))
    yield* db.run(
      "CREATE TRIGGER deny_custom_key BEFORE INSERT ON credential BEGIN SELECT RAISE(ABORT, 'fixture-store-unavailable'); END",
    )
    const credential = { id: Credential.ID.make("cred_partial"), key: "only-in-credential-store" }
    const failedResponse = yield* request({
      mode: "create",
      revision: listing.revision,
      patch: { baseURL: new URL("/nested/v1", endpoint.url).href, models: { alias: { modelID: "wire-model" } } },
      credential,
    })
    expect(failedResponse.status).toBe(200)
    const failed = Schema.decodeUnknownSync(CustomProvider.Saved)(yield* Effect.promise(() => failedResponse.json()))
    expect(failed).toMatchObject({ config: "saved", credential: "failed" })
    expect(yield* Effect.promise(() => fs.readFile(path.join(tmp.path, "opencode.jsonc"), "utf8"))).not.toContain(
      credential.key,
    )
    const credentials = Context.get(context, Credential.Service)
    expect(yield* credentials.get(credential.id)).toBeUndefined()
    yield* db.run("DROP TRIGGER deny_custom_key")
    const savedResponse = yield* request({ mode: "edit", revision: failed.revision, patch: {}, credential })
    const saved = Schema.decodeUnknownSync(CustomProvider.Saved)(yield* Effect.promise(() => savedResponse.json()))
    expect(saved).toMatchObject({ config: "saved", credential: "saved", catalog: "ready" })
    expect((yield* credentials.get(credential.id))?.value).toEqual({ type: "key", key: credential.key })
    const replay = yield* request({ mode: "edit", revision: saved.revision, patch: {}, credential })
    expect(replay.status).toBe(200)
    expect(yield* credentials.all()).toHaveLength(1)
    const generated = yield* Effect.promise(() =>
      handler(
        new Request("http://opencode.local/api/experimental/generate/text", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: "Check connection", model: { providerID: "partial", id: "alias" } }),
        }),
      ),
    )
    const result: unknown = yield* Effect.promise(() => generated.json())
    expect({ status: generated.status, result }).toEqual({ status: 200, result: { data: { text: "Connected" } } })
    expect(calls).toEqual([
      { path: "/nested/v1/chat/completions", model: "wire-model", authorization: `Bearer ${credential.key}` },
    ])
  }),
)
