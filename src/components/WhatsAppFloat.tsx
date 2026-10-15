export function WhatsAppFloat({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-4 right-4 z-20 rounded-full bg-orange px-5 py-3.5 font-extrabold text-prussian-blue shadow-lg hover:bg-orange-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange"
    >
      WhatsApp
    </a>
  );
}
