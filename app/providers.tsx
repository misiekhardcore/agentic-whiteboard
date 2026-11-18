"use client";

import { ThemeProvider, useTheme } from "@konopskidev/ui/components/theme-provider";
import { TooltipProvider } from "@konopskidev/ui/components/tooltip";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ChangesProvider } from "@/components/Changes";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {/* One subscription for the whole app: a change reaches every open tab. */}
        <ChangesProvider>{children}</ChangesProvider>
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return <Toaster richColors theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}
