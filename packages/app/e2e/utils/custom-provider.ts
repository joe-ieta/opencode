import { CustomProvider } from "@opencode/schema/custom-provider"
import { Provider } from "@opencode/schema/provider"
import { provider } from "./app"
import type { MockServerConfig } from "./mock-server"

export function customProviderFixture(paid = true) {
  const requests: { id: string; body: CustomProvider.Update }[] = []

  const original = provider({
    id: "existing",
    name: "Existing Model",
    cost: { input: paid ? 1 : 0, output: paid ? 1 : 0 },
  })

  const entry: CustomProvider.Entry = {
    id: Provider.ID.make("private-gateway"),
    name: "Private gateway",
    sources: ["C:/fixture/opencode.jsonc"],
    baseURL: "http://localhost:8080/v1",
    keyReadonly: false,
    keySources: [],
    credentials: [],
    models: { alias: { modelID: "remote-model", context: 16000, input: 12000, output: 4000, tools: true } },
  }

  const deleted = () => requests.some((request) => request.body.mode === "delete")
  const hasProvider = () => !deleted() && requests.some((request) => request.body.mode !== "delete")

  const config = {
    provider: () =>
      hasProvider()
        ? {
            ...original,
            all: [
              ...original.all,
              {
                id: "private-gateway",
                name: "Private gateway",
                models: {
                  alias: {
                    id: "alias",
                    name: "Alias",
                    modelID: "remote-model",
                    limit: { context: 16000, output: 4000 },
                    cost: { input: 1, output: 1 },
                  },
                },
              },
            ],
            connected: ["opencode", "private-gateway"],
          }
        : original,
    customProviders: (): CustomProvider.Listing => {
      const credential = requests.find((request) => request.body.mode !== "delete" && request.body.credential)

      return {
        revision: `revision-${requests.length}`,
        target: "C:/fixture/opencode.jsonc",
        providers: hasProvider()
          ? [
              {
                ...entry,
                credentials: credential
                  ? [{ id: credential.body.credential!.id, label: "Private gateway", active: true }]
                  : [],
              },
            ]
          : [],
      }
    },
    onCustomProviderUpdate: (id: string, body: CustomProvider.Update): CustomProvider.Saved => {
      requests.push({ id, body })

      if (body.mode === "delete")
        return {
          revision: `revision-${requests.length}`,
          config: "deleted",
          credential: "deleted",
          catalog: "ready",
        }

      return {
        revision: `revision-${requests.length}`,
        config: "saved",
        credential: body.credential ? (requests.length === 1 ? "failed" : "saved") : "unchanged",
        catalog: "ready",
      }
    },
  } satisfies Partial<MockServerConfig>

  return { config, requests, entry }
}

export function advancedProviderFixture() {
  const fixture = customProviderFixture()
  const requests: { id: string; body: CustomProvider.Update }[] = []

  const initial: CustomProvider.Entry = {
    ...fixture.entry,
    settings: { timeout: 30000, headerTimeout: false, encoding: "none" },
    compatibility: { streamUsage: true },
    models: {
      alias: {
        ...fixture.entry.models.alias,
        settings: { reasoningEffort: "medium" },
        compatibility: { requireFinishReason: true },
        cost: [
          { input: 1, output: 2, cacheRead: 0.1 },
          { input: 3, output: 4, tierSize: 1000 },
        ],
        variants: [{ id: "existing", settings: { reasoningEffort: "low" } }, { id: "remove" }],
      },
    },
  }

  const saved: CustomProvider.Entry = {
    ...initial,
    settings: { headerTimeout: false, chunkTimeout: 60000, encoding: "none" },
    compatibility: { streamUsage: false },
    models: {
      alias: {
        ...initial.models.alias,
        settings: { reasoningEffort: "high" },
        compatibility: { requireFinishReason: true, maxTokensField: "max_completion_tokens" },
        cost: [
          { input: 3, output: 8, tierSize: 1000 },
          { input: 2, output: 4, tierSize: 2000 },
        ],
        variants: [
          { id: "existing", settings: { reasoningEffort: "high" } },
          { id: "new/variant", settings: { reasoningEffort: "medium" } },
        ],
      },
    },
  }

  const states: CustomProvider.Entry[] = [
    initial,
    saved,
    {
      ...saved,
      models: {
        alias: {
          ...saved.models.alias,
          cost: [
            { input: 3, output: 8, cacheWrite: 0, tierSize: 1000 },
            { input: 2, output: 4, tierSize: 2000 },
          ],
        },
      },
    },
  ]

  return {
    requests,
    config: {
      ...fixture.config,
      customProviders: (): CustomProvider.Listing => ({
        revision: `advanced-${requests.length}`,
        target: "C:/fixture/opencode.jsonc",
        providers: [states[Math.min(requests.length, 2)]!],
      }),
      onCustomProviderUpdate: (id: string, body: CustomProvider.Update): CustomProvider.Saved => {
        requests.push({ id, body })

        return { revision: `advanced-${requests.length}`, config: "saved", credential: "unchanged", catalog: "pending" }
      },
    } satisfies Partial<MockServerConfig>,
  }
}
