import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Button } from "@konopskidev/ui/components/button";
import { Folder } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BoardCard } from "@/app/dashboard/_components/BoardCard";
import { CreateNewBoardDialog } from "@/app/dashboard/_components/CreateNewBoardDialog";
import { getSessionAccount } from "@/lib/account";
import { listAccountWorkspaces } from "@/lib/workspaces";

export const metadata = {
  title: "All boards",
};

// The list depends on the signed-in account, so it renders per request.
export const instant = false;

/**
 * Every active board in the selected account. The dashboard only shows the
 * latest handful of boards, docs and canvases; this page is the full list, and
 * mutations revalidate both paths.
 */
export default async function WorkspacesPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/sign-in?redirectTo=/workspaces");

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const boards = await listAccountWorkspaces(
    session.user.id,
    activeTeam?.id ?? null,
  );

  return (
    <div className="stack">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All boards</h1>
          <p className="text-sm text-muted-foreground">
            Every active board in {accountName}. The dashboard shows the
            latest five boards, docs and canvases.
          </p>
        </div>
        <CreateNewBoardDialog size="sm" variant="outline" />
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={<Folder height={64} width={64} className="text-primary" />}
          title={`No boards in ${accountName}`}
          description={
            activeTeam
              ? `Boards shared with ${activeTeam.name} will appear here.`
              : "You haven't created any personal boards yet."
          }
          action={<CreateNewBoardDialog size="sm" variant="outline" />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {boards.length} {boards.length === 1 ? "board" : "boards"} in
            this account.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </ul>
        </div>
      )}

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
    </div>
  );
}
