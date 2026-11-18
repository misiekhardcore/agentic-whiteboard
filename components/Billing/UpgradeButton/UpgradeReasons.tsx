"use client";

import { Alert, AlertDescription, AlertTitle } from "@konopskidev/ui/components/alert";
import { TriangleAlert } from "lucide-react";

import type { UpgradeReason } from "@/lib/billing/plans";

/** Why the person is being asked to upgrade: one alert per limit reached. */
export function UpgradeReasons({ reasons }: { reasons: UpgradeReason[] }) {
  return (
    <div className="flex flex-col gap-2">
      {reasons.map((reason) => (
        <Alert key={reason.title}>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{reason.title}</AlertTitle>
          <AlertDescription>{reason.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
