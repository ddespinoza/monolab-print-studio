import { describe, expect, it, vi } from "vitest";
import { createOrder, type OrdersDeps } from "@/lib/orders";
import type { OrderInput } from "@/lib/validation";

const tokenA = "a".repeat(32);
const tokenB = "b".repeat(32);
const order: OrderInput = {
  nombre: "Dra. Gómez",
  paciente: "A. P.",
  email: "doc@example.com",
  telefono: "+56 9 4862 3705",
  resina: "Estándar",
  entrega: "Flash",
  cantidad: 2,
  notas: "",
  empresa: "",
  files: [
    {
      token: tokenA,
      name: "caja.stl",
      volumeCm3: 96.3,
      size: { x: 120, y: 80, z: 40 },
      scalePercent: 100,
    },
    {
      token: tokenB,
      name: "caja.stl",
      volumeCm3: 12.1,
      size: { x: 60, y: 40, z: 20 },
      scalePercent: 100,
    },
  ],
};

function deps(over: Partial<OrdersDeps> = {}): OrdersDeps {
  const ids = ["ML-0001"];
  return {
    sheets: {
      readIds: vi.fn().mockImplementation(async () => [...ids]),
      appendOrder: vi.fn().mockImplementation(async (row: string[]) => {
        ids.push(row[0]);
        return { rowNumber: 3, link: "https://sheet/row3" };
      }),
      deleteRow: vi.fn().mockResolvedValue(undefined),
    },
    drive: {
      createOrderFolder: vi.fn().mockResolvedValue({ id: "FOLDER", link: "https://drive/FOLDER" }),
      uploadFile: vi.fn().mockResolvedValue("FILE"),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    tmp: {
      exists: vi.fn().mockResolvedValue(true),
      open: vi.fn().mockReturnValue({ pipe: vi.fn() }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    send: vi.fn().mockResolvedValue(undefined),
    siteUrl: "https://monolabprintstudio.cl",
    whatsappNumber: "56948623705",
    operatorEmail: "ops@example.com",
    now: () => new Date("2025-06-12T18:03:00Z"),
    ...over,
  } as unknown as OrdersDeps;
}

describe("createOrder", () => {
  it("creates the next sequential order and returns its id", async () => {
    const d = deps();
    expect(await createOrder(order, d)).toEqual({ id: "ML-0002" });
    expect(d.sheets.appendOrder).toHaveBeenCalledTimes(1);
    const row = vi.mocked(d.sheets.appendOrder).mock.calls[0][0];
    expect(row[0]).toBe("ML-0002");
    expect(row[9]).toBe("https://drive/FOLDER");
  });
  it("names the Drive folder with id and initials, and uploads each file with a unique sanitized name", async () => {
    const d = deps();
    await createOrder(order, d);
    expect(d.drive.createOrderFolder).toHaveBeenCalledWith("ML-0002 - A.P.");
    const names = vi.mocked(d.drive.uploadFile).mock.calls.map((c) => c[1]);
    expect(names).toEqual(["caja.stl", "caja_2.stl"]);
  });
  it("deletes each tmp file after its upload", async () => {
    const d = deps();
    await createOrder(order, d);
    expect(vi.mocked(d.tmp.remove).mock.calls.map((c) => c[0])).toEqual([tokenA, tokenB]);
  });
  it("sends the customer receipt and the operator notification", async () => {
    const d = deps();
    await createOrder(order, d);
    const mails = vi.mocked(d.send).mock.calls.map((c) => c[0]);
    expect(mails.map((m) => m.to)).toEqual(["doc@example.com", "ops@example.com"]);
    expect(mails[0].subject).toBe("Pedido ML-0002 — recibido");
    expect(mails[1].text).toContain("https://sheet/row3");
    expect(mails[1].text).toContain("https://drive/FOLDER");
  });
  it("rejects when a token has no tmp file, touching no Google API", async () => {
    const d = deps({
      tmp: { exists: vi.fn().mockResolvedValue(false), open: vi.fn(), remove: vi.fn() },
    });
    await expect(createOrder(order, d)).rejects.toMatchObject({ code: "missing_file" });
    expect(d.sheets.readIds).not.toHaveBeenCalled();
    expect(d.drive.createOrderFolder).not.toHaveBeenCalled();
  });
  it("still returns the id when an email fails after the row is saved", async () => {
    const d = deps({ send: vi.fn().mockRejectedValue(new Error("smtp")) });
    expect(await createOrder(order, d)).toEqual({ id: "ML-0002" });
  });
  it("propagates a Drive failure without writing a row", async () => {
    const d = deps();
    vi.mocked(d.drive.uploadFile).mockRejectedValue(new Error("drive"));
    await expect(createOrder(order, d)).rejects.toThrow("drive");
    expect(d.sheets.appendOrder).not.toHaveBeenCalled();
  });
  it("serialises concurrent orders so numbers never repeat", async () => {
    const d = deps();
    const [a, b] = await Promise.all([createOrder(order, d), createOrder(order, d)]);
    expect([a.id, b.id].sort()).toEqual(["ML-0002", "ML-0003"]);
  });
  it("retries with a fresh number when the appended id turns out to be duplicated", async () => {
    const ids = ["ML-0001"];
    let first = true;
    const d = deps({
      sheets: {
        readIds: vi.fn().mockImplementation(async () => [...ids]),
        appendOrder: vi.fn().mockImplementation(async (row: string[]) => {
          ids.push(row[0]);
          if (first) {
            first = false;
            ids.push(row[0]); // someone else wrote the same id at the same time
          }
          return { rowNumber: ids.length, link: "l" };
        }),
        deleteRow: vi.fn().mockImplementation(async () => {
          ids.pop();
        }),
      },
    } as never);
    const r = await createOrder(order, d);
    expect(d.sheets.deleteRow).toHaveBeenCalledTimes(1);
    expect(d.drive.remove).toHaveBeenCalledWith("FOLDER");
    expect(r.id).not.toBe("ML-0002");
  });
});
