import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
const env = (d: string): Record<string, string> => ({
  NODE_ENV: "test",
  MOCK_APIS: "true",
  DATA_DIR: d,
  SITE_URL: "http://127.0.0.1:3100",
  WHATSAPP_NUMBER: "56948623705",
  CRON_SECRET: "c".repeat(24),
  CONFIRM_SECRET: "k".repeat(40),
  SHEET_SECRET: "s".repeat(24),
  MAX_UPLOAD_MB: "1",
});

async function load() {
  vi.resetModules();
  const { resetRuntime } = await import("@/lib/runtime");
  resetRuntime();
  return {
    uploads: await import("@/app/api/uploads/route"),
    orders: await import("@/app/api/orders/route"),
    tick: await import("@/app/api/cron/tick/route"),
    send: await import("@/app/api/send/route"),
    confirmar: await import("@/app/api/confirmar/route"),
    config: await import("@/lib/config"),
  };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "monolab-routes-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));
beforeEach(async () => {
  await rm(join(dir, "mock"), { recursive: true, force: true });
  await rm(join(dir, "tmp"), { recursive: true, force: true });
  for (const [k, v] of Object.entries(env(dir))) vi.stubEnv(k, v);
});

const put = (name: string, body: BodyInit, ip = "1.1.1.1") =>
  new Request(`http://x/api/uploads?name=${encodeURIComponent(name)}`, {
    method: "PUT",
    body,
    headers: { "cf-connecting-ip": ip, "content-type": "application/octet-stream" },
    duplex: "half",
  } as RequestInit);

const orderBody = (token: string, extra: object = {}) => ({
  nombre: "Dra. Gómez",
  paciente: "A. P.",
  email: "doc@example.com",
  telefono: "+56 9 4862 3705",
  resina: "Estándar",
  entrega: "Flash",
  cantidad: 1,
  notas: "",
  empresa: "",
  files: [
    { token, name: "caja.stl", volumeCm3: 1, size: { x: 10, y: 10, z: 10 }, scalePercent: 100 },
  ],
  ...extra,
});
const post = (body: unknown, ip = "2.2.2.2") =>
  new Request("http://x/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
  });

describe("PUT /api/uploads", () => {
  it("stores a file and returns a token", async () => {
    const { uploads } = await load();
    const res = await uploads.PUT(put("caja.stl", "solid x"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: "caja.stl", size: 7 });
    expect(body.token).toMatch(/^[a-f0-9]{32}$/);
  });
  it("rejects other extensions, empty bodies and oversize files", async () => {
    const { uploads } = await load();
    expect((await uploads.PUT(put("virus.exe", "x"))).status).toBe(400);
    expect((await uploads.PUT(put("a.stl", ""))).status).toBe(400);
    expect((await uploads.PUT(put("a.stl", Buffer.alloc(1_048_576 + 10)))).status).toBe(413);
    expect(await readdir(join(dir, "tmp"))).toEqual([]);
  });
  it("rate-limits per CF-Connecting-IP, not globally", async () => {
    const { uploads } = await load();
    const codes: number[] = [];
    for (let i = 0; i < 21; i++)
      codes.push((await uploads.PUT(put("a.stl", "x", "9.9.9.9"))).status);
    expect(codes.slice(0, 20).every((c) => c === 201)).toBe(true);
    expect(codes[20]).toBe(429);
    expect((await uploads.PUT(put("a.stl", "x", "8.8.8.8"))).status).toBe(201);
  });
});

describe("POST /api/orders", () => {
  it("places sequential orders with files in a mock Drive folder and two emails each", async () => {
    const { uploads, orders } = await load();
    const t1 = (await (await uploads.PUT(put("caja.stl", "solid a"))).json()).token;
    const r1 = await orders.POST(post(orderBody(t1)));
    expect(r1.status).toBe(201);
    expect(await r1.json()).toEqual({ id: "ML-0001" });
    const t2 = (await (await uploads.PUT(put("caja.stl", "solid b"))).json()).token;
    expect(await (await orders.POST(post(orderBody(t2)))).json()).toEqual({ id: "ML-0002" });
    expect(await readdir(join(dir, "mock", "drive"))).toEqual(["ML-0001_-_A.P.", "ML-0002_-_A.P."]);
    expect(await readFile(join(dir, "mock", "drive", "ML-0001_-_A.P.", "caja.stl"), "utf8")).toBe(
      "solid a",
    );
    expect(await readdir(join(dir, "mock", "emails"))).toHaveLength(4);
    expect(await readdir(join(dir, "tmp"))).toEqual([]);
  });
  it("validates the body and unknown tokens", async () => {
    const { orders } = await load();
    expect((await orders.POST(post({ nope: 1 }))).status).toBe(400);
    expect((await orders.POST(post(orderBody("f".repeat(32))))).status).toBe(400);
  });
  it("accepts honeypot submissions silently without storing anything", async () => {
    const { uploads, orders } = await load();
    const t = (await (await uploads.PUT(put("caja.stl", "solid a"))).json()).token;
    const res = await orders.POST(post(orderBody(t, { empresa: "ACME" })));
    expect(res.status).toBe(201);
    await expect(readdir(join(dir, "mock"))).rejects.toThrow();
  });
});

describe("quote confirmation and cron", () => {
  async function placeOrder() {
    const api = await load();
    const t = (await (await api.uploads.PUT(put("caja.stl", "solid a"))).json()).token;
    await api.orders.POST(post(orderBody(t)));
    return api;
  }
  const authed = () =>
    new Request("http://x/api/cron/tick", {
      headers: { authorization: `Bearer ${"c".repeat(24)}` },
    });

  it("rejects the tick without the bearer secret and never caches", async () => {
    const { tick } = await load();
    expect((await tick.GET(new Request("http://x/api/cron/tick"))).status).toBe(401);
    expect((await tick.GET(authed())).headers.get("cache-control")).toBe("no-store");
  });
  it("sends the quote once, then confirms via the signed link, and sends nothing twice", async () => {
    const api = await placeOrder();
    const file = join(dir, "mock", "pedidos.json");
    const rows = JSON.parse(await readFile(file, "utf8")) as string[][];
    rows[0][2] = "Cotizado";
    rows[0][16] = "$45.000 CLP";
    await writeFile(file, JSON.stringify(rows));
    await writeFile(join(dir, "mock", "Config.json"), JSON.stringify([["ENVIO_AUTOMATICO", "SI"]]));

    expect(await (await api.tick.GET(authed())).json()).toMatchObject({
      processed: 1,
      failed: 0,
      skipped: 0,
    });
    expect(await (await api.tick.GET(authed())).json()).toMatchObject({ processed: 0 });

    const emails = await readdir(join(dir, "mock", "emails"));
    const quote = JSON.parse(
      await readFile(join(dir, "mock", "emails", emails[emails.length - 1]), "utf8"),
    );
    expect(quote.subject).toBe("Pedido ML-0001 — cotización");
    const link = /https?:\/\/[^\s]+\/confirmar\/([^\s]+)/.exec(quote.text);
    expect(link).not.toBeNull();
    const token = decodeURIComponent((link as RegExpExecArray)[1]);

    const form = new FormData();
    form.set("token", token);
    const res = await api.confirmar.POST(
      new Request("http://x/api/confirmar", { method: "POST", body: form }),
    );
    expect(res.status).toBe(303);
    const after = JSON.parse(await readFile(file, "utf8")) as string[][];
    expect(after[0][2]).toBe("Confirmado");
    expect(await (await api.tick.GET(authed())).json()).toMatchObject({ processed: 0 });
    const all = await readdir(join(dir, "mock", "emails"));
    expect(all.length).toBe(emails.length + 2);
  });
  it("ignores a forged or stale confirmation token", async () => {
    const api = await placeOrder();
    const form = new FormData();
    form.set("token", "ML-0001.forged");
    await api.confirmar.POST(new Request("http://x/api/confirmar", { method: "POST", body: form }));
    const rows = JSON.parse(
      await readFile(join(dir, "mock", "pedidos.json"), "utf8"),
    ) as string[][];
    expect(rows[0][2]).toBe("Nuevo");
  });
});

describe("POST /api/send", () => {
  const authed = () =>
    new Request("http://x/api/cron/tick", {
      headers: { authorization: `Bearer ${"c".repeat(24)}` },
    });
  const send = (body: unknown, secret: string | null = "s".repeat(24)) =>
    new Request("http://x/api/send", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
    });
  async function quoted() {
    const api = await load();
    const t = (await (await api.uploads.PUT(put("caja.stl", "solid a"))).json()).token;
    await api.orders.POST(post(orderBody(t)));
    const file = join(dir, "mock", "pedidos.json");
    const rows = JSON.parse(await readFile(file, "utf8")) as string[][];
    rows[0][2] = "Cotizado";
    rows[0][16] = "$45.000 CLP";
    await writeFile(file, JSON.stringify(rows));
    return { api, file };
  }

  it("rejects missing or wrong secrets and never caches", async () => {
    const { send: route } = await load();
    expect((await route.POST(send({ action: "pending" }, null))).status).toBe(401);
    const bad = await route.POST(send({ action: "pending" }, "x".repeat(24)));
    expect(bad.status).toBe(401);
    expect(bad.headers.get("cache-control")).toBe("no-store");
  });
  it("is disabled (503) when SHEET_SECRET is not configured", async () => {
    vi.stubEnv("SHEET_SECRET", "");
    const { send: route } = await load();
    expect((await route.POST(send({ action: "pending" }))).status).toBe(503);
  });
  it("validates the body", async () => {
    const { send: route } = await load();
    expect((await route.POST(send({ action: "burn" }))).status).toBe(400);
    expect((await route.POST(send({ action: "row" }))).status).toBe(400);
  });
  it("sends the quote for one order on demand, even in manual mode, and refuses a repeat", async () => {
    const { api, file } = await quoted();
    const emailsBefore = (await readdir(join(dir, "mock", "emails"))).length;
    const ok = await api.send.POST(send({ action: "row", orderId: "ML-0001" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).results[0]).toMatchObject({ orderId: "ML-0001", status: "sent" });
    expect((await readdir(join(dir, "mock", "emails"))).length).toBe(emailsBefore + 1);
    const rows = JSON.parse(await readFile(file, "utf8")) as string[][];
    expect(rows[0][18]).toBe("Cotizado");
    const again = await (await api.send.POST(send({ action: "row", orderId: "ML-0001" }))).json();
    expect(again.results[0].status).toBe("already_sent");
    const forced = await (
      await api.send.POST(send({ action: "row", orderId: "ML-0001", force: true }))
    ).json();
    expect(forced.results[0].status).toBe("sent");
    const log = JSON.parse(await readFile(join(dir, "mock", "Envíos.json"), "utf8")) as string[][];
    expect(log).toHaveLength(2);
    expect(log[0].slice(1, 5)).toEqual(["ML-0001", "Cotizado", "doc@example.com", "Enviado"]);
  });
  it("the cron does not send in manual mode", async () => {
    const { api } = await quoted();
    expect(await (await api.tick.GET(authed())).json()).toMatchObject({
      processed: 0,
      automatic: false,
    });
  });
  it("purges a delivered order's Drive folder, marks the sheet and refuses to repeat", async () => {
    const { api, file } = await quoted();
    const rows = JSON.parse(await readFile(file, "utf8")) as string[][];
    rows[0][2] = "Entregado";
    await writeFile(file, JSON.stringify(rows));
    expect(await readdir(join(dir, "mock", "drive"))).toHaveLength(1);
    const res = await (await api.send.POST(send({ action: "purge", orderId: "ML-0001" }))).json();
    expect(res.results[0]).toMatchObject({ orderId: "ML-0001", status: "purged" });
    expect(await readdir(join(dir, "mock", "drive"))).toEqual([]);
    const after = JSON.parse(await readFile(file, "utf8")) as string[][];
    expect(after[0][9]).toMatch(/^Eliminado \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    const again = await (await api.send.POST(send({ action: "purge", orderId: "ML-0001" }))).json();
    expect(again.results[0].status).toBe("refused");
    const log = JSON.parse(await readFile(join(dir, "mock", "Envíos.json"), "utf8")) as string[][];
    expect(log[0].slice(1, 6)).toEqual([
      "ML-0001",
      "Entregado",
      "doc@example.com",
      "Archivos eliminados",
      "Eliminación",
    ]);
  });
  it("refuses to purge an order that is still in progress", async () => {
    const { api } = await quoted();
    const res = await (await api.send.POST(send({ action: "purge", orderId: "ML-0001" }))).json();
    expect(res.results[0].status).toBe("refused");
    expect(await readdir(join(dir, "mock", "drive"))).toHaveLength(1);
  });
});
