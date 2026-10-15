import { createHmac, timingSafeEqual } from "node:crypto";

const signature = (orderId: string, quote: string, secret: string): string =>
  createHmac("sha256", secret).update(`${orderId}\n${quote}`).digest("base64url");

/** `ML-0001.<hmac>`: no database; editing the quote text in the sheet invalidates old links. */
export function signConfirmToken(orderId: string, quote: string, secret: string): string {
  return `${orderId}.${signature(orderId, quote, secret)}`;
}

/** Returns the order id when the token matches the order's current quote, otherwise null. */
export function verifyConfirmToken(
  token: string,
  quoteOf: (orderId: string) => string | undefined,
  secret: string,
): string | null {
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const orderId = token.slice(0, dot);
  const quote = quoteOf(orderId);
  if (quote === undefined || quote.trim() === "") return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signature(orderId, quote, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}
