import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/account";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

export function WelcomeBanner() {
  return (
    <Suspense fallback={<Loading />}>
      <WelcomeBannerInner />
    </Suspense>
  );
}

async function WelcomeBannerInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { activeTeam, session } = account;

  return (
    <Card className="topo-bg">
      <CardHeader>
        <CardTitle className="text-h1 font-bold">
          Welcome back,{" "}
          <span className="bg-linear-to-l from-purple-700 to-blue-700 bg-clip-text text-transparent capitalize">
            {session.user.name}!
          </span>
        </CardTitle>
        <CardDescription>
          {activeTeam
            ? `Working in ${activeTeam.name}. `
            : "Personal account. "}
          Bring your ideas to life on an infinite canvas.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-4">
        <CreateWorkspaceDialog variant="secondary" className="shadow" />
        <Button variant="primary" className="shadow">
          <Sparkles />
          Create with AI
        </Button>
      </CardFooter>
    </Card>
  );
}
