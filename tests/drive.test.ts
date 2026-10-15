import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createDriveApi } from "@/lib/drive";

describe("createDriveApi", () => {
  const make = () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "FOLDER" } })
      .mockResolvedValue({ data: { id: "FILE" } });
    const del = vi.fn().mockResolvedValue({});
    return {
      create,
      del,
      api: createDriveApi({ files: { create, delete: del } } as never, "ROOT", { sleep: vi.fn() }),
    };
  };
  it("creates the order subfolder inside the root folder", async () => {
    const { create, api } = make();
    expect(await api.createOrderFolder("ML-0001")).toEqual({
      id: "FOLDER",
      link: "https://drive.google.com/drive/folders/FOLDER",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          name: "ML-0001",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["ROOT"],
        },
        fields: "id",
      }),
    );
  });
  it("uploads a file as octet-stream into the folder", async () => {
    const { create, api } = make();
    await api.createOrderFolder("ML-0001");
    const id = await api.uploadFile("FOLDER", "caja.stl", () => Readable.from(["abc"]));
    expect(id).toBe("FILE");
    const call = create.mock.calls[1][0];
    expect(call.requestBody).toEqual({ name: "caja.stl", parents: ["FOLDER"] });
    expect(call.media.mimeType).toBe("application/octet-stream");
  });
  it("opens a fresh stream on each retry", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue({ data: { id: "FILE" } });
    const api = createDriveApi({ files: { create } } as never, "ROOT", {
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    const open = vi.fn(() => Readable.from(["abc"]));
    await api.uploadFile("F", "a.stl", open);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it("throws when Drive returns no id", async () => {
    const api = createDriveApi(
      { files: { create: vi.fn().mockResolvedValue({ data: {} }) } } as never,
      "ROOT",
      { sleep: vi.fn() },
    );
    await expect(api.createOrderFolder("ML-1")).rejects.toThrow(/id/);
  });

  it("deletes a file or folder by id", async () => {
    const { del, api } = make();
    await api.remove("FOLDER");
    expect(del).toHaveBeenCalledWith({ fileId: "FOLDER" });
  });
});
