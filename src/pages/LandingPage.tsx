import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button';
import { Logo } from '../components/ui/Logo';
import { cn } from '../lib/utils';
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Globe2,
  LayoutTemplate,
  MousePointer2,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: MousePointer2,
    title: 'Drag & Drop Builder',
    description: 'Create beautiful forms with our intuitive drag-and-drop interface. No coding required.',
  },
  {
    icon: LayoutTemplate,
    title: '10+ Templates',
    description: 'Start quickly with pre-built templates for events, surveys, job applications, and more.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track submissions, view responses, and export data in CSV or JSON format.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Reliable',
    description: 'Your data is encrypted and stored securely. GDPR compliant.',
  },
  {
    icon: UsersRound,
    title: 'Team Collaboration',
    description: 'Invite team members to manage forms and view submissions together.',
  },
  {
    icon: Globe2,
    title: 'Share Anywhere',
    description: 'Get shareable links, embed codes, and QR codes for your forms.',
  },
];

const steps = [
  {
    icon: FileText,
    title: 'Create Your Form',
    description: 'Use our drag-and-drop builder or start with a template',
  },
  {
    icon: Send,
    title: 'Share Your Form',
    description: 'Get a shareable link, embed code, or QR code',
  },
  {
    icon: BarChart3,
    title: 'Collect Responses',
    description: 'View submissions in real-time and export data',
  },
];

const testimonials = [
  {
    quote: "SifyForms.AI has transformed how we collect event registrations. It's incredibly easy to use!",
    author: 'Sarah Johnson',
    role: 'Event Manager',
  },
  {
    quote: 'We switched from Typeform and saved 50% on costs while getting better features.',
    author: 'Mike Chen',
    role: 'Startup Founder',
  },
  {
    quote: 'The drag-and-drop builder is so intuitive. I created my first form in under 5 minutes.',
    author: 'Emily Davis',
    role: 'Marketing Director',
  },
];

const freePlanFeatures = [
  'Unlimited forms',
  '100 submissions/month',
  'All field types',
  'CSV/JSON export',
];

export default function LandingPage() {
  return (
    <div className="public-shell min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link to="/" aria-label="SifyForms home" className="shrink-0 rounded-md">
            <Logo size="sm" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <a href="#features" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              to="/auth/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden h-9 rounded-lg px-3 text-[13px] font-semibold sm:inline-flex')}
            >
              Sign In
            </Link>
            <Link
              to="/auth/signup"
              className={cn(buttonVariants({ size: 'sm' }), 'h-9 rounded-lg px-3.5 text-xs font-semibold shadow-sm shadow-primary/15')}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-border/70">
          <div className="public-subtle-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] opacity-90" aria-hidden="true" />
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[36rem] max-w-full -translate-x-1/2 bg-primary/[0.035] blur-3xl" aria-hidden="true" />

          <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
            <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
              Create Registration Forms{' '}
              <span className="text-brand-gradient">in Minutes</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Build beautiful, responsive forms with our drag-and-drop builder.
              <br className="hidden sm:block" /> Collect submissions, analyze data, and grow your business.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/auth/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-lg px-6 text-[13px] font-semibold shadow-md shadow-primary/15')}
              >
                Start Building Free
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                to="/auth/login"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-lg border-border bg-background px-6 text-[13px] font-semibold shadow-sm')}
              >
                View Demo
              </Link>
            </div>

            <p className="mt-5 text-xs font-medium text-muted-foreground">
              No credit card required <span className="px-1.5 text-border">•</span> Free forever plan available
            </p>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Powerful and simple</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
                Everything You Need to Build Forms
              </h2>
              <p className="mt-4 text-sm font-medium leading-6 text-muted-foreground sm:text-base">
                Powerful features to help you create, share, and analyze your forms.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-border/90 bg-card p-6 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-foreground/[0.04]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-primary shadow-sm transition-colors group-hover:border-primary/20">
                    <feature.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <h3 className="mt-5 font-display text-sm font-bold tracking-tight text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-[13px] font-medium leading-[1.65] text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-border/70 bg-muted/30 px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Three simple steps</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">How It Works</h2>
              <p className="mt-4 text-sm font-medium text-muted-foreground sm:text-base">Get started in three simple steps</p>
            </div>

            <div className="relative mt-12 grid gap-4 md:grid-cols-3">
              <div className="absolute left-[17%] right-[17%] top-6 hidden border-t border-dashed border-border md:block" aria-hidden="true" />
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
                  <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-background text-primary shadow-sm">
                    <step.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Step {index + 1}</span>
                  <h3 className="mt-2 font-display text-sm font-bold tracking-tight">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[13px] font-medium leading-6 text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Customer stories</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Loved by Thousands</h2>
              <p className="mt-4 text-sm font-medium text-muted-foreground sm:text-base">See what our customers have to say</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.author} className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex gap-1" aria-label="5 out of 5 stars">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Sparkles key={star} className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-sm font-medium leading-6 text-foreground">“{testimonial.quote}”</blockquote>
                  <figcaption className="mt-6 border-t border-border/70 pt-4">
                    <p className="text-[13px] font-semibold text-foreground">{testimonial.author}</p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">{testimonial.role}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-y border-border/70 bg-muted/30 px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Start at no cost</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Simple, Transparent Pricing</h2>
              <p className="mt-4 text-sm font-medium text-muted-foreground sm:text-base">Start free, upgrade when you need more</p>
            </div>

            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-background p-7 shadow-lg shadow-foreground/[0.04] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold">Free Forever</h3>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">Everything you need to get started</p>
                </div>
                <span className="rounded-full border border-primary/15 bg-primary/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">Free</span>
              </div>

              <div className="mt-6 flex items-end gap-1.5 border-b border-border pb-6">
                <span className="font-display text-4xl font-bold tracking-tight">$0</span>
                <span className="pb-1 text-xs font-medium text-muted-foreground">/month</span>
              </div>

              <ul className="my-6 space-y-3">
                {freePlanFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[13px] font-medium text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/15 text-primary">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/auth/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full rounded-lg text-xs font-semibold shadow-sm shadow-primary/15')}
              >
                Get Started
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-background px-6 py-12 text-center shadow-xl shadow-foreground/[0.04] sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute inset-x-1/4 -top-24 h-48 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden="true" />
            <div className="relative">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-primary shadow-sm">
                <Zap className="h-5 w-5" strokeWidth={2} />
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Ready to Build Your First Form?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
                Join thousands of businesses using SifyForms.AI to collect data and grow.
              </p>
              <Link
                to="/auth/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'mt-7 h-11 rounded-lg px-6 text-[13px] font-semibold shadow-md shadow-primary/15')}
              >
                Start Building Free
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-background px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">Create, share, and understand better forms.</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex flex-wrap gap-5 text-xs font-semibold text-muted-foreground" aria-label="Footer navigation">
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#how-it-works" className="hover:text-foreground">How it works</a>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
              <Link to="/auth/login" className="hover:text-foreground">Sign In</Link>
            </nav>
            <p className="text-[11px] font-medium text-muted-foreground">© 2026 SifyForms.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
