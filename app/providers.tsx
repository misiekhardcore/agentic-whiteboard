import { TooltipProvider } from "@konopskidev/ui/components/tooltip";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster richColors/>
    </TooltipProvider>
  );
}
