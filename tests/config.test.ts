import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config";

const real = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@proj.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN KEY-----\\nabc\\n-----END KEY-----",
  GOOGLE_OAUTH_CLIENT_ID: "id",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
  DRIVE_FOLDER_ID: "folder",
  GOOGLE_SHEET_ID: "sheet",
  SMTP_USER: "monolabprintstudio@gmail.com",
  SMTP_PASS: "app-password",
  WHATSAPP_NUMBER: "56912345678",
  SITE_URL: "https://monolabprintstudio.cl",
  CRON_SECRET: "x".repeat(16),
  CONFIRM_SECRET: "y".repeat(32),
};

describe("parseEnv", () => {
  it("applies defaults and unescapes the private key", () => {
    const c = parseEnv(real);
    expect(c.sheetTab).toBe("Pedidos");
    expect(c.smtp.host).toBe("smtp.gmail.com");
    expect(c.smtp.port).toBe(465);
    expect(c.fromEmail).toBe("contacto@monolabprintstudio.cl");
    expect(c.maxUploadMb).toBe(95);
    expect(c.port).toBe(3100);
    expect(c.google?.privateKey).toContain("\n");
    expect(c.mock).toBe(false);
  });
  it("mock mode needs no credentials", () => {
    const c = parseEnv({
      MOCK_APIS: "true",
      WHATSAPP_NUMBER: "56912345678",
      SITE_URL: "http://127.0.0.1:3100",
      CRON_SECRET: "x".repeat(16),
      CONFIRM_SECRET: "y".repeat(32),
    });
    expect(c.mock).toBe(true);
    expect(c.google).toBeUndefined();
  });
  it("requires a long CONFIRM_SECRET even in mock mode", () => {
    expect(() => parseEnv({ ...real, CONFIRM_SECRET: "short" })).toThrow(/CONFIRM_SECRET/);
    expect(parseEnv(real).confirmSecret).toBe("y".repeat(32));
  });
  it("refuses mock mode in production", () => {
    expect(() => parseEnv({ ...real, MOCK_APIS: "true", NODE_ENV: "production" })).toThrow(
      /MOCK_APIS/,
    );
  });
  it("fails fast with English messages naming the variable", () => {
    expect(() => parseEnv({ ...real, DRIVE_FOLDER_ID: undefined })).toThrow(/DRIVE_FOLDER_ID/);
  });
  it("rejects a non-numeric WhatsApp number and a short cron secret", () => {
    expect(() => parseEnv({ ...real, WHATSAPP_NUMBER: "+56 9" })).toThrow(/WHATSAPP_NUMBER/);
    expect(() => parseEnv({ ...real, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });
  it("rejects MAX_UPLOAD_MB above the Cloudflare cap", () => {
    expect(() => parseEnv({ ...real, MAX_UPLOAD_MB: "120" })).toThrow(/MAX_UPLOAD_MB/);
  });
});
