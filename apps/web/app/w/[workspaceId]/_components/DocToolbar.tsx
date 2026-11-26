"use client";

import type { Editor } from "@tiptap/react";

/**
 * Formatting for the document. In a read-only workspace every control is
 * disabled; the room refuses the write anyway, so this is honesty rather than
 * the enforcement.
 */
export function DocToolbar({ editor, readOnly }: { editor: Editor | null; readOnly: boolean }) {
  const disabled = readOnly || editor === null;

  const button = (label: string, active: boolean, run: () => void) => (
    <button
      type="button"
      className={active ? "doc-tool active" : "doc-tool"}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        if (!disabled) run();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="doc-toolbar" role="toolbar" aria-label="Formatting" aria-disabled={disabled}>
      {button("Bold", editor?.isActive("bold") ?? false, () =>
        editor?.chain().focus().toggleBold().run(),
      )}
      {button("Italic", editor?.isActive("italic") ?? false, () =>
        editor?.chain().focus().toggleItalic().run(),
      )}
      {button("Strike", editor?.isActive("strike") ?? false, () =>
        editor?.chain().focus().toggleStrike().run(),
      )}
      {button("Heading", editor?.isActive("heading", { level: 2 }) ?? false, () =>
        editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      {button("Bullets", editor?.isActive("bulletList") ?? false, () =>
        editor?.chain().focus().toggleBulletList().run(),
      )}
      {button("Numbers", editor?.isActive("orderedList") ?? false, () =>
        editor?.chain().focus().toggleOrderedList().run(),
      )}
      {button("Quote", editor?.isActive("blockquote") ?? false, () =>
        editor?.chain().focus().toggleBlockquote().run(),
      )}
    </div>
  );
}
