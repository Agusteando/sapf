
import "./globals.css"

export const metadata = {
  title: "SAPF - Sistema de Atención a Padres de Familia",
  description: "Sistema de gestión de atención a padres de familia",
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  )
}
