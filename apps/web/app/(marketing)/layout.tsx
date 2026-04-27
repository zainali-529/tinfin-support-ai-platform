import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tinfin - AI Customer Support Platform",
  description:
    "Replace slow tickets with AI that knows your product. Chat, voice, and human handoff unified in one platform.",
  openGraph: {
    title: "Tinfin - AI Customer Support Platform",
    description:
      "Replace slow tickets with AI that knows your product. Chat, voice, and human handoff unified in one platform.",
    type: "website",
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main>{children}</main>
}
