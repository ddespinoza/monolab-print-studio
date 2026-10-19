import Image from "next/image";
import { HexArt } from "@/components/HexArt";
import { MobileMenu } from "@/components/MobileMenu";
import {
  ABOUT,
  FAQ,
  HERO,
  MATERIALS,
  NAV,
  PUBLIC_EMAIL,
  PUBLIC_PHONE,
  SITE_NAME,
  STEPS,
} from "@/lib/content";

const wrap = "mx-auto w-full max-w-6xl px-4";
const btnPrimary =
  "inline-block rounded-lg bg-orange px-6 py-3 font-bold text-prussian-blue hover:bg-orange-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange";
const btnSecondary =
  "inline-block rounded-lg border-2 border-prussian-blue px-6 py-[0.6rem] font-bold text-prussian-blue hover:bg-canvas focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange";
const band =
  "bg-[linear-gradient(135deg,var(--prussian-blue),var(--bg-deep)_50%,var(--bg-deepest))]";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b-[3px] border-orange bg-prussian-blue">
      <div className={`${wrap} flex min-h-16 items-center justify-between gap-4`}>
        <a href="#inicio" className="flex min-h-11 items-center gap-3 text-app no-underline">
          <Image src="/brand/logo-icon.svg" alt="" width={52} height={34} priority />
          <span className="leading-tight">
            <span className="block font-black uppercase tracking-[0.15em]">Monolab</span>
            <small className="block text-[11px] font-bold uppercase tracking-[0.12em] text-orange">
              Print Studio
            </small>
          </span>
        </a>
        <MobileMenu />
        <nav aria-label="Principal" className="hidden gap-5 text-sm md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-app hover:text-orange focus-visible:text-orange"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section id="inicio" className={`${band} relative isolate overflow-hidden py-24 text-app`}>
      <HexArt id="hero-hex" />
      <div className={wrap}>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-orange">
          {HERO.eyebrow}
        </p>
        <h1 className="max-w-2xl text-[clamp(2rem,6vw,3.25rem)] font-black leading-tight">
          {HERO.title} <span className="text-gold-light">{HERO.accent}</span>
        </h1>
        <p className="mb-8 mt-4 max-w-xl text-lg">{HERO.text}</p>
        <a href="#pedido" className={btnPrimary}>
          {HERO.cta}
        </a>
      </div>
    </section>
  );
}

export function About() {
  const rep = ABOUT.representative;
  return (
    <section id="nosotros" className="bg-canvas py-16">
      <div className={wrap}>
        <div>
          <h2 className="mb-4 text-2xl font-bold text-main">{ABOUT.title}</h2>
          {ABOUT.paragraphs.map((p) => (
            <p key={p} className="mb-3">
              {p}
            </p>
          ))}
          <div className="mt-6 flex items-center gap-5">
            <Image
              src={rep.photo}
              alt={`${rep.name}, ${rep.role}`}
              width={160}
              height={160}
              className="h-28 w-28 shrink-0 rounded-full border-4 border-orange object-cover sm:h-40 sm:w-40"
            />
            <p className="m-0">
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">
                {rep.label}
              </span>
              <strong className="text-main">{rep.name}</strong>, {rep.role}
              <span className="block text-sm text-muted">
                N° de Registro {rep.registro} · RUN {rep.run}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="como" className="py-16">
      <div className={wrap}>
        <h2 className="mb-4 text-2xl font-bold text-main">Cómo funciona</h2>
        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-border-light bg-surface p-6 shadow-sm"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-prussian-blue font-black text-orange">
                {i + 1}
              </span>
              <h3 className="mb-1 text-lg font-bold text-main">{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Materials() {
  return (
    <section id="materiales" className="bg-canvas py-16">
      <div className={wrap}>
        <h2 className="mb-4 text-2xl font-bold text-main">Materiales</h2>
        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
          {MATERIALS.map((m) => (
            <div
              key={m.name}
              className="rounded-xl border border-border-light bg-surface p-6 shadow-sm"
            >
              <h3 className="mb-1 text-lg font-bold text-main">{m.name}</h3>
              <p className="mb-3">{m.text}</p>
              <div className="flex flex-wrap gap-2">
                {m.uses.map((u) => (
                  <span
                    key={u}
                    className="rounded-full border border-border-light bg-canvas px-3 py-0.5 text-[13px]"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="py-16">
      <div className={wrap}>
        <h2 className="mb-4 text-2xl font-bold text-main">Preguntas frecuentes</h2>
        {FAQ.map((f, i) => (
          <details
            key={f.q}
            open={i === 0}
            className="mb-2 rounded-lg border border-border-light bg-surface px-4"
          >
            <summary className="cursor-pointer py-3 font-semibold text-main">{f.q}</summary>
            <p className="m-0 pb-3">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Contact({
  whatsappHref,
  retiro,
  horario,
}: {
  whatsappHref: string;
  retiro: string;
  horario: string;
}) {
  return (
    <section id="contacto" className="py-16">
      <div className={wrap}>
        <h2 className="mb-4 text-2xl font-bold text-main">Contacto</h2>
        <ul className="grid gap-2">
          <li className="flex flex-wrap gap-3">
            <a href={whatsappHref} className={btnPrimary} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
            <a
              href={`mailto:${PUBLIC_EMAIL}?subject=${encodeURIComponent("Consulta a Monolab Print Studio")}`}
              className={btnSecondary}
            >
              Escribir por correo
            </a>
          </li>
          <li>
            Teléfono:{" "}
            <a
              href={`tel:${PUBLIC_PHONE.tel}`}
              className="font-semibold text-prussian-blue underline"
            >
              {PUBLIC_PHONE.display}
            </a>
          </li>
          <li>Correo: {PUBLIC_EMAIL}</li>
          <li>Retiro en: {retiro}</li>
          <li>Horario: {horario}</li>
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={`${band} pb-24 pt-8 text-sm text-app sm:py-8`}>
      <div className={`${wrap} flex items-center gap-3`}>
        <Image src="/brand/logo-icon.svg" alt="" width={44} height={28} />
        <span>© {SITE_NAME} · Creado por Daniel Espinoza Charrier</span>
      </div>
    </footer>
  );
}
