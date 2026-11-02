export * as SessionActivity from "./session-activity.js"

import { Schema } from "effect"
import { Session } from "./session.js"
import { ephemeral, inventory } from "./event.js"
import { optional } from "./schema.js"

/** Observed work, independent of Session execution ownership and goal completion. */
export const Work = Schema.Struct({
  id: Schema.String,
  sessionID: Session.ID,
  kind: Schema.Literals(["shell", "subagent", "image", "job"]),
  title: optional(Schema.String),
  startedAt: Schema.Finite,
}).annotate({ identifier: "SessionActivity.Work" })
export interface Work extends Schema.Schema.Type<typeof Work> {}

export const Info = Schema.Struct({
  ...Work.fields,
  /** Immediate parent first; contains only existing ancestors. */
  ancestors: Schema.Array(Session.ID),
}).annotate({ identifier: "SessionActivity.Info" })
export interface Info extends Schema.Schema.Type<typeof Info> {}

/** Invalidation only: consumers obtain current facts from the activity snapshot. */
const Changed = ephemeral({ type: "experimental.session.activity.changed", schema: {} })
export const Event = { Changed, Definitions: inventory(Changed) }
