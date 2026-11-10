import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { SignButton } from "@/components/SignButton/SignButton";
import { Suspense } from "react";

import { BrandLockup } from "./brand";

export function SiteHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3 top-0 sticky z-10">
      <BrandLockup href="/" textClassName="text-base" />
      <nav className="flex items-center gap-4">
        <Suspense fallback={null}>
          <SignButton />
        </Suspense>
        <AccountMenu />
      </nav>
    </header>
  );
}
