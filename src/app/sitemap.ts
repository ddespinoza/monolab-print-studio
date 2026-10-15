import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

/** One public page: the home page. /confirmar/* links are private and not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.SITE_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
  return [{ url: site, changeFrequency: "monthly", priority: 1 }];
}
