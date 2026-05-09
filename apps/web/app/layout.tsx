import type { Metadata } from 'next'
import { Raleway } from 'next/font/google'
import { Providers } from './providers'
import { getSiteUrl } from '@/lib/site-url'
import '@workspace/ui/globals.css'

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: 'Tinfiz',
  title: {
    default: 'Tinfiz',
    template: '%s | Tinfiz',
  },
  description: 'AI-powered customer support platform with grounded AI, unified inbox, channels, voice, and analytics.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    siteName: 'Tinfiz',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${raleway.variable} antialiased font-sans`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
