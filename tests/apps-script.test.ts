import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

/** Runs docs/apps-script/Monolab.gs against hand-made Google service fakes. */
const source = readFileSync("docs/apps-script/Monolab.gs", "utf8");

function cell(over: {
  row?: number;
  col?: number;
  value?: unknown;
  note?: string;
  sheet?: string;
}) {
  const state: { value: unknown; note: string } = {
    value: over.value ?? true,
    note: over.note ?? "",
  };
  return {
    state,
    getSheet: () => ({
      getName: () => over.sheet ?? "Pedidos",
      getRange: () => ({ getValue: () => "ML-0007" }),
    }),
    getColumn: () => over.col ?? 21,
    getRow: () => over.row ?? 5,
    getNumRows: () => 1,
    getNumColumns: () => 1,
    getValue: () => state.value,
    setValue: (v: unknown) => void (state.value = v),
    getNote: () => state.note,
    setNote: (n: string) => void (state.note = n),
  };
}

function load(
  response: { code: number; body?: unknown } | Error,
  props: Record<string, string> = { SHEET_SECRET: "s".repeat(20) },
) {
  const fetch = vi.fn().mockImplementation(() => {
    if (response instanceof Error) throw response;
    return {
      getResponseCode: () => response.code,
      getContentText: () => JSON.stringify(response.body ?? {}),
    };
  });
  const lock = { tryLock: vi.fn().mockReturnValue(true), releaseLock: vi.fn() };
  const ctx: Record<string, any> = {
    UrlFetchApp: { fetch },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }),
    },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: {},
    ScriptApp: {},
    JSON,
  };
  runInNewContext(source, ctx);
  return { ctx, fetch, lock };
}

const sent = {
  results: [{ orderId: "ML-0007", status: "sent", message: "Correo «Listo» enviado a a@b.cl." }],
};

describe("Monolab.gs: casilla Enviar", () => {
  it("calls /api/send with the bearer secret, then unticks and notes the result", () => {
    const { ctx, fetch } = load({ code: 200, body: sent });
    const c = cell({});
    ctx.onEnviarEdit({ range: c });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://monolabprintstudio.cl/api/send");
    expect(opts.headers.Authorization).toBe(`Bearer ${"s".repeat(20)}`);
    expect(JSON.parse(opts.payload)).toEqual({ action: "row", orderId: "ML-0007" });
    expect(c.state.value).toBe(false);
    expect(c.state.note).toContain("enviado");
  });
  it("ignores other sheets, other columns, header row and unticking", () => {
    const { ctx, fetch } = load({ code: 200, body: sent });
    for (const c of [
      cell({ sheet: "Config" }),
      cell({ col: 3 }),
      cell({ row: 1 }),
      cell({ value: false }),
    ])
      ctx.onEnviarEdit({ range: c });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("asks to tick again after already_sent, and then forces the resend", () => {
    const already = { results: [{ orderId: "ML-0007", status: "already_sent", message: "ya" }] };
    const first = load({ code: 200, body: already });
    const c = cell({});
    first.ctx.onEnviarEdit({ range: c });
    expect(c.state.note).toMatch(/otra vez/);
    expect(c.state.value).toBe(false);
    const second = load({ code: 200, body: sent });
    c.state.value = true;
    second.ctx.onEnviarEdit({ range: c });
    expect(JSON.parse(second.fetch.mock.calls[0][1].payload)).toEqual({
      action: "row",
      orderId: "ML-0007",
      force: true,
    });
  });
  it.each([
    [401, /Clave incorrecta/],
    [503, /desactivado/],
    [409, /otro envío/],
    [500, /error \(500\)/],
  ])("explains HTTP %i in Spanish", (code, text) => {
    const { ctx } = load({ code });
    const c = cell({});
    ctx.onEnviarEdit({ range: c });
    expect(c.state.note).toMatch(text);
    expect(c.state.value).toBe(false);
  });
  it("reports a network failure and a missing secret without calling the site", () => {
    const net = load(new Error("dns"));
    const c = cell({});
    net.ctx.onEnviarEdit({ range: c });
    expect(c.state.note).toMatch(/No se pudo conectar/);
    const none = load({ code: 200 }, {});
    const d = cell({});
    none.ctx.onEnviarEdit({ range: d });
    expect(none.fetch).not.toHaveBeenCalled();
    expect(d.state.note).toMatch(/Falta la clave/);
  });
  it("refuses to run while another send holds the lock", () => {
    const { ctx, fetch, lock } = load({ code: 200, body: sent });
    lock.tryLock.mockReturnValue(false);
    const c = cell({});
    ctx.onEnviarEdit({ range: c });
    expect(fetch).not.toHaveBeenCalled();
    expect(c.state.value).toBe(false);
  });
  it("uses the configured SITE_URL without a trailing slash", () => {
    const { ctx, fetch } = load(
      { code: 200, body: sent },
      { SHEET_SECRET: "s".repeat(20), SITE_URL: "https://x.cl/" },
    );
    ctx.onEnviarEdit({ range: cell({}) });
    expect(fetch.mock.calls[0][0]).toBe("https://x.cl/api/send");
  });
});
