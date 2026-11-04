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

  const config = {
    provider: () =>
      requests.length
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
    customProviders: (): CustomProvider.Listing => ({
      revision: `revision-${requests.length}`,
      target: "C:/fixture/opencode.jsonc",
      providers: requests.length
        ? [
            {
              ...entry,
              credentials:
                requests.length > 1
                  ? [{ id: requests[1]!.body.credential!.id, label: "Private gateway", active: true }]
                  : [],
            },
          ]
        : [],
    }),
    onCustomProviderUpdate: (id: string, body: CustomProvider.Update): CustomProvider.Saved => {
      requests.push({ id, body })

      return {
        revision: `revision-${requests.length}`,
        config: "saved",
        credential: requests.length === 1 ? "failed" : "saved",
        catalog: "ready",
      }
    },
  } satisfies Partial<MockServerConfig>

  return { config, requests, entry }
}
