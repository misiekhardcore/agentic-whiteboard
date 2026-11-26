"use client";

/** What the document area says while it is opening, or when it cannot open. */
export function DocNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="doc-notice" data-testid="doc-notice">
      <p className="doc-notice-title">{title}</p>
      <p className="muted">{description}</p>
    </div>
  );
}
