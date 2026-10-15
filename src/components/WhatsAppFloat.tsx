"use client";

import { useEffect, useState } from "react";

/** Floating contact button. It hides while the order form is on screen so it never covers a field. */
export function WhatsAppFloat({ href }: { href: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const order = document.getElementById("pedido");
    if (!order || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(order);
    return () => observer.disconnect();
  }, []);
  if (hidden) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-4 right-4 z-20 min-h-11 rounded-full bg-orange px-4 py-2.5 text-sm font-extrabold text-prussian-blue shadow-lg hover:bg-orange-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange sm:px-5 sm:py-3.5 sm:text-base"
    >
      WhatsApp
    </a>
  );
}
