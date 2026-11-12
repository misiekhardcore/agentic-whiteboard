import { ArchivedWorkspaces } from "./_components/ArchivedWorkspaces";
import { ProjectsList } from "./_components/ProjectsList";
import { PromptComposer } from "./_components/PromptComposer";

export default function DashboardPage() {
  return (
    <div className="stack">
      <PromptComposer />
      <ProjectsList />
      <ArchivedWorkspaces />
    </div>
  );
}
