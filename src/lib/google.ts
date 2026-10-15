import { google } from "googleapis";
import { createDriveApi, type DriveApi } from "@/lib/drive";
import { createSheetsApi, type SheetsApi } from "@/lib/sheets";
import type { Config } from "@/lib/config";

type GoogleConfig = NonNullable<Config["google"]>;

/** Sheets uses the service account (the sheet is shared with it). */
export function sheetsFrom(g: GoogleConfig, sheetTab: string): SheetsApi {
  const auth = new google.auth.JWT({
    email: g.serviceAccountEmail,
    key: g.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return createSheetsApi(google.sheets({ version: "v4", auth }), { sheetId: g.sheetId, sheetTab });
}

/** Drive uses the owner's OAuth refresh token: a service account has no storage quota of its own. */
export function driveFrom(g: GoogleConfig): DriveApi {
  const auth = new google.auth.OAuth2(g.oauthClientId, g.oauthClientSecret);
  auth.setCredentials({ refresh_token: g.oauthRefreshToken });
  return createDriveApi(google.drive({ version: "v3", auth }), g.driveFolderId);
}
