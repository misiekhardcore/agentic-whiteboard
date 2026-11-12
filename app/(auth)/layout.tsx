import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // The shell never scrolls the document, so the auth pages scroll here; a
    // short window (or a browser password manager) would otherwise clip the form.
    <main className="flex flex-1 items-center justify-center overflow-y-auto bg-muted px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
