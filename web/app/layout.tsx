import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Self-Audit Dashboard',
  description: 'Device self-assessment results reported by the local agent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
        <link
          rel='stylesheet'
          href='https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap'
        />
      </head>
      <body
        style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif' }}
        className='bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased'
      >
        {children}
      </body>
    </html>
  );
}
