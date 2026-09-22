import type { Metadata } from 'next';
import "./globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: {
    template: '%s | LabFace',
    default: 'LabFace - Smart Attendance System',
  },
  description: 'AI-Powered Facial Recognition Attendance System',
};

import IdentityBackground from '../components/IdentityBackground';
import ConditionalFooter from '../components/ConditionalFooter';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
        <link rel="icon" href="/logo.png" />
      </head>
      <body className="text-foreground">
        <Providers>
          <IdentityBackground />
          <div className="flex flex-col min-h-screen relative z-10 text-identity-navy page-transition">
             <main className="flex-grow">
               {children}
             </main>
             <ConditionalFooter />
          </div>
        </Providers>
      </body>
    </html>

  );
}

