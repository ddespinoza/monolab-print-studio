import { ESTADOS } from "@/lib/validation";

/** Tabs built from plain sheet formulas: the operator reads them, the site never does. */
export const PANEL_TAB = "Panel";
export const STOCK_TAB = "Stock resinas";
/** Lot slots prepared in the stock tab (formulas filled down). */
export const STOCK_ROWS = 200;
/** Config key and default (ml) under which a resin lot counts as "Bajo". */
export const STOCK_MIN_KEY = "STOCK_MINIMO_ML";
export const STOCK_MIN_DEFAULT = "200";

/** Same row limit as the Estado dropdown and the Enviar checkboxes in setup-sheet. */
const LAST = 2000;
const PAYABLE = ["Confirmado", "En cola", "Imprimiendo", "Listo", "Entregado"];

/**
 * Formulas are written in the canonical comma form. Sheets parses written formulas in the spreadsheet's locale, where
 * decimal-comma locales (es, de, fr...) need ";" between arguments, so setup runs them through `localizeFormula`.
 * Array constants ({...}) and TEXT format codes also differ by locale, so none are used.
 */
export function argumentSeparator(locale: string | undefined): "," | ";" {
  if (!locale) return ",";
  try {
    return new Intl.NumberFormat(locale.replace("_", "-")).format(1.5).includes(",") ? ";" : ",";
  } catch {
    return ",";
  }
}

/** Replaces the argument commas of a formula (not those inside text literals) with `separator`. */
export function localizeFormula(formula: string, separator: "," | ";"): string {
  if (separator === "," || !formula.startsWith("=")) return formula;
  return formula
    .split(/("[^"]*")/)
    .map((part, i) => (i % 2 === 1 ? part : part.replaceAll(",", separator)))
    .join("");
}

const quote = (tab: string): string => `'${tab.replaceAll("'", "''")}'`;

/** Panel tab content (column A label, column B value). Written with USER_ENTERED so the formulas evaluate. */
export function buildPanelRows(pedidosTab: string): string[][] {
  const p = quote(pedidosTab);
  const col = (letter: string): string => `${p}!${letter}2:${letter}${LAST}`;
  const stock = `${quote(STOCK_TAB)}!F2:F${STOCK_ROWS + 1}`;
  const money = (expr: string): string =>
    `=SUMPRODUCT(ARRAYFORMULA(${expr}IFERROR(VALUE(Ingresos!C2:C${LAST}),0)))`;
  const rows: string[][] = [
    ["Panel Monolab"],
    ["Se calcula solo con fórmulas desde Pedidos, Ingresos y Stock resinas. No escriba aquí."],
    [""],
    ["Pedidos por estado"],
  ];
  for (const estado of ESTADOS) rows.push([estado, `=COUNTIF(${col("C")},A${rows.length + 1})`]);
  rows.push(["Total de pedidos", `=COUNTA(${p}!A2:A${LAST})`]);
  rows.push([""], ["Atención"]);
  rows.push([
    "Correos pendientes de enviar",
    `=SUMPRODUCT((${col("C")}<>"")*(${col("C")}<>"Nuevo")*(${col("E")}<>"")*(${col("C")}<>${col("S")}))`,
  ]);
  rows.push(["Cotizaciones esperando confirmación", `=COUNTIF(${col("C")},"Cotizado")`]);
  rows.push([
    "Pedidos por pagar (confirmados, sin pago)",
    `=SUMPRODUCT((${PAYABLE.map((e) => `(${col("C")}="${e}")`).join("+")})*(${col("V")}<>"Pagado"))`,
  ]);
  const open = `${col("C")},"<>Entregado",${col("C")},"<>Cancelado"`;
  rows.push(["Entregas vencidas", `=COUNTIFS(${col("W")},"<"&TODAY(),${open})`]);
  rows.push(["Entregas para hoy", `=COUNTIFS(${col("W")},TODAY(),${open})`]);
  rows.push([
    "Lotes de resina bajo el mínimo o agotados",
    `=COUNTIF(${stock},"Bajo")+COUNTIF(${stock},"Agotado")`,
  ]);
  rows.push([""], ["Ingresos"]);
  rows.push([
    "Ingresos del mes (CLP)",
    money(`(LEFT(Ingresos!A2:A${LAST}&"",7)=YEAR(TODAY())&"-"&TEXT(MONTH(TODAY()),"00"))*`),
  ]);
  rows.push(["Ingresos totales (CLP)", money("")]);
  return rows;
}

/** Stock resinas tab: typed columns A-D, computed E (ml restantes) and F (OK / Bajo / Agotado). */
export function buildStockRows(): string[][] {
  const min = `IFERROR(VLOOKUP("${STOCK_MIN_KEY}",Config!A:B,2,FALSE)*1,${STOCK_MIN_DEFAULT})`;
  const rows: string[][] = [
    ["Lote", "Resina", "ml iniciales", "ml usados", "ml restantes", "Estado"],
  ];
  for (let n = 2; n <= STOCK_ROWS + 1; n++)
    rows.push([
      "",
      "",
      "",
      "",
      `=IF(A${n}="","",C${n}-D${n})`,
      `=IF(A${n}="","",IF(E${n}<=0,"Agotado",IF(E${n}<${min},"Bajo","OK")))`,
    ]);
  return rows;
}
