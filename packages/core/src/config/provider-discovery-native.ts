export * as ProviderDiscoveryNative from "./provider-discovery-native.js"

import { Effect, Option, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { PositiveInt } from "@opencode/schema/schema"
import { ProviderDiscoveryHTTP } from "./provider-discovery-http.js"

const Text = Schema.String.check(Schema.isMinLength(1))
const Tags = Schema.Struct({ models: Schema.Array(Schema.Struct({ name: Text, model: Schema.optional(Text) })) })
const Show = Schema.Struct({
  capabilities: Schema.optional(Schema.Array(Schema.String)),
  model_info: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
const Running = Schema.Struct({
  models: Schema.Array(
    Schema.Struct({ name: Text, model: Schema.optional(Text), context_length: Schema.optional(Schema.Unknown) }),
  ),
})
const LMStudio = Schema.Struct({
  models: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      key: Text,
      display_name: Schema.optional(Schema.String),
      loaded_instances: Schema.Array(
        Schema.Struct({ id: Text, config: Schema.Struct({ context_length: Schema.optional(Schema.Unknown) }) }),
      ),
      max_context_length: Schema.optional(Schema.Unknown),
      capabilities: Schema.optional(
        Schema.NullOr(
          Schema.Struct({
            vision: Schema.optional(Schema.Boolean),
            trained_for_tool_use: Schema.optional(Schema.Boolean),
          }),
        ),
      ),
    }),
  ),
})

export const ollama = Effect.fn("ProviderDiscoveryNative.ollama")(function* (
  request: (suffix: string, model?: string) => Effect.Effect<string, ProviderDiscoveryHTTP.Error>,
  metadata?: readonly string[],
) {
  const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Tags))(yield* request("/api/tags"))
  if (Option.isNone(parsed)) return yield* new ProviderDiscoveryHTTP.Error({ kind: "invalid-response" })
  const warnings: string[] = parsed.value.models.length > 1000 ? ["truncated"] : []
  const inventory = new Map<string, CustomProvider.Candidate>()
  parsed.value.models.slice(0, 1000).forEach((item) => {
    const id = item.model ?? item.name
    if (inventory.has(id)) {
      warnings.push("duplicate-ids")
      return
    }
    inventory.set(id, {
      id,
      name: item.name,
      metadataPending: true,
      sources: { id: item.model ? "/api/tags.models.model" : "/api/tags.models.name", name: "/api/tags.models.name" },
      warnings: ["unverified"],
    })
  })
  if (metadata === undefined) return finish([...inventory.values()], warnings)
  const selected = new Set(metadata)
  if ([...selected].some((id) => !inventory.has(id)))
    return yield* new ProviderDiscoveryHTTP.Error({ kind: "model-not-found" })
  const running = yield* optional(
    request("/api/ps").pipe(
      Effect.flatMap((text) =>
        Schema.decodeUnknownEffect(Schema.fromJsonString(Running))(text).pipe(
          Effect.mapError(() => new ProviderDiscoveryHTTP.Error({ kind: "invalid-response" })),
        ),
      ),
    ),
  )
  if (!running) warnings.push("running-unavailable")
  const models = yield* Effect.forEach(
    [...inventory.values()].filter((item) => selected.has(item.id)),
    (item) =>
      Effect.gen(function* () {
        const show = yield* optional(
          request("/api/show", item.id).pipe(
            Effect.flatMap((text) =>
              Schema.decodeUnknownEffect(Schema.fromJsonString(Show))(text).pipe(
                Effect.mapError(() => new ProviderDiscoveryHTTP.Error({ kind: "invalid-response" })),
              ),
            ),
          ),
        )
        if (
          show?.capabilities &&
          !show.capabilities.includes("completion") &&
          ["embedding", "embeddings", "decision", "speech"].some((type) => show.capabilities?.includes(type))
        ) {
          warnings.push("filtered-models")
          return undefined
        }
        const active = running?.models.filter((model) => (model.model ?? model.name) === item.id)
        const context = active?.length === 1 ? positive(active[0].context_length) : undefined
        const architecture = show?.model_info?.["general.architecture"]
        const maximum =
          typeof architecture === "string" ? show?.model_info?.[`${architecture}.context_length`] : undefined
        const maxContext = positive(maximum)
        const issues = ["unverified"]
        if (!show) issues.push("metadata-unavailable")
        if (show?.capabilities !== undefined) issues.push("capabilities-declared")
        if (active?.length === 0) issues.push("unloaded")
        if ((active?.length ?? 0) > 1) issues.push("context-ambiguous")
        if (
          (maximum != null && maxContext === undefined) ||
          (active?.length === 1 && active[0].context_length !== undefined && context === undefined)
        )
          issues.push("invalid-limits")
        if (context && maxContext && context > maxContext) issues.push("conflicting-limits")
        const sources = { ...item.sources }
        if (running) sources.loaded = "/api/ps.models"
        if (context !== undefined) sources.context = "/api/ps.models.context_length"
        if (maxContext !== undefined) sources.maxContext = `/api/show.model_info.${architecture}.context_length`
        if (show?.capabilities !== undefined) {
          sources.tools = "/api/show.capabilities"
          sources.image = "/api/show.capabilities"
        }
        return {
          ...item,
          metadataPending: false,
          context,
          maxContext,
          loaded: active === undefined ? undefined : active.length > 0,
          tools: show?.capabilities?.includes("tools"),
          image: show?.capabilities?.includes("vision"),
          sources,
          warnings: issues,
        }
      }),
    { concurrency: 4 },
  )
  return finish(
    models.filter((item) => item !== undefined),
    warnings,
    true,
  )
})

export function lmstudio(text: string): CustomProvider.Discovery {
  const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(LMStudio))(text)
  if (Option.isNone(parsed)) return { status: "error", kind: "invalid-response" }
  const warnings: string[] = parsed.value.models.length > 1000 ? ["truncated"] : []
  const models: CustomProvider.Candidate[] = []
  parsed.value.models.slice(0, 1000).forEach((item) => {
    if (item.type !== "llm") {
      warnings.push("filtered-models")
      return
    }
    const maxContext = positive(item.max_context_length)
    const instances = item.loaded_instances.length ? item.loaded_instances : [undefined]
    if (instances.length > 1000) warnings.push("truncated")
    instances.slice(0, 1000).forEach((instance) => {
      if (models.length >= 1000) {
        warnings.push("truncated")
        return
      }
      const context = positive(instance?.config.context_length)
      const issues = ["unverified"]
      if (!instance) issues.push("unloaded")
      if (item.capabilities?.vision !== undefined || item.capabilities?.trained_for_tool_use !== undefined)
        issues.push("capabilities-declared")
      if (
        (item.max_context_length != null && maxContext === undefined) ||
        (instance?.config.context_length !== undefined && context === undefined)
      )
        issues.push("invalid-limits")
      if (context && maxContext && context > maxContext) issues.push("conflicting-limits")
      const sources: Record<string, string> = {
        id: instance ? "/api/v1/models.loaded_instances.id" : "/api/v1/models.key",
        loaded: "/api/v1/models.loaded_instances",
      }
      if (item.display_name) sources.name = "/api/v1/models.display_name"
      if (context !== undefined) sources.context = "/api/v1/models.loaded_instances.config.context_length"
      if (maxContext !== undefined) sources.maxContext = "/api/v1/models.max_context_length"
      if (item.capabilities?.trained_for_tool_use !== undefined)
        sources.tools = "/api/v1/models.capabilities.trained_for_tool_use"
      if (item.capabilities?.vision !== undefined) sources.image = "/api/v1/models.capabilities.vision"
      models.push({
        id: instance?.id ?? item.key,
        name: item.display_name || undefined,
        context,
        maxContext,
        loaded: !!instance,
        tools: item.capabilities?.trained_for_tool_use,
        image: item.capabilities?.vision,
        sources,
        warnings: issues,
      })
    })
  })
  return finish(models, warnings)
}

function positive(value: unknown) {
  return Option.getOrUndefined(Schema.decodeUnknownOption(PositiveInt)(value))
}

function optional<A>(effect: Effect.Effect<A, ProviderDiscoveryHTTP.Error>) {
  return effect.pipe(
    Effect.catchTag("ProviderDiscoveryFailure", (error) =>
      ["unsupported", "http", "invalid-response", "network"].includes(error.kind)
        ? Effect.succeed(undefined)
        : Effect.fail(error),
    ),
  )
}

function finish(
  models: readonly CustomProvider.Candidate[],
  warnings: string[],
  allowEmpty = false,
): CustomProvider.Discovery {
  const unique = new Map<string, CustomProvider.Candidate>()
  models.forEach((model) => {
    if (unique.has(model.id)) {
      warnings.push("duplicate-ids")
      return
    }
    unique.set(model.id, model)
  })
  if (!unique.size && !allowEmpty) return { status: "error", kind: "empty" }
  return { status: "success", models: [...unique.values()], warnings: [...new Set(warnings)] }
}
