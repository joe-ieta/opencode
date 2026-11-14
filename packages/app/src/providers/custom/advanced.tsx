import { For, Show } from "solid-js"
import { Schema } from "effect"
import { CustomProviderAdvanced } from "@opencode/schema/custom-provider-advanced"
import { Button } from "@opencode/ui/button"
import { TextField } from "@opencode/ui/text-field"
import { useLanguage } from "@/runtime/i18n/language"
import { uuid } from "@opencode/util/uuid"

const fields = [
  { group: "settings", key: "reasoningEffort", options: [] },
  { group: "settings", key: "textVerbosity", options: ["low", "medium", "high"] },
  { group: "settings", key: "parallelToolCalls", options: ["true", "false"] },
  { group: "settings", key: "encoding", options: ["none", "gzip", "zstd"] },
  { group: "settings", key: "timeout", options: [] },
  { group: "settings", key: "headerTimeout", options: [] },
  { group: "settings", key: "chunkTimeout", options: [] },
  { group: "compatibility", key: "reasoningField", options: [] },
  { group: "compatibility", key: "maxTokensField", options: ["max_tokens", "max_completion_tokens"] },
  { group: "compatibility", key: "requireReasoning", options: ["true", "false"] },
  { group: "compatibility", key: "requireFinishReason", options: ["true", "false"] },
  { group: "compatibility", key: "requireAssistantAfterTool", options: ["true", "false"] },
  { group: "compatibility", key: "supportsPromptCacheKey", options: ["true", "false"] },
  { group: "compatibility", key: "streamUsage", options: ["true", "false"] },
  { group: "compatibility", key: "cacheFormat", options: ["anthropic", "alibaba"] },
] as const

type Draft = Record<string, string>

type Source = {
  settings?: CustomProviderAdvanced.ProviderSettings
  compatibility?: CustomProviderAdvanced.Compatibility
}

const timeouts = new Set<string>(["timeout", "headerTimeout", "chunkTimeout"])

export function advancedDraft(source?: Source): Draft {
  return Object.fromEntries(
    fields.map((field) => {
      const value = field.group === "settings" ? source?.settings?.[field.key] : source?.compatibility?.[field.key]

      return [`${field.group}.${field.key}`, value === undefined ? "" : String(value)]
    }),
  )
}

export function advancedPatch(value: Draft, original: Draft, provider = false, variant = false) {
  const changed = fields
    .filter((field) => (provider || !timeouts.has(field.key)) && (!variant || field.group === "settings"))
    .flatMap((field) => {
      const key = `${field.group}.${field.key}`

      if (value[key] === original[key]) return []
      const text = value[key]?.trim() ?? ""

      const parsed =
        text === ""
          ? null
          : timeouts.has(field.key)
            ? text === "false"
              ? false
              : Number(text)
            : field.options.some((option) => option === "true")
              ? text === "true"
              : text

      return [[field.group, field.key, parsed] as const]
    })

  const settings = Object.fromEntries(
    changed.flatMap(([group, key, value]) => (group === "settings" ? [[key, value]] : [])),
  )

  const compatibility = Object.fromEntries(
    changed.flatMap(([group, key, value]) => (group === "compatibility" ? [[key, value]] : [])),
  )

  return {
    settings: Object.keys(settings).length
      ? Schema.decodeUnknownSync(
          provider ? CustomProviderAdvanced.ProviderSettingsPatch : CustomProviderAdvanced.SettingsPatch,
        )(settings, { onExcessProperty: "error" })
      : undefined,
    compatibility: Object.keys(compatibility).length
      ? Schema.decodeUnknownSync(CustomProviderAdvanced.CompatibilityPatch)(compatibility, {
          onExcessProperty: "error",
        })
      : undefined,
  }
}

export function AdvancedFields(props: {
  value: Draft
  onChange: (key: string, value: string) => void
  provider?: boolean
  variant?: boolean
}) {
  const language = useLanguage()

  const optionLabel = (value: string) => {
    if (value === "true") return language.t("customProvider.advanced.yes")

    if (value === "false") return language.t("customProvider.advanced.no")

    return value
  }

  return (
    <div class="grid gap-3 sm:grid-cols-2">
      <For
        each={fields.filter(
          (field) => (props.provider || !timeouts.has(field.key)) && (!props.variant || field.group === "settings"),
        )}
      >
        {(field) => (
          <Show
            when={field.options.length}
            fallback={
              <TextField
                label={language.t(`customProvider.advanced.${field.key}`)}
                value={props.value[`${field.group}.${field.key}`] ?? ""}
                onChange={(value) => props.onChange(`${field.group}.${field.key}`, value)}
                placeholder={timeouts.has(field.key) ? language.t("customProvider.advanced.timeoutHint") : undefined}
              />
            }
          >
            <label class="flex flex-col gap-2">
              {language.t(`customProvider.advanced.${field.key}`)}
              <select
                class="rounded border border-v2-border-border-base p-2 bg-v2-surface-surface-base"
                value={props.value[`${field.group}.${field.key}`] ?? ""}
                onChange={(event) => props.onChange(`${field.group}.${field.key}`, event.currentTarget.value)}
              >
                <option value="">{language.t("customProvider.advanced.inherit")}</option>
                <For each={field.options}>{(option) => <option value={option}>{optionLabel(option)}</option>}</For>
              </select>
            </label>
          </Show>
        )}
      </For>
    </div>
  )
}

export function priceRow(value?: CustomProviderAdvanced.Cost, index?: number) {
  return {
    token: uuid(),
    index,
    input: value?.input.toString() ?? "",
    output: value?.output.toString() ?? "",
    cacheRead: value?.cacheRead?.toString() ?? "",
    cacheWrite: value?.cacheWrite?.toString() ?? "",
    tierSize: value?.tierSize?.toString() ?? "",
  }
}

const priceFields = ["input", "output", "cacheRead", "cacheWrite", "tierSize"] as const

export function pricePatch(rows: ReturnType<typeof priceRow>[], original: readonly CustomProviderAdvanced.Cost[] = []) {
  const next = { index: original.length }

  const patch = Object.fromEntries([
    ...original.flatMap((_, index) => (rows.some((row) => row.index === index) ? [] : [[String(index), null]])),
    ...rows.flatMap((row) => {
      if (!row.input.trim() || !row.output.trim()) throw new Error("invalid-price")
      const before = row.index === undefined ? priceRow() : priceRow(original[row.index])

      const change = Object.fromEntries(
        priceFields.flatMap((key) =>
          row[key] === before[key] ? [] : [[key, row[key].trim() ? Number(row[key]) : null]],
        ),
      )

      if (row.index !== undefined && !Object.keys(change).length) return []

      return [[String(row.index ?? next.index++), change]]
    }),
  ])

  if (!Object.keys(patch).length) return undefined

  if (new Set(rows.map((row) => (row.tierSize.trim() ? Number(row.tierSize) : "default"))).size !== rows.length)
    throw new Error("duplicate-price-tiers")

  return Schema.decodeUnknownSync(CustomProviderAdvanced.CostsPatch)(patch, { onExcessProperty: "error" })
}

export function PriceFields(props: {
  rows: ReturnType<typeof priceRow>[]
  onChange: (rows: ReturnType<typeof priceRow>[]) => void
}) {
  const language = useLanguage()

  return (
    <div class="flex flex-col gap-3">
      <p>{language.t("customProvider.advanced.priceHelp")}</p>
      <For each={props.rows}>
        {(row, index) => (
          <fieldset class="flex flex-col gap-3 rounded border border-v2-border-border-base p-3">
            <legend>{language.t("customProvider.advanced.priceTier", { index: index() + 1 })}</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <For each={priceFields}>
                {(field) => (
                  <TextField
                    label={language.t(`customProvider.advanced.price.${field}`)}
                    value={row[field]}
                    inputmode="decimal"
                    onChange={(value) =>
                      props.onChange(
                        props.rows.map((item) => (item.token === row.token ? { ...item, [field]: value } : item)),
                      )
                    }
                  />
                )}
              </For>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onChange(props.rows.filter((item) => item.token !== row.token))}
            >
              {language.t("customProvider.advanced.removePrice")}
            </Button>
          </fieldset>
        )}
      </For>
      <Button type="button" variant="outline" onClick={() => props.onChange([...props.rows, priceRow()])}>
        {language.t("customProvider.advanced.addPrice")}
      </Button>
    </div>
  )
}

export function variantRow(value?: CustomProviderAdvanced.Variant) {
  return { token: uuid(), id: value?.id ?? "", original: value?.id, advanced: advancedDraft(value) }
}

export function variantPatch(
  rows: ReturnType<typeof variantRow>[],
  original: readonly CustomProviderAdvanced.Variant[] = [],
) {
  const ids = rows.map((row) => row.original ?? row.id.trim())

  if (ids.some((id) => !id.trim() || id === "default" || id.includes("#")) || new Set(ids).size !== ids.length)
    throw new Error("invalid-variants")

  const patch = Object.fromEntries([
    ...original.flatMap((row) => (ids.includes(row.id) ? [] : [[row.id, null]])),
    ...rows.flatMap((row, index) => {
      const change = advancedPatch(
        row.advanced,
        advancedDraft(original.find((item) => item.id === row.original)),
        false,
        true,
      )

      return row.original === undefined || change.settings
        ? [[ids[index], change.settings ? { settings: change.settings } : {}]]
        : []
    }),
  ])

  return Object.keys(patch).length
    ? Schema.decodeUnknownSync(CustomProviderAdvanced.VariantsPatch)(patch, { onExcessProperty: "error" })
    : undefined
}

export function VariantFields(props: {
  rows: ReturnType<typeof variantRow>[]
  readonly?: boolean
  onChange: (rows: ReturnType<typeof variantRow>[]) => void
}) {
  const language = useLanguage()

  return (
    <fieldset disabled={props.readonly} class="flex flex-col gap-3">
      <p>{language.t("customProvider.advanced.variantHelp")}</p>
      <Show when={props.readonly}>
        <p>{language.t("customProvider.advanced.variantsReadonly")}</p>
      </Show>
      <For each={props.rows}>
        {(row, index) => (
          <fieldset class="flex flex-col gap-3 rounded border border-v2-border-border-base p-3">
            <legend>{language.t("customProvider.advanced.variant", { index: index() + 1 })}</legend>
            <TextField
              label={language.t("customProvider.advanced.variantID")}
              value={row.id}
              readOnly={row.original !== undefined}
              onChange={(value) =>
                props.onChange(props.rows.map((item) => (item.token === row.token ? { ...item, id: value } : item)))
              }
            />
            <AdvancedFields
              variant
              value={row.advanced}
              onChange={(key, value) =>
                props.onChange(
                  props.rows.map((item) =>
                    item.token === row.token ? { ...item, advanced: { ...item.advanced, [key]: value } } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onChange(props.rows.filter((item) => item.token !== row.token))}
            >
              {language.t("customProvider.advanced.removeVariant")}
            </Button>
          </fieldset>
        )}
      </For>
      <Button type="button" variant="outline" onClick={() => props.onChange([...props.rows, variantRow()])}>
        {language.t("customProvider.advanced.addVariant")}
      </Button>
    </fieldset>
  )
}
