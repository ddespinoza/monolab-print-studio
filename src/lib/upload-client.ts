export interface UploadedFile {
  token: string;
  name: string;
  size: number;
}

/** PUT one file as a raw body to /api/uploads with progress; retries once on a network or 5xx failure. */
export function uploadFile(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadedFile> {
  const attempt = (): Promise<UploadedFile> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/uploads?name=${encodeURIComponent(file.name)}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.onprogress = (e) =>
        e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = () => reject(Object.assign(new Error("network"), { retry: true }));
      xhr.onload = () => {
        if (xhr.status === 201) {
          try {
            resolve(JSON.parse(xhr.responseText) as UploadedFile);
          } catch {
            reject(new Error("bad response"));
          }
        } else {
          reject(Object.assign(new Error(`status ${xhr.status}`), { retry: xhr.status >= 500 }));
        }
      };
      xhr.send(file);
    });
  return attempt().catch((error: { retry?: boolean }) =>
    error.retry ? attempt() : Promise.reject(error),
  );
}

export interface OrderResult {
  ok: boolean;
  id?: string;
  status: number;
}

export async function postOrder(payload: unknown): Promise<OrderResult> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: res.status === 201, id: body.id, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
