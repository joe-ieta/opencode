import type { CustomProvider } from "@opencode/schema/custom-provider"
import { customProviderFixture } from "../utils/custom-provider"
import { openSession } from "../utils/workspace"
import { expect, test, type Page } from "@playwright/test"
import { fixture, installStressSessionTabs } from "../utils/session-fixture"
import { sessionHref } from "../utils/app"
import { openWithDirection } from "../utils/direction"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

for (const direction of ["ltr", "rtl"] as const) {
  for (const paid of [true, false]) {
    test(`mobile model and variant pickers use drawers with ${paid ? "paid" : "free"} models in ${direction}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await openPickerSession(page, direction, paid)
      const composer = page.locator('[data-component="composer"]')
      const variant = composer.getByRole("button", { name: "Choose model variant", exact: true })
      await expect(variant).toHaveText("balanced")
      await variant.click()
      const variants = page.getByRole("dialog", { name: "Choose model variant", exact: true })
      await expect(variants.getByRole("button", { name: "balanced", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      )
      await expect(variants.getByRole("button", { name: "Close", exact: true })).toHaveCount(0)
      await expect(variants).toBeInViewport({ ratio: 1 })
      await expect(variants).not.toHaveAttribute("data-transitioning")
      await variants.screenshot({ path: testInfo.outputPath("variants.png") })
      await page.keyboard.press("Escape")
      await expect(variants).toBeHidden()
      await expect(variant).toBeFocused()
      await variant.click()
      await variants.getByRole("button", { name: "high", exact: true }).click()
      await expect(variants).toBeHidden()
      await expect(variant).toHaveText("high")
      await expect(variant).toBeFocused()

      const model = composer.locator('[data-action="composer-model"]')
      await expect(model).toHaveText("Mobile Model A")
      await expect(model).toHaveAttribute("data-control-type", "drawer")
      await model.click()
      const models = page.getByRole("dialog", { name: "Select model", exact: true })
      const search = models.getByRole("searchbox", { name: "Search models", exact: true })
      await expect(models.locator('[data-slot="model-selector-drawer"]')).toBeFocused()
      await expect(search).not.toBeFocused()
      await expect(models.getByRole("button", { name: /Mobile Model A/ })).toHaveAttribute("aria-pressed", "true")
      await expect(models.getByRole("button", { name: "Close", exact: true })).toHaveCount(0)
      await expect(models).toBeInViewport({ ratio: 1 })
      await expect(models).not.toHaveAttribute("data-transitioning")
      await expect
        .poll(() =>
          models.evaluate((element) => {
            const drawer = element.getBoundingClientRect()
            const search = element.querySelector('[data-component="text-input-v2"]')!.getBoundingClientRect()
            const row = element.querySelector('[data-component="settings-row"]')!.getBoundingClientRect()
            const searchClip = element.querySelector('[data-slot="mobile-panel-content"]')!.getBoundingClientRect()
            const rowClip = element.querySelector(".settings-models")!.getBoundingClientRect()

            return {
              searchStart: Math.round(search.left - drawer.left),
              searchEnd: Math.round(drawer.right - search.right),
              rowStart: Math.round(row.left - drawer.left),
              rowEnd: Math.round(drawer.right - row.right),
              searchClipStart: Math.round(search.left - searchClip.left),
              searchClipEnd: Math.round(searchClip.right - search.right),
              rowClipStart: Math.round(row.left - rowClip.left),
              rowClipEnd: Math.round(rowClip.right - row.right),
            }
          }),
        )
        .toEqual({
          searchStart: 12,
          searchEnd: 12,
          rowStart: 12,
          rowEnd: 12,
          searchClipStart: 12,
          searchClipEnd: 12,
          rowClipStart: 12,
          rowClipEnd: 12,
        })
      await expect(models.getByRole("button", { name: /Mobile Model A/ })).toHaveCSS("padding-inline-start", "12px")
      await expect(models.getByRole("button", { name: /Mobile Model A/ })).toHaveCSS("padding-block-start", "16px")
      await models.screenshot({ path: testInfo.outputPath("models.png") })
      await search.click()
      await expect(search).toBeFocused()
      await search.fill("no-matching-model")
      await expect(models.getByText("No model results", { exact: true })).toBeVisible()
      await search.fill("Mobile Model B")
      await expect(models.getByRole("button", { name: /Mobile Model A/ })).toHaveCount(0)
      await search.press("Enter")
      await expect(models).toBeHidden()
      await expect(model).toHaveText("Mobile Model B")
      await expect(composer.getByRole("textbox", { name: "Prompt", exact: true })).toBeFocused()

      await model.click()
      await expect(search).toHaveValue("")
      await expect(models.locator('[data-slot="model-selector-drawer"]')).toBeFocused()
      await expect(models.getByRole("button", { name: /Mobile Model B/ })).toHaveAttribute("aria-pressed", "true")
      await expect
        .poll(() => models.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42))
        .toBe(0)
      await expect(models).not.toHaveAttribute("data-transitioning")
      await page.locator('[data-slot="mobile-drawer-overlay"]').click({ position: { x: 10, y: 10 } })
      await expect(models).toBeHidden()
      await expect(model).toBeFocused()

      if (paid) {
        await model.click()
        await models.getByRole("button", { name: "Manage models", exact: true }).click()
        await expect(models).toBeHidden()
        await expect(page.getByRole("dialog", { name: "Manage models", exact: true })).toBeVisible()
        await expect(page.getByRole("dialog")).toHaveCount(1)

        return
      }

      await model.click()
      await models.getByRole("button", { name: "Connect an integration", exact: true }).click()
      await expect(models).toBeHidden()
      const providers = page.getByRole("dialog", { name: "Integrations", exact: true })
      await expect(providers.getByRole("searchbox", { name: "Search providers", exact: true })).toBeFocused()
      await expect(page.getByRole("dialog")).toHaveCount(1)
    })
  }

  test(`desktop model button opens the model dialog in ${direction}`, async ({ page }) => {
    const { composer, model, variant, dialog } = await openDesktopPicker(page, direction)
    await variant.click()
    await page.getByRole("menuitemradio", { name: "high", exact: true }).click()
    await expect(variant).toHaveText("high")
    await expect(model).toHaveAttribute("data-control-type", "dialog")
    await model.click()
    await expect(dialog.getByRole("combobox", { name: "Search models", exact: true })).toBeFocused()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await dialog.locator('[data-option-key="opencode:mobile-b"]').click()
    await expect(dialog).toBeHidden()
    await expect(model).toHaveText("Mobile Model B")
    await expect(page.locator('[data-slot="mobile-drawer-content"]')).toHaveCount(0)
    await expect(composer.getByRole("textbox", { name: "Prompt", exact: true })).toBeFocused()
  })

  test(`model dialog flyout applies a model and variant in ${direction}`, async ({ page }) => {
    const { model, variant, dialog } = await openDesktopPicker(page, direction)
    const flyout = dialog.locator('[data-slot="model-dialog-flyout"]')
    await model.click()
    await dialog.locator('[data-option-key="opencode:mobile-a"]').hover()
    await expect(flyout.getByRole("menuitemradio", { name: "balanced", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    await dialog.locator('[data-option-key="opencode:mobile-b"]').hover()
    await expect(flyout.getByText("OpenCode · 1M context", { exact: true })).toBeVisible()
    await expect(flyout.getByText("Text, Image, PDF, Tools", { exact: true })).toBeVisible()
    await flyout.getByRole("menuitemradio", { name: "max", exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(model).toHaveText("Mobile Model B")
    await expect(variant).toHaveText("max")
  })

  test(`model dialog arrow keys stage a variant in ${direction}`, async ({ page }) => {
    const { composer, model, variant, dialog } = await openDesktopPicker(page, direction)
    const search = dialog.getByRole("combobox", { name: "Search models", exact: true })
    const rowA = dialog.locator('[data-option-key="opencode:mobile-a"]')
    const next = direction === "rtl" ? "ArrowLeft" : "ArrowRight"
    await model.click()
    await expect(search).toBeFocused()
    await search.press(next)
    await expect(rowA).toContainText("high")
    await search.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(variant).toHaveText("balanced")

    await model.click()
    await search.fill("Mobile Model A")
    await search.press(next)
    await expect(search).toHaveValue("Mobile Model A")
    await expect(rowA).toContainText("balanced")
    await search.press("ArrowDown")
    await search.press("ArrowUp")
    await search.press(next)
    await expect(rowA).toContainText("high")
    await search.press("Enter")
    await expect(dialog).toBeHidden()
    await expect(model).toHaveText("Mobile Model A")
    await expect(variant).toHaveText("high")
    await expect(composer.getByRole("textbox", { name: "Prompt", exact: true })).toBeFocused()
  })

  test(`model shortcut opens the model dialog in ${direction}`, async ({ page }) => {
    const { composer, model, variant, dialog } = await openDesktopPicker(page, direction)
    const prompt = composer.getByRole("textbox", { name: "Prompt", exact: true })
    await prompt.fill("keep me")
    await prompt.press("ControlOrMeta+Quote")
    const search = dialog.getByRole("combobox", { name: "Search models", exact: true })
    await expect(search).toBeFocused()
    await search.press(direction === "rtl" ? "ArrowLeft" : "ArrowRight")
    await expect(dialog.locator('[data-option-key="opencode:mobile-a"]')).toContainText("high")
    await search.press("Enter")
    await expect(dialog).toBeHidden()
    await expect(model).toHaveText("Mobile Model A")
    await expect(variant).toHaveText("high")
    await expect(prompt).toBeFocused()
    await expect(prompt).toHaveText("keep me")
  })
}

test("desktop model button shows only the choose-model hint, not the model details", async ({ page }) => {
  const { model } = await openDesktopPicker(page, "ltr")
  await model.hover()
  const tooltip = page.getByRole("tooltip")
  await expect(tooltip).toContainText("Choose model")
  await expect(tooltip.getByText("1,000,000", { exact: true })).toHaveCount(0)
  await expect(tooltip.getByText("Input & Output", { exact: true })).toHaveCount(0)
})

test("model dialog shows a summary and only the default variant for models without variants", async ({ page }) => {
  const { model, dialog } = await openDesktopPicker(page, "ltr")
  const flyout = dialog.locator('[data-slot="model-dialog-flyout"]')
  await model.click()
  await dialog.locator('[data-option-key="opencode:mobile-c"]').hover()
  await expect(flyout.getByText("OpenCode · 262K context", { exact: true })).toBeVisible()
  await expect(flyout.getByRole("menuitemradio")).toHaveText(["Default"])
})

test("model dialog toggles a favorite from the keyboard and leads with favorite and recent models", async ({
  page,
}) => {
  const { model, dialog } = await openDesktopPicker(page, "ltr")
  const sections = dialog.locator('[data-slot="search-list-header"]')
  const search = dialog.getByRole("combobox", { name: "Search models", exact: true })
  await model.click()
  await expect(sections).toHaveText(["OpenCode"])
  await search.press("ArrowDown")
  await search.press("ArrowDown")
  await search.press("ControlOrMeta+f")
  await expect(sections).toHaveText(["Favorites", "OpenCode"])
  // A favorite leaves its provider group, so the model is listed once.
  await expect(dialog.locator('[data-option-key="opencode:mobile-c"]')).toHaveCount(1)
  await dialog.locator('[data-option-key="opencode:mobile-b"]').click()
  await expect(model).toHaveText("Mobile Model B")

  await model.click()
  await expect(sections).toHaveText(["Favorites", "Recent", "OpenCode"])
  await expect(dialog.locator('[data-option-key="opencode:mobile-b"]')).toHaveAttribute("aria-current", "true")
  await search.fill("Mobile")
  await expect(sections).toHaveText(["OpenCode"])
  await search.press("Escape")
  await expect(dialog).toBeHidden()
  // The dialog opens on its first row with the search focused, not on the selected model further down.
  await model.click()
  await expect(search).toBeFocused()
  await expect(dialog.locator('[data-option-key="opencode:mobile-c"]')).toHaveAttribute("data-active", "")
  await expect(dialog.locator('[data-option-key="opencode:mobile-b"]')).not.toHaveAttribute("data-active")
  await search.press("ControlOrMeta+f")
  await expect(sections).toHaveText(["Recent", "OpenCode"])
  await expect(dialog.locator('[data-option-key="opencode:mobile-c"]')).toHaveAttribute("data-active", "")
})

test("model dialog opens Manage models from its search row with Enter", async ({ page }) => {
  const { model, dialog } = await openDesktopPicker(page, "ltr")
  await model.click()
  const search = dialog.getByRole("combobox", { name: "Search models", exact: true })
  const manage = dialog.getByRole("button", { name: "Manage models", exact: true })
  await expect(search).toBeFocused()
  await search.press("Tab")
  await expect(dialog.getByRole("button", { name: "Connect an integration", exact: true })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(manage).toBeFocused()
  await manage.press("Enter")
  await expect(page.getByRole("dialog", { name: "Manage models", exact: true })).toBeVisible()
  await expect(model).toHaveText("Mobile Model A")
})

test.describe("touch composer pickers", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test("model and default variant open with one tap", async ({ page }) => {
    await openPickerSession(page, "ltr", true)
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true)
    const composer = page.locator('[data-component="composer"]')
    const variant = composer.getByRole("button", { name: "Choose model variant", exact: true })
    await variant.tap()
    const variants = page.getByRole("dialog", { name: "Choose model variant", exact: true })
    await variants.getByRole("button", { name: "default", exact: true }).tap()
    await expect(variants).toBeHidden()
    await expect(variant).toHaveText("default")
    await page.touchscreen.tap(5, 300)
    await expect(variant).toHaveCSS("pointer-events", "auto")
    await expect(variant).toHaveCSS("opacity", "1")
    await variant.tap()
    await expect(variants).toBeVisible()
    await expect
      .poll(() => variants.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42))
      .toBe(0)
    await page.locator('[data-slot="mobile-drawer-overlay"]').tap({ position: { x: 10, y: 10 } })
    await expect(variants).toBeHidden()

    await composer.locator('[data-action="composer-model"]').tap()
    const models = page.getByRole("dialog", { name: "Select model", exact: true })
    await expect(models.locator('[data-slot="model-selector-drawer"]')).toBeFocused()
    const search = models.getByRole("searchbox", { name: "Search models", exact: true })
    await expect(search).not.toBeFocused()
    await search.tap()
    await expect(search).toBeFocused()
  })
})

async function openDesktopPicker(page: Page, direction: "ltr" | "rtl") {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openPickerSession(page, direction, true)
  const composer = page.locator('[data-component="composer"]')

  return {
    composer,
    model: composer.locator('[data-action="composer-model"]'),
    variant: composer.getByRole("button", { name: "Choose model variant", exact: true }),
    dialog: page.getByRole("dialog", { name: "Select model", exact: true }),
  }
}

async function openPickerSession(page: Page, direction: "ltr" | "rtl", paid: boolean) {
  await mockOpenCodeServer(page, {
    ...fixture,
    sessions: fixture.sessions.map((session) => ({
      ...session,
      model: { id: "mobile-a", providerID: "opencode", variant: "balanced" },
    })),
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: Object.fromEntries(
            ["a", "b", "c"].map((id) => [
              `mobile-${id}`,
              {
                id: `mobile-${id}`,
                name: `Mobile Model ${id.toUpperCase()}`,
                cost: { input: paid ? 1 : 0, output: paid ? 1 : 0 },
                limit: { context: id === "c" ? 262_144 : 1_000_000 },
                capabilities: {
                  tools: id !== "c",
                  input: id === "c" ? ["text"] : ["text", "image", "pdf"],
                  output: ["text"],
                },
                variants: id === "c" ? {} : { balanced: {}, high: {}, max: {} },
              },
            ]),
          ),
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "mobile-a" },
    },
    pageMessages: () => ({ items: [] }),
  })
  await installStressSessionTabs(page)
  await page.addInitScript((direction) => {
    localStorage.setItem("opencode-color-scheme", direction === "rtl" ? "dark" : "light")
    localStorage.setItem(
      "opencode.global.dat:model",
      JSON.stringify({
        user: ["a", "b", "c"].map((id) => ({ providerID: "opencode", modelID: `mobile-${id}`, visibility: "show" })),
        recent: [],
        variant: {},
      }),
    )
  }, direction)
  await openWithDirection(page, sessionHref(fixture.targetID), direction)
  await expectAppVisible(page.getByRole("textbox", { name: "Prompt", exact: true }))
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toBeEditable()
}

test("mobile custom providers replace the picker drawer and expose the manual form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = customProviderFixture()
  await openSession(page, {
    name: "MobileCustomProvider",
    ...fixture.config,
    onCustomProviderDiscover: () => ({
      status: "success",
      warnings: [],
      models: [
        { id: "mobile/model", input: 4096, sources: { input: "/models.max_input_tokens" }, warnings: ["unverified"] },
      ],
    }),
  })
  const trigger = page.locator('[data-action="composer-model"]')
  await expect(trigger).toHaveText("Existing Model")
  await trigger.click()
  const picker = page.getByRole("dialog", { name: "Select model", exact: true })
  await picker.getByRole("button", { name: "Custom providers", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Custom providers", exact: true })
  await expect(picker).toBeHidden()
  await dialog.getByRole("button", { name: "Add custom provider", exact: true }).click()
  const id = dialog.getByRole("textbox", { name: "Provider ID", exact: true })
  await id.fill("mobile-gateway")
  await expect(id).toBeFocused()
  await expect(dialog).toBeInViewport({ ratio: 1 })
  await dialog.getByRole("textbox", { name: "Base URL", exact: true }).fill("http://localhost:8080/v1")
  await dialog.getByRole("button", { name: "Fetch models", exact: true }).click()
  const candidate = dialog.getByRole("checkbox", { name: "mobile/model", exact: true })
  await expect(candidate).not.toBeChecked()
  await candidate.check()
  await dialog.getByRole("button", { name: "Import selected models", exact: true }).click()
  await expect(dialog.getByRole("textbox", { name: "Model key", exact: true })).toHaveValue("mobile/model")
  await expect(dialog.getByRole("textbox", { name: "Input limit", exact: true })).toHaveValue("4096")
  await expect(dialog.getByRole("textbox", { name: "Context limit", exact: true })).toHaveValue("")
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toHaveText("Existing Model")
})

test("mobile custom provider advanced options create explicit zero prices and validate variant identities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = customProviderFixture()
  await openSession(page, {
    name: "MobileAdvancedProvider",
    ...fixture.config,
    onCustomProviderUpdate: (id, body) => ({
      ...fixture.config.onCustomProviderUpdate(id, body),
      credential: "unchanged",
      catalog: "pending",
    }),
  })
  await page.locator('[data-action="composer-model"]').click()
  await page
    .getByRole("dialog", { name: "Select model", exact: true })
    .getByRole("button", { name: "Custom providers", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Custom providers", exact: true })
  await dialog.getByRole("button", { name: "Add custom provider", exact: true }).click()
  await dialog.getByRole("textbox", { name: "Provider ID", exact: true }).fill("private-gateway")
  await dialog.getByRole("textbox", { name: "Base URL", exact: true }).fill("http://localhost:8080/v1")
  await dialog.getByRole("textbox", { name: "Model key", exact: true }).fill("alias")
  const provider = dialog
    .locator("details")
    .filter({ has: page.getByText("Provider advanced options", { exact: true }) })
  await provider.getByText("Provider advanced options", { exact: true }).click()
  await provider.getByRole("textbox", { name: "Response header timeout (ms)", exact: true }).fill("false")
  const model = dialog.getByRole("group", { name: "Model 1", exact: true })
  await model.getByText("Model advanced options", { exact: true }).click()
  await model
    .getByRole("group", { name: "Model request options", exact: true })
    .getByRole("combobox", { name: "Parallel tool calls", exact: true })
    .selectOption("false")
  await model.getByRole("button", { name: "Add price tier", exact: true }).click()
  const price = model.getByRole("group", { name: "Price tier 1", exact: true })
  await price.getByRole("textbox", { name: "Input price", exact: true }).fill("0")
  await price.getByRole("textbox", { name: "Output price", exact: true }).fill("0")
  await model.getByRole("button", { name: "Add variant", exact: true }).click()
  await model
    .getByRole("group", { name: "Variant 1", exact: true })
    .getByRole("textbox", { name: "Variant ID", exact: true })
    .fill("same")
  await model.getByRole("button", { name: "Add variant", exact: true }).click()
  const variant = model.getByRole("group", { name: "Variant 2", exact: true })
  await variant.getByRole("textbox", { name: "Variant ID", exact: true }).fill("same")
  await dialog.getByRole("button", { name: "Save provider", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Check advanced options")
  expect(fixture.requests).toEqual([])
  await variant.getByRole("textbox", { name: "Variant ID", exact: true }).fill("high")
  await variant.getByRole("textbox", { name: "Reasoning effort", exact: true }).fill("high")
  await dialog.getByRole("button", { name: "Save provider", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Provider saved")
  expect(fixture.requests[0]?.body.patch).toMatchObject({
    settings: { headerTimeout: false },
    models: {
      alias: {
        settings: { parallelToolCalls: false },
        cost: { "0": { input: 0, output: 0 } },
        variants: { same: {}, high: { settings: { reasoningEffort: "high" } } },
      },
    },
  })
})

test("mobile LM Studio native preview imports the loaded instance limit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = customProviderFixture()
  await openSession(page, {
    name: "MobileLMStudioMetadata",
    ...fixture.config,
    onCustomProviderDiscover: (): CustomProvider.Discovery => ({
      status: "success",
      warnings: [],
      models: [
        {
          id: "mobile-instance",
          context: 4096,
          maxContext: 131072,
          loaded: true,
          tools: false,
          image: true,
          sources: { context: "/api/v1/models.loaded_instances.config.context_length" },
          warnings: ["unverified", "capabilities-declared"],
        },
      ],
    }),
  })
  await page.locator('[data-action="composer-model"]').click()
  await page
    .getByRole("dialog", { name: "Select model", exact: true })
    .getByRole("button", { name: "Custom providers", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Custom providers", exact: true })
  await dialog.getByRole("button", { name: "Add custom provider", exact: true }).click()
  await dialog.getByRole("textbox", { name: "Base URL", exact: true }).fill("http://localhost:1234/v1")
  await dialog.getByRole("combobox", { name: "Discovery API", exact: true }).selectOption("lmstudio")
  await dialog.getByRole("button", { name: "Fetch models", exact: true }).click()
  const checkbox = dialog.getByRole("checkbox", { name: "mobile-instance", exact: true })
  await expect(checkbox).not.toBeChecked()
  await checkbox.check()
  await dialog.getByRole("button", { name: "Import selected models", exact: true }).click()
  await expect(dialog.getByRole("textbox", { name: "Context limit", exact: true })).toHaveValue("4096")
  await expect(dialog.getByRole("combobox", { name: "Tool support", exact: true })).toHaveValue("false")
  await expect(dialog.getByRole("combobox", { name: "Image input", exact: true })).toHaveValue("true")
})
