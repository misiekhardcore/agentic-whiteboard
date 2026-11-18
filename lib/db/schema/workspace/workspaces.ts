import { createId } from "@paralleldrive/cuid2";
import { doublePrecision, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { workspaceStatusEnum } from "./workspaceStatusEnum";

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

    /**
     * Soft delete: archived workspaces disappear from the dashboard and stop
     * counting against the plan, but keep their stage, documents and agent
     * history so restoring them puts everything back.
     */
    archivedAt: timestamp("archivedAt", { precision: 3, mode: "date" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),

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
