export * as CustomProvider from "./custom-provider.js"

import { Schema } from "effect"
import { Credential } from "./credential.js"
import { Provider } from "./provider.js"
import { PositiveInt, optional } from "./schema.js"

const Text = Schema.String.check(Schema.isMinLength(1))
const ClearText = Schema.NullOr(Text).pipe(optional)
const Limit = Schema.NullOr(PositiveInt).pipe(optional)

export const ModelPatch = Schema.Struct({
  name: ClearText,
  modelID: ClearText,
  context: Limit,
  input: Limit,
  output: Limit,
  tools: Schema.NullOr(Schema.Boolean).pipe(optional),
  image: Schema.NullOr(Schema.Boolean).pipe(optional),
}).annotate({ identifier: "CustomProvider.ModelPatch" })
export interface ModelPatch extends Schema.Schema.Type<typeof ModelPatch> {}

export const Patch = Schema.Struct({
  name: ClearText,
  baseURL: Text.pipe(optional),
  models: Schema.Record(Text, Schema.NullOr(ModelPatch)).pipe(optional),
}).annotate({ identifier: "CustomProvider.Patch" })
export interface Patch extends Schema.Schema.Type<typeof Patch> {}

export const Update = Schema.Struct({
  mode: Schema.Literals(["create", "edit"]),
  revision: Text,
  patch: Patch,
  credential: Schema.Struct({ id: Credential.ID, key: Text }).pipe(optional),
}).annotate({ identifier: "CustomProvider.Update" })
export interface Update extends Schema.Schema.Type<typeof Update> {}

// Existing hand-written definitions may contain empty names or non-positive limits.
// Return those values for correction without weakening validation of new patches.
export const Definition = Schema.Struct({
  ...ModelPatch.fields,
  name: Schema.String.pipe(optional),
  modelID: Schema.String.pipe(optional),
  context: Schema.Int.pipe(optional),
  input: Schema.Int.pipe(optional),
  output: Schema.Int.pipe(optional),
}).annotate({ identifier: "CustomProvider.Definition" })
export interface Definition extends Schema.Schema.Type<typeof Definition> {}

export const Entry = Schema.Struct({
  id: Provider.ID,
  name: Schema.String,
  sources: Schema.Array(Schema.String),
  reason: Schema.String.pipe(optional),
  baseURL: Schema.String.pipe(optional),
  keyReadonly: Schema.Boolean,
  keySources: Schema.Array(Schema.String),
  credentials: Schema.Array(Schema.Struct({ id: Credential.ID, label: Schema.String, active: Schema.Boolean })),
  models: Schema.Record(Schema.String, Definition),
}).annotate({ identifier: "CustomProvider.Entry" })
export interface Entry extends Schema.Schema.Type<typeof Entry> {}

export const Listing = Schema.Struct({
  revision: Schema.String,
  target: Schema.String,
  reason: Schema.String.pipe(optional),
  providers: Schema.Array(Entry),
}).annotate({ identifier: "CustomProvider.Listing" })
export interface Listing extends Schema.Schema.Type<typeof Listing> {}

export const Saved = Schema.Struct({
  revision: Schema.String,
  config: Schema.Literal("saved"),
  credential: Schema.Literals(["unchanged", "saved", "failed"]),
  catalog: Schema.Literals(["ready", "pending"]),
}).annotate({ identifier: "CustomProvider.Saved" })
export interface Saved extends Schema.Schema.Type<typeof Saved> {}

const SavedTarget = Schema.Struct({ mode: Schema.Literal("saved"), providerID: Provider.ID, revision: Text })

export const DiscoveryInput = Schema.Union([
  SavedTarget,
  Schema.Struct({ mode: Schema.Literal("draft"), baseURL: Text, key: Text.pipe(optional) }),
]).annotate({ identifier: "CustomProvider.DiscoveryInput" })
export type DiscoveryInput = typeof DiscoveryInput.Type

export const DiscoveryAPI = Schema.Literals(["openai", "ollama", "lmstudio"])
export type DiscoveryAPI = typeof DiscoveryAPI.Type

export const DiscoveryRequest = Schema.Struct({
  target: DiscoveryInput,
  api: DiscoveryAPI.pipe(optional),
  metadata: Schema.Array(Text).check(Schema.isMinLength(1), Schema.isMaxLength(20)).pipe(optional),
}).annotate({ identifier: "CustomProvider.DiscoveryRequest" })
export interface DiscoveryRequest extends Schema.Schema.Type<typeof DiscoveryRequest> {}

export const DiscoveryKind = Schema.Literals([
  "model-not-found",
  "invalid-url",
  "blocked-address",
  "authentication",
  "unsupported",
  "redirect",
  "http",
  "network",
  "timeout",
  "too-large",
  "invalid-response",
  "empty",
  "unsupported-auth",
])
export type DiscoveryKind = typeof DiscoveryKind.Type

export const Candidate = Schema.Struct({
  id: Text,
  name: Text.pipe(optional),
  context: PositiveInt.pipe(optional),
  input: PositiveInt.pipe(optional),
  output: PositiveInt.pipe(optional),
  maxContext: PositiveInt.pipe(optional),
  loaded: Schema.Boolean.pipe(optional),
  tools: Schema.Boolean.pipe(optional),
  image: Schema.Boolean.pipe(optional),
  metadataPending: Schema.Boolean.pipe(optional),
  sources: Schema.Record(Schema.String, Schema.String),
  warnings: Schema.Array(Schema.String),
}).annotate({ identifier: "CustomProvider.Candidate" })
export interface Candidate extends Schema.Schema.Type<typeof Candidate> {}

export const Discovery = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("success"),
    models: Schema.Array(Candidate),
    warnings: Schema.Array(Schema.String),
  }),
  Schema.Struct({ status: Schema.Literal("error"), kind: DiscoveryKind, httpStatus: Schema.Int.pipe(optional) }),
]).annotate({ identifier: "CustomProvider.Discovery" })
export type Discovery = typeof Discovery.Type

export const TextTestRequest = Schema.Struct({
  target: SavedTarget,
  modelID: Text.check(Schema.isMaxLength(1024)),
}).annotate({ identifier: "CustomProvider.TextTestRequest" })
export interface TextTestRequest extends Schema.Schema.Type<typeof TextTestRequest> {}

export const TextTest = Schema.Union([
  Schema.Struct({ status: Schema.Literal("success") }),
  Schema.Struct({
    status: Schema.Literal("error"),
    kind: Schema.Union([DiscoveryKind, Schema.Literal("no-text")]),
    httpStatus: Schema.Int.pipe(optional),
  }),
]).annotate({ identifier: "CustomProvider.TextTest" })
export type TextTest = typeof TextTest.Type
