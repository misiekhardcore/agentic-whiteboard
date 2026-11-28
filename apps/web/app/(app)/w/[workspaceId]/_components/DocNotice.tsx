"use client";

/** What the document area says while it is opening, or when it cannot open. */
export function DocNotice({ title, description }: { title: string; description: string }) {
  return (
    <div
      data-testid="doc-notice"
      className="doc-notice flex min-h-56 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <p className="doc-notice-title font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
