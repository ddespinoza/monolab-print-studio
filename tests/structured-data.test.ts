/* eslint-disable @typescript-eslint/no-explicit-any -- schema.org nodes are free-form JSON; the assertions below check their shape */
import { describe, expect, it } from "vitest";
import { FAQ } from "@/lib/content";
import { buildStructuredData, serializeJsonLd } from "@/lib/structured-data";

const site = "https://monolabprintstudio.cl";
const graph = buildStructuredData(site)["@graph"];
const byType = (t: string) =>
  graph.find((n) => n["@type"] === t || (Array.isArray(n["@type"]) && n["@type"].includes(t)));

describe("buildStructuredData", () => {
  it("describes the business in Santiago, Chile with its public email and logo", () => {
    const b = byType("LocalBusiness") as Record<string, any>;
    expect(b.name).toBe("Monolab Print Studio");
    expect(b.url).toBe(site);
    expect(b.email).toBe("contacto@monolabprintstudio.cl");
    expect(b.address).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: "Río Guadiana 8672",
      addressLocality: "Las Condes",
      addressRegion: "Región Metropolitana de Santiago",
      addressCountry: "CL",
    });
    expect(b.areaServed).toMatchObject({ name: "Santiago" });
    expect(b.logo).toBe(`${site}/icon-512.png`);
    expect(b.image).toBe(`${site}/og-image.png`);
  });
  it("names the representative with his title and photo, never his RUN or registry number", () => {
    const text = JSON.stringify(buildStructuredData(site));
    const person = (byType("LocalBusiness") as Record<string, any>).employee;
    expect(person).toMatchObject({
      "@type": "Person",
      name: "Antonio Alvear Muñoz",
      jobTitle: "Odontólogo",
    });
    expect(person.image).toBe(`${site}/brand/antonio-alvear.jpg`);
    expect(text).not.toContain("19.069.824");
    expect(text).not.toContain("727145");
  });
  it("publishes the studio phone in international format", () => {
    expect((byType("LocalBusiness") as Record<string, any>).telephone).toBe("+56948623705");
  });
  it("marks up the site and the FAQ exactly as shown on the page", () => {
    expect(byType("WebSite")).toMatchObject({ url: site, inLanguage: "es-CL" });
    const faq = byType("FAQPage") as Record<string, any>;
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    expect(faq.mainEntity[0]).toEqual({
      "@type": "Question",
      name: FAQ[0].q,
      acceptedAnswer: { "@type": "Answer", text: FAQ[0].a },
    });
  });
  it("strips a trailing slash from the site address", () => {
    expect((buildStructuredData(`${site}/`)["@graph"][0] as Record<string, any>).url).toBe(site);
  });
});

describe("serializeJsonLd", () => {
  it("escapes characters that could close the script tag", () => {
    const out = serializeJsonLd({ a: "</script><script>alert(1)</script> & <b>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).a).toBe("</script><script>alert(1)</script> & <b>");
  });
});
