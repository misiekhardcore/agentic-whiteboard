import { Suspense } from "react";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { SignButton } from "@/components/SignButton/SignButton";

import { HeaderBilling } from "./billing/header-billing";
import { BrandLockup } from "./brand";
import { HeaderThemeSwitcher } from "./header-theme-switcher";

export function SiteHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3 top-0 sticky z-10">
      <BrandLockup href="/" textClassName="text-base" />
      <nav className="flex items-center gap-4">
        <HeaderThemeSwitcher />
        <Suspense fallback={null}>
          <SignButton />
        </Suspense>
        <Suspense fallback={null}>
          <HeaderBilling />
        </Suspense>
        <AccountMenu />
      </nav>
    </header>
  );
}
