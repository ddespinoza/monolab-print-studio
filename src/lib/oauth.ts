/** The code from the URL Google redirects to (the page itself fails to load; the user pastes the address). */
export function extractAuthCode(input: string): string {
  const value = input.trim();
  if (!value) throw new Error("Nothing pasted");
  if (!/^https?:\/\//.test(value)) return value;
  const params = new URL(value).searchParams;
  const error = params.get("error");
  if (error) throw new Error(`Google returned an error: ${error}`);
  const code = params.get("code");
  if (!code) throw new Error("The URL has no code parameter");
  return code;
}
