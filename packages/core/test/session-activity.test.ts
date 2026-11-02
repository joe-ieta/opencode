import { expect } from "bun:test"
import { Deferred, Effect, Exit, Scope } from "effect"
import { Database } from "@opencode/core/database/database"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Job } from "@opencode/core/job"
import { ProjectTable } from "@opencode/core/project/sql"
import { SessionActivity } from "@opencode/core/session/activity"
import { SessionActivitySource } from "@opencode/core/session/activity-source"
import { SessionTable } from "@opencode/core/session/sql"
import { SessionStore } from "@opencode/core/session/store"
import { Session } from "@opencode/schema/session"
import { SessionMessage } from "@opencode/schema/session-message"
import { Project } from "@opencode/schema/project"
import { AbsolutePath } from "@opencode/schema/schema"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Job.node, Database.node, SessionStore.node, SessionActivitySource.node])),
)

it.effect("observes nested live jobs but not settled notifications or recovered durable markers", () =>
  Effect.gen(function* () {
    const database = yield* Database.Service
    const jobs = yield* Job.Service
    const root = Session.ID.make("ses_activity_root")
    const child = Session.ID.make("ses_activity_child")
    const grandchild = Session.ID.make("ses_activity_grandchild")
    yield* database.db
      .insert(ProjectTable)
      .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
      .run()
    yield* database.db
      .insert(SessionTable)
      .values(
        [root, child, grandchild].map((id, index) => ({
          id,
          project_id: Project.ID.global,
          slug: id,
          directory: "/project",
          title: id,
          version: "test",
          parent_id: index === 0 ? null : index === 1 ? root : child,
        })),
      )
      .run()
    const childGate = yield* Deferred.make<string>()
    const imageGate = yield* Deferred.make<string>()
    yield* jobs.start({
      id: "child",
      type: "subagent",
      title: "Review",
      recovery: {
        kind: "subagent",
        parentSessionID: root,
        childSessionID: child,
        agent: "review",
        description: "Review",
      },
      run: Deferred.await(childGate),
    })
    yield* jobs.start({
      id: "image",
      type: "image",
      notificationID: SessionMessage.ID.create(),
      recovery: { kind: "image", sessionID: grandchild, path: "/image.png", model: "test" },
      run: Deferred.await(imageGate),
    })
    yield* jobs.background("image")
    expect(yield* SessionActivity.list()).toMatchObject([
      { id: `session:${child}`, kind: "subagent", sessionID: child, ancestors: [root] },
      { id: "job:image", kind: "image", sessionID: grandchild, ancestors: [child, root] },
    ])
    yield* Deferred.succeed(imageGate, "done")
    yield* jobs.wait({ id: "image" })
    expect(yield* jobs.pendingBackground).toMatchObject([{ status: "completed" }])
    expect((yield* SessionActivity.list()).map((item) => item.id)).toEqual([`session:${child}`])
    yield* jobs.cancel("child")
    expect(yield* SessionActivity.list()).toEqual([])
    const recovered = yield* Job.make
    expect(yield* recovered.pendingBackground).toHaveLength(1)
    expect(yield* SessionActivity.list()).toEqual([])
  }),
)

it.effect("removes an observation source when its owning scope closes", () =>
  Effect.gen(function* () {
    const sources = yield* SessionActivitySource.Service
    const scope = yield* Scope.make()
    yield* sources
      .register(
        Effect.succeed([
          {
            id: "plugin:work",
            sessionID: Session.ID.make("ses_owner"),
            kind: "job",
            startedAt: 1,
          },
        ]),
      )
      .pipe(Scope.provide(scope))
    expect((yield* sources.list).map((item) => item.id)).toEqual(["plugin:work"])
    yield* Scope.close(scope, Exit.void)
    expect(yield* sources.list).toEqual([])
  }),
)
