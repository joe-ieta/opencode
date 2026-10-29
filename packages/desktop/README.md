# OpenCode Desktop

The OpenCode Desktop app, built with Electron.

## Development

```bash
bun install
bun dev
```

## Build

`bun run build` prepares `resources/` (icons, metainfo and the bundled CLI) and builds the app into `out/`.
`bun run pack` then packages it, unsigned, into `dist/desktop/` at the repository root: a `.app` tarball on macOS,
the unpacked app on Windows, and AppImage/deb/rpm on Linux. The release workflow signs and notarizes afterwards.

```bash
bun run build && bun run pack
```

Both read the same environment as every other release package:

| Variable           | Meaning                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `OPENCODE_CHANNEL` | `dev` (default), `beta`, or `latest`/`prod`. Picks the app identity, icons and bundled CLI.                     |
| `OPENCODE_VERSION` | Version stamped into the app and its packages.                                                                  |
| `OPENCODE_TARGET`  | `darwin-arm64`, `darwin-x64`, `windows-arm64`, `windows-x64`, `linux-x64`, `linux-arm64`. Defaults to the host. |

The CLI is placed outside `app.asar` in the application's resources directory, and packaging fails if it is missing.
`bun run build` uses `packages/cli/dist` when that holds the target's CLI. Otherwise `dev` (and `local`, unset or unrecognized)
downloads the published dev CLI, `beta` downloads the beta CLI, and `prod`/`latest` fail.

`bun dev` is separate from packaging: it uses local renderer/server mode, the dev app identity, and the CLI source by
default. `bun dev --download-server <version>` instead downloads that CLI version for local development.

## Fork releases

From `dev-my`, on Windows x64 or Ubuntu/Linux x64 with the root `packageManager` Bun version:

```powershell
bun install --frozen-lockfile
bun run release:desktop:my --version=2.2.1-dev-my.1
```

This follows the official CLI build, Electron build and packaging stages. It builds the CLI from the same checkout and verifies its version and bundled model catalog. Before packaging, a compiled-CLI smoke test checks service discovery and a confirmed V1-to-V2 migration in a temporary home. The fork has no signing service configured, so the artifacts are unsigned.

On Windows x64 the app becomes an NSIS installer. On Ubuntu/Linux x64 the same command writes an AppImage and a deb plus `latest-linux.yml`; rpm is left out because Ubuntu ships no rpmbuild, and `OPENCODE_DESKTOP_LINUX_TARGETS=AppImage,deb,rpm` adds it back on hosts that do.

`dev-my` is the source branch and version suffix; the runtime channel is `dev`. This preserves the official `service.json` registration and `opencode.db` history database, including the one-way V1 upgrade confirmation. Using `dev-my` as the runtime channel would select `service-dev-my.json` and an empty `opencode-dev-my.db`, which the desktop cannot discover. The GUI app identity and fork update feed remain separate below.

The app is named **OpenCode My**, uses `ai.opencode.desktop.dev-my`, and reads its updater manifest from its own GitHub release tag. It never uses the official desktop update feed. This initial release feed is pinned to its tag; install subsequent fork releases manually.

The installer or Linux packages, `latest.yml`/`latest-linux.yml`, `SHA256SUMS` and source commit metadata are written to `dist/releases/v<version>/`. After checking those files, tag the built commit as `v<version>` and attach them to the corresponding GitHub release.

## Beta channel

Every push to the `beta` branch publishes OpenCode Beta (`ai.opencode.desktop.beta`) as version `0.0.0-beta-<run>` to
the `beta` update channel. Beta publishes only the desktop app and `beta.opencode.ai`; the CLI and SDK packages ship
from `dev`. Install it from `https://opencode.ai/download/beta/<platform>`, for example `darwin-aarch64-dmg` or
`windows-x64-nsis`. Installed builds update in place on every platform.

Each beta build compiles in its commit and the `feat`, `fix` and `perf` commits among its newest 200
(`script/beta-notes.ts`, embedded by `electron.vite.config.ts`; run `bun script/beta-notes.ts` to preview them). After an
update, the beta app lists the ones after the commit of the build the user saw last in a "What's new in beta" dialog,
unless release notes are turned off in Settings.

## Startup benchmark

`bun run bench:startup` measures a **packaged** build from process spawn to the restored tab being ready and the
renderer going idle, so dev-server and bundling costs are not part of the numbers.

```bash
OPENCODE_CHANNEL=dev bun run build && bun run pack
bun run bench:startup -- --runs 5                                  # warm service (started once, reused by every launch)
bun run bench:startup -- --runs 5 --compare dist/other/OpenCode\ Dev.exe   # A/B: alternate launches of two builds
bun run bench:startup -- --service cold                            # each launch spawns the service
bun run bench:startup -- --fresh                                   # first launch after an install (profile wiped each time)
bun run bench:startup -- --profile-main --profile-renderer --trace # CPU profiles and a Chromium startup trace
bun run bench:startup -- --seed "%APPDATA%\ai.opencode.desktop.dev"   # restore tabs and drafts from an existing profile
```

The app runs in an isolated home (`%TEMP%\opencode-bench-startup`): its own `%APPDATA%`, XDG directories, OpenCode
database, config and service registration, with the developer's `OPENCODE_*` and `OTEL_*` environment stripped
(an inherited OTLP endpoint alone adds a network round trip to every CLI exit). It never attaches to or restarts the
developer's live service, and only ever kills the process tree it spawned. `--service cold` stops the service before
each launch so the desktop has to spawn it; the isolated config directory gives that service a private port. One
`--warmup` launch per build is discarded by default because the first launch of a new binary pays the antivirus scan.
`--compare` alternates two builds so machine drift affects both equally; they must bundle the same CLI or the desktop
restarts the service on the version mismatch.

Milestones (ms since spawn) come from the main log, the renderer's performance timeline and DOM readiness polled over
CDP. Node's bootstrap timing is read from the main process after each run over `--inspect` (nothing attaches until the
run is over): `processCreated` → `nodeStart` is Electron's native init, `nodeStart` → `nodeBootstrapped` is Node
itself, and `nodeBootstrapped` → `appStarting` is Electron's JavaScript init plus our main bundle up to its first
log line. Renderer idle is the start of the first 500 ms window with under 10 % main-thread task time that stays quiet
for `--settle-ms`; `rendererTaskMs` is the renderer's total main-thread task time until then. Raw samples are
written to `dist/bench-startup`.

A packaged beta or prod build registers itself as the `opencode://` handler when it starts, even from the bench; the
installed app takes the registration back on its next launch. Those channels run with `HTTPS_PROXY` pointed at a
closed port (`--offline` forces it for dev) so the updater's first check fails fast instead of reaching GitHub.
