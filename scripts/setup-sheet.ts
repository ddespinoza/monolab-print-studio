/** Seeds the Pedidos, Plantillas and Config tabs. Safe to re-run: never overwrites operator edits. */
import { google } from "googleapis";
import { setupSheet } from "@/lib/sheet-setup";

async function main(): Promise<void> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetTab = process.env.SHEET_TAB ?? "Pedidos";
  if (!email || !key || !sheetId)
    throw new Error(
      "Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID in .env first",
    );
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const report = await setupSheet(google.sheets({ version: "v4", auth }), { sheetId, sheetTab });
  console.log(
    `OK  created tabs: ${report.created.join(", ") || "none"}; seeded: ${report.seeded.join(", ") || "nothing (already set up)"}`,
  );
  console.log("OK  Estado dropdown and frozen header applied to", sheetTab);
}

main().catch((error: unknown) => {
  console.error("FAIL", error);
  process.exit(1);
});
