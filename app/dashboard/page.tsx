import { ArchivedBoards } from "./_components/ArchivedBoards";
import { ProjectsList } from "./_components/ProjectsList";
import { WelcomeBanner } from "./_components/WelcomeBanner";

export default function DashboardPage() {
  return (
    <div className="stack">
      <WelcomeBanner />
      <ProjectsList />
      <ArchivedBoards />
    </div>
  );
}
