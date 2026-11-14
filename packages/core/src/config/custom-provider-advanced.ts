export * as ConfigProviderAdvanced from "./custom-provider-advanced.js"

import { findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser"
import { Option, Schema } from "effect"
import { CustomProvider } from "@opencode/schema/custom-provider"
import { CustomProviderAdvanced } from "@opencode/schema/custom-provider-advanced"
import { ConfigProvider } from "@opencode/schema/config/provider"

type Change = { path: (string | number)[]; value: Schema.Json | undefined }

export function provider(info: ConfigProvider.Info | undefined) {
  return {
    settings: project(CustomProviderAdvanced.ProviderSettings, info?.settings),
    compatibility: project(CustomProviderAdvanced.Compatibility, info?.compatibility),
  }
}

export function model(info: NonNullable<ConfigProvider.Info["models"]>[string]) {
  return {
    settings: project(CustomProviderAdvanced.Settings, info.settings),
    compatibility: project(CustomProviderAdvanced.Compatibility, info.compatibility),
    cost:
      info.cost === undefined
        ? undefined
        : (Array.isArray(info.cost) ? info.cost : [info.cost]).map((cost) => ({
            input: cost.input,
            output: cost.output,
            cacheRead: cost.cache?.read,
            cacheWrite: cost.cache?.write,
            tierSize: cost.tier?.size,
          })),
    variants: info.variants?.map((variant) => ({
      id: variant.id,
      settings: project(CustomProviderAdvanced.Settings, variant.settings),
    })),
    variantsReadonly:
      info.variants?.some((variant) => !variant.id.trim() || variant.id === "default" || variant.id.includes("#")) ||
      new Set(info.variants?.map((variant) => variant.id)).size !== (info.variants?.length ?? 0) ||
      undefined,
  }
}

// Decode each allowlisted leaf once. Unrelated settings, headers, body and their secrets never enter the snapshot.
function project<F extends { readonly [key: string]: Schema.ConstraintDecoder<unknown> }>(
  schema: Schema.Struct<F>,
  value: object | undefined,
) {
  const entries = Object.entries(value ?? {}).flatMap(([key, value]) => {
    if (!Object.hasOwn(schema.fields, key)) return []
    const parsed = Schema.decodeUnknownOption(schema.fields[key])(value)
    return Option.isSome(parsed) && parsed.value !== undefined ? [[key, parsed.value]] : []
  })
  return entries.length ? (Object.fromEntries(entries) as Schema.Schema.Type<Schema.Struct<F>>) : undefined
}

export function changes(text: string, id: string, patch: CustomProvider.Patch, info: ConfigProvider.Info | undefined) {
  const result: Change[] = []
  const leaves = (path: string[], fields: object | undefined) =>
    Object.entries(fields ?? {}).forEach(([key, value]) => {
      if (value !== undefined) result.push({ path: [...path, key], value: value ?? undefined })
    })
  leaves(["settings"], patch.settings)
  leaves(["compatibility"], patch.compatibility)
  Object.entries(patch.models ?? {}).forEach(([key, model]) => {
    if (!model) return
    leaves(["models", key, "settings"], model.settings)
    leaves(["models", key, "compatibility"], model.compatibility)
    if (model.cost) result.push(...costs(text, id, key, model.cost, info?.models?.[key]?.cost))
    if (model.variants) result.push(...variants(key, model.variants, info?.models?.[key]?.variants))
  })
  return result
}

function costs(
  text: string,
  id: string,
  key: string,
  patch: CustomProviderAdvanced.CostsPatch,
  saved: NonNullable<ConfigProvider.Info["models"]>[string]["cost"],
) {
  const path = ["models", key, "cost"]
  const current = saved === undefined ? [] : Array.isArray(saved) ? saved : [saved]
  const entries = Object.entries(patch).map(([index, value]) => ({ index: Number(index), value }))
  if (entries.some((item) => !Number.isSafeInteger(item.index))) throw new Error("invalid-price-index")
  const added = entries.filter((item) => item.index >= current.length).sort((a, b) => a.index - b.index)
  if (added.some((item, index) => item.index !== current.length + index || !item.value))
    throw new Error("invalid-price-index")
  const removed = entries.filter((item) => item.value === null).sort((a, b) => b.index - a.index)
  if (!entries.length) return []
  if (current.length + added.length === removed.length) return [{ path, value: undefined }]
  const array = Array.isArray(saved) || current.length + added.length > 1
  const result: Change[] = []
  if (array && !Array.isArray(saved)) {
    // Adding a tier converts a legacy object to an array while retaining its unexposed keys.
    const original: Schema.Json =
      saved === undefined ? [] : [getNodeValue(findNodeAtLocation(parseTree(text)!, ["providers", id, ...path])!)]
    result.push({ path, value: original })
  }
  entries
    .filter((item) => item.value !== null)
    .forEach((item) => {
      const prefix = array ? [...path, item.index] : path
      if (item.index >= current.length) result.push({ path: prefix, value: {} })
      Object.entries(item.value!).forEach(([field, value]) => {
        if (value === undefined) return
        if (field === "tierSize") {
          if (value === null) result.push({ path: [...prefix, "tier"], value: undefined })
          if (value !== null) {
            result.push({ path: [...prefix, "tier", "type"], value: "context" })
            result.push({ path: [...prefix, "tier", "size"], value })
          }
          return
        }
        const suffix = field === "cacheRead" ? ["cache", "read"] : field === "cacheWrite" ? ["cache", "write"] : [field]
        result.push({ path: [...prefix, ...suffix], value: value ?? undefined })
      })
    })
  removed.forEach((item) => result.push({ path: [...path, item.index], value: undefined }))
  return result
}

function variants(
  key: string,
  patch: CustomProviderAdvanced.VariantsPatch,
  saved: NonNullable<ConfigProvider.Info["models"]>[string]["variants"],
) {
  const current = saved ?? []
  if (!Object.keys(patch).length) return []
  if (current.some((item) => !item.id.trim()) || new Set(current.map((item) => item.id)).size !== current.length)
    throw new Error("ambiguous-variants")
  const result: Change[] = []
  const removed: number[] = []
  const next = { index: current.length }
  Object.entries(patch).forEach(([id, value]) => {
    if (!id.trim()) throw new Error("invalid-variant-id")
    const found = current.findIndex((item) => item.id === id)
    if (value === null) {
      if (found >= 0) removed.push(found)
      return
    }
    const index = found < 0 ? next.index++ : found
    if (found < 0) result.push({ path: ["models", key, "variants", index], value: { id } })
    Object.entries(value.settings ?? {}).forEach(([field, value]) => {
      if (value !== undefined)
        result.push({ path: ["models", key, "variants", index, "settings", field], value: value ?? undefined })
    })
  })
  removed
    .sort((a, b) => b - a)
    .forEach((index) => result.push({ path: ["models", key, "variants", index], value: undefined }))
  return result
}
