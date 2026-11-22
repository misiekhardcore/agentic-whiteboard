import type { WorkspaceCreator } from "./types";

/** The two columns `creatorColumns` selects for a joined creator. */
export type CreatorColumns = {
  creatorName: string | null;
  creatorImage: string | null;
};

/** The joined creator as a card shows them; null when the person's row is gone. */
export function withCreator<T extends CreatorColumns>(
  row: T,
): Omit<T, keyof CreatorColumns> & { creator: WorkspaceCreator | null } {
  const { creatorName, creatorImage, ...workspace } = row;

  return {
    ...workspace,
    creator: creatorName ? { name: creatorName, image: creatorImage } : null,
  };
}
