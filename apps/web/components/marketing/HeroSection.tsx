"use client";


import { Button } from "@workspace/ui/components/button";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="relative bg-gray-100 py-16">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center">
        <div className="w-full md:w-1/2 mb-8 md:mb-0">
          <h1 className="text-4xl font-bold mb-4">Welcome to Our Service</h1>
          <p className="text-lg mb-6">
            Discover the best solutions for your needs. Join us today and experience the difference!
          </p>
          <Button size="lg">
            Get Started
          </Button>
        </div>
        <div className="w-full md:w-1/2">
          <Image
            src="/hero-image.png"
            alt="Hero Image"   
            width={600}
            height={400}
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}