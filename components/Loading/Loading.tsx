import { Spinner } from "@konopskidev/ui/components/spinner";

import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  label?: string;
}

export function Loading({ className, label = "Loading..." }: LoadingProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Spinner className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}
