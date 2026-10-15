/**
 * One-time: gets the Drive refresh token for the Gmail account that owns the Drive folder.
 * Run it with `! npm run setup:oauth`, open the printed URL, approve, then paste the address the browser ends on
 * (it will say the page cannot be reached; that is expected).
 */
import { createInterface } from "node:readline/promises";
import { google } from "googleapis";
import { extractAuthCode } from "@/lib/oauth";

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first");
  const redirect = "http://localhost:1";
  const client = new google.auth.OAuth2(clientId, clientSecret, redirect);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
  });
  console.log(`\n1. Open this URL and approve:\n\n${url}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question("2. Paste the address the browser ends on (or the code): ");
  rl.close();
  const { tokens } = await client.getToken(extractAuthCode(pasted));
  if (!tokens.refresh_token)
    throw new Error("Google returned no refresh token; revoke the app's access and run again");
  console.log(`\nOK  Add this line to .env:\nGOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((error: unknown) => {
  console.error("FAIL", error);
  process.exit(1);
});
