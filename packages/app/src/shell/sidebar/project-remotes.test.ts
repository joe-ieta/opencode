import { expect, test } from "bun:test"
import { compactRemote, projectRemoteHint } from "./project-remotes"

test("compacts HTTPS and SCP-style remote URLs", () => {
  expect(compactRemote("https://github.com/joe-ieta/opencode.git")).toBe("github.com/joe-ieta/opencode")
  expect(compactRemote("git@gitee.com:ieta/opencode-my.git")).toBe("gitee.com/ieta/opencode-my")
  expect(compactRemote("ssh://git@github.com/team/project.git")).toBe("github.com/team/project")
})

test("shows origin and upstream once each", () => {
  expect(
    projectRemoteHint([
      { name: "origin", url: "https://github.com/team/project.git" },
      { name: "upstream", url: "git@github.com:team/project-fork.git" },
    ]),
  ).toEqual(["origin: github.com/team/project", "upstream: github.com/team/project-fork"])

  expect(projectRemoteHint([{ name: "upstream", url: "https://github.com/team/project.git" }])).toEqual([
    "upstream: github.com/team/project",
  ])
})
