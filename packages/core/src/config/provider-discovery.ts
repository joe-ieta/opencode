export * as ConfigProviderDiscovery from "./provider-discovery.js"

import { Effect, Option, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { PositiveInt } from "@opencode/schema/schema"
import { ProviderDiscoveryHTTP } from "./provider-discovery-http.js"
import { ProviderDiscoveryNative } from "./provider-discovery-native.js"
const Inventory = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String.check(Schema.isMinLength(1)),
      name: Schema.optional(Schema.String),
      type: Schema.optional(Schema.String),
      max_model_len: Schema.optional(Schema.Unknown),
      max_input_tokens: Schema.optional(Schema.Unknown),
      max_output_tokens: Schema.optional(Schema.Unknown),
      supported_parameters: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
})

export const discover = Effect.fn("ConfigProviderDiscovery.discover")(function* (
  input: CustomProvider.DiscoveryInput,
  options: Pick<CustomProvider.DiscoveryRequest, "api" | "metadata"> = {},
) {
  return yield* Effect.gen(function* () {
    const target = yield* ProviderDiscoveryHTTP.target(input)
    const root = target.url
    const api = options.api ?? "openai"
    if (api !== "openai") root.pathname = root.pathname.replace(/\/+$/, "").replace(/\/v1$/, "")
    const budget = { bytes: 0 }
    const request = (suffix: string, model?: string) => {
      const url = new URL(root)
      url.pathname = `${root.pathname.replace(/\/+$/, "")}${suffix}`
      const requestHeaders = new Headers(target.headers)
      if (model !== undefined) requestHeaders.set("content-type", "application/json")
      return ProviderDiscoveryHTTP.request(url, requestHeaders, budget, model === undefined ? undefined : { model })
    }
    if (api === "ollama") return yield* ProviderDiscoveryNative.ollama(request, options.metadata)
    if (api === "lmstudio") return ProviderDiscoveryNative.lmstudio(yield* request("/api/v1/models"))
    const text = yield* request("/models")
    const inventory = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Inventory))(text).pipe(
      Effect.mapError(() => new ProviderDiscoveryHTTP.Error({ kind: "invalid-response" })),
    )
    const warnings: string[] = []
    const models = new Map<string, CustomProvider.Candidate>()
    inventory.data.slice(0, 1000).forEach((item) => {
      if (["embedding", "embeddings", "image", "audio", "rerank", "decision"].includes(item.type ?? "")) {
        warnings.push("filtered-models")
        return
      }
      if (models.has(item.id)) {
        warnings.push("duplicate-ids")
        return
      }
      const fields = [
        ["context", "max_model_len"],
        ["input", "max_input_tokens"],
        ["output", "max_output_tokens"],
      ] as const
      const limits = fields.flatMap<[string, number]>(([field, source]) => {
        if (item[source] === undefined) return []
        const value = Schema.decodeUnknownOption(PositiveInt)(item[source])
        if (Option.isNone(value)) return []
        return [[field, value.value]]
      })
      const limit = Object.fromEntries(limits)
      const issues = ["unverified"]
      if (
        fields.some(([, field]) => item[field] !== undefined) &&
        limits.length !== fields.filter(([, field]) => item[field] !== undefined).length
      )
        issues.push("invalid-limits")
      if (limit.context && ((limit.input ?? 0) > limit.context || (limit.output ?? 0) > limit.context))
        issues.push("conflicting-limits")
      if (item.supported_parameters?.includes("tools")) issues.push("tools-declared")
      models.set(item.id, {
        id: item.id,
        name: item.name || undefined,
        ...limit,
        sources: Object.fromEntries([
          ["id", "/models.id"],
          ...(item.name ? [["name", "/models.name"]] : []),
          ...fields
            .filter(([field]) => limit[field] !== undefined)
            .map(([field, source]) => [field, `/models.${source}`]),
        ]),
        warnings: issues,
      })
    })
    if (inventory.data.length > 1000) warnings.push("truncated")
    if (!models.size) return yield* new ProviderDiscoveryHTTP.Error({ kind: "empty" })
    return { status: "success" as const, models: [...models.values()], warnings: [...new Set(warnings)] }
  }).pipe(
    Effect.timeoutOrElse({
      duration: "5 seconds",
      orElse: () => Effect.fail(new ProviderDiscoveryHTTP.Error({ kind: "timeout" })),
    }),
    Effect.catchTag("ProviderDiscoveryFailure", (error) =>
      Effect.succeed({ status: "error" as const, kind: error.kind, httpStatus: error.httpStatus }),
    ),
  )
})
