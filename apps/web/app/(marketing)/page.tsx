import { HeroSection } from '@/components/marketing/HeroSection'
import { LogoMarquee } from '@/components/marketing/LogoMarquee'
import { FeaturesSection } from '@/components/marketing/FeaturesSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { CtaSection } from '@/components/marketing/CtaSection'

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoMarquee />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection />
    </>
  )
}