
import "./globals.css"
import { Fredoka, Montserrat } from "next/font/google";
import SiteHeader from "@/components/site-header";

export const metadata = {
  title: "SAPF - Sistema de Atención a Padres de Familia",
  description: "Sistema de gestión de atención a padres de familia",
};

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sans-brand",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-title",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${montserrat.variable} ${fredoka.variable}`}>
      <body className="min-h-screen bg-brand-bg text-brand-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
