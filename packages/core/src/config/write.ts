export * as ConfigWrite from "./write.js"

import { Effect, Semaphore } from "effect"
import path from "path"
import { FSUtil } from "@opencode/util/fs-util"
import { randomUUID } from "node:crypto"

// Global config is shared by all Locations, including the shell settings writer.
export const lock = Semaphore.makeUnsafe(1)

export const atomic = Effect.fn("ConfigWrite.atomic")(function* (file: string, text: string) {
  const fs = yield* FSUtil.Service
  const temporary = path.join(path.dirname(file), `.opencode-${randomUUID()}.tmp`)
  const mode = (yield* fs.exists(file)) ? (yield* fs.stat(file)).mode : 0o600
  yield* Effect.acquireUseRelease(
    fs.writeWithDirs(temporary, text, mode).pipe(Effect.as(temporary)),
    () => fs.rename(temporary, file),
    () => fs.remove(temporary).pipe(Effect.ignore),
  )
})
