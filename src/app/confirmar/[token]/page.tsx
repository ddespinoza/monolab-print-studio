import type { Metadata } from "next";
import { Header } from "@/components/sections";
import { viewConfirmation } from "@/lib/confirmation";
import { whatsappLink } from "@/lib/templates";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmar cotización | Monolab Print Studio",
  robots: { index: false },
};

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rt = getRuntime();
  const view = await viewConfirmation(decodeURIComponent(token), rt.confirmDeps()).catch(() => ({
    status: "invalid" as const,
  }));
  const wa = whatsappLink(rt.config.whatsappNumber, view.status === "invalid" ? "" : view.orderId);
  const card =
    "mx-auto max-w-xl rounded-xl border-2 border-prussian-blue bg-surface p-8 text-center";
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        {view.status === "ready" && (
          <div className={card}>
            <h1 className="mb-2 text-2xl font-bold text-main">Confirme su cotización</h1>
            <p className="mb-3 inline-block rounded-lg bg-canvas px-4 py-1 text-3xl font-black tracking-widest text-prussian-blue">
              {view.orderId}
            </p>
            <div className="my-4 rounded-xl border border-border-light bg-app p-4 text-left">
              <strong className="text-main">Cotización</strong>
              <p className="m-0 whitespace-pre-line">{view.cotizacion}</p>
            </div>
            <form action="/api/confirmar" method="post">
              <input type="hidden" name="token" value={decodeURIComponent(token)} />
              <button
                type="submit"
                className="rounded-lg bg-orange px-6 py-3 font-bold text-prussian-blue hover:bg-orange-dark"
              >
                Confirmar cotización
              </button>
            </form>
            <p className="mt-4 text-sm text-muted">
              ¿Desea cambiar algo?{" "}
              <a href={wa} className="underline">
                Escríbanos por WhatsApp
              </a>
              .
            </p>
          </div>
        )}
        {view.status === "done" && (
          <div role="status" className={card}>
            <h1 className="mb-2 text-2xl font-bold text-main">Cotización confirmada</h1>
            <p>
              Gracias. Recibimos su confirmación del pedido {view.orderId} y le avisaremos cuando
              comience la producción.
            </p>
          </div>
        )}
        {view.status === "invalid" && (
          <div role="alert" className={card}>
            <h1 className="mb-2 text-2xl font-bold text-main">Enlace no disponible</h1>
            <p>
              Este enlace ya no es válido o el pedido ya fue confirmado. Si necesita ayuda,{" "}
              <a href={wa} className="underline">
                escríbanos por WhatsApp
              </a>
              .
            </p>
          </div>
        )}
      </main>
    </>
  );
}
