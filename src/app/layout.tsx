import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        {/* <meta name="theme-color" content="#4285F4" /> */}
        {/* <link rel="manifest" href="/manifest.json" /> */}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
