import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/account";
import { listAccountWorkspaces } from "@/lib/workspaces";
import { Button } from "@konopskidev/ui/components/button";
import { Folder } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export function ProjectsList() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsListInner />
    </Suspense>
  );
}

async function ProjectsListInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const boards = await listAccountWorkspaces(
    session.user.id,
    activeTeam?.id ?? null,
  );

  if (boards.length === 0) {
    return (
      <EmptyState
        icon={<Folder height={64} width={64} className="text-primary" />}
        title={`No boards in ${accountName}`}
        description={
          activeTeam
            ? `Boards shared with ${activeTeam.name} will appear here.`
            : "You haven't created any personal boards yet."
        }
        action={<Button size="sm">+ Create new board</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">{accountName} boards</h2>
        <p className="text-sm text-muted-foreground">
          {boards.length} {boards.length === 1 ? "board" : "boards"} in this
          account.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {boards.map((board) => (
          <li key={board.id}>
            <Link
              href={`/workspace/${board.id}`}
              className="card flex h-full flex-col gap-2 p-4 transition-colors hover:border-primary/40"
            >
              <span className="font-medium">{board.name}</span>
              {board.description ? (
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {board.description}
                </span>
              ) : null}
              <span className="mt-auto font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                {board.status.replace(/_/g, " ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
