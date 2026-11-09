import { Loading } from "@/components/Loading/Loading";
import { auth } from "@/lib/auth";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { Sparkles } from "lucide-react";
import { headers } from "next/headers";
import { Suspense } from "react";
import { CreateNewBoardDialog } from "./CreateNewBoardDialog";

export function WelcomeBanner() {
  return (
    <Suspense fallback={<Loading />}>
      <WelcomeBannerInner />
    </Suspense>
  );
}

async function WelcomeBannerInner() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <Card className="p-4 bg-radial-[at_25%_25%] from-blue-200 to-purple-200 border-border shadow">
      <CardHeader>
        <CardTitle className="text-h1 font-bold">
          Welcome back,{" "}
          <span className="bg-linear-to-l from-purple-700 to-blue-700 bg-clip-text text-transparent capitalize">
            {session.user.name}!
          </span>
        </CardTitle>
        <CardDescription>
          Bring your ideas to life on an infinite canvas.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-4">
        <CreateNewBoardDialog variant="secondary" className="shadow" />
        <Button variant="primary" className="shadow">
          <Sparkles />
          Create with AI
        </Button>
      </CardFooter>
    </Card>
  );
}
