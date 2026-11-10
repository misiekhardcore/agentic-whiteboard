"use client";

import {
  ThemeProvider,
  useTheme,
} from "@konopskidev/ui/components/theme-provider";
import { TooltipProvider } from "@konopskidev/ui/components/tooltip";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster richColors theme={resolvedTheme === "dark" ? "dark" : "light"} />
  );
}
