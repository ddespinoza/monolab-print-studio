import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

/** Everything public is crawlable; the API and the customer confirmation links are not. */
export default function robots(): MetadataRoute.Robots {
  const site = (process.env.SITE_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/confirmar/"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
