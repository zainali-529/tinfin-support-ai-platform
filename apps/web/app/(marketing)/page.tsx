import HeroSection from "@/components/marketing/HeroSection";
import { ProductPillarsSection } from "@/components/marketing/ProductPillarsSection";
import { Header } from "@/components/marketing/header";
import { ProductWorkflowSection } from "@/components/marketing/ProductWorkflowSection";
import { WhyNowSection } from "@/components/marketing/why-now-section";
import { ScrollStorySection } from "@/components/marketing/ScrollStorySection";
import { UnifiedInboxSection } from "@/components/marketing/UnifiedInboxSection";

export default function HomePage() {
  return (
    <>
      <Header />
      <HeroSection />
      <WhyNowSection />
      <ProductWorkflowSection />
      <UnifiedInboxSection />
      <ProductPillarsSection />
      <ScrollStorySection />
    </>
  )
}
