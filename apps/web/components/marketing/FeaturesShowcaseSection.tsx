'use client'

import { useState, useEffect } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  BookOpenIcon,
  BotIcon,
  MessageSquareIcon,
  WidgetIcon,
  PaletteIcon,
  NetworkIcon,
} from 'lucide-react'

type Feature = {
  id: number
  title: string
  description: string
  longDescription: string
  icon: React.ComponentType<{ className?: string }>
  highlights: string[]
  accentColor: string
}

const FEATURES: Feature[] = [
  {
    id: 1,
    title: 'AI Training',
    description: 'Train your AI on company knowledge',
    longDescription: 'Upload and train your AI models on your unique company data, documentation, and knowledge base. Our intelligent system learns your business processes, product details, and support procedures to provide accurate, contextual responses.',
    icon: SparklesIcon,
    highlights: ['Multi-format support', 'Real-time updates', 'Version control'],
    accentColor: 'hsl(var(--primary))',
  },
  {
    id: 2,
    title: 'Knowledge Base',
    description: 'Chunk and manage documentation',
    longDescription: 'Organize your knowledge into intelligent chunks for better AI understanding. Automatically extract and structure information from documents, websites, and notes. Our chunking system optimizes content for retrieval and context awareness.',
    icon: BookOpenIcon,
    highlights: ['Auto-chunking', 'Semantic search', 'Content analytics'],
    accentColor: 'hsl(210 100% 50%)',
  },
  {
    id: 3,
    title: 'AI Actions',
    description: 'Trigger automated responses',
    longDescription: 'Set up intelligent workflows that automatically handle customer inquiries. Configure AI-powered actions that resolve common issues, escalate complex ones, and trigger internal notifications. Build smart decision trees without coding.',
    icon: BotIcon,
    highlights: ['No-code setup', 'Custom workflows', 'Smart routing'],
    accentColor: 'hsl(280 100% 50%)',
  },
  {
    id: 4,
    title: 'Omnichannel',
    description: 'Multi-channel message routing',
    longDescription: 'Consolidate messages from all your channels—email, chat, WhatsApp, social media, and more. Route conversations intelligently and maintain context across platforms. Provide seamless customer support wherever your audience is.',
    icon: MessageSquareIcon,
    highlights: ['Multiple channels', 'Smart routing', 'Unified inbox'],
    accentColor: 'hsl(160 100% 50%)',
  },
  {
    id: 5,
    title: 'Widget',
    description: 'Embed support on website',
    longDescription: 'Add a beautiful, responsive chat widget to your website in minutes. Customize appearance, behavior, and flows to match your brand. Track visitor interactions and route conversations to your support team.',
    icon: WidgetIcon,
    highlights: ['Easy embed', 'Fully customizable', 'Analytics ready'],
    accentColor: 'hsl(45 100% 50%)',
  },
  {
    id: 6,
    title: 'Customizations',
    description: 'Brand and configure appearance',
    longDescription: 'Full control over your support experience. Customize colors, fonts, branding, and behavior to align perfectly with your brand identity. Configure workflows, response templates, and user permissions to match your organization.',
    icon: PaletteIcon,
    highlights: ['White-label ready', 'Advanced theming', 'Role-based access'],
    accentColor: 'hsl(330 100% 50%)',
  },
]

export function FeaturesShowcaseSection() {
  const [activeStep, setActiveStep] = useState(1)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const currentFeature = FEATURES.find((f) => f.id === activeStep) || FEATURES[0]
  const Icon = currentFeature.icon

  // Auto-advance through steps
  useEffect(() => {
    if (!isAutoPlaying) return

    const timer = setTimeout(() => {
      setActiveStep((prev) => (prev === FEATURES.length ? 1 : prev + 1))
    }, 6000)

    return () => clearTimeout(timer)
  }, [activeStep, isAutoPlaying])

  const handlePrevious = () => {
    setIsAutoPlaying(false)
    setActiveStep((prev) => (prev === 1 ? FEATURES.length : prev - 1))
  }

  const handleNext = () => {
    setIsAutoPlaying(false)
    setActiveStep((prev) => (prev === FEATURES.length ? 1 : prev + 1))
  }

  const handleStepClick = (id: number) => {
    setIsAutoPlaying(false)
    setActiveStep(id)
  }

  return (
    <section className="relative overflow-hidden bg-background py-20 md:py-24">
      <style>{`
        @keyframes feature-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes feature-slide-in {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes feature-badge-pop {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes feature-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.1);
          }
          50% {
            box-shadow: 0 0 0 6px hsl(var(--primary) / 0);
          }
        }

        .feature-fade-in {
          animation: feature-fade-in 0.4s ease-out;
        }

        .feature-slide-in {
          animation: feature-slide-in 0.5s ease-out;
        }

        .feature-badge {
          animation: feature-badge-pop 0.4s ease-out;
        }

        .feature-step-active {
          animation: feature-glow 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Powerful Features Designed for Support Teams
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to deliver exceptional customer support at scale
          </p>
        </div>

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left Sidebar - Step Navigation */}
          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <button
                key={feature.id}
                onClick={() => handleStepClick(feature.id)}
                className={cn(
                  'group w-full text-left rounded-lg border transition-all duration-300 p-4',
                  activeStep === feature.id
                    ? 'border-primary/50 bg-primary/5 feature-step-active'
                    : 'border-border bg-transparent hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-colors duration-300',
                      activeStep === feature.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/20'
                    )}
                  >
                    {feature.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      'font-semibold transition-colors duration-300',
                      activeStep === feature.id ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {feature.title}
                    </h3>
                    <p className={cn(
                      'text-sm transition-colors duration-300 line-clamp-2',
                      activeStep === feature.id ? 'text-foreground/70' : 'text-muted-foreground/60'
                    )}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Content - Feature Display */}
          <div className="lg:col-span-2">
            <div key={`feature-${activeStep}`} className="feature-slide-in space-y-6">
              {/* Feature Header */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className="inline-flex items-center justify-center rounded-lg p-3"
                      style={{ backgroundColor: `${currentFeature.accentColor}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: currentFeature.accentColor }}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">
                      {currentFeature.title}
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Step {currentFeature.id} of {FEATURES.length}
                    </p>
                  </div>
                </div>

                <p className="text-base leading-relaxed text-foreground/80">
                  {currentFeature.longDescription}
                </p>
              </div>

              {/* Video Placeholder */}
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/50 aspect-video flex items-center justify-center group">
                <div className="text-center space-y-3">
                  <div
                    className="inline-flex items-center justify-center rounded-lg p-3 mx-auto"
                    style={{ backgroundColor: `${currentFeature.accentColor}20` }}
                  >
                    <svg
                      className="h-8 w-8"
                      style={{ color: currentFeature.accentColor }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Demo Video Coming Soon</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Interactive demo video will be available here
                    </p>
                  </div>
                </div>

                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>

              {/* Highlights */}
              <div>
                <h4 className="text-sm font-semibold text-foreground/70 mb-3">Key Features</h4>
                <div className="flex flex-wrap gap-2">
                  {currentFeature.highlights.map((highlight, index) => (
                    <div
                      key={highlight}
                      className="feature-badge inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {highlight}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="mt-12 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
            aria-label="Previous feature"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          {/* Step Indicators */}
          <div className="flex items-center gap-2">
            {FEATURES.map((feature) => (
              <button
                key={feature.id}
                onClick={() => handleStepClick(feature.id)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  activeStep === feature.id ? 'w-8 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground'
                )}
                aria-label={`Go to step ${feature.id}`}
                aria-current={activeStep === feature.id}
              />
            ))}
          </div>

          {/* Step Counter */}
          <div className="hidden sm:block text-sm text-muted-foreground font-medium">
            {String(activeStep).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}
          </div>

          <button
            onClick={handleNext}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
            aria-label="Next feature"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
