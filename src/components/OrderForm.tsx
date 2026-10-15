"use client";

import { ENTREGA_LABELS, MACHINE, RESIN_OPTIONS } from "@/lib/content";
import { ENTREGAS } from "@/lib/validation";

export interface FormValues {
  nombre: string;
  paciente: string;
  telefono: string;
  email: string;
  resina: string;
  entrega: string;
  cantidad: string;
  notas: string;
  empresa: string;
}

export const emptyForm: FormValues = {
  nombre: "",
  paciente: "",
  telefono: "",
  email: "",
  resina: RESIN_OPTIONS[0].value,
  entrega: ENTREGAS[0].id,
  cantidad: "1",
  notas: "",
  empresa: "",
};

interface Props {
  values: FormValues;
  errors: Partial<Record<keyof FormValues | "files", string>>;
  retiro: string;
  submitting: boolean;
  /** Files are still being read or uploaded. */
  busy?: boolean;
  disabled: boolean;
  hint?: string;
  formError?: string;
  whatsappHref: string;
  onChange: (patch: Partial<FormValues>) => void;
  onSubmit: () => void;
}

const field =
  "w-full rounded-lg border border-border-medium bg-surface px-3 py-2.5 text-main placeholder:text-muted";
const label = "mb-1 block text-sm font-semibold text-main";

function Err({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p
      id={id}
      role="alert"
      className="mt-1 border-l-[3px] border-prussian-blue pl-2 text-[13px] text-main"
    >
      {message}
    </p>
  ) : null;
}

export function OrderForm({
  values: v,
  errors,
  retiro,
  submitting,
  busy = false,
  disabled,
  hint,
  formError,
  whatsappHref,
  onChange,
  onSubmit,
}: Props) {
  const input = (
    id: keyof FormValues,
    text: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        value={v[id]}
        onChange={(e) => onChange({ [id]: e.target.value })}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-err` : undefined}
        className={field}
        {...props}
      />
      <Err id={`${id}-err`} message={errors[id]} />
    </div>
  );
  return (
    <form
      aria-label="Datos de la solicitud"
      noValidate
      onSubmit={(e) => (e.preventDefault(), onSubmit())}
      className="grid gap-3"
    >
      <div>
        <label htmlFor="resina" className={label}>
          Tipo de resina *
        </label>
        <select
          id="resina"
          value={v.resina}
          onChange={(e) => onChange({ resina: e.target.value })}
          className={field}
        >
          {RESIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Err id="resina-err" message={errors.resina} />
      </div>
      <div className="rounded-lg border-[1.5px] border-prussian-blue border-l-4 border-l-orange bg-surface px-3.5 py-2.5">
        <span className="float-right rounded bg-prussian-blue px-1.5 py-0.5 text-[10px] font-bold text-app">
          CALIBRADA
        </span>
        <span className="text-sm text-muted">Equipo de impresión</span>
        <strong className="block text-prussian-blue">{MACHINE.name}</strong>
        <span className="text-sm text-muted">Volumen máximo: {MACHINE.volume}</span>
      </div>
      {input("cantidad", "Cantidad de copias *", {
        type: "number",
        min: 1,
        max: 100,
        inputMode: "numeric",
      })}
      <div className="grid gap-3 sm:grid-cols-2">
        {input("nombre", "Nombre del odontólogo/a *", {
          placeholder: "Ej.: Dra. Matías Gómez",
          autoComplete: "name",
        })}
        <div>
          <label htmlFor="paciente" className={label}>
            Iniciales del paciente *
          </label>
          <input
            id="paciente"
            value={v.paciente}
            maxLength={8}
            placeholder="Ej.: A. P."
            onChange={(e) => onChange({ paciente: e.target.value })}
            aria-describedby="paciente-help paciente-err"
            aria-invalid={Boolean(errors.paciente)}
            className={field}
          />
          <span id="paciente-help" className="text-xs text-muted">
            Solo iniciales, para proteger sus datos.
          </span>
          <Err id="paciente-err" message={errors.paciente} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {input("telefono", "Teléfono *", {
          type: "tel",
          placeholder: "+56 9 1234 5678",
          autoComplete: "tel",
        })}
        {input("email", "Correo electrónico *", {
          type: "email",
          placeholder: "correo@ejemplo.cl",
          autoComplete: "email",
        })}
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className={label}>Tiempo de entrega *</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENTREGAS.map((e) => (
            <label
              key={e.id}
              className={`cursor-pointer rounded-xl border bg-surface p-4 ${v.entrega === e.id ? "border-prussian-blue ring-2 ring-prussian-blue" : "border-border-light"}`}
            >
              <input
                type="radio"
                name="entrega"
                checked={v.entrega === e.id}
                onChange={() => onChange({ entrega: e.id })}
                className="mr-2"
              />
              <strong className="text-main">{ENTREGA_LABELS[e.id].title}</strong>
              <br />
              <span className="text-sm text-muted">{ENTREGA_LABELS[e.id].fee}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="notas" className={label}>
          Notas técnicas
        </label>
        <textarea
          id="notas"
          rows={3}
          value={v.notas}
          onChange={(e) => onChange({ notas: e.target.value })}
          placeholder="Orientación, cara crítica, tolerancia, tono de la resina u otras indicaciones"
          className={field}
        />
        <Err id="notas-err" message={errors.notas} />
      </div>
      <input
        name="empresa"
        value={v.empresa}
        onChange={(e) => onChange({ empresa: e.target.value })}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px]"
      />
      <p className="m-0 text-sm text-muted">Retiro en: {retiro}</p>
      {formError && (
        <p
          role="alert"
          className="m-0 rounded border-l-4 border-prussian-blue bg-canvas px-3 py-2 text-sm text-main"
        >
          {formError}{" "}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline">
            Escribir por WhatsApp
          </a>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled || submitting}
          className="rounded-lg bg-orange px-6 py-3 font-bold text-prussian-blue hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Solicitar cotización"}
        </button>
        {(submitting || busy) && (
          <span role="status" className="flex items-center gap-2 text-sm font-semibold text-main">
            <span className="spinner" aria-hidden="true" />
            {submitting ? "Enviando su solicitud…" : "Procesando sus archivos…"}
          </span>
        )}
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </div>
    </form>
  );
}
