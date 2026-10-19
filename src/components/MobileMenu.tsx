"use client";

import { useState } from "react";
import { NAV } from "@/lib/content";

/** Phones have no room for the nav row: a menu button opens the same links in a panel under the header. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen(!open)}
        className="min-h-11 rounded-lg border-2 border-orange px-4 text-sm font-bold text-app"
      >
        {open ? "Cerrar" : "Menú"}
      </button>
      {open && (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="absolute inset-x-0 top-full grid border-b-[3px] border-orange bg-prussian-blue px-4 pb-3"
        >
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center border-t border-border-brand text-app"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
