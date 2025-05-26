
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google'; // Geist is fine as a modern sans-serif
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Mentalist - Manage Your Lists Efficiently', // Changed "Scandalist" to "Mentalist"
  description: 'Mentalist helps you organize your work and life with an intuitive list management system.', // Changed "Scandalist" to "Mentalist"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
