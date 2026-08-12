import { Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/AuthContext';
import './globals.css';

// next/font self-hosts the font at build time — no external request to Google,
// and no render-blocking <link> like the Vite version had.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata = {
  title: 'EduConnect',
  description: 'AI tutor, PDF-to-quiz, and a personal study schedule.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
