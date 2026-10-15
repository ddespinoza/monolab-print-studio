import type { Metadata } from "next";
import Link from "next/link";
import { HexArt } from "@/components/HexArt";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Header } from "@/components/sections";
import { viewConfirmation } from "@/lib/confirmation";
import { activeStep } from "@/lib/progress";
import { getRuntime } from "@/lib/runtime";
import { whatsappLink } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmar cotización | Monolab Print Studio",
  robots: { index: false },
};

const pill = "inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide";
const waLink =
  "inline-block rounded-full border border-prussian-blue px-3.5 py-1.5 text-[13px] font-bold text-prussian-blue no-underline hover:bg-canvas focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange";
const help =
  "mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-border-light pt-4 text-sm";

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rt = getRuntime();
  const view = await viewConfirmation(decodeURIComponent(token), rt.confirmDeps()).catch(() => ({
    status: "invalid" as const,
  }));
  const wa = whatsappLink(rt.config.whatsappNumber, view.status === "invalid" ? "" : view.orderId);
  const card =
    "relative mx-auto -mt-16 w-full max-w-[31rem] rounded-2xl border border-border-light bg-app p-7 shadow-[0_10px_30px_rgba(8,14,26,0.14)]";
  return (
    <>
      <Header />
      <div className="relative isolate h-32 overflow-hidden bg-[linear-gradient(135deg,var(--prussian-blue),var(--bg-deep)_60%,var(--bg-deepest))]">
        <HexArt id="confirm-hex" variant="band" />
      </div>
      <main className="flex-1 bg-canvas px-4 pb-12">
        {view.status === "ready" && (
          <div className={card}>
            <span className={`${pill} bg-orange text-prussian-blue`}>Cotización lista</span>
            <h1 className="mb-0.5 mt-3.5 text-2xl font-black leading-tight text-main">
              Confirme su cotización
            </h1>
            <p className="m-0 font-bold tracking-wide text-prussian-blue">Pedido {view.orderId}</p>
            <div className="my-5 rounded-r-lg border-l-4 border-orange bg-surface px-4 py-3.5">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Cotización
              </div>
              <p className="m-0 mt-1 whitespace-pre-line text-[17px] font-bold leading-snug text-main">
                {view.cotizacion}
              </p>
            </div>
            <ProgressSteps active={1} />
            <form action="/api/confirmar" method="post">
              <input type="hidden" name="token" value={decodeURIComponent(token)} />
              <button
                type="submit"
                className="min-h-12 w-full rounded-[10px] bg-orange px-5 py-3.5 text-[17px] font-bold text-prussian-blue hover:bg-orange-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange"
              >
                Confirmar cotización
              </button>
            </form>
            <p className="mt-2.5 text-center text-[13px] text-muted">
              Al confirmar, su pedido pasa a la cola de impresión.
            </p>
            <div className={help}>
              <span>¿Desea cambiar algo?</span>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={waLink}>
                Abrir WhatsApp
              </a>
            </div>
          </div>
        )}
        {view.status === "done" && (
          <div role="status" className={`${card} text-center`}>
            <div className="mx-auto mb-3.5 grid h-[52px] w-[52px] place-items-center rounded-full bg-prussian-blue">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--orange)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <span className={`${pill} bg-prussian-blue text-app`}>Cotización confirmada</span>
            <h1 className="mb-0.5 mt-3.5 text-2xl font-black leading-tight text-main">
              Gracias, quedó confirmada
            </h1>
            <p className="m-0 font-bold tracking-wide text-prussian-blue">Pedido {view.orderId}</p>
            <p className="mb-0 mt-2">
              Recibimos su confirmación y le avisaremos por correo cuando comience la producción.
            </p>
            <div className="mt-5">
              <ProgressSteps active={activeStep(view.estado)} />
            </div>
            <div className={help}>
              <span>¿Consultas?</span>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={waLink}>
                Abrir WhatsApp
              </a>
            </div>
          </div>
        )}
        {view.status === "invalid" && (
          <div role="alert" className={`${card} text-center`}>
            <div className="mx-auto mb-3.5 grid h-[52px] w-[52px] place-items-center rounded-full border-2 border-border-light bg-canvas text-xl font-black text-muted">
              !
            </div>
            <h1 className="mb-0 text-2xl font-black leading-tight text-main">
              Enlace no disponible
            </h1>
            <p className="mb-0 mt-2">
              Este enlace ya no es válido o el pedido ya fue confirmado. Si necesita ayuda,
              escríbanos y lo revisamos.
            </p>
            <div className={help}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={waLink}>
                Abrir WhatsApp
              </a>
              <Link href="/" className={`${waLink} border-border-light text-secondary`}>
                Volver al sitio
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
