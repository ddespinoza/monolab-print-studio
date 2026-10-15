import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { DriveApi } from "@/lib/drive";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mailer";
import { parseOrderRow } from "@/lib/order-row";
import type { SheetsApi } from "@/lib/sheets";

/** MOCK_APIS=true: the same interfaces as the Google and SMTP wrappers, backed by files under ./data/mock. */

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function createMockSheets(dir: string): SheetsApi {
  const file = join(dir, "pedidos.json");
  let queue: Promise<unknown> = Promise.resolve();
  const locked = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const load = (): Promise<string[][]> => readJson<string[][]>(file, []);
  const save = async (rows: string[][]): Promise<void> => {
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(rows, null, 2));
  };
  const edit = (change: (rows: string[][]) => void): Promise<void> =>
    locked(async () => {
      const rows = await load();
      change(rows);
      await save(rows);
    });
  return {
    readIds: async () => (await load()).map((r) => r[0] ?? ""),
    readOrders: async () => (await load()).map((r, i) => parseOrderRow(r, i + 2)),
    readTab: (name) => readJson<string[][]>(join(dir, `${name}.json`), []),
    appendOrder: (row) =>
      locked(async () => {
        const rows = await load();
        rows.push(row);
        await save(rows);
        return { rowNumber: rows.length + 1, link: `mock://sheet/row-${rows.length + 1}` };
      }),
    markNotified: (rowNumber, estado, timestamp) =>
      edit((rows) => {
        const r = rows[rowNumber - 2];
        if (!r) return;
        r[18] = estado;
        r[19] = timestamp;
      }),
    setConfirmed: (rowNumber, timestamp) =>
      edit((rows) => {
        const r = rows[rowNumber - 2];
        if (!r) return;
        r[2] = "Confirmado";
        r[17] = timestamp;
        r[18] = "Confirmado";
        r[19] = timestamp;
      }),
    deleteRow: (rowNumber) => edit((rows) => void rows.splice(rowNumber - 2, 1)),
  };
}

export function createMockDrive(dir: string): DriveApi {
  const root = join(dir, "drive");
  return {
    async createOrderFolder(name) {
      const id = name.replace(/[^\w.-]+/g, "_") || randomUUID();
      await mkdir(join(root, id), { recursive: true });
      return { id, link: `mock://drive/${id}` };
    },
    async uploadFile(folderId, name, open) {
      await pipeline(open(), createWriteStream(join(root, folderId, name)));
      return `${folderId}/${name}`;
    },
    async remove(fileId) {
      await rm(join(root, fileId), { recursive: true, force: true });
    },
    canWriteRoot: async () => true,
  };
}

export function createMockMailer(dir: string): Mailer {
  const outbox = join(dir, "emails");
  return {
    async send(mail) {
      await mkdir(outbox, { recursive: true });
      const count = (await readdir(outbox)).length + 1;
      await writeFile(
        join(outbox, `${String(count).padStart(4, "0")}.json`),
        JSON.stringify(mail, null, 2),
      );
      logger.info("mock email", { to: mail.to, subject: mail.subject });
    },
  };
}
