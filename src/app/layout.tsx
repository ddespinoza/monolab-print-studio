import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const description =
  "Impresión 3D en resina para odontología, en Santiago, Chile. Sube tus archivos 3D y recibe tu cotización por correo.";

const siteName = "Monolab Print Studio";
const defaultTitle = `${siteName} | Impresión 3D en resina para odontología`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://127.0.0.1:3100"),
  title: { default: defaultTitle, template: `%s | ${siteName}` },
  description,
  applicationName: siteName,
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: {
    title: defaultTitle,
    description,
    siteName,
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Monolab Print Studio: impresión 3D en resina para odontología",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
