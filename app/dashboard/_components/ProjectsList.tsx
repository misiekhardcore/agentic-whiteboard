import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { db } from "@/lib/db";
import { Button } from "@konopskidev/ui/components/button";
import { Folder } from "lucide-react";
import { Suspense } from "react";

export function ProjectsList() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsListInner />
    </Suspense>
  );
}

async function ProjectsListInner() {
  const projects = await db.query.user.findMany();

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={<Folder height={64} width={64} className="text-primary" />}
        title="No projects found"
        description="You haven't created any projects yet."
        action={<Button size='sm'>+ Create new board</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold">Your Projects</h2>
      <p className="text-sm text-muted-foreground">
        Here are your recent projects.
      </p>
    </div>
  );
}
