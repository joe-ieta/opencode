import type { VcsInfo } from "@opencode/client/promise"

type Remote = NonNullable<NonNullable<VcsInfo["experimental"]>["remotes"]>[number]

/** The concise origin/upstream lines shown in a project's hint. */
export function projectRemoteHint(remotes: readonly Remote[] | undefined) {
  const primary = remotes?.find((remote) => remote.name === "origin") ?? remotes?.[0]
  const upstream = remotes?.find((remote) => remote.name === "upstream" && remote !== primary)

  return [primary, upstream].flatMap((remote) => {
    if (!remote) return []
    const url = compactRemote(remote.url)

    return url ? [`${remote.name}: ${url}`] : []
  })
}

/** Drops the protocol, credentials, `.git` suffix and trailing slash from a remote URL. */
export function compactRemote(url: string) {
  const value = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
  if (!value) return ""

  const scp = /^[^@:/\s]+@([^:/\s]+):(.+)$/.exec(value)
  if (scp) return `${scp[1]}/${scp[2].replace(/^\/+/, "")}`

  try {
    const parsed = new URL(value)
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, "").replace(/\.git$/i, "")
  } catch {
    return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^[^@/]+@/, "")
  }
}
