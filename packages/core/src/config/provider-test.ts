export * as ConfigProviderTest from "./provider-test.js"

import { Effect, Option, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { ProviderDiscoveryHTTP } from "./provider-discovery-http.js"

const Response = Schema.Struct({
  choices: Schema.Array(Schema.Struct({ message: Schema.Struct({ content: Schema.NullOr(Schema.String) }) })),
})

// A deliberately minimal text probe, not a Session or a test of custom generation options.
export const run = Effect.fn("ConfigProviderTest.run")(function* (input: CustomProvider.TextTestRequest) {
  return yield* Effect.gen(function* () {
    const target = yield* ProviderDiscoveryHTTP.target(input.target)
    target.url.pathname = `${target.url.pathname.replace(/\/+$/, "")}/chat/completions`
    target.headers.set("content-type", "application/json")
    const text = yield* ProviderDiscoveryHTTP.request(
      target.url,
      target.headers,
      { bytes: 0 },
      {
        model: input.modelID,
        messages: [{ role: "user", content: "Reply with OK." }],
        max_tokens: 32,
        stream: false,
      },
    )
    const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Response))(text)
    if (Option.isNone(parsed)) return { status: "error", kind: "invalid-response" } as const
    if (!parsed.value.choices[0]?.message.content?.trim()) return { status: "error", kind: "no-text" } as const
    return { status: "success" } as const
  }).pipe(
    Effect.timeoutOrElse({
      duration: "30 seconds",
      orElse: () => Effect.fail(new ProviderDiscoveryHTTP.Error({ kind: "timeout" })),
    }),
    Effect.catchTag("ProviderDiscoveryFailure", (error) =>
      Effect.succeed({ status: "error" as const, kind: error.kind, httpStatus: error.httpStatus }),
    ),
  )
})
