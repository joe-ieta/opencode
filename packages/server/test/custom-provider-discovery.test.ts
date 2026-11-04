import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Effect, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { Provider } from "@opencode/schema/provider"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { withEnv } from "../../core/test/fixture/env"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"

it.live("discovers model declarations without saving and confines saved credentials to their provider", () =>
  withEnv({ CUSTOM_DISCOVERY_KEY: "environment-key" }, () =>
    Effect.gen(function* () {
      const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-discovery-")))
      const calls: { path: string; authorization: string | null }[] = []
      const endpoint = yield* Effect.acquireRelease(
        Effect.sync(() =>
          Bun.serve({
            hostname: "127.0.0.1",
            port: 0,
            fetch(request) {
              calls.push({ path: new URL(request.url).pathname, authorization: request.headers.get("authorization") })
              return Response.json({
                data: [
                  {
                    id: "org/model.v1",
                    name: "Declared model",
                    max_model_len: 8192,
                    max_input_tokens: 4096,
                    max_output_tokens: 1024,
                    supported_parameters: ["tools"],
                    secret: "never-return",
                  },
                  { id: "org/model.v1" },
                  { id: "embedding", type: "embedding" },
                  { id: "unknown", max_input_tokens: 1024, max_tokens: 9999, context_length: 30000 },
                  { id: "bad-limits", max_model_len: 100, max_output_tokens: 200, max_input_tokens: -1 },
                ],
              })
            },
          }),
        ),
        (server) => Effect.promise(() => server.stop(true)),
      )
      const baseURL = new URL("/nested/v1/", endpoint.url).href
      const provider = {
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL },
        models: { alias: { modelID: "org/model.v1" } },
      }
      const file = path.join(tmp.path, "opencode.jsonc")
      const original = JSON.stringify({
        providers: {
          saved: provider,
          environment: { ...provider, env: ["CUSTOM_DISCOVERY_KEY"] },
          modelauth: { ...provider, models: { alias: { settings: { apiKey: "model-only-key" } } } },
          headered: {
            ...provider,
            settings: { baseURL, apiKey: "config-key" },
            headers: { Authorization: "Bearer explicit-header" },
          },
        },
      })
      yield* Effect.promise(() => fs.writeFile(file, original))
      const server = yield* startServer(tmp.path)
      yield* Effect.promise(async () => {
        const request = (route: string, body?: unknown) =>
          fetch(new URL(route, server.base), {
            method: body ? "POST" : "GET",
            headers: {
              ...server.headers,
              "content-type": "application/json",
              "x-opencode-directory": encodeURIComponent(tmp.path),
            },
            body: body ? JSON.stringify(body) : undefined,
          })
        const list = Schema.decodeUnknownSync(CustomProvider.Listing)(
          await (await request("/api/experimental/config/providers")).json(),
        )
        const credential = await request("/api/credential", {
          id: "cred_discover",
          integrationID: "saved",
          value: { type: "key", key: "stored-key" },
        })
        expect(credential.status).toBe(200)
        const discover = async (target: CustomProvider.DiscoveryInput) => {
          const response = await request("/api/experimental/config/providers/discover", { target })
          const body: unknown = await response.json()
          expect({ status: response.status, body }).toMatchObject({ status: 200 })
          return Schema.decodeUnknownSync(CustomProvider.Discovery)(body)
        }
        const result = await discover({ mode: "draft", baseURL, key: "draft-key" })
        expect(result).toMatchObject({
          status: "success",
          warnings: ["duplicate-ids", "filtered-models"],
          models: [
            {
              id: "org/model.v1",
              context: 8192,
              input: 4096,
              output: 1024,
              sources: { context: "/models.max_model_len" },
              warnings: ["unverified", "tools-declared"],
            },
            { id: "unknown", input: 1024 },
            {
              id: "bad-limits",
              context: 100,
              output: 200,
              warnings: ["unverified", "invalid-limits", "conflicting-limits"],
            },
          ],
        })
        if (result.status !== "success") throw new Error("Expected inventory")
        expect(result.models[1]?.context).toBeUndefined()
        expect(result.models[1]?.output).toBeUndefined()
        expect(JSON.stringify(result)).not.toContain("never-return")
        await discover({ mode: "saved", providerID: Provider.ID.make("saved"), revision: list.revision })
        await discover({ mode: "draft", baseURL: new URL("/other/v1", endpoint.url).href })
        await discover({ mode: "saved", providerID: Provider.ID.make("environment"), revision: list.revision })
        await discover({ mode: "saved", providerID: Provider.ID.make("headered"), revision: list.revision })
        expect(calls).toEqual([
          { path: "/nested/v1/models", authorization: "Bearer draft-key" },
          { path: "/nested/v1/models", authorization: "Bearer stored-key" },
          { path: "/other/v1/models", authorization: null },
          { path: "/nested/v1/models", authorization: "Bearer environment-key" },
          { path: "/nested/v1/models", authorization: "Bearer explicit-header" },
        ])
        expect(
          await discover({ mode: "saved", providerID: Provider.ID.make("modelauth"), revision: list.revision }),
        ).toMatchObject({ status: "error", kind: "unsupported-auth" })
        expect(await discover({ mode: "draft", baseURL, key: "invalid-header-secret\nsecond-line" })).toMatchObject({
          status: "error",
          kind: "unsupported-auth",
        })
        const count = calls.length
        const conflict = await request("/api/experimental/config/providers/discover", {
          target: { mode: "saved", providerID: "saved", revision: "stale" },
        })
        expect(conflict.status).toBe(409)
        for (const target of [
          { mode: "saved", providerID: "saved", revision: list.revision, baseURL: new URL("/trap", endpoint.url).href },
          { mode: "draft", baseURL, providerID: "saved" },
        ])
          expect((await request("/api/experimental/config/providers/discover", { target })).status).toBe(400)
        expect(calls).toHaveLength(count)
        expect(await fs.readFile(file, "utf8")).toBe(original)
        const credentials = Schema.decodeUnknownSync(
          Schema.Struct({ data: Schema.Array(Schema.Struct({ id: Schema.String })) }),
        )(await (await request("/api/credential")).json())
        expect(credentials.data).toEqual([{ id: "cred_discover" }])
      })
    }),
  ),
)

// Includes one real five-second timeout while the response body remains open.
it.live("bounds discovery responses and rejects redirects, invalid targets and unsupported inventories", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-discovery-errors-")))
    const calls: string[] = []
    const endpoint = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch(request) {
            const route = new URL(request.url).pathname.split("/")[1]
            calls.push(route)
            if (route === "redirect")
              return new Response(null, { status: 302, headers: { location: new URL("/trap", request.url).href } })
            if (route === "large") return new Response(new Uint8Array(2 * 1024 * 1024 + 1))
            if (route === "stream-large")
              return new Response(
                new ReadableStream({
                  start(controller) {
                    controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
                    controller.close()
                  },
                }),
              )
            if (route === "slow")
              return new Response(
                new ReadableStream({
                  start(controller) {
                    controller.enqueue(new TextEncoder().encode("{"))
                  },
                }),
              )
            if (route === "bad-json") return new Response("secret malformed body")
            if (route === "wrong-shape") return Response.json({ models: [{ id: "not-openai-format" }] })
            if (route === "empty") return Response.json({ data: [] })
            if (route === "many")
              return Response.json({ data: Array.from({ length: 1002 }, (_, index) => ({ id: `model-${index}` })) })
            return new Response("secret error response", { status: Number(route) })
          },
        }),
      ),
      (server) => Effect.promise(() => server.stop(true)),
    )
    const server = yield* startServer(tmp.path)
    yield* Effect.promise(async () => {
      const discover = async (baseURL: string) => {
        const response = await fetch(new URL("/api/experimental/config/providers/discover", server.base), {
          method: "POST",
          headers: {
            ...server.headers,
            "content-type": "application/json",
            "x-opencode-directory": encodeURIComponent(tmp.path),
          },
          body: JSON.stringify({ target: { mode: "draft", baseURL } }),
        })
        const body: unknown = await response.json()
        expect(response.status).toBe(200)
        return Schema.decodeUnknownSync(CustomProvider.Discovery)(body)
      }
      for (const [route, kind] of [
        ["401", "authentication"],
        ["403", "authentication"],
        ["404", "unsupported"],
        ["500", "http"],
        ["redirect", "redirect"],
        ["large", "too-large"],
        ["stream-large", "too-large"],
        ["bad-json", "invalid-response"],
        ["wrong-shape", "invalid-response"],
        ["empty", "empty"],
        ["slow", "timeout"],
      ]) {
        const result = await discover(new URL(`/${route}/v1`, endpoint.url).href)
        expect(result).toMatchObject({ status: "error", kind })
        expect(JSON.stringify(result)).not.toContain("secret")
      }
      expect(calls).not.toContain("trap")
      for (const baseURL of [
        "http://169.254.169.254/v1",
        "http://0xa9fea9fe/v1",
        "http://[fe80::1]/v1",
        "http://[fd00:ec2::254]/v1",
        "http://[::ffff:169.254.169.254]/v1",
        "http://168.63.129.16/v1",
        "http://100.100.100.200/v1",
      ])
        expect(await discover(baseURL)).toMatchObject({ status: "error", kind: "blocked-address" })
      for (const baseURL of ["file:///tmp/key", "http://user:pass@localhost/v1", "http://localhost/v1?key=secret"])
        expect(await discover(baseURL)).toMatchObject({ status: "error", kind: "invalid-url" })
      const many = await discover(new URL("/many/v1", endpoint.url).href)
      expect(many.status).toBe("success")
      if (many.status === "success") {
        expect(many.models).toHaveLength(1000)
        expect(many.warnings).toContain("truncated")
      }
    })
  }),
)
