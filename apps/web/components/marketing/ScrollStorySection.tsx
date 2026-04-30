"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Bot, Layers, Sparkles, MessageSquare, Code } from "lucide-react";

const steps = [
  {
    id: "step-1",
    title: "A Unified Support Workspace.",
    subtitle:
      "Bring all your customer interactions into one single, powerful operating system.",
    icon: Layers,
    color: "from-blue-500/20 to-indigo-500/20",
    iconColor: "text-blue-500",
  },
  {
    id: "step-2",
    title: "Train AI in Seconds.",
    subtitle:
      "Connect your data—docs, URLs, and text. Your knowledge base becomes instant intelligence.",
    icon: Bot,
    color: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    id: "step-3",
    title: "Execute Actions Automatically.",
    subtitle:
      "Give your AI the power to resolve tickets, update records, and run workflows instantly.",
    icon: Sparkles,
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
  },
  {
    id: "step-4",
    title: "Omnichannel. Everywhere.",
    subtitle:
      "Seamlessly transition between chat, email, WhatsApp, and voice without leaving the dashboard.",
    icon: MessageSquare,
    color: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-500",
  },
  {
    id: "step-5",
    title: "Make it Yours.",
    subtitle:
      "Customizable widgets that feel native to your brand. Seamless integration everywhere.",
    icon: Code,
    color: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-500",
  },
];

function StepContent({ step }: { step: typeof steps[0] }) {
  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
      {/* Text Section */}
      <div className="flex flex-col max-w-3xl">
        <h2 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-neutral-900 dark:text-white mb-4 md:mb-6">
          {step.title}
        </h2>
        
        <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {step.subtitle}
        </p>
      </div>

      {/* Video / Animation Placeholder */}
      <div className="w-full aspect-[16/9] rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl lg:shadow-2xl overflow-hidden relative flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03)_0%,transparent_60%)]" />
        <div className="absolute top-4 left-4 right-4 h-10 lg:h-12 rounded-xl bg-white/50 dark:bg-black/20 border border-neutral-200 dark:border-white/5 flex items-center px-4 gap-2">
          <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-green-400" />
        </div>
        
        <div className="flex items-center justify-center flex-col z-10">
          <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mb-4 ring-8 ring-neutral-100 dark:ring-neutral-900/50">
            <div className="w-5 h-5 lg:w-6 lg:h-6 border-4 border-neutral-400 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-400 rounded-full animate-spin" />
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium tracking-wide text-xs lg:text-sm uppercase">
            Demo Video Placeholder
          </p>
        </div>
        
        <div className="absolute bottom-0 inset-x-0 h-32 lg:h-48 opacity-20 bg-gradient-to-t from-black/10 to-transparent flex items-end justify-center gap-2 lg:gap-4 px-6 lg:px-12">
            <div className="w-1/4 h-16 lg:h-24 bg-neutral-400 dark:bg-neutral-600 rounded-t-lg" />
            <div className="w-1/2 h-24 lg:h-40 bg-neutral-400 dark:bg-neutral-600 rounded-t-lg" />
            <div className="w-1/4 h-20 lg:h-32 bg-neutral-400 dark:bg-neutral-600 rounded-t-lg" />
        </div>
      </div>
    </div>
  );
}

// Vertical view for mobile/tablet devices
function MobileVerticalStory() {
  return (
    <div className="flex flex-col gap-16 lg:hidden py-24 pb-32">
      <div className="absolute top-0 inset-x-0 h-[40rem] bg-[radial-gradient(100%_100%_at_50%_0%,rgba(100,100,100,0.05)_0%,transparent_100%)] dark:bg-[radial-gradient(100%_100%_at_50%_0%,rgba(255,255,255,0.02)_0%,transparent_100%)] pointer-events-none" />
      {steps.map((step) => (
        <div key={step.id} className="min-h-min border-b border-neutral-200 dark:border-neutral-800 last:border-0 pb-16 last:pb-0 z-10">
          <StepContent step={step} />
        </div>
      ))}
    </div>
  );
}

// Horizontal sticky view for Desktop
function DesktopHorizontalStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });

  // Apply a spring physics to make the scroll transition much smoother
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 25,
    mass: 0.1,
    restDelta: 0.001
  });

  // Total horizontal width will be the width of all steps plus gaps.
  // Let's say each step is 80vw width and gap is 4vw.
  // The motion div will translate up to the end of its scrollable width.
  // For 5 steps, the movement is much smaller than 500vw, so it feels faster and closer.
  const xTransform = useTransform(smoothProgress, [0, 1], ["0%", `-${(steps.length - 1) * 85}vw`]);

  return (
    <div 
      ref={containerRef} 
      className="hidden lg:block relative" 
      // Adjusted the height so the overall scroll time is faster.
      style={{ height: `${steps.length * 70}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center bg-white dark:bg-black">
        <div className="absolute top-0 inset-x-0 h-[40rem] bg-[radial-gradient(100%_100%_at_50%_0%,rgba(100,100,100,0.05)_0%,transparent_100%)] dark:bg-[radial-gradient(100%_100%_at_50%_0%,rgba(255,255,255,0.02)_0%,transparent_100%)] pointer-events-none" />
        
        <motion.div 
          className="flex gap-[5vw] pl-[10vw] pr-[10vw]" 
          // Width needs to cover all the steps sizes + gaps + paddings -> 5 steps * 80vw + 4 gaps * 5vw + 2 padding * 10vw = 400 + 20 + 20 = 440vw
          // We translate based on percentage.
          style={{ x: xTransform, width: `${(steps.length * 80) + ((steps.length - 1) * 5) + 20}vw` }}
        >
          {steps.map((step) => (
            <div 
              key={step.id} 
              className="w-[80vw] h-screen flex items-center justify-center shrink-0"
            >
              <StepContent step={step} />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export function ScrollStorySection() {
  return (
    <section className="bg-white dark:bg-black w-full relative">
      <MobileVerticalStory />
      <DesktopHorizontalStory />
    </section>
  );
}
