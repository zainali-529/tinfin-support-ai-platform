import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DocsShell } from '@/components/docs/DocsShell'
import { docsPages, getDocsHref, getDocsPage } from '@/lib/docs'

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>
}

function titleWithBrand(title: string) {
  return `${title} | Tinfin AI Docs`
}

export function generateStaticParams() {
  return [
    { slug: [] },
    ...docsPages.map((page) => ({
      slug: page.slug.split('/'),
    })),
  ]
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getDocsPage(slug)

  if (!page) {
    return {
      title: 'Docs | Tinfin AI',
    }
  }

  return {
    title: titleWithBrand(page.title),
    description: page.description,
    alternates: {
      canonical: getDocsHref(page.slug),
    },
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params
  const page = getDocsPage(slug)

  if (!page) notFound()

  return <DocsShell page={page} />
}
