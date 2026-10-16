import type { Metadata } from "next";
import { OrderSection } from "@/components/OrderSection";
import {
  About,
  Contact,
  Faq,
  Footer,
  Header,
  Hero,
  HowItWorks,
  Materials,
} from "@/components/sections";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { getRuntime } from "@/lib/runtime";
import { buildStructuredData, serializeJsonLd } from "@/lib/structured-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const rt = getRuntime();
  const { RETIRO_DIRECCION: retiro, RETIRO_HORARIO: horario } = await rt.sheetConfig();
  const whatsappHref = `https://wa.me/${rt.config.whatsappNumber}`;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildStructuredData(rt.config.siteUrl)),
        }}
      />
      <Header />
      <main>
        <Hero />
        <section id="pedido" className="bg-canvas py-16">
          <div className="mx-auto w-full max-w-6xl px-4">
            <h2 className="mb-4 text-2xl font-bold text-main">Tu solicitud</h2>
            <OrderSection
              whatsappNumber={rt.config.whatsappNumber}
              retiro={retiro}
              maxUploadMb={rt.config.maxUploadMb}
            />
          </div>
        </section>
        <HowItWorks />
        <Materials />
        <Faq />
        <About />
        <Contact whatsappHref={whatsappHref} retiro={retiro} horario={horario} />
      </main>
      <Footer />
      <WhatsAppFloat href={whatsappHref} />
    </>
  );
}
