import { describe, expect, it } from "vitest";
import {
  argumentSeparator,
  buildPanelRows,
  localizeFormula,
  buildStockRows,
  STOCK_ROWS,
  STOCK_TAB,
  PANEL_TAB,
} from "@/lib/sheet-panel";
import { ESTADOS } from "@/lib/validation";

const balanced = (f: string): boolean => {
  let depth = 0;
  let quotes = 0;
  for (const ch of f) {
    if (ch === '"') quotes++;
    if (quotes % 2 === 0) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    if (depth < 0) return false;
  }
  return depth === 0 && quotes % 2 === 0;
};

describe("buildPanelRows", () => {
  const rows = buildPanelRows("Pedidos");
  const cells = rows.flat();
  const formulas = cells.filter((c) => c.startsWith("="));

  it("lists every Estado with a COUNTIF over the Pedidos tab", () => {
    for (const estado of ESTADOS) {
      const row = rows.find((r) => r[0] === estado);
      expect(row, estado).toBeTruthy();
      expect(row?.[1]).toBe(`=COUNTIF('Pedidos'!C2:C2000,A${rows.indexOf(row as string[]) + 1})`);
    }
  });
  it("has the attention and income lines the operator needs", () => {
    for (const label of [
      "Total de pedidos",
      "Correos pendientes de enviar",
      "Cotizaciones esperando confirmación",
      "Pedidos por pagar",
      "Entregas vencidas",
      "Entregas para hoy",
      "Lotes de resina bajo el mínimo o agotados",
      "Ingresos del mes (CLP)",
      "Ingresos totales (CLP)",
    ])
      expect(
        rows.some((r) => r[0].startsWith(label)),
        label,
      ).toBe(true);
  });
  it("only uses plain formulas with balanced brackets and quotes", () => {
    expect(formulas.length).toBeGreaterThan(10);
    for (const f of formulas) {
      expect(balanced(f), f).toBe(true);
      expect(f).not.toMatch(/IMPORT|SCRIPT|HYPERLINK|QUERY/i);
    }
  });
  it("follows the configured Pedidos tab name, quoting it", () => {
    const other = buildPanelRows("Mi Tab")
      .flat()
      .filter((c) => c.startsWith("="));
    expect(other.some((f) => f.includes("'Mi Tab'!"))).toBe(true);
    expect(other.some((f) => f.includes("'Pedidos'!"))).toBe(false);
  });
  it("counts unpaid orders only from Confirmado onwards and ignores finished ones for lateness", () => {
    const unpaid = rows.find((r) => r[0].startsWith("Pedidos por pagar"))?.[1] ?? "";
    for (const e of ["Confirmado", "En cola", "Imprimiendo", "Listo", "Entregado"])
      expect(unpaid).toContain(`"${e}"`);
    expect(unpaid).not.toContain('"Cancelado"');
    expect(unpaid).toContain('"Pagado"');
    const late = rows.find((r) => r[0] === "Entregas vencidas")?.[1] ?? "";
    expect(late).toContain('"<>Entregado"');
    expect(late).toContain('"<>Cancelado"');
  });
  it("reads the resin stock tab", () => {
    expect(formulas.some((f) => f.includes(`'${STOCK_TAB}'!`))).toBe(true);
    expect(PANEL_TAB).toBe("Panel");
  });
});

describe("buildStockRows", () => {
  const rows = buildStockRows();
  it("has headers and a computed row per lot slot", () => {
    expect(rows[0]).toEqual([
      "Lote",
      "Resina",
      "ml iniciales",
      "ml usados",
      "ml restantes",
      "Estado",
    ]);
    expect(rows).toHaveLength(STOCK_ROWS + 1);
  });
  it("leaves the typed columns empty and computes ml restantes and Estado only for filled rows", () => {
    const r = rows[1];
    expect(r.slice(0, 4)).toEqual(["", "", "", ""]);
    expect(r[4]).toBe('=IF(A2="","",C2-D2)');
    expect(r[5]).toContain('"Agotado"');
    expect(r[5]).toContain('"Bajo"');
    expect(r[5]).toContain('"OK"');
    expect(r[5]).toContain("STOCK_MINIMO_ML");
    expect(balanced(r[5])).toBe(true);
    expect(rows[STOCK_ROWS][4]).toBe(
      `=IF(A${STOCK_ROWS + 1}="","",C${STOCK_ROWS + 1}-D${STOCK_ROWS + 1})`,
    );
  });
  it("falls back to 200 ml when STOCK_MINIMO_ML is missing or blank", () => {
    expect(rows[1][5]).toMatch(/IFERROR\(VLOOKUP\("STOCK_MINIMO_ML",Config!A:B,2,FALSE\)[^)]*200/);
  });
});

describe("locale handling", () => {
  it("uses ; between arguments where the locale writes decimals with a comma", () => {
    for (const l of ["es_ES", "es_CL", "de_DE", "fr_FR", "pt_BR", "it_IT"])
      expect(argumentSeparator(l), l).toBe(";");
    for (const l of ["en_US", "en_GB", "ja_JP", ""]) expect(argumentSeparator(l), l).toBe(",");
    expect(argumentSeparator(undefined)).toBe(",");
  });
  it("swaps only the commas outside text literals", () => {
    expect(localizeFormula('=IF(A2="a,b",COUNTIF(B:B,"x,y"),0)', ";")).toBe(
      '=IF(A2="a,b";COUNTIF(B:B;"x,y");0)',
    );
    expect(localizeFormula("=SUM(A1,B1)", ",")).toBe("=SUM(A1,B1)");
    expect(localizeFormula("texto, no formula", ";")).toBe("texto, no formula");
  });
  it("builds formulas without array constants or TEXT format codes, which differ by locale", () => {
    const all = [...buildPanelRows("Pedidos"), ...buildStockRows()]
      .flat()
      .filter((c) => c.startsWith("="));
    for (const f of all) {
      expect(f, f).not.toContain("{");
      expect(f, f).not.toMatch(/TEXT\([^)]*"[ymd]{2,4}/i);
    }
  });
});
