export * as CustomProviderAdvanced from "./custom-provider-advanced.js"

import { Schema } from "effect"
import { MaxTokensField, CacheFormat } from "./model-compatibility.js"
import { Provider } from "./provider.js"
import { PositiveInt, optional } from "./schema.js"

const Text = Schema.String.check(Schema.isMinLength(1))
const BooleanPatch = Schema.NullOr(Schema.Boolean).pipe(optional)
const Price = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))
const Timeout = Schema.Union([PositiveInt, Schema.Literal(false)])

export const Compatibility = Schema.Struct({
  reasoningField: Schema.String.pipe(optional),
  maxTokensField: MaxTokensField.pipe(optional),
  requireReasoning: Schema.Boolean.pipe(optional),
  requireFinishReason: Schema.Boolean.pipe(optional),
  requireAssistantAfterTool: Schema.Boolean.pipe(optional),
  supportsPromptCacheKey: Schema.Boolean.pipe(optional),
  streamUsage: Schema.Boolean.pipe(optional),
  cacheFormat: CacheFormat.pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.Compatibility" })
export interface Compatibility extends Schema.Schema.Type<typeof Compatibility> {}

export const CompatibilityPatch = Schema.Struct({
  reasoningField: Schema.NullOr(Text.check(Schema.isPattern(/^(?!(?:role|content|refusal|tool_calls)$)\S+$/))).pipe(
    optional,
  ),
  maxTokensField: Schema.NullOr(MaxTokensField).pipe(optional),
  requireReasoning: BooleanPatch,
  requireFinishReason: BooleanPatch,
  requireAssistantAfterTool: BooleanPatch,
  supportsPromptCacheKey: BooleanPatch,
  streamUsage: BooleanPatch,
  cacheFormat: Schema.NullOr(CacheFormat).pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.CompatibilityPatch" })
export interface CompatibilityPatch extends Schema.Schema.Type<typeof CompatibilityPatch> {}

export const Settings = Schema.Struct({
  reasoningEffort: Schema.String.pipe(optional),
  textVerbosity: Schema.Literals(["low", "medium", "high"]).pipe(optional),
  parallelToolCalls: Schema.Boolean.pipe(optional),
  encoding: Provider.Encoding.pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.Settings" })
export interface Settings extends Schema.Schema.Type<typeof Settings> {}

export const SettingsPatch = Schema.Struct({
  reasoningEffort: Schema.NullOr(Text).pipe(optional),
  textVerbosity: Schema.NullOr(Schema.Literals(["low", "medium", "high"])).pipe(optional),
  parallelToolCalls: BooleanPatch,
  encoding: Schema.NullOr(Provider.Encoding).pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.SettingsPatch" })
export interface SettingsPatch extends Schema.Schema.Type<typeof SettingsPatch> {}

export const ProviderSettings = Schema.Struct({
  ...Settings.fields,
  timeout: Schema.Union([Schema.Finite, Schema.Literal(false)]).pipe(optional),
  headerTimeout: Schema.Union([Schema.Finite, Schema.Literal(false)]).pipe(optional),
  chunkTimeout: Schema.Union([Schema.Finite, Schema.Literal(false)]).pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.ProviderSettings" })
export interface ProviderSettings extends Schema.Schema.Type<typeof ProviderSettings> {}

export const ProviderSettingsPatch = Schema.Struct({
  ...SettingsPatch.fields,
  timeout: Schema.NullOr(Timeout).pipe(optional),
  headerTimeout: Schema.NullOr(Timeout).pipe(optional),
  chunkTimeout: Schema.NullOr(Timeout).pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.ProviderSettingsPatch" })
export interface ProviderSettingsPatch extends Schema.Schema.Type<typeof ProviderSettingsPatch> {}

export const Cost = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
  cacheRead: Schema.Finite.pipe(optional),
  cacheWrite: Schema.Finite.pipe(optional),
  tierSize: Schema.Int.pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.Cost" })
export interface Cost extends Schema.Schema.Type<typeof Cost> {}

export const CostPatch = Schema.Struct({
  input: Price.pipe(optional),
  output: Price.pipe(optional),
  cacheRead: Schema.NullOr(Price).pipe(optional),
  cacheWrite: Schema.NullOr(Price).pipe(optional),
  tierSize: Schema.NullOr(PositiveInt).pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.CostPatch" })
export interface CostPatch extends Schema.Schema.Type<typeof CostPatch> {}

export const CostsPatch = Schema.Record(
  Schema.String.check(Schema.isPattern(/^(0|[1-9]\d*)$/)),
  Schema.NullOr(CostPatch),
).annotate({ identifier: "CustomProvider.Advanced.CostsPatch" })
export type CostsPatch = typeof CostsPatch.Type

export const Variant = Schema.Struct({
  id: Schema.String,
  settings: Settings.pipe(optional),
}).annotate({ identifier: "CustomProvider.Advanced.Variant" })
export interface Variant extends Schema.Schema.Type<typeof Variant> {}

export const VariantsPatch = Schema.Record(
  Text.check(Schema.isPattern(/^(?!default$)[^#]+$/)),
  Schema.NullOr(Schema.Struct({ settings: SettingsPatch.pipe(optional) })),
).annotate({ identifier: "CustomProvider.Advanced.VariantsPatch" })
export type VariantsPatch = typeof VariantsPatch.Type
