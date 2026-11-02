export * as SessionActivitySource from "./activity-source.js"

import { SessionActivity } from "@opencode/schema/session-activity"
import { Context, Effect, Layer, Scope } from "effect"
import { makeGlobalNode } from "@opencode/util/effect/app-node"
import { Bus } from "../bus.js"

/** Sources expose live facts; this registry neither stores work nor controls its execution. */
export interface Interface {
  readonly register: (read: Effect.Effect<readonly SessionActivity.Work[]>) => Effect.Effect<void, never, Scope.Scope>
  readonly list: Effect.Effect<readonly SessionActivity.Work[]>
  readonly changed: Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionActivitySource") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const sources = new Set<Effect.Effect<readonly SessionActivity.Work[]>>()
    const changed = bus.publish(SessionActivity.Event.Changed, {}, { global: true }).pipe(Effect.asVoid)
    return Service.of({
      register: (read) =>
        Effect.gen(function* () {
          sources.add(read)
          yield* Effect.addFinalizer(() => Effect.sync(() => sources.delete(read)).pipe(Effect.andThen(changed)))
        }),
      list: Effect.suspend(() => Effect.all([...sources]).pipe(Effect.map((items) => items.flat()))),
      changed,
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Bus.node] })
