import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTmpStore, type TmpStore } from "@/lib/tmp-store";

let dir: string;
let store: TmpStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "monolab-"));
  store = createTmpStore(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("tmp store", () => {
  it("saves a stream under a random 32-hex token", async () => {
    const r = await store.save(Readable.from([Buffer.from("abc"), Buffer.from("def")]), 100);
    expect(r.token).toMatch(/^[a-f0-9]{32}$/);
    expect(r.size).toBe(6);
    expect(await readFile(store.pathOf(r.token), "utf8")).toBe("abcdef");
  });
  it("aborts and removes the file when the stream exceeds the limit", async () => {
    await expect(
      store.save(Readable.from([Buffer.alloc(60), Buffer.alloc(60)]), 100),
    ).rejects.toThrow(/too large/i);
    expect(await store.sweep(0, Date.now() + 1000)).toBe(0);
  });
  it("refuses tokens that are not 32 hex characters (no path traversal)", () => {
    expect(() => store.pathOf("../etc/passwd")).toThrow();
    expect(() => store.pathOf("a".repeat(31))).toThrow();
  });
  it("reports existence and removes files", async () => {
    const { token } = await store.save(Readable.from(["x"]), 10);
    expect(await store.exists(token)).toBe(true);
    await store.remove(token);
    expect(await store.exists(token)).toBe(false);
    expect(await store.exists("nothex")).toBe(false);
    await expect(store.remove(token)).resolves.toBeUndefined();
  });
  it("sweeps only files older than the age limit", async () => {
    const old = await store.save(Readable.from(["old"]), 10);
    const fresh = await store.save(Readable.from(["new"]), 10);
    const past = new Date(Date.now() - 25 * 3600_000);
    await utimes(store.pathOf(old.token), past, past);
    expect(await store.sweep(24 * 3600_000)).toBe(1);
    expect(await store.exists(old.token)).toBe(false);
    expect(await store.exists(fresh.token)).toBe(true);
  });
  it("ignores unrelated files when sweeping", async () => {
    await writeFile(join(dir, "README"), "keep");
    const past = new Date(Date.now() - 48 * 3600_000);
    await utimes(join(dir, "README"), past, past);
    expect(await store.sweep(24 * 3600_000)).toBe(0);
    expect((await stat(join(dir, "README"))).isFile()).toBe(true);
  });
});
