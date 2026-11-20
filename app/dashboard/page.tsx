import { RefreshOnChanges } from "@/components/Changes";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { ArchivedSection } from "./_components/ArchivedSection";
import { ComposerSection } from "./_components/ComposerSection";
import { ProjectsSection } from "./_components/ProjectsSection";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="stack">
      <RefreshOnChanges
        keys={[
          CHANGE_KEYS.workspaces,
          CHANGE_KEYS.conversations,
          CHANGE_KEYS.settings,
          CHANGE_KEYS.account,
        ]}
      />
      {/*
        The URL is read inside the section's own `<Suspense>` boundary: touching
        `searchParams` at the page level would block the shell Next prerenders,
        and this page has one because the composer reads it on every visit.
      */}
      <ComposerSection searchParams={searchParams} />
      <ProjectsSection />
      <ArchivedSection />
    </div>
  );
}
