import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { docs } from "./doc";
import { canvases } from "./canvas";
import { agentPrompts } from "./agentPrompt";

export const workspaceStatusEnum = pgEnum("WorkspaceStatus", [
  "PLANNING",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
]);

export const workspaces = pgTable(
  "workspace",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    name: text("name").notNull(),
    description: text("description"),
    creatorId: text("creatorId").notNull(),
    orgId: text("orgId"),

    status: workspaceStatusEnum("status").default("PLANNING").notNull(),

    position: doublePrecision("position").default(0).notNull(),

    shareToken: text("shareToken").unique(),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Workspace_creatorId_idx").on(table.creatorId),
    index("Workspace_orgId_idx").on(table.orgId),
  ],
);

export const workspacesRelations = relations(
  workspaces,
  ({ one, many }) => ({
    creator: one(user, {
      fields: [workspaces.creatorId],
      references: [user.id],
    }),
    doc: one(docs),
    canvas: one(canvases),
    agentPrompts: many(agentPrompts),
  }),
);
