import { ArchivedWorkspaces } from "./_components/ArchivedWorkspaces";
import { ProjectsList } from "./_components/ProjectsList";
import { PromptSection } from "./_components/PromptSection";

export default function DashboardPage() {
  return (
    <div className="stack">
      <PromptSection />
      <ProjectsList />
      <ArchivedWorkspaces />
    </div>
  );
}
