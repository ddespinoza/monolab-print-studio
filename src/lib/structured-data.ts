import { ABOUT, FAQ, PUBLIC_ADDRESS, PUBLIC_EMAIL, PUBLIC_PHONE, SITE_NAME } from "@/lib/content";

type Json = Record<string, unknown>;

/**
 * schema.org data for search engines (LocalBusiness, WebSite, FAQPage), built from the same copy the page shows.
 * Left out on purpose: the representative's RUN / registry number.
 */
export function buildStructuredData(siteUrl: string): { "@context": string; "@graph": Json[] } {
  const site = siteUrl.replace(/\/+$/, "");
  const rep = ABOUT.representative;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": `${site}/#negocio`,
        name: SITE_NAME,
        url: site,
        description: ABOUT.paragraphs[0],
        email: PUBLIC_EMAIL,
        telephone: PUBLIC_PHONE.tel,
        logo: `${site}/icon-512.png`,
        image: `${site}/og-image.png`,
        address: {
          "@type": "PostalAddress",
          streetAddress: PUBLIC_ADDRESS.street,
          addressLocality: PUBLIC_ADDRESS.commune,
          addressRegion: "Región Metropolitana de Santiago",
          addressCountry: "CL",
        },
        areaServed: { "@type": "City", name: "Santiago" },
        knowsAbout: [
          "Impresión 3D en resina",
          "Odontología digital",
          "Modelos de estudio dentales",
        ],
        employee: {
          "@type": "Person",
          name: rep.name,
          jobTitle: rep.role,
          image: `${site}${rep.photo}`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#sitio`,
        url: site,
        name: SITE_NAME,
        inLanguage: "es-CL",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

/** JSON for an inline `<script type="application/ld+json">`: `<` is escaped so the data can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
