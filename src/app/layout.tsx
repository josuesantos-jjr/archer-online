"use client";

import "./globals.css";

// Removendo as importações de Geist e Geist_Mono para resolver o erro de fontes.
// Usaremos fontes padrão do sistema.
// Removido SessionProvider para desabilitar NextAuth.js e permitir acesso direto ao dashboard.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
