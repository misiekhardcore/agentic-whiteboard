import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

import type { promptFailure } from "@/lib/ai/thread/transport/promptFailure";
import { routes } from "@/lib/shared/routes";

export function PromptFailureAlert({
  failure,
  isBusy,
  onRetry,
}: {
  failure: ReturnType<typeof promptFailure>;
  isBusy: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>{failure.message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isBusy}>
          <RotateCcw />
          Retry
        </Button>
        {failure.limitReached && (
          <Link href={routes.dashboardBilling} className="font-medium underline underline-offset-4">
            View plans
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
