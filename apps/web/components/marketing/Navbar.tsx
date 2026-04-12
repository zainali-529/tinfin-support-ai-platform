'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { ZapIcon, MenuIcon, XIcon, SparklesIcon } from 'lucide-react'

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#testimonials', label: 'Customers' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handler = () => setScrolled(window.scrollY > 24)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          mounted && scrolled
            ? 'bg-background/85 backdrop-blur-2xl border-b border-border/60 shadow-[0_1px_32px_rgba(0,0,0,0.06)]'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-8">

            {/* ── Logo ── */}
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold text-base shrink-0 group"
            >
              <div className="relative flex size-8 items-center justify-center rounded-xl bg-foreground text-background overflow-hidden transition-transform group-hover:scale-105">
                <ZapIcon className="size-[18px]" />
                {/* Shimmer */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-500" />
              </div>
              <span className="tracking-tight">Tinfin</span>
            </Link>

            {/* ── Desktop nav ── */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/60 font-medium"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* ── Desktop CTA ── */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="gap-1.5 shadow-sm" asChild>
                <Link href="/signup">
                  <SparklesIcon className="size-3.5" />
                  Get started free
                </Link>
              </Button>
            </div>

            {/* ── Mobile toggle ── */}
            <button
              className="md:hidden flex size-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen
                ? <XIcon className="size-5" />
                : <MenuIcon className="size-5" />
              }
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        <div
          className={cn(
            'md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-border/50 bg-background/95 backdrop-blur-2xl',
            mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="flex px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
              </Button>
              <Button size="sm" className="gap-1.5" asChild>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <SparklesIcon className="size-3.5" />
                  Get started free
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}