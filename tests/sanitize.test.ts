import { describe, expect, it } from "vitest";
import { escapeHtml, escapeSheetCell, sanitizeFilename, stripLineBreaks } from "@/lib/sanitize";

describe("sanitizeFilename", () => {
  it("replaces unsafe characters, collapses repeats and trims", () => {
    expect(sanitizeFilename("  mi caja (v2).stl ")).toBe("mi_caja_v2.stl");
    expect(sanitizeFilename("../../etc/passwd.stl")).toBe("etc_passwd.stl");
  });
  it("caps at 80 chars keeping the .stl extension", () => {
    const out = sanitizeFilename("a".repeat(200) + ".stl");
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith(".stl")).toBe(true);
  });
  it("falls back when nothing usable remains", () => {
    expect(sanitizeFilename("???.stl")).toBe("archivo.stl");
  });
});

describe("escapeSheetCell", () => {
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\t=x", "\r=x"])("neutralises %j", (v) => {
    expect(escapeSheetCell(v).startsWith("'")).toBe(true);
  });
  it("leaves normal text alone", () => {
    expect(escapeSheetCell("Ana Pérez")).toBe("Ana Pérez");
    expect(escapeSheetCell("")).toBe("");
  });
});

describe("escapeHtml / stripLineBreaks", () => {
  it("escapes html metacharacters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
  it("replaces CR/LF with a space", () => {
    expect(stripLineBreaks("a\r\nb\nc")).toBe("a b c");
  });
});
