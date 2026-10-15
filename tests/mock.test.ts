import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockDrive, createMockMailer, createMockSheets } from "@/lib/mock";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "monolab-mock-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const row = (id: string): string[] =>
  Array.from({ length: 20 }, (_, i) =>
    i === 0 ? id : i === 2 ? "Nuevo" : i === 18 ? "Nuevo" : "",
  );

describe("mock sheets", () => {
  it("appends rows, lists ids and survives a restart", async () => {
    const a = createMockSheets(dir);
    expect(await a.readIds()).toEqual([]);
    expect(await a.appendOrder(row("ML-0001"))).toMatchObject({ rowNumber: 2 });
    expect(await a.appendOrder(row("ML-0002"))).toMatchObject({ rowNumber: 3 });
    const b = createMockSheets(dir);
    expect(await b.readIds()).toEqual(["ML-0001", "ML-0002"]);
    expect((await b.readOrders())[1]).toMatchObject({
      rowNumber: 3,
      id: "ML-0002",
      estado: "Nuevo",
    });
  });
  it("marks notified and confirms like the real sheet", async () => {
    const s = createMockSheets(dir);
    await s.appendOrder(row("ML-0001"));
    await s.markNotified(2, "En cola", "t1");
    expect((await s.readOrders())[0]).toMatchObject({ notificado: "En cola", ultima: "t1" });
    await s.setConfirmed(2, "t2");
    expect((await s.readOrders())[0]).toMatchObject({
      estado: "Confirmado",
      confirmado: "t2",
      notificado: "Confirmado",
    });
  });
  it("deletes a row and reads optional tab files", async () => {
    const s = createMockSheets(dir);
    await s.appendOrder(row("ML-0001"));
    await s.deleteRow(2);
    expect(await s.readIds()).toEqual([]);
    expect(await s.readTab("Plantillas")).toEqual([]);
  });
  it("marks the Drive cell as deleted", async () => {
    const s = createMockSheets(dir);
    await s.appendOrder(row("ML-0001"));
    await s.markFilesDeleted(2, "Eliminado t1");
    expect((await s.readOrders())[0].drive).toBe("Eliminado t1");
  });
  it("appends log rows to the Envíos tab file", async () => {
    const s = createMockSheets(dir);
    await s.appendLog(["t", "ML-0001"]);
    await s.appendLog(["t", "ML-0002"]);
    expect(await s.readTab("Envíos")).toEqual([
      ["t", "ML-0001"],
      ["t", "ML-0002"],
    ]);
  });
  it("serialises concurrent appends", async () => {
    const s = createMockSheets(dir);
    await Promise.all([
      s.appendOrder(row("ML-0001")),
      s.appendOrder(row("ML-0002")),
      s.appendOrder(row("ML-0003")),
    ]);
    expect((await s.readIds()).sort()).toEqual(["ML-0001", "ML-0002", "ML-0003"]);
  });
});

describe("mock drive", () => {
  it("creates a folder and writes the uploaded files into it", async () => {
    const d = createMockDrive(dir);
    const folder = await d.createOrderFolder("ML-0001 - A.P.");
    await d.uploadFile(folder.id, "caja.stl", () => Readable.from(["abc"]));
    expect(await readFile(join(dir, "drive", folder.id, "caja.stl"), "utf8")).toBe("abc");
    await d.remove(folder.id);
    expect(await readdir(join(dir, "drive"))).toEqual([]);
  });
});

describe("mock mailer", () => {
  it("writes each email to the outbox instead of sending it", async () => {
    const m = createMockMailer(dir);
    await m.send({ to: "a@b.cl", subject: "Hola", text: "texto", html: "<p>texto</p>" });
    const files = await readdir(join(dir, "emails"));
    expect(files).toHaveLength(1);
    expect(JSON.parse(await readFile(join(dir, "emails", files[0]), "utf8"))).toMatchObject({
      to: "a@b.cl",
      subject: "Hola",
      text: "texto",
    });
  });
});
