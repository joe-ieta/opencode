import { FSUtil } from "@opencode/util/fs-util"
import { ModelsDev } from "@opencode/core/models-dev"
import { Credential } from "@opencode/core/credential"
import { ConfigCustomProvider } from "@opencode/core/config/custom-provider"
import { ConfigProviderDiscovery } from "@opencode/core/config/provider-discovery"
import { ConfigProviderTest } from "@opencode/core/config/provider-test"
import { FileSystem } from "@opencode/core/filesystem"
import { Integration } from "@opencode/core/integration"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-services"
import { AbsolutePath } from "@opencode/schema/schema"
import { ConflictError, InvalidRequestError, UnknownError } from "@opencode/protocol/errors"
import { Global } from "@opencode/util/global"
import { requireConnectable } from "./integration"
import { Config } from "@opencode/core/config"
import { ShellSelect } from "@opencode/core/shell/select"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

export const ConfigHandler = HttpApiBuilder.group(Api, "server.config", (handlers) =>
  Effect.gen(function* () {
    const dependencies = yield* Effect.context<
      Global.Service | FSUtil.Service | ModelsDev.Service | Credential.Service
    >()
    const global = yield* Global.Service
    const locations = yield* LocationServiceMap.Service
    return handlers
      .handle(
        "config.providers.test",
        Effect.fn(function* (ctx) {
          if (ctx.payload.target.mode === "saved") {
            yield* requireConnectable(Integration.ID.make(ctx.payload.target.providerID)).pipe(
              Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(global.config) }))),
              Effect.catchIf((error) => error instanceof FileSystem.DirectoryNotFoundError, Effect.die),
            )
          }
          return yield* ConfigProviderTest.run(ctx.payload).pipe(
            Effect.provide(dependencies),
            Effect.mapError((error) =>
              error instanceof ConfigCustomProvider.Error
                ? new ConflictError({ message: error.message, resource: "custom-provider" })
                : new UnknownError({ message: "Unable to test provider text response" }),
            ),
          )
        }),
      )
      .handle(
        "config.providers.discover",
        Effect.fn(function* (ctx) {
          if (ctx.payload.metadata !== undefined && ctx.payload.api !== "ollama")
            return yield* new InvalidRequestError({
              message: "Model detail selection requires Ollama discovery",
              kind: "custom_provider",
            })
          if (ctx.payload.target.mode === "saved") {
            yield* requireConnectable(Integration.ID.make(ctx.payload.target.providerID)).pipe(
              Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(global.config) }))),
              Effect.catchIf((error) => error instanceof FileSystem.DirectoryNotFoundError, Effect.die),
            )
          }
          return yield* ConfigProviderDiscovery.discover(ctx.payload.target, ctx.payload).pipe(
            Effect.provide(dependencies),
            Effect.mapError((error) =>
              error instanceof ConfigCustomProvider.Error
                ? new ConflictError({ message: error.message, resource: "custom-provider" })
                : new UnknownError({ message: "Unable to discover provider models" }),
            ),
          )
        }),
      )
      .handle("config.providers.list", () =>
        ConfigCustomProvider.list().pipe(
          Effect.provide(dependencies),
          Effect.mapError(() => new UnknownError({ message: "Unable to read provider configuration" })),
        ),
      )
      .handle(
        "config.providers.update",
        Effect.fn(function* (ctx) {
          yield* requireConnectable(Integration.ID.make(ctx.params.providerID)).pipe(
            Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(global.config) }))),
            Effect.catchIf((error) => error instanceof FileSystem.DirectoryNotFoundError, Effect.die),
          )
          return yield* ConfigCustomProvider.update(ctx.params.providerID, ctx.payload).pipe(
            Effect.provide(dependencies),
            Effect.mapError((error) => {
              if (error instanceof ConfigCustomProvider.Error)
                return error.kind === "conflict"
                  ? new ConflictError({ message: error.message, resource: ctx.params.providerID })
                  : new InvalidRequestError({ message: error.message, kind: "custom_provider" })
              return new UnknownError({ message: "Unable to save provider configuration" })
            }),
          )
        }),
      )
      .handle("config.get", () => Config.Service.use((config) => config.entries()))
      .handle(
        "config.update",
        Effect.fn(function* (ctx) {
          const config = yield* Config.Service
          if (!config.update) return yield* Effect.die(new Error("Config updates are unavailable"))
          return yield* config.update(ctx.payload).pipe(Effect.orDie)
        }),
      )
      .handle(
        "config.shells",
        Effect.fn(function* () {
          const shell = yield* ShellSelect.Service
          if (!shell.list) return yield* Effect.die(new Error("Shell discovery is unavailable"))
          return yield* shell.list()
        }),
      )
  }),
)
