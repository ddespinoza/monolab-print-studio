/**
 * One-time: gets the Drive refresh token for the Gmail account that owns the Drive folder.
 *   npm run setup:oauth                    prints the approval link
 *   npm run setup:oauth -- "<pasted URL>"  exchanges the code and saves GOOGLE_OAUTH_REFRESH_TOKEN into .env
 * After approving, the browser ends on a page that cannot be reached (localhost:1); paste that address.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";
import { extractAuthCode } from "@/lib/oauth";

const ENV_FILE = ".env";

function saveToken(token: string): void {
  const env = readFileSync(ENV_FILE, "utf8");
  const line = `GOOGLE_OAUTH_REFRESH_TOKEN=${token}`;
  const next = /^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m.test(env)
    ? env.replace(/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m, () => line)
    : `${env.replace(/\n*$/, "\n")}${line}\n`;
  writeFileSync(ENV_FILE, next, { mode: 0o600 });
}

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first");
  const client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:1");
  const pasted = process.argv[2];
  if (!pasted) {
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive"],
    });
    console.log(`Open this link, approve, then paste the address the browser ends on:\n\n${url}\n`);
    return;
  }
  const { tokens } = await client.getToken(extractAuthCode(pasted));
  if (!tokens.refresh_token)
    throw new Error("Google returned no refresh token; revoke the app's access and run again");
  saveToken(tokens.refresh_token);
  console.log("OK  GOOGLE_OAUTH_REFRESH_TOKEN saved to .env");
}

main().catch((error: unknown) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
