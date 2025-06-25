'use client';

import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { NextUIProvider } from '@nextui-org/react'; // Importa o NextUIProvider

export default function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false); // Added state

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render null on the server and initial client render
    return null; // Added conditional return
  }

  // Once mounted, render the ThemeProvider and children
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
    >
      <NextUIProvider>
        {' '}
        {/* Envolve os children com NextUIProvider */}
        {children}
      </NextUIProvider>
    </ThemeProvider>
  );
}
