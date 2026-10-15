/**
 * Derives every served brand asset from brand/logo-source.svg, which is never served: it carries the
 * operator's Gmail address on an "email plate" that is stripped from every derivative (a guard below
 * fails the build if an "@" survives). The geometry constants match the owner-supplied artwork (600x700).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/brand";
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const ICON_BOX = "96 86 408 264"; // wireframe printer incl. stroke and glow
const FULL_HEIGHT = 590; // lockup height once the email plate is gone (source is 700)

const source = readFileSync("brand/logo-source.svg", "utf8");

function must(value: string | undefined, what: string): string {
  if (!value)
    throw new Error(
      `logo-source.svg: ${what} not found; update scripts/brand.ts for the new artwork`,
    );
  return value;
}

const defs = must(/<defs>[\s\S]*?<\/defs>/.exec(source)?.[0], "<defs>");
const wire = must(
  /<g stroke="url\(#goldLine\)"[\s\S]*?<\/g>/.exec(source)?.[0],
  "gold wireframe group",
);
const dots = must(/<g fill="#ffffff">[\s\S]*?<\/g>/.exec(source)?.[0], "vertex dots group");
const iconGroup = `${wire}\n${dots}`;

/** Removes the pill behind the address and the address text itself. */
function withoutPlate(svg: string): string {
  const out = svg
    .replace(/<rect[^>]*rx="18"[^>]*\/>\s*/, "")
    .replace(/<text[^>]*>[^<]*@[^<]*<\/text>\s*/, "");
  if (out.includes("@")) throw new Error("Email plate was not fully removed from the logo");
  return out;
}

const full = withoutPlate(source)
  .replace('viewBox="0 0 600 700" width="100%" height="100%"', `viewBox="0 0 600 ${FULL_HEIGHT}"`)
  .replace('<rect width="600" height="700"', `<rect width="600" height="${FULL_HEIGHT}"`)
  .replace('height="676"', `height="${FULL_HEIGHT - 24}"`);

const iconSvg = `<svg ${NS} viewBox="${ICON_BOX}">${defs}${iconGroup}</svg>`;

function horizontal(textFill: string, sublineFill: string): string {
  return `<svg ${NS} viewBox="0 0 280 56" height="56">${defs}
<svg x="0" y="0" width="68" height="44" viewBox="${ICON_BOX}">${iconGroup}</svg>
<text x="76" y="30" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="3" fill="${textFill}">MONOLAB</text>
<text x="77" y="47" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" letter-spacing="4" fill="${sublineFill}">PRINT STUDIO</text>
</svg>`;
}

/** ICO container holding one PNG image (valid for 32x32, supported by every current browser). */
function ico(pngData: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngData.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, pngData]);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/logo-full.svg`, full);
  writeFileSync(`${OUT}/logo-icon.svg`, iconSvg);
  writeFileSync(`${OUT}/logo-horizontal.svg`, horizontal("#14213d", "#64748b"));
  writeFileSync(`${OUT}/logo-horizontal-dark.svg`, horizontal("#ffffff", "#e5a93c"));

  const iconPng = (width: number): Promise<Buffer> =>
    sharp(Buffer.from(iconSvg), { density: 384 }).resize({ width, fit: "inside" }).png().toBuffer();
  const onDark = async (size: number): Promise<Buffer> =>
    sharp({ create: { width: size, height: size, channels: 4, background: "#0d172a" } })
      .composite([{ input: await iconPng(Math.round(size * 0.8)), gravity: "center" }])
      .png()
      .toBuffer();

  writeFileSync("public/favicon.ico", ico(await onDark(32), 32));
  writeFileSync("public/icon-192.png", await onDark(192));
  writeFileSync("public/icon-512.png", await onDark(512));
  writeFileSync("public/apple-touch-icon.png", await onDark(180));

  const og = `<svg ${NS} width="1200" height="630" viewBox="0 0 1200 630">${defs}
<rect width="1200" height="630" fill="url(#blueBg)"/>
<svg x="400" y="40" width="400" height="260" viewBox="${ICON_BOX}">${iconGroup}</svg>
<text x="600" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="900" letter-spacing="9" fill="#ffffff">MONOLAB PRINT STUDIO</text>
<text x="600" y="460" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#ffd166">Impresión 3D en resina de precisión</text>
</svg>`;
  writeFileSync("public/og-image.png", await sharp(Buffer.from(og)).png().toBuffer());
  console.log("brand assets written to public/");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
