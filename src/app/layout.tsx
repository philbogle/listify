import type { Metadata } from 'next';
import { Geist_Sans } from 'next/font/google';
import './globals.css';

const geistSans = Geist_Sans({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Listify - Scan anything to a list',
  description: 'Listify converts printed and handwritten text and even arbitrary objects to easy-to-manage checklists. ',
  icons: {
    icon: '/favicon.ico?v=2',
  },
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
      <body className={geistSans.className}>
        {children}
      </body>
    </html>
  );
}
