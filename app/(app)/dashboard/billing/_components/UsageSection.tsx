import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { UsageMeter } from "@/components/Billing/UsageMeter";
import type { BillingOverview } from "@/lib/billing/overview";
import { limitLabels } from "@/lib/billing/plans";

/** The usage card: agent prompts for the period and workspaces for the account. */
export function UsageSection({ overview }: { overview: BillingOverview }) {
  const { agentPrompts, workspaces } = overview.usage;
  const reset = agentPrompts.periodEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          Agent prompts are counted per member for {agentPrompts.periodLabel}; workspaces are
          counted for the whole account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <UsageMeter
          label={limitLabels.agentPromptsPerMonth}
          used={agentPrompts.used}
          limit={agentPrompts.limit}
          title={`Agent prompts ${agentPrompts.periodLabel} · resets ${reset}`}
        />
        <p className="text-xs text-muted-foreground">
          {agentPrompts.periodLabel === "this billing period"
            ? `Resets ${reset}, at the end of the period you’ve paid for.`
            : `Resets ${reset}.`}
        </p>

        <UsageMeter
          label={limitLabels.workspaces}
          used={workspaces.used}
          limit={workspaces.limit}
        />
      </CardContent>
    </Card>
  );
}
