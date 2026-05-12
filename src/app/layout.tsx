
import type { Metadata } from 'next';
import { Poppins, Outfit } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/components/QueryProvider';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-poppins',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Dezlog Secure Freight',
  description: 'Sistema de cálculo e gestão de cotações de frete.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dezlog Secure Freight',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${poppins.className} ${outfit.variable}`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
          <script dangerouslySetInnerHTML={{ __html: `
            try {
              let layoutMode = localStorage.getItem('app-layout-mode');
              if (layoutMode) {
                 if (layoutMode.startsWith('"')) layoutMode = JSON.parse(layoutMode);
                 document.documentElement.setAttribute('data-layout-mode', layoutMode);
              } else {
                 document.documentElement.setAttribute('data-layout-mode', 'classic');
              }
            } catch (e) {}
            try {
              let theme = localStorage.getItem('app-theme');
              if (theme) {
                 if (theme.startsWith('"')) theme = JSON.parse(theme);
                 if (typeof theme === 'string' && theme.includes(' ')) {
                    document.documentElement.style.setProperty('--primary', theme);
                    document.documentElement.style.setProperty('--ring', theme);
                 } else if (typeof theme === 'object') {
                    for (const [key, value] of Object.entries(theme)) {
                       document.documentElement.style.setProperty(key, value);
                       if (key === '--primary' && !theme['--ring']) {
                           document.documentElement.style.setProperty('--ring', value);
                       }
                    }
                 }
              }
            } catch (e) {}
          `}} />
          <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <QueryProvider>
              <AuthProvider>
                {children}
                <Toaster />
              </AuthProvider>
            </QueryProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
