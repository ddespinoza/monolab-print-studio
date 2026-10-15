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

export const dynamic = "force-dynamic";

export default async function Home() {
  const rt = getRuntime();
  const { RETIRO_DIRECCION: retiro, RETIRO_HORARIO: horario } = await rt.sheetConfig();
  const whatsappHref = `https://wa.me/${rt.config.whatsappNumber}`;
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <section id="pedido" className="bg-canvas py-16">
          <div className="mx-auto w-full max-w-6xl px-4">
            <h2 className="mb-4 text-2xl font-bold text-main">Su solicitud</h2>
            <OrderSection
              whatsappNumber={rt.config.whatsappNumber}
              retiro={retiro}
              maxUploadMb={rt.config.maxUploadMb}
            />
          </div>
        </section>
        <Materials />
        <Faq />
        <Contact whatsappHref={whatsappHref} retiro={retiro} horario={horario} />
      </main>
      <Footer />
      <WhatsAppFloat href={whatsappHref} />
    </>
  );
}
