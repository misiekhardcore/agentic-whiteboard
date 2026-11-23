ALTER TABLE "canvas" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A workspace has a canvas becomes an invariant, so every existing workspace
-- gains the one it should always have had. The row starts empty (`content` is
-- null) and at revision 0; the live room is created on the first connection.
INSERT INTO "canvas" ("id", "workspaceId")
SELECT 'canvas_' || "id", "id"
FROM "workspace" AS "workspace"
WHERE NOT EXISTS (
	SELECT 1 FROM "canvas" AS "canvas" WHERE "canvas"."workspaceId" = "workspace"."id"
);
