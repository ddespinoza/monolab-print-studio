import { describe, expect, it } from "vitest";
import { escapeHtml, folderName, sanitizeFilename, stripLineBreaks } from "@/lib/sanitize";

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
  it("keeps obj and ply extensions, lowercased", () => {
    expect(sanitizeFilename("Molar Sup.OBJ")).toBe("Molar_Sup.obj");
    expect(sanitizeFilename("arco.ply")).toBe("arco.ply");
  });
  it("falls back when nothing usable remains", () => {
    expect(sanitizeFilename("???.stl")).toBe("archivo.stl");
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

describe("folderName", () => {
  it("joins the order id and the initials without spaces", () => {
    expect(folderName("ML-0001", "A. P.")).toBe("ML-0001 - A.P.");
  });
  it("strips anything that is not a letter or dot", () => {
    expect(folderName("ML-0002", "á/ñ")).toBe("ML-0002 - áñ");
  });
});
