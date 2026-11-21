# Metadata and branding

The public surface search engines, social cards and install prompts read: one
brand source, one metadata source, and an explicit indexing policy.

## Sources of truth

| What                                   | Lives in                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| Name, tagline, description, home title | `lib/shared/brand/brand.ts`                                    |
| Literal colours for non-CSS surfaces   | `lib/shared/brand/brandColors.ts`                              |
| Public origin (`NEXT_PUBLIC_SITE_URL`) | `lib/shared/brand/publicSiteUrl.ts`                            |
| Site metadata and viewport             | `app/metadata/siteMetadata.ts`, `app/metadata/siteViewport.ts` |
| Homepage metadata                      | `app/metadata/homeMetadata.ts`                                 |
| `noindex` for private routes           | `app/metadata/privateMetadata.ts`                              |
| Mark geometry                          | `public/brand/mark.svg`, mirrored by `app/icon.svg`            |
| Generated icons                        | `pnpm brand:assets`                                            |

`public/brand/mark.svg` is the one vector source: the header mark renders that
file, and `scripts/generate-brand-assets.mjs` rasterises it into `favicon.ico`,
`icon.svg`, `apple-icon.png` and the manifest icons. Chromium comes from
Playwright, so regenerating adds no dependency. The output is committed because
the manifest needs stable URLs and CI should not launch a browser to build.

The wordmark's "AI" is the only gradient in the identity (`--brand-ai-*` in
`app/globals.css`), amber into magenta. Social cards use solid magenta for those
letters because the image renderer does not reliably paint gradient text.

## Indexing policy

- The landing page is the only indexable route and the only entry in the
  sitemap. It carries the canonical URL, Open Graph and Twitter metadata, and
  `SoftwareApplication` JSON-LD.
- Signed-in pages (`/dashboard`, `/workspaces`, `/workspace/:id`), the auth
  pages and `/invite/:id` export `robots: { index: false, follow: false }`.
  Layouts carry it so a new page inherits the directive. They also set
  `alternates.canonical` to `null`: inheriting the homepage canonical would tell
  a crawler the private page is a duplicate of the marketing page.
- Only `/dashboard` names itself in the layout because it has no page metadata of
  its own; every other route titles its page.
- `robots.txt` disallows the app and `/api/`, but deliberately allows the auth
  and invitation routes: a blocked URL cannot be read, so its `noindex` would
  never take effect and it could still be listed without a snippet.
- `robots.txt` is crawl management, not access control. Ownership is still
  enforced by the proxy and by the workspace queries.

## Deliberate omissions

- No `keywords`: search engines ignore the tag.
- No verification tokens: none exist yet. When one does, it belongs in
  `siteMetadata.verification`, sourced from an environment variable.
- No `lastModified` in the sitemap: a timestamp that moves on every deploy does
  not describe a content change.

## The name

"WorkspAIce" replaced "Agentic Whiteboard" in everything a person reads: UI,
emails, Stripe product names, agent instructions, docs and the manifest. Stable
technical identifiers keep the original name: the npm package
`agentic-whiteboard`, the Postgres database and the Docker service names.
Renaming those is a data migration, not branding.
