
// Removed "use client"; directive - this is now a Server Component
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AppSetup from '@/components/AppSetup'; // Import the new client component

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Mentalist - Manage Your Lists Efficiently',
  description: 'Mentalist helps you organize your work and life with an intuitive list management system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* <meta name="theme-color" content="#4285F4" /> */}
        {/* <link rel="manifest" href="/manifest.json" /> */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppSetup>
          {children}
        </AppSetup>
      </body>
    </html>
  );
}
