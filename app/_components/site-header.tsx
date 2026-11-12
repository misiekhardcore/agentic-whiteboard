import { Suspense } from "react";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { SignButton } from "@/components/SignButton/SignButton";

import { HeaderBilling } from "./billing/header-billing";
import { BrandLockup } from "./brand";
import { HeaderThemeSwitcher } from "./header-theme-switcher";

export function SiteHeader() {
  return (
    // The header's height is a token, not a result of its content: the shell
    // never scrolls the document, so nothing here can be `sticky`, and the
    // sidebar subtracts this same height from its own.
    <header className="flex h-(--app-header-height) shrink-0 items-center justify-between gap-4 border-b px-6">
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
