import { ArchivedWorkspaces } from "./_components/ArchivedWorkspaces";
import { ProjectsList } from "./_components/ProjectsList";
import { PromptSection } from "./_components/PromptSection";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="stack">
      {/*
        The URL is read inside the section's own `<Suspense>` boundary: touching
        `searchParams` at the page level would block the shell Next prerenders,
        and this page has one because the composer reads it on every visit.
      */}
      <PromptSection searchParams={searchParams} />
      <ProjectsList />
      <ArchivedWorkspaces />
    </div>
  );
}
