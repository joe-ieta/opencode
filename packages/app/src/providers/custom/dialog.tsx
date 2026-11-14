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
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
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
import "./custom.css"

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

  const reasonKeys = {
    "invalid-config": "customProvider.reason.invalidConfig",
    "multiple-sources": "customProvider.reason.multipleSources",
    "legacy-provider": "customProvider.reason.legacyProvider",
    "readonly-source": "customProvider.reason.readonlySource",
    "built-in-provider": "customProvider.reason.builtInProvider",
    "unsupported-provider": "customProvider.reason.unsupportedProvider",
  } as const

  const readonlyReason = (reason: string) => {
    const key = reasonKeys[reason as keyof typeof reasonKeys]

    return key ? language.t(key) : reason
  }

  const readonlyMessage = (reason: string) =>
    reason === "legacy-provider"
      ? language.t("customProvider.readonlyLegacy")
      : language.t("customProvider.readonly", { reason: readonlyReason(reason) })

  const canDelete = (entry?: CustomProviderEntry) => !!entry && (!entry.reason || entry.reason === "legacy-provider")

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
    confirmDelete: boolean
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
    confirmDelete: false,
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
      confirmDelete: false,
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

    const models: NonNullable<NonNullable<ExperimentalConfigProvidersUpdateInput["patch"]>["models"]> =
      Object.fromEntries([
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

  const removeProvider = async () => {
    if (store.busy || !store.listing || !store.original) return
    clearTest()
    clearDiscovery()
    setStore({ busy: true, error: "", result: "" })
    await sdk.api.experimental.config.providers
      .update({
        providerID: store.id,
        location: location(),
        mode: "delete",
        revision: store.listing.revision,
      })
      .then(async (saved) => {
        if (saved.config !== "deleted") return
        setStore({
          view: "list",
          confirmDelete: false,
          original: undefined,
          key: "",
          result: language.t(
            saved.credential === "failed"
              ? "customProvider.deletedKeyFailed"
              : "customProvider.deleted",
          ),
        })
        await load()
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

  const backToList = () => {
    clearTest()
    clearDiscovery()
    setStore({ view: "list", key: "", result: "", error: "", confirmDelete: false })
    void load()
  }

  return (
    <Dialog fit class="custom-provider-dialog" containerClass="!w-[min(calc(100vw_-_24px),720px)]">
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("customProvider.title")}</DialogTitle>
        <Show when={store.view !== "list"}>
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            {language.t("customProvider.backToPicker")}
          </Button>
        </Show>
      </DialogHeader>
      <DialogBody class="custom-provider-body max-h-[min(78dvh,760px)]">
        <Show when={store.error}>
          <p role="alert" class="custom-provider-alert">
            {store.error}
          </p>
        </Show>
        <Show when={store.result}>
          <p role="status" class="custom-provider-status">
            {store.result}
          </p>
        </Show>
        <Show when={store.listing} fallback={<p class="custom-provider-empty">{language.t("customProvider.loading")}</p>}>
          <Show
            when={store.view === "list"}
            fallback={
              <form
                id="custom-provider-form"
                onSubmit={save}
                onInput={clearTest}
                onChange={clearTest}
                class="custom-provider-section"
              >
                <fieldset disabled={store.busy || !!store.original?.reason} class="flex flex-col gap-3">
                  <Show when={store.original?.reason}>
                    <p role="alert" class="custom-provider-alert">
                      {readonlyMessage(store.original?.reason ?? "")}
                    </p>
                  </Show>

                  <section class="custom-provider-section">
                    <div class="custom-provider-section-head">
                      <h3 class="custom-provider-section-title">{language.t("customProvider.section.provider")}</h3>
                      <span class="custom-provider-hint">
                        {language.t("customProvider.scope", { server: sdk.url })}
                      </span>
                    </div>
                    <div class="custom-provider-grid">
                      <TextField
                        label={language.t("customProvider.id")}
                        value={store.id}
                        required
                        readOnly={store.view === "edit"}
                        placeholder="local-vllm"
                        onChange={(value) => setStore("id", value)}
                      />
                      <TextField
                        label={language.t("customProvider.name")}
                        value={store.name}
                        placeholder={language.t("customProvider.optional")}
                        onChange={(value) => setStore("name", value)}
                      />
                      <div class="span-2">
                        <TextField
                          label={language.t("customProvider.url")}
                          value={store.baseURL}
                          required
                          placeholder="http://127.0.0.1:8080/v1"
                          title={language.t("customProvider.localhost")}
                          onChange={(value) => {
                            clearDiscovery()
                            setStore({ baseURL: value, key: "", credentialID: `cred_${uuid()}` })
                          }}
                        />
                      </div>
                      <div class="span-2">
                        <TextField
                          label={language.t("customProvider.key")}
                          type="password"
                          autocomplete="new-password"
                          disabled={store.original?.keyReadonly}
                          value={store.key}
                          placeholder={language.t(
                            store.original?.keyReadonly
                              ? "customProvider.keyReadonly"
                              : "customProvider.keyPlaceholder",
                          )}
                          onChange={(value) => {
                            clearDiscovery()
                            setStore({ key: value, credentialID: `cred_${uuid()}` })
                          }}
                        />
                      </div>
                    </div>
                    <Show when={store.original?.keySources.length}>
                      <p class="custom-provider-hint">
                        {language.t("customProvider.keySources", {
                          sources: store.original?.keySources.join(", ") ?? "",
                        })}
                      </p>
                    </Show>
                  </section>

                  <section class="custom-provider-section">
                    <div class="custom-provider-section-head">
                      <h3 class="custom-provider-section-title">{language.t("customProvider.section.discovery")}</h3>
                    </div>
                    <div class="flex flex-col gap-2">
                      <div class="custom-provider-grid">
                        <label class="flex flex-col gap-1.5 text-[12px] font-[440] leading-[18px] text-v2-text-text-muted">
                          {language.t("customProvider.discoveryAPI")}
                          <select
                            value={store.api}
                            disabled={store.discovering}
                            title={
                              store.api === "openai"
                                ? language.t("customProvider.discoveryHelp")
                                : language.t("customProvider.nativeHelp")
                            }
                            onChange={(event) => {
                              clearDiscovery()

                              const api = (["openai", "ollama", "lmstudio"] as const).find(
                                (api) => api === event.currentTarget.value,
                              )

                              if (api) setStore("api", api)
                            }}
                            class="h-8 rounded border border-v2-border-border-base bg-v2-surface-surface-base px-2 text-[13px] text-v2-text-text-base"
                          >
                            <option value="openai">{language.t("customProvider.api.openai")}</option>
                            <option value="ollama">{language.t("customProvider.api.ollama")}</option>
                            <option value="lmstudio">{language.t("customProvider.api.lmstudio")}</option>
                          </select>
                        </label>
                        <div class="flex items-end">
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
                        </div>
                      </div>
                      <p class="custom-provider-hint">{language.t("customProvider.discoveryHint")}</p>
                      <Show when={store.discoveryError}>
                        <p role="alert" class="custom-provider-alert">
                          {store.discoveryError}
                        </p>
                      </Show>
                      <Show when={store.api === "ollama" && store.candidates.length}>
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="custom-provider-hint">{language.t("customProvider.metadataHelp")}</p>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={store.discovering || !store.selected.length || store.selected.length > 20}
                            onClick={() => void discoverModels(true)}
                          >
                            {language.t("customProvider.readMetadata")}
                          </Button>
                        </div>
                      </Show>
                      <For each={store.discoveryWarnings}>
                        {(warning) => (
                          <p class="custom-provider-hint">{language.t(`customProvider.warning.${warning}`)}</p>
                        )}
                      </For>
                      <Show when={store.candidates.length}>
                        <fieldset class="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-v2-border-border-base p-3">
                          <legend class="px-1 text-[12px] text-v2-text-text-muted">
                            {language.t("customProvider.discovered")}
                          </legend>
                          <For each={store.candidates}>
                            {(item) => (
                              <label class="flex items-start gap-2 text-[13px] leading-5">
                                <input
                                  type="checkbox"
                                  class="mt-1"
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
                                <span class="min-w-0">
                                  <span class="block truncate">{item.id}</span>
                                  <span class="custom-provider-hint">
                                    {language.t("customProvider.discoveredLimits", {
                                      context: item.context ?? "?",
                                      input: item.input ?? "?",
                                      output: item.output ?? "?",
                                    })}
                                  </span>
                                </span>
                              </label>
                            )}
                          </For>
                        </fieldset>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!store.selected.length}
                          onClick={importModels}
                        >
                          {language.t("customProvider.import")}
                        </Button>
                      </Show>
                    </div>
                  </section>

                  <section class="custom-provider-section">
                    <div class="custom-provider-section-head">
                      <h3 class="custom-provider-section-title">{language.t("customProvider.section.models")}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        icon="plus"
                        onClick={() => {
                          clearTest()
                          setStore("rows", [...store.rows, row()])
                        }}
                      >
                        {language.t("customProvider.addModel")}
                      </Button>
                    </div>
                    <p class="custom-provider-hint">{language.t("customProvider.defaultsShort")}</p>
                    <p class="custom-provider-hint">{language.t("customProvider.testHint")}</p>
                    <For each={store.rows}>
                      {(item, index) => (
                        <fieldset class="custom-provider-model">
                          <legend class="sr-only">
                            {language.t("customProvider.model", { index: index() + 1 })}
                          </legend>
                          <div class="custom-provider-model-head">
                            <span class="custom-provider-model-title">
                              {language.t("customProvider.model", { index: index() + 1 })}
                            </span>
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
                          </div>
                          <div class="custom-provider-grid">
                            <TextField
                              label={language.t("customProvider.modelKey")}
                              value={item.id}
                              required
                              readOnly={!!item.original}
                              placeholder="model-name"
                              onChange={(value) => setStore("rows", index(), "id", value)}
                            />
                            <TextField
                              label={language.t("customProvider.modelID")}
                              value={item.modelID}
                              placeholder={language.t("customProvider.optional")}
                              onChange={(value) => setStore("rows", index(), "modelID", value)}
                            />
                            <TextField
                              label={language.t("customProvider.modelName")}
                              value={item.name}
                              placeholder={language.t("customProvider.optional")}
                              onChange={(value) => setStore("rows", index(), "name", value)}
                            />
                            <For each={["context", "input", "output"] as const}>
                              {(field) => (
                                <TextField
                                  label={language.t(`customProvider.${field}`)}
                                  inputmode="numeric"
                                  value={item[field]}
                                  placeholder={language.t("customProvider.auto")}
                                  onChange={(value) => setStore("rows", index(), field, value)}
                                />
                              )}
                            </For>
                            <For each={["tools", "image"] as const}>
                              {(field) => (
                                <label class="flex flex-col gap-1.5 text-[12px] font-[440] leading-[18px] text-v2-text-text-muted">
                                  {language.t(`customProvider.${field}`)}
                                  <select
                                    value={item[field]}
                                    onChange={(event) => setStore("rows", index(), field, event.currentTarget.value)}
                                    class="h-8 rounded border border-v2-border-border-base bg-v2-surface-surface-base px-2 text-[13px] text-v2-text-text-base"
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
                            <p class="custom-provider-hint">{language.t("customProvider.noTools")}</p>
                          </Show>
                          <div class="custom-provider-model-actions">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={store.testing || !canTest(item)}
                              title={language.t("customProvider.testHelp")}
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
                                <span role="status" class="custom-provider-hint">
                                  {store.testResult}
                                </span>
                              </Show>
                              <Show when={store.testError}>
                                <span role="alert" class="custom-provider-hint">
                                  {store.testError}
                                </span>
                              </Show>
                            </Show>
                          </div>
                          <details class="custom-provider-disclosure">
                            <summary>{language.t("customProvider.advanced.model")}</summary>
                            <div class="mt-2 flex flex-col gap-3">
                              <fieldset class="flex flex-col gap-3">
                                <legend class="custom-provider-hint">
                                  {language.t("customProvider.advanced.modelRequest")}
                                </legend>
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
                            </div>
                          </details>
                        </fieldset>
                      )}
                    </For>
                  </section>

                  <details class="custom-provider-disclosure">
                    <summary>{language.t("customProvider.advanced.provider")}</summary>
                    <div class="mt-2 flex flex-col gap-2">
                      <p class="custom-provider-hint">{language.t("customProvider.advanced.help")}</p>
                      <AdvancedFields
                        provider
                        value={store.advanced}
                        onChange={(key, value) => setStore("advanced", key, value)}
                      />
                    </div>
                  </details>

                  <Show when={store.original?.credentials.length}>
                    <details class="custom-provider-disclosure">
                      <summary>{language.t("customProvider.section.credentials")}</summary>
                      <div class="mt-2 flex flex-col gap-2">
                        <p class="custom-provider-hint">{language.t("customProvider.deleteHelp")}</p>
                        <For each={store.original?.credentials}>
                          {(credential) => (
                            <div class="flex items-center justify-between gap-3 text-[13px]">
                              <span>
                                {credential.label} ·{" "}
                                {language.t(
                                  credential.active ? "customProvider.active" : "customProvider.inactive",
                                )}
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
                      </div>
                    </details>
                  </Show>

                  <p class="custom-provider-hint">
                    {language.t("customProvider.target", {
                      path: store.original?.sources[0] ?? store.listing?.target ?? "",
                    })}
                  </p>
                  <Show when={store.original && store.baseURL !== store.original.baseURL}>
                    <p class="custom-provider-hint">{language.t("customProvider.urlChange")}</p>
                  </Show>
                  <Show when={store.ready && usable()}>
                    <Button
                      type="button"
                      variant="outline"
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
                  <Show when={store.confirmDelete}>
                    <p role="alert" class="custom-provider-alert">
                      {language.t("customProvider.deleteConfirm")}
                    </p>
                  </Show>
                </fieldset>
              </form>
            }
          >
            <div class="custom-provider-section">
              <Show when={store.listing?.reason}>
                <p role="alert" class="custom-provider-alert">
                  {readonlyMessage(store.listing?.reason ?? "")}
                </p>
              </Show>
              <Show
                when={store.listing?.providers.length}
                fallback={<p class="custom-provider-empty">{language.t("customProvider.empty")}</p>}
              >
                <div class="custom-provider-list">
                  <For each={store.listing?.providers}>
                    {(entry) => (
                      <div class="custom-provider-provider">
                        <div class="min-w-0">
                          <p class="custom-provider-provider-name">{entry.name}</p>
                          <p class="custom-provider-provider-id">{entry.id}</p>
                          <Show when={entry.reason}>
                            <p class="custom-provider-hint">
                              {readonlyMessage(entry.reason ?? "")}
                            </p>
                          </Show>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <Show when={canDelete(entry)}>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                select(entry)
                                setStore("confirmDelete", true)
                              }}
                            >
                              {language.t("customProvider.delete")}
                            </Button>
                          </Show>
                          <Button variant="outline" onClick={() => select(entry)}>
                            {language.t(entry.reason ? "customProvider.view" : "customProvider.edit")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </DialogBody>
      <DialogFooter>
        <div class="custom-provider-footer">
          <Show
            when={store.view === "list"}
            fallback={
              <>
                <Button type="button" variant="ghost" onClick={backToList}>
                  {language.t("customProvider.back")}
                </Button>
                <div class="custom-provider-footer-grow" />
                <Show
                  when={store.confirmDelete}
                  fallback={
                    <>
                      <Show when={store.original}>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={store.busy || !canDelete(store.original)}
                          onClick={() => setStore("confirmDelete", true)}
                        >
                          {language.t("customProvider.delete")}
                        </Button>
                      </Show>
                      <Button
                        type="submit"
                        form="custom-provider-form"
                        disabled={
                          store.busy ||
                          !!store.original?.reason ||
                          !store.id.trim() ||
                          !store.baseURL.trim() ||
                          !store.rows.length
                        }
                      >
                        {language.t(store.busy ? "customProvider.saving" : "customProvider.save")}
                      </Button>
                    </>
                  }
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={store.busy}
                    onClick={() => void removeProvider()}
                  >
                    {language.t("customProvider.deleteConfirmAction")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setStore("confirmDelete", false)}>
                    {language.t("common.cancel")}
                  </Button>
                </Show>
              </>
            }
          >
            <Button type="button" variant="ghost" onClick={() => dialog.close()}>
              {language.t("customProvider.backToPicker")}
            </Button>
            <div class="custom-provider-footer-grow" />
            <Button type="button" disabled={!store.listing || !!store.listing.reason} onClick={() => select()}>
              {language.t("customProvider.add")}
            </Button>
          </Show>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
