import type * as React from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Bot,
  Code2,
  Compass,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Inbox,
  MessageCircle,
} from 'lucide-react'

import type { DocsPage } from '@/lib/docs'
import { docsPageMap, docsSections, getDocsHref } from '@/lib/docs'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { Button } from '@workspace/ui/components/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@workspace/ui/components/sidebar'
import { cn } from '@workspace/ui/lib/utils'
import { DocsArticle } from './DocsArticle'
import { DocsSearchLauncher } from './DocsSearchLauncher'

const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Get Started': Compass,
  Widget: MessageCircle,
  'Inbox Operations': Inbox,
  'AI Support': Bot,
  Channels: MessageCircle,
  Admin: CreditCard,
  Developers: Code2,
  Troubleshooting: HelpCircle,
}

function DocsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link href="/docs" className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-sidebar-accent">
          <span className="flex size-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground">
            <BookOpen className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Tinfiz Docs</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/55">Setup and product guides</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-3">
        {docsSections.map((section) => {
          const Icon = sectionIcons[section.title] ?? BookOpen

          return (
            <SidebarGroup key={section.title} className="px-2 py-2">
              <SidebarGroupLabel className="mb-1 gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                <Icon className="size-3.5" />
                {section.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.pages.map((slug) => {
                    const page = docsPageMap.get(slug)
                    if (!page) return null

                    return (
                      <SidebarMenuItem key={slug}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeSlug === slug}
                          tooltip={page.title}
                          className={cn(
                            'h-8 rounded-lg px-2.5 text-[13px] font-medium',
                            activeSlug === slug && 'bg-sidebar-accent text-sidebar-accent-foreground'
                          )}
                        >
                          <Link href={getDocsHref(slug)}>
                            <span className="size-1.5 shrink-0 rounded-full bg-current opacity-50" />
                            <span>{page.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarSeparator />
      <div className="px-3 py-3 text-[11px] leading-5 text-sidebar-foreground/55 group-data-[collapsible=offcanvas]:hidden">
        Keep these docs updated as product workflows change.
      </div>
      <SidebarRail />
    </Sidebar>
  )
}

export function DocsShell({ page }: { page: DocsPage }) {
  return (
    <SidebarProvider
      className="min-h-screen bg-background"
      style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
    >
      <DocsSidebar activeSlug={page.slug} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-16 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">Documentation</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">{page.section} / {page.title}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DocsSearchLauncher showDocsButton={false} compact />
              <ThemeToggle />
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">
                  <ArrowLeft className="size-3.5" />
                  Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                <Link href="/analytics">
                  <BarChart2 className="size-3.5" />
                  Analytics
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
                <Link href="/widget">
                  Widget setup
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <DocsArticle page={page} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

