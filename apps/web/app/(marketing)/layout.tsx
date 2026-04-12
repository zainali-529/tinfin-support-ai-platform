import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/Navbar'
import '@/app/(marketing)/marketing.css'

export const metadata: Metadata = {
  title: 'Tinfin — AI Customer Support Platform',
  description:
    'Replace slow tickets with AI that knows your product. Chat, voice, and human handoff — unified in one platform.',
  openGraph: {
    title: 'Tinfin — AI Customer Support Platform',
    description:
      'Replace slow tickets with AI that knows your product. Chat, voice, and human handoff — unified in one platform.',
    type: 'website',
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <footer className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <div className="size-7 rounded-lg bg-foreground text-background flex items-center justify-center text-sm">
                  ⚡
                </div>
                Tinfin
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered customer support for modern teams.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Product
              </p>
              {['Features', 'Pricing', 'Changelog', 'Roadmap'].map(l => (
                <a
                  key={l}
                  href="#"
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>

            {/* Company */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Company
              </p>
              {['About', 'Blog', 'Careers', 'Contact'].map(l => (
                <a
                  key={l}
                  href="#"
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Legal
              </p>
              {['Privacy', 'Terms', 'Security', 'DPA'].map(l => (
                <a
                  key={l}
                  href="#"
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground/60">
              © {new Date().getFullYear()} Tinfin. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Built with ❤️ for support teams everywhere
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}