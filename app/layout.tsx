import "./globals.css";
import { SiteHeader } from "@/components/Site/SiteHeader";
import { cn } from "@/lib/utils";

import { FONT_CLASSNAMES } from "./constants";
import { siteMetadata } from "./metadata/siteMetadata";
import { siteViewport } from "./metadata/siteViewport";
import { Providers } from "./providers";

export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes (behind the library's ThemeProvider) renders an inline script
    // that sets the `dark` class before paint, so React must accept the DOM it
    // finds rather than the className it rendered.
    <html
      lang="en"
      className={cn("h-full", "antialiased", FONT_CLASSNAMES)}
      suppressHydrationWarning
    >
      <body className="flex h-svh flex-col overflow-hidden">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
