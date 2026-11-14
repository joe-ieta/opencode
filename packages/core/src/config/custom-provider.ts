export * as ConfigCustomProvider from "./custom-provider.js"

import path from "path"
import { applyEdits, modify, parseTree, getNodeValue, type Node, type ParseError } from "jsonc-parser"
import { Effect, Option, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { ConfigProvider } from "@opencode/schema/config/provider"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Hash } from "@opencode/util/hash"
import { Config } from "../config.js"
import { Credential } from "../credential.js"
import { Integration } from "../integration.js"
import { Provider } from "../provider.js"
import { Plugin } from "../plugin.js"
import { Model } from "../model.js"
import { ModelsDev } from "../models-dev.js"
import { ConfigDiscovery } from "./discovery.js"
import { ConfigWrite } from "./write.js"
import { ConfigProviderAdvanced } from "./custom-provider-advanced.js"

const packageName = "@opencode/ai/providers/openai-compatible"
const Definitions = Schema.Record(Schema.String, Schema.Json)
const Document = Schema.Struct({
  provider: Schema.optional(Definitions),
  providers: Schema.optional(Definitions),
})

export class Error extends Schema.TaggedError<Error>()("CustomProviderError", {
  kind: Schema.Literals(["invalid", "conflict"]),
  message: Schema.String,
}) {}

export const list = Effect.fn("ConfigCustomProvider.list")(function* () {
  const state = yield* read()
  return state.listing
})

export const update = Effect.fn("ConfigCustomProvider.update")(
  function* (id: string, input: CustomProvider.Update) {
    const state = yield* read()
    const existing = state.listing.providers.find((item) => item.id === id)
    const reason = state.listing.reason ?? existing?.reason
    if (reason) return yield* new Error({ kind: "conflict", message: reason })
    if (state.reserved.has(id)) return yield* new Error({ kind: "conflict", message: "built-in-provider" })
    if (state.listing.revision !== input.revision)
      return yield* new Error({ kind: "conflict", message: "config-changed" })
    if (input.mode === "delete") {
      if (!existing) return yield* new Error({ kind: "conflict", message: "provider-not-found" })
      const file = existing.sources[0]
      const original = state.documents.find((item) => item.path === file)?.text ?? "{}\n"
      const text = yield* Effect.try({
        try: () => editProvider(original, id),
        catch: () => new Error({ kind: "invalid", message: "invalid-provider" }),
      })
      if (text === original) return yield* new Error({ kind: "conflict", message: "provider-not-found" })
      yield* ConfigWrite.atomic(file, text)
      const credentials = yield* Credential.Service
      const stored = yield* credentials.list(Integration.ID.make(id))
      const removed = yield* Effect.forEach(
        stored,
        (credential) =>
          credentials.remove(credential.id).pipe(
            Effect.as(true),
            Effect.catchCause(() => Effect.succeed(false)),
          ),
        { concurrency: 1 },
      )
      const config = yield* Config.Service
      const integration = yield* Integration.Service
      const providers = yield* Provider.Service
      const models = yield* Model.Service
      if (config.refresh) yield* config.refresh()
      yield* integration.reload()
      yield* providers.reload()
      yield* models.reload()
      const next = yield* read()
      return {
        revision: next.listing.revision,
        config: "deleted" as const,
        credential: stored.length ? (removed.every(Boolean) ? "deleted" as const : "failed" as const) : ("unchanged" as const),
        catalog: (yield* models.available()).some((model) => model.providerID === id) ? ("pending" as const) : ("ready" as const),
      }
    }
    if (!input.patch) return yield* new Error({ kind: "invalid", message: "invalid-provider" })
    const patch = input.patch
    if (input.mode === "create" && (existing || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)))
      return yield* new Error({ kind: "conflict", message: "provider-id-conflict" })
    if (input.mode === "edit" && !existing) return yield* new Error({ kind: "conflict", message: "provider-not-found" })
    if (input.credential && existing?.keyReadonly)
      return yield* new Error({ kind: "conflict", message: "config-key-readonly" })
    const credentials = yield* Credential.Service
    const previous = input.credential ? yield* credentials.get(input.credential.id) : undefined
    if (
      previous &&
      (previous.integrationID !== id || previous.value.type !== "key" || previous.value.key !== input.credential?.key)
    )
      return yield* new Error({ kind: "conflict", message: "credential-id-conflict" })
    const file = existing?.sources[0] ?? state.listing.target
    const original = state.documents.find((item) => item.path === file)?.text ?? "{}\n"
    const text = yield* Effect.try({
      try: () => edit(original, id, { ...input, patch }),
      catch: () => new Error({ kind: "invalid", message: "invalid-provider" }),
    })
    if (text !== original) yield* ConfigWrite.atomic(file, text)
    const saved =
      input.credential && !previous
        ? yield* credentials
            .create({
              id: input.credential.id,
              integrationID: Integration.ID.make(id),
              label: patch.name || existing?.name || id,
              value: { type: "key", key: input.credential.key },
              activate: true,
            })
            .pipe(
              Effect.as(true),
              Effect.catchCause(() => Effect.succeed(false)),
            )
        : true
    const config = yield* Config.Service
    const integration = yield* Integration.Service
    const providers = yield* Provider.Service
    const models = yield* Model.Service
    const ready = yield* Effect.gen(function* () {
      if (config.refresh) yield* config.refresh()
      yield* integration.reload()
      yield* providers.reload()
      yield* models.reload()
      return (yield* models.available()).some((model) => model.providerID === id)
    }).pipe(
      Effect.timeoutOption("5 seconds"),
      Effect.map(Option.getOrElse(() => false)),
      Effect.catchCause(() => Effect.succeed(false)),
    )
    const next = yield* read()
    return {
      revision: next.listing.revision,
      config: "saved" as const,
      credential: input.credential ? (saved ? ("saved" as const) : ("failed" as const)) : ("unchanged" as const),
      catalog: ready ? ("ready" as const) : ("pending" as const),
    }
  },
  (effect) => ConfigWrite.lock.withPermit(effect),
)

const read = Effect.fn("ConfigCustomProvider.read")(function* () {
  const config = yield* Config.Service
  const fs = yield* FSUtil.Service
  const global = yield* Global.Service
  const catalog = yield* ModelsDev.Service
  const credentials = yield* Credential.Service
  const entries = yield* config.entries()
  const globals = yield* Effect.forEach(ConfigDiscovery.names, (name) => fs.resolve(path.join(global.config, name)))
  const paths = [
    ...new Set([
      ...globals,
      ...entries.flatMap((entry) =>
        entry.path
          ? entry.type === "directory"
            ? ConfigDiscovery.names.map((name) => path.join(entry.path, name))
            : [entry.path]
          : [],
      ),
    ]),
  ]
  const documents = yield* Effect.forEach(paths, (file) =>
    Effect.gen(function* () {
      if (!(yield* fs.exists(file))) return undefined
      const text = yield* fs.readFileString(file)
      return { path: yield* fs.resolve(file), text, document: decode(text) }
    }),
  )
  const files = documents.filter((item) => item !== undefined)
  const reserved = new Set([
    ...(yield* catalog.get()).map((item) => item.info.id as string),
    "ollama",
    "lmstudio",
    "vllm",
  ])
  const definitions = files.flatMap((file) => [
    ...Object.entries(file.document?.providers ?? {}).map(([id, value]) => ({
      id,
      value,
      path: file.path,
      legacy: false,
    })),
    ...Object.entries(file.document?.provider ?? {}).map(([id, value]) => ({
      id,
      value,
      path: file.path,
      legacy: true,
    })),
  ])
  const remote = entries.flatMap((entry) =>
    entry.type === "document" && (!entry.path || !files.some((file) => file.path === entry.path))
      ? Object.keys(entry.info.providers ?? {}).map((id) => ({
          id,
          value: null,
          path: entry.path ?? "managed/integration",
          legacy: false,
        }))
      : [],
  )
  const reason = files.some((file) => !file.document) ? "invalid-config" : undefined
  const revision = Hash.sha256(JSON.stringify([files.map((file) => [file.path, file.text]), remote]))
  const configurations = new Map<string, ConfigProvider.Info>()
  const providers = yield* Effect.forEach(
    [...Map.groupBy([...definitions, ...remote], (item) => item.id)],
    ([id, sources]) =>
      Effect.gen(function* () {
        const source = sources[0]
        const parsed = Schema.decodeUnknownOption(ConfigProvider.Info)(source.value)
        const info = Option.getOrUndefined(parsed)
        if (info) configurations.set(id, info)
        const restricted =
          info &&
          (info.canonical ||
            info.package !== packageName ||
            Object.values(info.models ?? {}).some(
              (model) =>
                model.package !== undefined ||
                model.settings?.baseURL !== undefined ||
                (model.type !== undefined && model.type !== "chat"),
            ))
        const readonly =
          reason ??
          (sources.length !== 1
            ? "multiple-sources"
            : source.legacy
              ? "legacy-provider"
              : !globals.includes(source.path)
                ? "readonly-source"
                : reserved.has(id)
                  ? "built-in-provider"
                  : !info || restricted
                    ? "unsupported-provider"
                    : undefined)
        const saved = yield* credentials.list(Integration.ID.make(id))
        const configuredKey =
          info?.settings?.apiKey !== undefined ||
          info?.headers !== undefined ||
          Object.values(info?.models ?? {}).some(
            (model) =>
              model.settings?.apiKey !== undefined ||
              model.headers !== undefined ||
              model.variants?.some(
                (variant) => variant.settings?.apiKey !== undefined || variant.headers !== undefined,
              ),
          )
        return {
          id: Provider.ID.make(id),
          name: info?.name || id,
          sources: sources.map((item) => item.path),
          reason: readonly,
          baseURL: safeURL(info?.settings?.baseURL),
          ...ConfigProviderAdvanced.provider(info),
          keyReadonly: !!configuredKey,
          keySources: [
            ...(saved.length ? ["credential"] : []),
            ...(info?.env?.length ? ["env"] : []),
            ...(configuredKey ? ["config"] : []),
          ],
          credentials: saved.map((item, index) => ({
            id: item.id,
            label: item.label,
            active: index === saved.length - 1,
          })),
          models: Object.fromEntries(
            Object.entries(info?.models ?? {}).map(([key, model]) => [
              key,
              {
                ...ConfigProviderAdvanced.model(model),
                name: model.name,
                modelID: model.modelID,
                context: model.limit?.context,
                input: model.limit?.input,
                output: model.limit?.output,
                tools: model.capabilities?.tools,
                image: model.capabilities?.input === undefined ? undefined : model.capabilities.input.includes("image"),
              },
            ]),
          ),
        }
      }),
  )
  return {
    configurations,
    documents: files,
    reserved,
    listing: {
      revision,
      reason,
      target: globals.findLast((file) => files.some((item) => item.path === file)) ?? globals[1],
      providers,
    },
  }
})

export const discoveryTarget = Effect.fn("ConfigCustomProvider.discoveryTarget")(function* (
  input: Extract<CustomProvider.DiscoveryInput, { mode: "saved" }>,
) {
  const state = yield* read()
  const entry = state.listing.providers.find((item) => item.id === input.providerID)
  if (input.revision !== state.listing.revision || state.listing.reason || !entry || entry.reason)
    return yield* new Error({ kind: "conflict", message: "config-changed-or-readonly" })
  yield* Plugin.awaitActivation
  const providers = yield* Provider.Service
  const integrations = yield* Integration.Service
  const provider = yield* providers.get(input.providerID)
  if (!provider || provider.settings?.baseURL !== entry.baseURL)
    return yield* new Error({ kind: "conflict", message: "provider-refresh-pending" })
  const connection = yield* integrations.connection.active(
    provider.integrationID ?? Integration.ID.make(input.providerID),
  )
  const credential = connection ? yield* integrations.connection.resolve(connection) : undefined
  const modelAuth = Object.values(state.configurations.get(input.providerID)?.models ?? {}).some(
    (model) =>
      model.settings?.apiKey !== undefined ||
      model.headers !== undefined ||
      model.variants?.some((variant) => variant.settings?.apiKey !== undefined || variant.headers !== undefined),
  )
  return { baseURL: entry.baseURL, settings: provider.settings, headers: provider.headers, credential, modelAuth }
})

function decode(text: string) {
  const errors: ParseError[] = []
  const root = parseTree(text, errors, { allowTrailingComma: true })
  if (!root || errors.length || duplicate(root)) return undefined
  return Option.getOrUndefined(Schema.decodeUnknownOption(Document)(getNodeValue(root)))
}

function duplicate(node: Node): boolean {
  if (node.type === "object") {
    const names = node.children?.map((child) => child.children?.[0].value) ?? []
    if (new Set(names).size !== names.length) return true
  }
  return node.children?.some(duplicate) ?? false
}

export function safeURL(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) return undefined
  const url = new URL(value)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    return undefined
  return value
}

type EditInput = CustomProvider.Update & { patch: NonNullable<CustomProvider.Update["patch"]> }

function editProvider(text: string, id: string) {
  const result = applyEdits(
    text,
    modify(text, ["providers", id], undefined, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    }),
  )
  if (!decode(result)) throw new Error({ kind: "invalid", message: "invalid-provider" })
  return result.endsWith("\n") ? result : `${result}\n`
}

function edit(text: string, id: string, input: EditInput) {
  const info = Option.getOrUndefined(Schema.decodeUnknownOption(ConfigProvider.Info)(decode(text)?.providers?.[id]))
  const changes: { path: (string | number)[]; value: Schema.Json | undefined }[] = []
  if (input.mode === "create") changes.push({ path: ["package"], value: packageName })
  if (input.patch.name !== undefined) changes.push({ path: ["name"], value: input.patch.name ?? undefined })
  if (input.patch.baseURL !== undefined) {
    if (!safeURL(input.patch.baseURL)) throw new Error({ kind: "invalid", message: "invalid-base-url" })
    changes.push({ path: ["settings", "baseURL"], value: input.patch.baseURL })
  }
  Object.entries(input.patch.models ?? {}).forEach(([key, model]) => {
    if (model === null) {
      changes.push({ path: ["models", key], value: undefined })
      return
    }
    if (!info?.models?.[key])
      changes.push({ path: ["models", key], value: { capabilities: { input: ["text"], output: ["text"] } } })
    Object.entries(model).forEach(([field, value]) => {
      if (value === undefined) return
      if (["settings", "compatibility", "cost", "variants"].includes(field)) return
      const path = ["models", key]
      if (["context", "input", "output"].includes(field)) path.push("limit", field)
      if (field === "tools") path.push("capabilities", "tools")
      if (field === "image") {
        path.push("capabilities", "input")
        const modalities = info?.models?.[key]?.capabilities?.input ?? ["text"]
        changes.push({
          path,
          value:
            value === null
              ? undefined
              : value
                ? [...new Set([...modalities, "image"])]
                : modalities.filter((item) => item !== "image"),
        })
        return
      }
      if (field === "name" || field === "modelID") path.push(field)
      changes.push({ path, value: value ?? undefined })
    })
  })
  changes.push(...ConfigProviderAdvanced.changes(text, id, input.patch, info))
  const result = changes.reduce(
    (current, change) =>
      applyEdits(
        current,
        modify(current, ["providers", id, ...change.path], change.value, {
          formattingOptions: { tabSize: 2, insertSpaces: true },
        }),
      ),
    text,
  )
  const validated = Schema.decodeUnknownSync(ConfigProvider.Info)(decode(result)?.providers?.[id])
  Object.entries(input.patch.models ?? {}).forEach(([key, model]) => {
    if (!model?.cost || !Object.keys(model.cost).length) return
    const prices = validated.models?.[key]?.cost
    if (Array.isArray(prices) && new Set(prices.map((price) => price.tier?.size ?? "default")).size !== prices.length)
      throw new Error({ kind: "invalid", message: "duplicate-price-tiers" })
  })
  if (!safeURL(validated.settings?.baseURL) || !Object.keys(validated.models ?? {}).length)
    throw new Error({ kind: "invalid", message: "provider-needs-url-and-model" })
  return result.endsWith("\n") ? result : `${result}\n`
}
