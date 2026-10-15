/** Seeds the Pedidos, Plantillas and Config tabs. Safe to re-run: never overwrites operator edits. */
import { google } from "googleapis";
import { parseEnv } from "@/lib/config";
import { setupSheet } from "@/lib/sheet-setup";

async function main(): Promise<void> {
  const cfg = parseEnv(process.env);
  if (!cfg.google || cfg.mock)
    throw new Error("setup:sheet needs real Google credentials (MOCK_APIS must be false)");
  const auth = new google.auth.JWT({
    email: cfg.google.serviceAccountEmail,
    key: cfg.google.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const report = await setupSheet(google.sheets({ version: "v4", auth }), {
    sheetId: cfg.google.sheetId,
    sheetTab: cfg.sheetTab,
  });
  console.log(
    `OK  created tabs: ${report.created.join(", ") || "none"}; seeded: ${report.seeded.join(", ") || "nothing (already set up)"}`,
  );
  console.log("OK  Estado dropdown and frozen header applied to", cfg.sheetTab);
}

main().catch((error: unknown) => {
  console.error("FAIL", error);
  process.exit(1);
});
