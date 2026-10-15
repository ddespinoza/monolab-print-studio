import { whatsappLink } from "@/lib/whatsapp";

export interface Summary {
  orderId: string;
  nFiles: number;
  volumeCm3: number;
  resina: string;
  cantidad: number;
  entrega: string;
  paciente: string;
  retiro: string;
}

export function SuccessPanel({
  summary: s,
  whatsappNumber,
}: {
  summary: Summary;
  whatsappNumber: string;
}) {
  return (
    <div
      role="status"
      className="mx-auto max-w-xl rounded-xl border-2 border-prussian-blue bg-surface p-8 text-center"
    >
      <h2 className="mb-2 text-2xl font-bold text-main">Recibimos su solicitud</h2>
      <p className="mb-2 inline-block rounded-lg bg-canvas px-4 py-1 text-3xl font-black tracking-widest text-prussian-blue">
        {s.orderId}
      </p>
      <p>
        <strong>Guarde este número.</strong> Lo necesitará para cualquier consulta.
      </p>
      <ul className="mx-auto my-4 max-w-sm list-disc pl-5 text-left">
        <li>
          {s.nFiles} {s.nFiles === 1 ? "archivo" : "archivos"} ·{" "}
          {s.volumeCm3.toFixed(1).replace(".", ",")} cm³
        </li>
        <li>Paciente: {s.paciente}</li>
        <li>
          Resina: {s.resina} · Copias: {s.cantidad}
        </li>
        <li>Entrega: {s.entrega}</li>
        <li>Retiro en: {s.retiro}</li>
      </ul>
      <p>
        Le enviamos la confirmación a su correo. Revisaremos su solicitud y le enviaremos la
        cotización con un enlace para confirmarla.
      </p>
      <a
        href={whatsappLink(whatsappNumber, s.orderId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-orange px-6 py-3 font-bold text-prussian-blue hover:bg-orange-dark"
      >
        Escribir por WhatsApp
      </a>
    </div>
  );
}
