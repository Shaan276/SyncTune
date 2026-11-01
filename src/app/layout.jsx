import '../styles/globals.css';

export const viewport = {
  themeColor: '#10b981',
};

export const metadata = {
  title: 'SyncTune - Listen Together & Watch Together',
  description: 'Synchronized low-data music and cinema room streaming powered by Next.js & Supabase Realtime.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SyncTune'
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg'
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-purple-500/30 selection:text-purple-200">
        {children}
      </body>
    </html>
  );
}
