import HeroSection from "@/components/marketing/HeroSection";
import { ProductPillarsSection } from "@/components/marketing/ProductPillarsSection";
import { Header } from "@/components/marketing/header";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { FeaturesShowcaseSection } from "@/components/marketing/FeaturesShowcaseSection";
import { WhyNowSection } from "@/components/marketing/why-now-section";

export default function HomePage() {
  return (
    <>
      <Header />
      <HeroSection />
      <ProductPillarsSection />
      <LogoCloud />
      <FeaturesShowcaseSection />
      {/* <WhyNowSection /> */}
    </>
  )
}
