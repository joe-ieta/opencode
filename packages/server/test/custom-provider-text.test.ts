import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Context, Effect, Fiber, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { HttpEffect, HttpRouter, HttpServer } from "effect/http"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { Provider } from "@opencode/schema/provider"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { startServer } from "./fixture/server"
import { createRoutes } from "../src/routes"

it.live(
  "text tests send one minimal saved request without saving, creating a Session or exposing provider output",
  () =>
    Effect.gen(function* () {
      const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-text-")))
      const calls: { path: string; authorization: string | null; body: unknown }[] = []
      const endpoint = yield* Effect.acquireRelease(
        Effect.sync(() =>
          Bun.serve({
            hostname: "127.0.0.1",
            port: 0,
            async fetch(request) {
              calls.push({
                path: new URL(request.url).pathname,
                authorization: request.headers.get("authorization"),
                body: await request.json(),
              })
              return Response.json({
                choices: [{ message: { content: "OK private response", reasoning_content: "private reasoning" } }],
                secret: "private metadata",
              })
            },
          }),
        ),
        (server) => Effect.promise(() => server.stop(true)),
      )
      const original = JSON.stringify({
        providers: {
          saved: {
            package: "@opencode/ai/providers/openai-compatible",
            settings: { baseURL: new URL("/proxy/team/v1/", endpoint.url).href },
            models: { alias: { modelID: "org/model:latest" } },
          },
        },
      })
      const file = path.join(tmp.path, "opencode.jsonc")
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
        const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(
          await (await request("/api/experimental/config/providers")).json(),
        )
        expect(calls).toEqual([])
        expect(
          (
            await request("/api/credential", {
              id: "cred_text",
              integrationID: "saved",
              value: { type: "key", key: "saved-test-key" },
            })
          ).status,
        ).toBe(200)
        const before = await (await request("/api/session")).json()
        const input: CustomProvider.TextTestRequest = {
          target: { mode: "saved", providerID: Provider.ID.make("saved"), revision: listing.revision },
          modelID: "org/model:latest",
        }
        const response = await request("/api/experimental/config/providers/test", input)
        expect(response.status).toBe(200)
        const result: unknown = await response.json()
        expect(Schema.decodeUnknownSync(CustomProvider.TextTest)(result)).toEqual({ status: "success" })
        expect(calls).toEqual([
          {
            path: "/proxy/team/v1/chat/completions",
            authorization: "Bearer saved-test-key",
            body: {
              model: "org/model:latest",
              messages: [{ role: "user", content: "Reply with OK." }],
              max_tokens: 32,
              stream: false,
            },
          },
        ])
        expect(await fs.readFile(file, "utf8")).toBe(original)
        expect(await (await request("/api/session")).json()).toEqual(before)
        const credentials = Schema.decodeUnknownSync(
          Schema.Struct({ data: Schema.Array(Schema.Struct({ id: Schema.String })) }),
        )(await (await request("/api/credential")).json())
        expect(credentials.data.map((item) => item.id)).toEqual(["cred_text"])
        for (const invalid of [
          { ...input, target: { ...input.target, revision: "stale" } },
          { ...input, target: { ...input.target, baseURL: endpoint.url.href } },
          { ...input, target: { mode: "draft", baseURL: endpoint.url.href, key: "never-sent" } },
          { ...input, modelID: "x".repeat(1025) },
          { ...input, messages: [{ role: "user", content: "untrusted prompt" }] },
        ]) {
          const denied = await request("/api/experimental/config/providers/test", invalid)
          expect(denied.status).toBe("revision" in invalid.target && invalid.target.revision === "stale" ? 409 : 400)
        }
        expect(calls).toHaveLength(1)
      })
    }),
)

it.live("text tests bound responses and return redacted errors without redirects or automatic retries", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-text-errors-")))
    const calls: string[] = []
    const endpoint = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(request) {
            if (new URL(request.url).pathname === "/trap") {
              calls.push("trap")
              return Response.json({ choices: [{ message: { content: "must not follow" } }] })
            }
            const body = Schema.decodeUnknownSync(Schema.Struct({ model: Schema.String }))(await request.json())
            calls.push(body.model)
            if (body.model === "redirect")
              return new Response("provider-secret", { status: 307, headers: { location: "/trap" } })
            if (body.model === "auth") return new Response("provider-secret", { status: 401 })
            if (body.model === "missing") return new Response("provider-secret", { status: 404 })
            if (body.model === "busy") return new Response("provider-secret", { status: 429 })
            if (body.model === "large") return new Response("x".repeat(2 * 1024 * 1024 + 1))
            if (body.model === "invalid") return Response.json({ data: "provider-secret" })
            if (body.model === "empty") return Response.json({ choices: [] })
            return Response.json({
              choices: [
                {
                  message: { content: body.model === "reasoning" ? null : "  ", reasoning_content: "provider-secret" },
                },
              ],
            })
          },
        }),
      ),
      (server) => Effect.promise(() => server.stop(true)),
    )
    yield* Effect.promise(() =>
      fs.writeFile(
        path.join(tmp.path, "opencode.jsonc"),
        JSON.stringify({
          providers: {
            blocked: {
              package: "@opencode/ai/providers/openai-compatible",
              settings: { baseURL: new URL("/v1", endpoint.url).href },
              models: { chat: {} },
            },
            errors: {
              package: "@opencode/ai/providers/openai-compatible",
              settings: { baseURL: new URL("/v1", endpoint.url).href },
              models: { chat: {} },
            },
          },
          policies: [{ action: "provider.use", resource: "blocked", effect: "deny" }],
        }),
      ),
    )
    const server = yield* startServer(tmp.path)
    yield* Effect.promise(async () => {
      const headers = {
        ...server.headers,
        "content-type": "application/json",
        "x-opencode-directory": encodeURIComponent(tmp.path),
      }
      const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(
        await (await fetch(new URL("/api/experimental/config/providers", server.base), { headers })).json(),
      )
      const blocked = await fetch(new URL("/api/experimental/config/providers/test", server.base), {
        method: "POST",
        headers,
        body: JSON.stringify({
          target: { mode: "saved", providerID: "blocked", revision: listing.revision },
          modelID: "chat",
        }),
      })
      expect(blocked.status).toBe(409)
      expect(calls).toEqual([])
      const cases = [
        ["redirect", "redirect", 307],
        ["auth", "authentication", 401],
        ["missing", "unsupported", 404],
        ["busy", "http", 429],
        ["large", "too-large", undefined],
        ["invalid", "invalid-response", undefined],
        ["empty", "no-text", undefined],
        ["blank", "no-text", undefined],
        ["reasoning", "no-text", undefined],
      ] as const
      for (const [modelID, kind, httpStatus] of cases) {
        const response = await fetch(new URL("/api/experimental/config/providers/test", server.base), {
          method: "POST",
          headers,
          body: JSON.stringify({
            target: { mode: "saved", providerID: "errors", revision: listing.revision },
            modelID,
          }),
        })
        expect(response.status).toBe(200)
        const text = await response.text()
        expect(text).not.toContain("provider-secret")
        const result = Schema.decodeUnknownSync(Schema.fromJsonString(CustomProvider.TextTest))(text)
        expect(result).toMatchObject({ status: "error", kind })
        if (result.status !== "error") throw new Error("Expected text test error")
        expect(result.httpStatus).toBe(httpStatus)
      }
      expect(calls).toEqual(cases.map(([modelID]) => modelID))
    })
  }),
)

it.effect("text tests interrupt an unresponsive body at the overall deadline", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("provider-text-timeout-")))
    const arrived = Promise.withResolvers<void>()
    const endpoint = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch() {
            arrived.resolve()
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode('{"choices":['))
                },
              }),
            )
          },
        }),
      ),
      (server) => Effect.promise(() => server.stop(true)),
    )
    yield* Effect.promise(() =>
      fs.writeFile(
        path.join(tmp.path, "opencode.jsonc"),
        JSON.stringify({
          providers: {
            timeout: {
              package: "@opencode/ai/providers/openai-compatible",
              settings: { baseURL: new URL("/v1", endpoint.url).href },
              models: { chat: {} },
            },
          },
        }),
      ),
    )
    const context = Context.merge(
      yield* Effect.context(),
      yield* Layer.build(
        createRoutes({
          password: "secret",
          database: { path: ":memory:" },
          models: { fetch: false },
          fs: { filewatcher: false },
          config: { directory: tmp.path },
        }).pipe(Layer.provide(HttpServer.layerServices)),
      ),
    )
    const handler = Context.get(context, HttpRouter.HttpRouter)
      .asHttpEffect()
      .pipe(HttpEffect.toWebHandlerWith(context))
    const headers = { authorization: `Basic ${btoa("opencode:secret")}`, "content-type": "application/json" }
    const url = new URL("/api/experimental/config/providers", "http://opencode.local")
    url.searchParams.set("location[directory]", tmp.path)
    const listing = Schema.decodeUnknownSync(CustomProvider.Listing)(
      yield* Effect.promise(async () => (await handler(new Request(url, { headers }))).json()),
    )
    url.pathname += "/test"
    const pending = yield* Effect.promise((signal) =>
      handler(
        new Request(url, {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({
            target: { mode: "saved", providerID: "timeout", revision: listing.revision },
            modelID: "chat",
          }),
        }),
      ),
    ).pipe(Effect.forkChild({ startImmediately: true }))
    yield* Effect.promise(() => arrived.promise)
    yield* TestClock.adjust("31 seconds")
    const response = yield* Fiber.join(pending)
    expect(response.status).toBe(200)
    expect(yield* Effect.promise(() => response.json())).toEqual({ status: "error", kind: "timeout" })
  }),
)
