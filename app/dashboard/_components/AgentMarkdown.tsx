"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * An agent reply as the model wrote it. Replies are markdown, so headings,
 * lists, emphasis, links and fenced code have to survive the trip through a
 * streaming text area; rendering the raw text would show the syntax instead.
 *
 * `prose-article` supplies the house rhythm and keeps its serif for long-form
 * reading, which `font-sans` opts out of: a chat bubble is UI, not an article.
 */
export function AgentMarkdown({ children }: { children: string }) {
  return (
    <div className="prose-article font-sans text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // An in-app link should navigate, not reload the app; an external one
          // must not take over the dashboard tab.
          a: ({ href, children: linkText }) =>
            href?.startsWith("/") ? (
              <Link href={href}>{linkText}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {linkText}
              </a>
            ),
          // Replaces the bare <pre>; the code inside keeps its own element so
          // `prose-article` styles only inline code.
          pre: ({ children: code }) => (
            <pre className="my-3 overflow-x-auto rounded-sm border border-border bg-code p-3 font-mono text-xs leading-relaxed">
              {code}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
