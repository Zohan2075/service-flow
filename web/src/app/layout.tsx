import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const serviceWorkerScript = process.env.NODE_ENV === "development"
  ? `(()=>{const resetKey='serviceflow-dev-sw-reset';const cleanup=async()=>{let shouldReload=false;try{if('serviceWorker' in navigator){const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);if(registrations.length>0){await Promise.all(registrations.map((registration)=>registration.unregister().catch(()=>false)));shouldReload=true;}}if('caches' in window){const keys=await caches.keys().catch(()=>[]);const serviceflowKeys=keys.filter((key)=>key.startsWith('serviceflow-'));if(serviceflowKeys.length>0){await Promise.all(serviceflowKeys.map((key)=>caches.delete(key)));shouldReload=true;}}if(shouldReload&&!sessionStorage.getItem(resetKey)){sessionStorage.setItem(resetKey,'1');location.reload();return;}sessionStorage.removeItem(resetKey);}catch{sessionStorage.removeItem(resetKey);}};cleanup();})();`
  : `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}`;

export const metadata: Metadata = {
  title: "ServiceFlow",
  description: "Service time tracking dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/android-chrome-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ServiceFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/android-chrome-192x192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: serviceWorkerScript,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${inter.className} bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
