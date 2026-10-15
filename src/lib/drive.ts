import type { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { withRetry, type RetryOptions } from "@/lib/retry";

export interface DriveApi {
  createOrderFolder(name: string): Promise<{ id: string; link: string }>;
  /** `open` is called again on retry because a consumed stream cannot be replayed. */
  uploadFile(folderId: string, name: string, open: () => Readable): Promise<string>;
  remove(fileId: string): Promise<void>;
  /** Whether the authenticated user may add children to the root folder (used by setup:check). */
  canWriteRoot(): Promise<boolean>;
}

/** Files stay private: no permissions are ever created, only the owner (the OAuth user) can open them. */
export function createDriveApi(
  client: Pick<drive_v3.Drive, "files">,
  rootFolderId: string,
  retry: RetryOptions = {},
): DriveApi {
  const idOf = (data: { id?: string | null }): string => {
    if (!data.id) throw new Error("Drive returned no id");
    return data.id;
  };
  return {
    async createOrderFolder(name) {
      const res = await withRetry(
        () =>
          client.files.create({
            requestBody: {
              name,
              mimeType: "application/vnd.google-apps.folder",
              parents: [rootFolderId],
            },
            fields: "id",
          }),
        retry,
      );
      const id = idOf(res.data);
      return { id, link: `https://drive.google.com/drive/folders/${id}` };
    },
    async uploadFile(folderId, name, open) {
      const res = await withRetry(
        () =>
          client.files.create({
            requestBody: { name, parents: [folderId] },
            media: { mimeType: "application/octet-stream", body: open() },
            fields: "id",
          }),
        retry,
      );
      return idOf(res.data);
    },
    async remove(fileId) {
      await withRetry(() => client.files.delete({ fileId }), retry);
    },
    async canWriteRoot() {
      const res = await withRetry(
        () => client.files.get({ fileId: rootFolderId, fields: "capabilities/canAddChildren" }),
        retry,
      );
      return res.data.capabilities?.canAddChildren === true;
    },
  };
}
