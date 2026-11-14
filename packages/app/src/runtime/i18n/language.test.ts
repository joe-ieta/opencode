import { describe, expect, test } from "bun:test"
import { DESKTOP_NATIVE_LOCALES } from "./desktop-native"
import { localizedListParts, resolveLanguagePreference, richTemplateParts } from "./language"

describe("rich translations", () => {
  test("lets the translated phrase position a rich slot", () => {
    const names = { type: "names" }
    expect(richTemplateParts("Written by {{names}}", { names })).toEqual(["Written by ", names])
    expect(richTemplateParts("{{names}} tarafından yazıldı", { names })).toEqual([names, " tarafından yazıldı"])
  })

  test("keeps list elements intact while localizing punctuation", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the check is that no element was stringified
    expect(localizedListParts("en", items).filter((part) => typeof part !== "string")).toEqual(items)
  })
})

describe("dictionaries", () => {
  test("are flat string maps in every locale", async () => {
    const modules = await Promise.all(
      DESKTOP_NATIVE_LOCALES.flatMap((locale) => [
        import(`./${locale}`),
        import(`../../../../ui/src/i18n/${locale}`),
      ]),
    )

    const nested = modules.flatMap((module) =>
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the check is that no value is nested
      Object.entries<unknown>(module.dict).filter(([, value]) => typeof value !== "string"),
    )

    expect(nested).toEqual([])
  })

  test("the custom provider dialog is translated in both Chinese locales", async () => {
    const [en, zh, zht] = await Promise.all([import("./en"), import("./zh"), import("./zht")])
    const keys = Object.keys(en.dict).filter((key) => key.startsWith("customProvider."))

    expect(keys.filter((key) => !(key in zh.dict))).toEqual([])
    expect(keys.filter((key) => !(key in zht.dict))).toEqual([])
  })
})

describe("language preference", () => {
  test("a fresh install follows the detected system language", () => {
    expect(resolveLanguagePreference(undefined, "zh")).toEqual({ locale: "zh", system: true })
  })

  test("a stored pre-system choice stays manual", () => {
    expect(resolveLanguagePreference({ locale: "de" }, "zh")).toEqual({ locale: "de", system: false })
  })

  test("following the system resolves the detected language on each launch", () => {
    expect(resolveLanguagePreference({ locale: "de", system: true }, "zh")).toEqual({ locale: "zh", system: true })
  })

  test("a manual choice replaces system following", () => {
    expect(resolveLanguagePreference({ locale: "de", system: false }, "zh")).toEqual({ locale: "de", system: false })
  })
})
