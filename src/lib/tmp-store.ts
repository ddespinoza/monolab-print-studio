import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { TOKEN_PATTERN } from "@/lib/validation";

export interface TmpStore {
  save(stream: Readable, maxBytes: number): Promise<{ token: string; size: number }>;
  pathOf(token: string): string;
  exists(token: string): Promise<boolean>;
  open(token: string): Readable;
  remove(token: string): Promise<void>;
  /** Deletes stored files older than maxAgeMs; returns how many. */
  sweep(maxAgeMs: number, now?: number): Promise<number>;
}

const FILE_PATTERN = /^[a-f0-9]{32}\.bin$/;

class SizeLimit extends Transform {
  size = 0;
  constructor(private max: number) {
    super();
  }
  override _transform(
    chunk: Buffer,
    _enc: BufferEncoding,
    done: (error?: Error | null, data?: Buffer) => void,
  ): void {
    this.size += chunk.length;
    if (this.size > this.max) done(new Error("Upload too large"));
    else done(null, chunk);
  }
}

/** Upload staging area (./data/tmp). Tokens are random 128-bit hex, validated before any path use. */
export function createTmpStore(dir: string): TmpStore {
  const pathOf = (token: string): string => {
    if (!TOKEN_PATTERN.test(token)) throw new Error("Invalid token");
    return join(dir, `${token}.bin`);
  };
  return {
    pathOf,
    async save(stream, maxBytes) {
      await mkdir(dir, { recursive: true });
      const token = randomBytes(16).toString("hex");
      const limit = new SizeLimit(maxBytes);
      try {
        await pipeline(stream, limit, createWriteStream(pathOf(token)));
      } catch (error) {
        await rm(pathOf(token), { force: true });
        throw error;
      }
      return { token, size: limit.size };
    },
    async exists(token) {
      if (!TOKEN_PATTERN.test(token)) return false;
      return stat(pathOf(token)).then(
        (s) => s.isFile(),
        () => false,
      );
    },
    open: (token) => createReadStream(pathOf(token)),
    async remove(token) {
      await rm(pathOf(token), { force: true });
    },
    async sweep(maxAgeMs, now = Date.now()) {
      const names = await readdir(dir).catch(() => [] as string[]);
      let swept = 0;
      for (const name of names) {
        if (!FILE_PATTERN.test(name)) continue;
        const s = await stat(join(dir, name)).catch(() => undefined);
        if (s && now - s.mtimeMs > maxAgeMs) {
          await rm(join(dir, name), { force: true });
          swept++;
        }
      }
      return swept;
    },
  };
}
