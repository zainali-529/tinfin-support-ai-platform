import type { Metadata } from 'next'
import { Raleway } from 'next/font/google'
import { Providers } from './providers'
import '@workspace/ui/globals.css'

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tinfin',
  description: 'AI-Powered Customer Support Platform',
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