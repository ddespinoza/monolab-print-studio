import { z } from "zod";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  MOCK_APIS: flag,
  DATA_DIR: z.string().min(1).default("./data"),
  PORT: z.coerce.number().int().default(3100),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().min(1).optional(),
  DRIVE_FOLDER_ID: z.string().min(1).optional(),
  GOOGLE_SHEET_ID: z.string().min(1).optional(),
  SHEET_TAB: z.string().min(1).default("Pedidos"),
  SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  FROM_EMAIL: z.string().email().default("contacto@monolabprintstudio.cl"),
  OPERATOR_EMAIL: z.string().email().default("monolabprintstudio@gmail.com"),
  WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/, "must be digits only, with country code"),
  SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16, "must be at least 16 characters"),
  CONFIRM_SECRET: z.string().min(32, "must be at least 32 characters"),
  /** Lets the sheet's buttons call POST /api/send. Empty or unset disables that endpoint. */
  SHEET_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(16, "must be at least 16 characters").optional(),
  ),
  MAX_UPLOAD_MB: z.coerce
    .number()
    .positive()
    .max(100, "must not exceed 100 (Cloudflare body cap)")
    .default(95),
});

export interface Config {
  mock: boolean;
  /** Holds tmp uploads and, in mock mode, the fake sheet, Drive and outbox. */
  dataDir: string;
  nodeEnv: string;
  port: number;
  sheetTab: string;
  fromEmail: string;
  operatorEmail: string;
  whatsappNumber: string;
  siteUrl: string;
  cronSecret: string;
  /** Signs the quote-confirmation links. */
  confirmSecret: string;
  /** Authorises the sheet's send buttons; undefined disables POST /api/send. */
  sheetSecret?: string;
  maxUploadMb: number;
  smtp: { host: string; port: number; user: string; pass: string };
  /** Present unless MOCK_APIS=true. */
  google?: {
    serviceAccountEmail: string;
    privateKey: string;
    oauthClientId: string;
    oauthClientSecret: string;
    oauthRefreshToken: string;
    driveFolderId: string;
    sheetId: string;
  };
}

const REQUIRED_WHEN_REAL = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "DRIVE_FOLDER_ID",
  "GOOGLE_SHEET_ID",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

/** Validates the environment once; throws an English error naming every bad variable. */
export function parseEnv(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  const e = parsed.data;
  if (e.MOCK_APIS && e.NODE_ENV === "production") {
    throw new Error("MOCK_APIS=true is not allowed when NODE_ENV=production");
  }
  const base = {
    mock: e.MOCK_APIS,
    dataDir: e.DATA_DIR,
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    sheetTab: e.SHEET_TAB,
    fromEmail: e.FROM_EMAIL,
    operatorEmail: e.OPERATOR_EMAIL,
    whatsappNumber: e.WHATSAPP_NUMBER,
    siteUrl: e.SITE_URL.replace(/\/+$/, ""),
    cronSecret: e.CRON_SECRET,
    confirmSecret: e.CONFIRM_SECRET,
    sheetSecret: e.SHEET_SECRET,
    maxUploadMb: e.MAX_UPLOAD_MB,
  };
  if (e.MOCK_APIS) {
    return {
      ...base,
      smtp: {
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        user: e.SMTP_USER ?? "",
        pass: e.SMTP_PASS ?? "",
      },
    };
  }
  const missing = REQUIRED_WHEN_REAL.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Invalid environment configuration:\nMissing required variables: ${missing.join(", ")}`,
    );
  }
  return {
    ...base,
    smtp: { host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER!, pass: e.SMTP_PASS! },
    google: {
      serviceAccountEmail: e.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      privateKey: e.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      oauthClientId: e.GOOGLE_OAUTH_CLIENT_ID!,
      oauthClientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET!,
      oauthRefreshToken: e.GOOGLE_OAUTH_REFRESH_TOKEN!,
      driveFolderId: e.DRIVE_FOLDER_ID!,
      sheetId: e.GOOGLE_SHEET_ID!,
    },
  };
}

let cached: Config | undefined;
export function getConfig(): Config {
  return (cached ??= parseEnv(process.env));
}
