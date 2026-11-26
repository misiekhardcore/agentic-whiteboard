import type { Actor, RoomOwnerPort } from "@v2/contracts";

/** The workspace fields authorization needs. The database row is mapped to this. */
export type WorkspaceRecord = {
  id: string;
  name: string;
  accountId: string;
  docRoomId: string;
  archived: boolean;
};

/** A metadata port implemented by the app; the kernel never opens a connection. */
export type WorkspaceReader = {
  findById(id: string): Promise<WorkspaceRecord | null>;
};

export type CapabilityContext = {
  actor: Actor;
  workspaces: WorkspaceReader;
  rooms: RoomOwnerPort;
};
