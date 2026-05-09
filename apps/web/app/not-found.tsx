import Link from 'next/link'
import { ArrowLeftIcon, BookOpenIcon, HomeIcon, SearchIcon } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Header } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
        <div className="absolute left-[10%] top-24 h-[72px] w-[144px] bg-emerald-500/10" />
        <div className="absolute right-[14%] top-48 h-[144px] w-[72px] bg-emerald-500/10" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-6 py-28 text-center">
          <div className="mb-5 inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            404 - Page not found
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            This page wandered outside the workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            The link may be outdated, moved, or unavailable. You can return home, open docs, or book a demo from here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/">
                <HomeIcon className="mr-2 size-4" />
                Go home
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/docs">
                <BookOpenIcon className="mr-2 size-4" />
                Read docs
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link href="/demo">
                <SearchIcon className="mr-2 size-4" />
                Book a demo
              </Link>
            </Button>
          </div>
          <Link
            href="/"
            className="mt-8 inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Tinfiz
          </Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  )
}
