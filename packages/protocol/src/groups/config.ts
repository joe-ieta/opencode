import { CustomProvider } from "@opencode/schema/custom-provider"
import { Provider } from "@opencode/schema/provider"
import { ConflictError, InvalidRequestError, UnknownError } from "../errors.js"
import { Config } from "@opencode/schema/config"
import { ConfigShell } from "@opencode/schema/config/shell"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const ConfigGroup = HttpApiGroup.make("server.config")
  .add(
    HttpApiEndpoint.get("config.get", "/api/config", {
      query: LocationQuery,
      success: Schema.Array(Config.Entry),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "config.get",
          summary: "Get configuration",
          description:
            "Return configuration documents and discovery sources for the requested location, from lowest to highest priority.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("config.shells", "/api/config/shell", {
      success: Schema.Array(ConfigShell.Option),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "config.shells",
        summary: "List available shells",
        description: "Return shells available to terminal and agent execution.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.patch("config.update", "/api/experimental/config", {
      payload: Config.Patch,
      success: HttpApiSchema.NoContent,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "experimental.config.update",
        summary: "Update global configuration",
        description: "Patch supported fields in the highest-precedence global configuration document.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("config.providers.list", "/api/experimental/config/providers", {
      query: LocationQuery,
      success: CustomProvider.Listing,
      error: UnknownError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.config.providers.list",
          summary: "List custom provider configuration",
          description:
            "Experimental: may change without compatibility guarantees. Return editable global definitions, read-only sources and credential metadata without secrets.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.patch("config.providers.update", "/api/experimental/config/providers/:providerID", {
      params: { providerID: Provider.ID },
      query: LocationQuery,
      payload: CustomProvider.Update,
      success: CustomProvider.Saved,
      error: [ConflictError, InvalidRequestError, UnknownError],
    })
      .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.config.providers.update",
          summary: "Save a custom provider",
          description:
            "Experimental: may change without compatibility guarantees. Patch supported global provider fields and optionally store a credential. Report partial success separately from catalog readiness.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("config.providers.discover", "/api/experimental/config/providers/discover", {
      query: LocationQuery,
      payload: CustomProvider.DiscoveryRequest,
      success: CustomProvider.Discovery,
      error: [ConflictError, InvalidRequestError, UnknownError],
    })
      .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.config.providers.discover",
          summary: "Discover custom provider models",
          description:
            "Experimental: may change without compatibility guarantees. Request a bounded model inventory from a saved provider or an explicit draft endpoint without saving configuration or credentials.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("config.providers.test", "/api/experimental/config/providers/test", {
      query: LocationQuery,
      payload: CustomProvider.TextTestRequest,
      success: CustomProvider.TextTest,
      error: [ConflictError, InvalidRequestError, UnknownError],
    })
      .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "experimental.config.providers.test",
          summary: "Test a custom provider text response",
          description:
            "Experimental: may change without compatibility guarantees. Explicitly send one minimal text request to a saved provider, limited to 32 output tokens and 30 seconds. May load a model or incur charges. Does not save configuration, create a Session or verify custom options, tools, images or token limits.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "config", description: "Location-scoped configuration routes." }))
