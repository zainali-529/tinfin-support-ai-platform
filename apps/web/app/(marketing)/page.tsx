import HeroSection from "@/components/marketing/HeroSection";
import { ProductPillarsSection } from "@/components/marketing/ProductPillarsSection";
import { Header } from "@/components/marketing/header";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { WhyNowSection } from "@/components/marketing/why-now-section";
import { ScrollStorySection } from "@/components/marketing/ScrollStorySection";

export default function HomePage() {
  return (
    <>
      <Header />
      <HeroSection />
      <LogoCloud />
      <ProductPillarsSection />
      <ScrollStorySection />
      {/* <WhyNowSection /> */}
    </>
  )
}
