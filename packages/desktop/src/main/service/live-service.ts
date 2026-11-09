export * as LiveService from "./live-service"

import { Service } from "@opencode/client/service"

// Live UI acceptance uses the installed service's data without ensuring, upgrading or starting a server.
export async function connect() {
  const endpoint = await Service.discover()
  if (!endpoint) throw new Error("No running compatible OpenCode service found. Start the installed desktop first.")
  if (!endpoint.auth) throw new Error("The existing OpenCode service did not provide authentication")
  return { url: new URL(endpoint.url).origin, password: endpoint.auth.password }
}
