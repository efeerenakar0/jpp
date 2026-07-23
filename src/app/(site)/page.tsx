import Hero from "@/components/home/Hero";
import Stats from "@/components/home/Stats";
import FeaturedProjects from "@/components/home/FeaturedProjects";
import ServicesSummary from "@/components/home/ServicesSummary";
import WhyJasmine from "@/components/home/WhyJasmine";
import PartnerCTA from "@/components/home/PartnerCTA";
import Testimonials from "@/components/home/Testimonials";
import ContactPreview from "@/components/home/ContactPreview";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <FeaturedProjects />
      <ServicesSummary />
      <WhyJasmine />
      <PartnerCTA />
      <Testimonials />
      <ContactPreview />
    </>
  );
}
