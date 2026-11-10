import { expect, test } from "bun:test"
import { compactRemote, projectRemoteHint } from "./project-remotes"

test.each([
  ["https://github.com/joe-ieta/opencode.git", "github.com/joe-ieta/opencode"],
  ["git@github.com:team/project.git", "github.com/team/project"],
  ["ssh://git@github.com/team/project.git", "github.com/team/project"],
  [
    "https://user:secret@git.example.com:8443/team/project.git/?token=secret#branch",
    "git.example.com:8443/team/project",
  ],
  ["", ""],
])("compacts %s without credentials", (url, expected) => {
  expect(compactRemote(url)).toBe(expected)
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
