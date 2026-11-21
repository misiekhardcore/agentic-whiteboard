import { BILLING_CURRENCY, plans } from "@/lib/billing/plans";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_PUBLISHER, publicSiteUrl } from "@/lib/shared/brand";

/**
 * Structured data for the landing page only: the site, the company and the
 * product with its entry price. It is a plain script tag, which is how Next.js
 * documents JSON-LD; `<` is escaped so no value can close the script early.
 */
export function StructuredData() {
  const origin = publicSiteUrl();
  const url = new URL("/", origin).toString();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: BRAND_PUBLISHER,
        url,
        logo: new URL("/brand/icons/icon-512.png", origin).toString(),
      },
      {
        "@type": "WebSite",
        name: BRAND_NAME,
        url,
        description: BRAND_DESCRIPTION,
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: BRAND_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: BRAND_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: plans.free.priceUsd,
          priceCurrency: BILLING_CURRENCY,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
