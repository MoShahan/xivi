import { CssBaseline } from "@mui/material"
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"
import type { Metadata } from "next"
import { Fraunces, Source_Sans_3 } from "next/font/google"

import AuthProvider from "@/providers/AuthProvider"
import FeatureFlagsProvider from "@/providers/FeatureFlagsProvider"
import ProductTourProvider from "@/providers/ProductTourProvider"
import RealtimeProvider from "@/providers/RealtimeProvider"
import ReduxProvider from "@/providers/ReduxProvider"
import ThemeProviderComp from "@/providers/ThemeProvider"
import ToastProvider from "@/providers/ToastProvider"

import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Xivi",
    template: "%s · Xivi",
  },
  description: "Xivi - connect with friends, share posts, and stay in the loop.",
  applicationName: "Xivi",
  appleWebApp: {
    title: "Xivi",
  },
  icons: {
    icon: [{ url: "/assets/xivi-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable}`}>
      <body className={sourceSans.className}>
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <AppRouterCacheProvider>
          <ReduxProvider>
            <AuthProvider>
              <FeatureFlagsProvider>
                <RealtimeProvider>
                  <ThemeProviderComp>
                    <ToastProvider>
                      <ProductTourProvider>
                        <CssBaseline />
                        {children}
                      </ProductTourProvider>
                    </ToastProvider>
                  </ThemeProviderComp>
                </RealtimeProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </ReduxProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
