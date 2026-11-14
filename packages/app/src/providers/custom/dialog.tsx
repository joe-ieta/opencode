import type {
  CustomProviderEntry,
  CustomProviderListing,
  CustomProviderCandidate,
  ExperimentalConfigProvidersUpdateInput,
  ExperimentalConfigProvidersDiscoverInput,
} from "@opencode/client/promise"
import { createStore } from "solid-js/store"
import { For, Show, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { TextField } from "@opencode/ui/text-field"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { formatServerError } from "@/runtime/server/errors"
import { useLocal, type ModelSelection } from "@/providers/models/selection"
import { uuid } from "@opencode/util/uuid"
import {
  advancedDraft,
  advancedPatch,
  AdvancedFields,
  priceRow,
  pricePatch,
  PriceFields,
  variantRow,
  variantPatch,
  VariantFields,
} from "./advanced"

function row(id = "", model: CustomProviderEntry["models"][string] = {}) {
  return {
    token: uuid(),
    id,
    original: id,
    name: model.name ?? "",
    modelID: model.modelID ?? "",
    context: model.context?.toString() ?? "",
    input: model.input?.toString() ?? "",
    output: model.output?.toString() ?? "",
    tools: model.tools == null ? "inherit" : String(model.tools),
    image: model.image == null ? "inherit" : String(model.image),
    advanced: advancedDraft(model),
    costs: model.cost?.map(priceRow) ?? [],
    variants: model.variants?.map(variantRow) ?? [],
  }
}

export function DialogCustomProviders(props: { directory?: string; providerID?: string; selection?: ModelSelection }) {
  const sdk = useServerSDK()
  const data = useData()
  const language = useLanguage()
  const dialog = useDialog()
  const local = useLocal()

  const [store, setStore] = createStore<{
    listing?: CustomProviderListing
    original?: CustomProviderEntry
    view: "list" | "create" | "edit"
    id: string
    name: string
    baseURL: string
    key: string
    advanced: ReturnType<typeof advancedDraft>
    credentialID: string
    rows: ReturnType<typeof row>[]
    busy: boolean
    error: string
    result: string
    ready: boolean
    candidates: CustomProviderCandidate[]
    selected: string[]
    discoveryWarnings: string[]
    discovering: boolean
    discoveryError: string
    api: NonNullable<ExperimentalConfigProvidersDiscoverInput["api"]>
    testing: boolean
    testToken: string
    testResult: string
    testError: string
  }>({
    view: "list",
    id: "",
    name: "",
    baseURL: "",
    key: "",
    advanced: advancedDraft(),
    credentialID: `cred_${uuid()}`,
    rows: [row()],
    busy: false,
    error: "",
    result: "",
    ready: false,
    candidates: [],
    selected: [],
    discoveryWarnings: [],
    discovering: false,
    discoveryError: "",
    api: "openai",
    testing: false,
    testToken: "",
    testResult: "",
    testError: "",
  })

  let discovery: AbortController | undefined
  let test: AbortController | undefined

  const clearTest = () => {
    test?.abort()
    test = undefined
    setStore({ testing: false, testToken: "", testResult: "", testError: "" })
  }

  const target = () =>
    store.original && store.baseURL === store.original.baseURL && !store.key
      ? { mode: "saved" as const, providerID: store.id, revision: store.listing!.revision }
      : { mode: "draft" as const, baseURL: store.baseURL.trim(), key: store.key || undefined }

  const canTest = (item: ReturnType<typeof row>) => {
    const original = store.original?.models[item.id]

    return (
      !!original &&
      store.original?.baseURL === store.baseURL &&
      !store.key &&
      (original.modelID || item.id) === (item.modelID.trim() || item.id.trim())
    )
  }

  const testModel = async (item: ReturnType<typeof row>) => {
    if (!canTest(item) || !store.listing) return
    clearTest()
    const controller = new AbortController()
    test = controller
    setStore({ testing: true, testToken: item.token })
    await sdk.api.experimental.config.providers
      .test(
        {
          target: { mode: "saved", providerID: store.id, revision: store.listing.revision },
          modelID: item.modelID.trim() || item.id.trim(),
          location: location(),
        },
        { signal: controller.signal },
      )
      .then((result) => {
        if (test !== controller || controller.signal.aborted) return

        if (result.status === "success") {
          setStore("testResult", language.t("customProvider.testSuccess"))

          return
        }

        const message = language.t(`customProvider.test.${result.kind}`)
        setStore(
          "testError",
          result.httpStatus
            ? `${message} ${language.t("customProvider.discoveryStatus", { status: result.httpStatus })}`
            : message,
        )
      })
      .catch((error) => {
        if (test === controller && !controller.signal.aborted)
          setStore("testError", formatServerError(error, language.t))
      })
      .finally(() => {
        if (test === controller) {
          test = undefined
          setStore("testing", false)
        }
      })
  }

  const cancelDiscovery = () => {
    discovery?.abort()
    discovery = undefined
    setStore("discovering", false)
  }

  const clearDiscovery = () => {
    cancelDiscovery()
    setStore({ candidates: [], selected: [], discoveryWarnings: [], discoveryError: "" })
  }

  const location = () => ({ directory: props.directory })

  const load = () =>
    sdk.api.experimental.config.providers.list({ location: location() }).then((listing) => {
      setStore("listing", listing)

      return listing
    })

  const select = (entry?: CustomProviderEntry) => {
    clearTest()
    clearDiscovery()
    setStore({
      original: entry,
      advanced: advancedDraft(entry),
      api: "openai",
      view: entry ? "edit" : "create",
      id: entry?.id ?? "",
      name: entry?.name ?? "",
      baseURL: entry?.baseURL ?? "",
      key: "",
      credentialID: `cred_${uuid()}`,
      error: "",
      result: "",
      ready: false,
      rows: entry ? Object.entries(entry.models).map(([id, model]) => row(id, model)) : [row()],
    })
  }

  onMount(() => {
    void load()
      .then((listing) => {
        const entry = listing.providers.find((item) => item.id === props.providerID)

        if (entry) select(entry)
      })
      .catch((error) => setStore("error", formatServerError(error, language.t)))
  })
  onCleanup(() => {
    clearTest()
    cancelDiscovery()
    setStore("key", "")
  })

  const discoverModels = async (metadata = false) => {
    const selected = [...store.selected]

    if (metadata) {
      cancelDiscovery()
      setStore("discoveryError", "")
    }

    if (!metadata) clearDiscovery()
    const controller = new AbortController()
    discovery = controller
    setStore("discovering", true)

    await sdk.api.experimental.config.providers
      .discover(
        {
          target: target(),
          location: location(),
          api: store.api === "openai" ? undefined : store.api,
          metadata: metadata ? selected : undefined,
        },
        { signal: controller.signal },
      )
      .then((result) => {
        if (discovery !== controller || controller.signal.aborted) return

        if (result.status === "error") {
          const message = language.t(`customProvider.discovery.${result.kind}`)
          setStore(
            "discoveryError",
            result.httpStatus
              ? `${message} ${language.t("customProvider.discoveryStatus", { status: result.httpStatus })}`
              : message,
          )

          return
        }

        const updates = new Map(result.models.map((item) => [item.id, item]))

        const candidates = metadata
          ? store.candidates.flatMap((item) => {
              if (!selected.includes(item.id)) return [item]
              const updated = updates.get(item.id)

              return updated ? [updated] : []
            })
          : result.models

        setStore({
          candidates,
          selected: metadata ? store.selected.filter((id) => candidates.some((item) => item.id === id)) : [],
          discoveryWarnings: result.warnings,
        })
      })
      .catch((error) => {
        if (discovery === controller && !controller.signal.aborted)
          setStore("discoveryError", formatServerError(error, language.t))
      })
      .finally(() => {
        if (discovery === controller) {
          discovery = undefined
          setStore("discovering", false)
        }
      })
  }

  const importModels = () => {
    clearTest()
    const rows = store.rows.map((item) => ({ ...item }))
    store.candidates
      .filter((item) => store.selected.includes(item.id))
      .forEach((item) => {
        const match = rows.findIndex((row) => (row.modelID.trim() || row.id.trim()) === item.id)
        const index = match < 0 ? rows.findIndex((row) => !row.id.trim() && !row.modelID.trim()) : match
        const original = index < 0 ? { ...row(item.id), original: "" } : rows[index]

        const imported = {
          ...original,
          id: original.id || item.id,
          name: original.name || item.name || "",
          context: original.context || item.context?.toString() || "",
          input: original.input || item.input?.toString() || "",
          output: original.output || item.output?.toString() || "",
          tools: original.tools === "inherit" && item.tools !== undefined ? String(item.tools) : original.tools,
          image: original.image === "inherit" && item.image !== undefined ? String(item.image) : original.image,
        }

        if (index < 0) {
          rows.push(imported)

          return
        }

        rows[index] = imported
      })
    setStore({ rows, selected: [], ready: false, result: language.t("customProvider.imported") })
  }

  const refresh = async () => {
    const directory = props.directory

    if (!directory) return

    const ref = { directory }
    data.location.integration.invalidate(ref)
    data.location.provider.invalidate(ref)
    data.location.model.invalidate(ref)
    await Promise.all([
      data.location.integration.sync(ref),
      data.location.provider.sync(ref),
      data.location.model.sync(ref),
    ])
  }

  const usable = () =>
    (props.selection ?? local.model)
      .list()
      .find(
        (model) =>
          model.provider.id === store.id &&
          store.rows.some((row) => row.id === model.id) &&
          (props.selection ?? local.model).visible({ providerID: store.id, modelID: model.id }),
      )

  const save = async (event: SubmitEvent) => {
    event.preventDefault()

    if (store.busy || !store.listing) return
    clearTest()
    cancelDiscovery()
    const keys = store.rows.map((item) => item.id.trim())

    if (!keys.length || keys.some((id) => !id) || new Set(keys).size !== keys.length) {
      setStore("error", language.t("customProvider.invalidModels"))

      return
    }

    if (
      store.rows.some((item) =>
        [item.context, item.input, item.output].some(
          (value) =>
            value !== "" && (!/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))),
        ),
      )
    ) {
      setStore("error", language.t("customProvider.invalidLimits"))

      return
    }

    const advanced = await Promise.resolve()
      .then(() => ({
        provider: advancedPatch(store.advanced, advancedDraft(store.original), true),
        models: store.rows.map((item) => {
          const original = store.original?.models[item.id]

          return {
            ...advancedPatch(item.advanced, advancedDraft(original)),
            cost: pricePatch(item.costs, original?.cost),
            variants: original?.variantsReadonly ? undefined : variantPatch(item.variants, original?.variants),
          }
        }),
      }))
      .catch(() => undefined)

    if (!advanced) {
      setStore("error", language.t("customProvider.advanced.invalid"))

      return
    }

    const models: NonNullable<ExperimentalConfigProvidersUpdateInput["patch"]["models"]> = Object.fromEntries([
      ...Object.keys(store.original?.models ?? {})
        .filter((key) => !keys.includes(key))
        .map((key) => [key, null]),
      ...store.rows.map((item, index) => {
        const original = row(item.id, store.original?.models[item.id])

        const fields = Object.fromEntries(
          (["name", "modelID", "context", "input", "output", "tools", "image"] as const).flatMap<
            [string, string | number | boolean | null]
          >((field) => {
            if (item[field] === original[field]) return []
            const value = item[field]

            if (field === "tools" || field === "image") return [[field, value === "inherit" ? null : value === "true"]]

            if (field === "context" || field === "input" || field === "output")
              return [[field, value === "" ? null : Number(value)]]

            return [[field, value.trim() || null]]
          }),
        )

        return [item.id.trim(), { ...fields, ...advanced.models[index] }]
      }),
    ])

    setStore({ busy: true, error: "", result: "" })

    const input: ExperimentalConfigProvidersUpdateInput = {
      providerID: store.id.trim(),
      location: location(),
      mode: store.view === "create" ? "create" : "edit",
      revision: store.listing.revision,
      patch: {
        ...advanced.provider,
        name: store.name === (store.original?.name ?? "") ? undefined : store.name.trim() || null,
        baseURL: store.baseURL === (store.original?.baseURL ?? "") ? undefined : store.baseURL.trim(),
        models,
      },
      credential: store.key ? { id: store.credentialID, key: store.key } : undefined,
    }

    await sdk.api.experimental.config.providers
      .update(input)
      .then(async (saved) => {
        setStore("listing", "revision", saved.revision)
        setStore({
          view: "edit",
          ready: saved.catalog === "ready",
          result: language.t(
            saved.credential === "failed"
              ? "customProvider.keyFailed"
              : saved.catalog === "pending"
                ? "customProvider.pending"
                : "customProvider.saved",
          ),
        })

        if (saved.credential !== "failed") setStore("key", "")
        const listing = await load()
        const original = listing.providers.find((item) => item.id === input.providerID)
        setStore("advanced", advancedDraft(original))
        store.rows.forEach((item, index) => {
          const model = original?.models[item.id]
          setStore("rows", index, {
            advanced: advancedDraft(model),
            costs: model?.cost?.map(priceRow) ?? [],
            variants: model?.variants?.map(variantRow) ?? [],
          })
        })
        setStore("original", original)
        await refresh()
      })
      .catch((error) => setStore("error", formatServerError(error, language.t)))
      .finally(() => setStore("busy", false))
  }

  const removeCredential = async (id: string) => {
    if (store.busy) return
    clearTest()
    setStore("busy", true)
    await sdk.api.credential
      .remove({ credentialID: id })
      .then(load)
      .then((listing) => {
        setStore(
          "original",
          listing.providers.find((item) => item.id === store.id),
        )

        return refresh()
      })
      .catch((error) => setStore("error", formatServerError(error, language.t)))
      .finally(() => setStore("busy", false))
  }

  return (
    <Dialog fit containerClass="!w-[min(calc(100vw_-_24px),760px)]">
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("customProvider.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex min-h-0 flex-col gap-4 max-h-[80dvh] overflow-y-auto" data-scrollable>
        <p class="text-13 leading-5 text-v2-text-text-muted">
          {language.t("customProvider.scope", { server: sdk.url })}
        </p>
        <Show when={store.error}>
          <p role="alert">{store.error}</p>
        </Show>
        <Show when={store.result}>
          <p role="status">{store.result}</p>
        </Show>
        <Show when={store.listing} fallback={<p>{language.t("customProvider.loading")}</p>}>
          <Show
            when={store.view === "list"}
            fallback={
              <form onSubmit={save} onInput={clearTest} onChange={clearTest} class="flex flex-col gap-4">
                <fieldset disabled={store.busy || !!store.original?.reason} class="flex flex-col gap-4">
                  <Show when={store.original?.reason}>
                    <p>{language.t("customProvider.readonly", { reason: store.original?.reason ?? "" })}</p>
                  </Show>
                  <TextField
                    label={language.t("customProvider.id")}
                    value={store.id}
                    required
                    readOnly={store.view === "edit"}
                    onChange={(value) => setStore("id", value)}
                  />
                  <TextField
                    label={language.t("customProvider.name")}
                    value={store.name}
                    onChange={(value) => setStore("name", value)}
                  />
                  <TextField
                    label={language.t("customProvider.url")}
                    value={store.baseURL}
                    required
                    placeholder="http://127.0.0.1:8080/v1"
                    onChange={(value) => {
                      clearDiscovery()
                      setStore({ baseURL: value, key: "", credentialID: `cred_${uuid()}` })
                    }}
                  />
                  <p>{language.t("customProvider.localhost")}</p>
                  <TextField
                    label={language.t("customProvider.key")}
                    type="password"
                    autocomplete="new-password"
                    disabled={store.original?.keyReadonly}
                    value={store.key}
                    onChange={(value) => {
                      clearDiscovery()
                      setStore({ key: value, credentialID: `cred_${uuid()}` })
                    }}
                    description={language.t(
                      store.original?.keyReadonly ? "customProvider.keyReadonly" : "customProvider.keyHelp",
                    )}
                  />
                  <Show when={store.original?.keySources.length}>
                    <p>
                      {language.t("customProvider.keySources", {
                        sources: store.original?.keySources.join(", ") ?? "",
                      })}
                    </p>
                  </Show>
                  <div class="flex flex-col gap-2">
                    <label class="flex flex-col gap-2">
                      {language.t("customProvider.discoveryAPI")}
                      <select
                        value={store.api}
                        disabled={store.discovering}
                        onChange={(event) => {
                          clearDiscovery()

                          const api = (["openai", "ollama", "lmstudio"] as const).find(
                            (api) => api === event.currentTarget.value,
                          )

                          if (api) setStore("api", api)
                        }}
                        class="rounded border border-v2-border-border-base p-2 bg-v2-surface-surface-base"
                      >
                        <option value="openai">{language.t("customProvider.api.openai")}</option>
                        <option value="ollama">{language.t("customProvider.api.ollama")}</option>
                        <option value="lmstudio">{language.t("customProvider.api.lmstudio")}</option>
                      </select>
                    </label>
                    <p>{language.t("customProvider.discoveryHelp")}</p>
                    <Show when={store.api !== "openai"}>
                      <p>{language.t("customProvider.nativeHelp")}</p>
                    </Show>
                    <Show
                      when={store.discovering}
                      fallback={
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!store.baseURL.trim()}
                          onClick={() => void discoverModels()}
                        >
                          {language.t("customProvider.discover")}
                        </Button>
                      }
                    >
                      <Button type="button" variant="ghost" onClick={cancelDiscovery}>
                        {language.t("customProvider.cancelDiscovery")}
                      </Button>
                    </Show>
                    <Show when={store.discoveryError}>
                      <p role="alert">{store.discoveryError}</p>
                    </Show>
                    <Show when={store.api === "ollama" && store.candidates.length}>
                      <p>{language.t("customProvider.metadataHelp")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={store.discovering || !store.selected.length || store.selected.length > 20}
                        onClick={() => void discoverModels(true)}
                      >
                        {language.t("customProvider.readMetadata")}
                      </Button>
                    </Show>
                    <For each={store.discoveryWarnings}>
                      {(warning) => <p>{language.t(`customProvider.warning.${warning}`)}</p>}
                    </For>
                    <Show when={store.candidates.length}>
                      <fieldset class="max-h-64 overflow-y-auto rounded border border-v2-border-border-base p-3 flex flex-col gap-3">
                        <legend>{language.t("customProvider.discovered")}</legend>
                        <For each={store.candidates}>
                          {(item) => (
                            <div>
                              <label class="flex gap-2 items-center">
                                <input
                                  type="checkbox"
                                  aria-label={item.id}
                                  checked={store.selected.includes(item.id)}
                                  onChange={(event) =>
                                    setStore(
                                      "selected",
                                      event.currentTarget.checked
                                        ? [...store.selected, item.id]
                                        : store.selected.filter((id) => id !== item.id),
                                    )
                                  }
                                />
                                {item.id}
                              </label>
                              <Show when={item.name}>
                                <p>{item.name}</p>
                              </Show>
                              <p
                                title={Object.entries(item.sources)
                                  .map(([field, source]) => `${field}: ${source}`)
                                  .join("; ")}
                              >
                                {language.t("customProvider.discoveredLimits", {
                                  context: item.context ?? "?",
                                  input: item.input ?? "?",
                                  output: item.output ?? "?",
                                })}
                              </p>
                              <Show when={item.maxContext !== undefined}>
                                <p>
                                  {language.t("customProvider.maximumContext", { context: item.maxContext ?? "?" })}
                                </p>
                              </Show>
                              <Show when={item.loaded !== undefined}>
                                <p>{language.t(item.loaded ? "customProvider.loaded" : "customProvider.notLoaded")}</p>
                              </Show>
                              <Show when={item.tools !== undefined || item.image !== undefined}>
                                <p>
                                  {language.t("customProvider.declaredCapabilities", {
                                    tools: language.t(
                                      item.tools === undefined
                                        ? "customProvider.unknown"
                                        : item.tools
                                          ? "customProvider.yes"
                                          : "customProvider.no",
                                    ),
                                    image: language.t(
                                      item.image === undefined
                                        ? "customProvider.unknown"
                                        : item.image
                                          ? "customProvider.yes"
                                          : "customProvider.no",
                                    ),
                                  })}
                                </p>
                              </Show>
                              <Show when={item.metadataPending}>
                                <p>{language.t("customProvider.metadataPending")}</p>
                              </Show>
                              <For each={item.warnings}>
                                {(warning) => <p>{language.t(`customProvider.warning.${warning}`)}</p>}
                              </For>
                            </div>
                          )}
                        </For>
                      </fieldset>
                      <Button type="button" variant="outline" disabled={!store.selected.length} onClick={importModels}>
                        {language.t("customProvider.import")}
                      </Button>
                    </Show>
                  </div>
                  <p>{language.t("customProvider.defaults")}</p>
                  <details class="flex flex-col gap-3">
                    <summary>{language.t("customProvider.advanced.provider")}</summary>
                    <p>{language.t("customProvider.advanced.help")}</p>
                    <AdvancedFields
                      provider
                      value={store.advanced}
                      onChange={(key, value) => setStore("advanced", key, value)}
                    />
                  </details>
                  <p>{language.t("customProvider.testHelp")}</p>
                  <For each={store.rows}>
                    {(item, index) => (
                      <fieldset class="flex flex-col gap-3 rounded-md border border-v2-border-border-base p-3">
                        <legend>{language.t("customProvider.model", { index: index() + 1 })}</legend>
                        <div class="grid gap-3 sm:grid-cols-2">
                          <TextField
                            label={language.t("customProvider.modelKey")}
                            value={item.id}
                            required
                            readOnly={!!item.original}
                            onChange={(value) => setStore("rows", index(), "id", value)}
                          />
                          <TextField
                            label={language.t("customProvider.modelID")}
                            value={item.modelID}
                            onChange={(value) => setStore("rows", index(), "modelID", value)}
                          />
                          <TextField
                            label={language.t("customProvider.modelName")}
                            value={item.name}
                            onChange={(value) => setStore("rows", index(), "name", value)}
                          />
                          <For each={["context", "input", "output"] as const}>
                            {(field) => (
                              <TextField
                                label={language.t(`customProvider.${field}`)}
                                inputmode="numeric"
                                value={item[field]}
                                onChange={(value) => setStore("rows", index(), field, value)}
                              />
                            )}
                          </For>
                          <For each={["tools", "image"] as const}>
                            {(field) => (
                              <label class="flex flex-col gap-2">
                                {language.t(`customProvider.${field}`)}
                                <select
                                  value={item[field]}
                                  onChange={(event) => setStore("rows", index(), field, event.currentTarget.value)}
                                  class="rounded border border-v2-border-border-base p-2 bg-v2-surface-surface-base"
                                >
                                  <option value="inherit">{language.t("customProvider.inherit")}</option>
                                  <option value="true">{language.t("customProvider.yes")}</option>
                                  <option value="false">{language.t("customProvider.no")}</option>
                                </select>
                              </label>
                            )}
                          </For>
                        </div>
                        <Show when={item.tools === "false"}>
                          <p>{language.t("customProvider.noTools")}</p>
                        </Show>
                        <details class="flex flex-col gap-3">
                          <summary>{language.t("customProvider.advanced.model")}</summary>
                          <fieldset class="flex flex-col gap-3">
                            <legend>{language.t("customProvider.advanced.modelRequest")}</legend>
                            <AdvancedFields
                              value={item.advanced}
                              onChange={(key, value) => setStore("rows", index(), "advanced", key, value)}
                            />
                          </fieldset>
                          <PriceFields
                            rows={item.costs}
                            onChange={(rows) => setStore("rows", index(), "costs", rows)}
                          />
                          <VariantFields
                            rows={item.variants}
                            readonly={store.original?.models[item.id]?.variantsReadonly}
                            onChange={(rows) => setStore("rows", index(), "variants", rows)}
                          />
                        </details>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={store.testing || !canTest(item)}
                          onClick={() => void testModel(item)}
                        >
                          {language.t("customProvider.testText")}
                        </Button>
                        <Show when={store.testToken === item.token}>
                          <Show when={store.testing}>
                            <Button type="button" variant="ghost" onClick={clearTest}>
                              {language.t("customProvider.cancelTest")}
                            </Button>
                          </Show>
                          <Show when={store.testResult}>
                            <p role="status">{store.testResult}</p>
                          </Show>
                          <Show when={store.testError}>
                            <p role="alert">{store.testError}</p>
                          </Show>
                        </Show>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            clearTest()
                            setStore(
                              "rows",
                              store.rows.filter((entry) => entry.token !== item.token),
                            )
                          }}
                        >
                          {language.t("customProvider.removeModel")}
                        </Button>
                      </fieldset>
                    )}
                  </For>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      clearTest()
                      setStore("rows", [...store.rows, row()])
                    }}
                  >
                    {language.t("customProvider.addModel")}
                  </Button>
                  <p>
                    {language.t("customProvider.target", {
                      path: store.original?.sources[0] ?? store.listing?.target ?? "",
                    })}
                  </p>
                  <Show when={store.original && store.baseURL !== store.original.baseURL}>
                    <p>{language.t("customProvider.urlChange")}</p>
                  </Show>
                  <Button type="submit" disabled={!store.id.trim() || !store.baseURL.trim() || !store.rows.length}>
                    {language.t(store.busy ? "customProvider.saving" : "customProvider.save")}
                  </Button>
                </fieldset>
                <Show when={store.original?.credentials.length}>
                  <p>{language.t("customProvider.deleteHelp")}</p>
                  <For each={store.original?.credentials}>
                    {(credential) => (
                      <div class="flex items-center justify-between gap-3">
                        <span>
                          {credential.label} ·{" "}
                          {language.t(credential.active ? "customProvider.active" : "customProvider.inactive")}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={store.busy || !!store.original?.reason}
                          onClick={() => void removeCredential(credential.id)}
                        >
                          {language.t("customProvider.deleteKey")}
                        </Button>
                      </div>
                    )}
                  </For>
                </Show>
                <Show when={store.ready && usable()}>
                  <Button
                    type="button"
                    onClick={() => {
                      const model = usable()

                      if (!model) return
                      ;(props.selection ?? local.model).set(
                        { providerID: store.id, modelID: model.id },
                        { recent: true },
                      )
                      dialog.close()
                    }}
                  >
                    {language.t("customProvider.useModel")}
                  </Button>
                </Show>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={store.busy}
                  onClick={() => {
                    clearTest()
                    setStore({ view: "list", key: "", result: "", error: "" })
                    void load()
                  }}
                >
                  {language.t("customProvider.back")}
                </Button>
              </form>
            }
          >
            <Show when={store.listing?.reason}>
              <p role="alert">{language.t("customProvider.readonly", { reason: store.listing?.reason ?? "" })}</p>
            </Show>
            <Button disabled={!!store.listing?.reason} onClick={() => select()}>
              {language.t("customProvider.add")}
            </Button>
            <For each={store.listing?.providers}>
              {(entry) => (
                <div class="flex items-center justify-between gap-3 rounded border border-v2-border-border-base p-3">
                  <div>
                    <p>{entry.name}</p>
                    <p class="text-v2-text-text-muted">{entry.id}</p>
                    <Show when={entry.reason}>
                      <p>{language.t("customProvider.readonly", { reason: entry.reason ?? "" })}</p>
                    </Show>
                  </div>
                  <Button variant="outline" onClick={() => select(entry)}>
                    {language.t(entry.reason ? "customProvider.view" : "customProvider.edit")}
                  </Button>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </DialogBody>
    </Dialog>
  )
}
