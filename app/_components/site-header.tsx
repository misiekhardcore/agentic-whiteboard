import { SignButton } from "@/components/SignButton/SignButton";
import Link from "next/link";
import { Suspense } from "react";

export function SiteHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3 top-0 sticky z-10">
      <Link href="/" className="font-medium">
        Agentic whiteboard
      </Link>
      <Suspense fallback={null}>
        <SignButton />
      </Suspense>
    </header>
  );
}
