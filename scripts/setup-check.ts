/** Verifies the configuration without changing anything: env, Sheets access, Drive folder access, SMTP login. */
import { parseEnv, type Config } from "@/lib/config";
import { driveFrom, sheetsFrom } from "@/lib/google";
import { createSmtpTransport } from "@/lib/mailer";

const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;

let failures = 0;
async function check(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    console.log(`${green("OK  ")} ${label}`);
  } catch (error) {
    failures++;
    console.log(
      `${red("FAIL")} ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main(): Promise<void> {
  let cfg: Config | undefined;
  await check("environment is complete and valid", async () => {
    cfg = parseEnv(process.env);
  });
  if (!cfg) process.exit(1);
  const { google, smtp, sheetTab } = cfg;
  if (cfg.mock || !google) {
    console.log("MOCK_APIS=true: nothing to check against Google or SMTP.");
    return;
  }
  const sheets = sheetsFrom(google, sheetTab);
  await check(
    `Sheets: tab ${sheetTab} is readable (share the sheet with the service account)`,
    () => sheets.readIds(),
  );
  await check("Sheets: Plantillas and Config tabs exist (run npm run setup:sheet)", async () => {
    await sheets.readTab("Plantillas");
    await sheets.readTab("Config");
  });
  await check("Drive: the OAuth user can add folders to DRIVE_FOLDER_ID", async () => {
    if (!(await driveFrom(google).canWriteRoot()))
      throw new Error("no permission on the root folder");
  });
  await check("SMTP: login works", () => createSmtpTransport(smtp).verify());
  console.log(
    failures
      ? `\n${failures} check(s) failed.`
      : "\nAll checks passed. Run npm run test:live for a full write test.",
  );
}

main()
  .catch((error: unknown) => {
    failures++;
    console.error(error);
  })
  .finally(() => process.exit(failures ? 1 : 0));
