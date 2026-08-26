import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button';
import { Logo } from '../components/ui/Logo';
import { cn } from '../lib/utils';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe2,
  GripVertical,
  LayoutTemplate,
  ListChecks,
  LockKeyhole,
  Mail,
  MousePointer2,
  Send,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: MousePointer2,
    title: 'Visual form builder',
    description: 'Build polished forms with an intuitive drag-and-drop workspace—no code required.',
  },
  {
    icon: LayoutTemplate,
    title: 'Ready-to-use templates',
    description: 'Start from practical templates for registrations, surveys, applications, and more.',
  },
  {
    icon: Workflow,
    title: 'Flexible workflows',
    description: 'Shape each form with the fields, rules, and experience your process needs.',
  },
  {
    icon: BarChart3,
    title: 'Response analytics',
    description: 'Review submissions as they arrive and export your data in CSV or JSON format.',
  },
  {
    icon: UsersRound,
    title: 'Team collaboration',
    description: 'Keep forms, members, roles, and access organized in one shared workspace.',
  },
  {
    icon: Globe2,
    title: 'Share anywhere',
    description: 'Publish with a direct link, embed your form, or make it easy to access by QR code.',
  },
];

const steps = [
  {
    number: '01',
    icon: LayoutTemplate,
    title: 'Start with a clear foundation',
    description: 'Choose a template or begin with a blank canvas, then add the fields your process requires.',
  },
  {
    number: '02',
    icon: Send,
    title: 'Publish with confidence',
    description: 'Preview the responsive experience, then share a simple link or embed it where people already are.',
  },
  {
    number: '03',
    icon: BarChart3,
    title: 'Learn from every response',
    description: 'Track incoming submissions, review the details, and export structured data for the next step.',
  },
];

const freePlanFeatures = [
  'Unlimited forms',
  '100 submissions per month',
  'All field types',
  'CSV and JSON export',
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[38rem] lg:ml-auto">
      <div className="absolute -inset-5 rounded-[2rem] bg-brand-gradient-soft blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-plum-200/80 bg-card shadow-2xl shadow-plum-950/15">
        <div className="flex h-11 items-center justify-between border-b bg-ink-50/80 px-3.5 sm:px-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-plum-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
            Autosaved
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-foreground sm:text-sm">Candidate application</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">12 fields · Updated just now</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-md border bg-muted/50 px-2 py-1 text-[10px] font-bold text-muted-foreground sm:inline-flex">Preview</span>
            <span className="rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground sm:px-3">Publish</span>
          </div>
        </div>

        <div className="grid min-h-[20rem] grid-cols-[4.75rem_1fr] bg-ink-50/60 sm:min-h-[23rem] sm:grid-cols-[9rem_1fr]">
          <div className="border-r bg-background p-2 sm:p-3">
            <p className="mb-2 hidden text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:block">Add a field</p>
            <div className="space-y-2">
              {[
                { icon: TextCursorInput, label: 'Short answer' },
                { icon: Mail, label: 'Email' },
                { icon: ListChecks, label: 'Choice' },
                { icon: CalendarDays, label: 'Date' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border bg-card text-muted-foreground shadow-sm sm:justify-start sm:px-2.5"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
                  <span className="hidden truncate text-[11px] font-bold sm:block">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="mx-auto max-w-sm rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <div className="h-2.5 w-24 rounded-full bg-plum-800 sm:w-32" />
                  <div className="mt-2 h-1.5 w-32 rounded-full bg-ink-200 sm:w-44" />
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary">
                  <FileText className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Full name', width: 'w-20' },
                  { label: 'Work email', width: 'w-16' },
                ].map((field) => (
                  <div key={field.label} className="group relative rounded-lg border border-primary/20 bg-background p-2.5 ring-1 ring-primary/[0.05]">
                    <GripVertical className="absolute -left-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary sm:block" />
                    <div className={`h-1.5 ${field.width} rounded-full bg-ink-500`} />
                    <div className="mt-2.5 h-8 rounded-md border bg-ink-50" />
                  </div>
                ))}
                <div className="rounded-lg border bg-background p-2.5">
                  <div className="h-1.5 w-24 rounded-full bg-ink-500" />
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="h-7 rounded-md border bg-ink-50" />
                    <div className="h-7 rounded-md border bg-ink-50" />
                  </div>
                </div>
                <div className="h-8 w-24 rounded-md bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-xl border bg-card p-3 pr-5 shadow-xl shadow-plum-950/10 sm:flex lg:-left-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/[0.09] text-primary">
          <Zap className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-xs font-bold text-foreground">Ready to share</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Responsive on every screen</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link to="/" aria-label="SifyForms home" className="shrink-0 rounded-md">
            <Logo size="md" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            <a href="#features" className="rounded-md px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Features
            </a>
            <a href="#workflow" className="rounded-md px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              How it works
            </a>
            <a href="#security" className="rounded-md px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              For teams
            </a>
            <a href="#pricing" className="rounded-md px-3.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/auth/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden font-bold sm:inline-flex')}
            >
              Sign in
            </Link>
            <Link
              to="/auth/signup"
              className={cn(buttonVariants({ size: 'sm' }), 'rounded-lg px-3.5 font-bold shadow-sm shadow-primary/20 sm:px-4')}
            >
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border/60">
          <div className="landing-dot-pattern absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="absolute left-1/2 top-12 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:px-8 lg:py-24 xl:gap-20 xl:py-28">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
                Form operations, simplified
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[3.45rem] xl:text-6xl">
                Build forms that make{' '}
                <span className="text-brand-gradient">every response actionable.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Create responsive forms, collaborate with your team, and understand submissions—all in one clear, dependable workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/auth/signup"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-lg px-6 text-base font-bold shadow-lg shadow-primary/20')}
                >
                  Start building free
                  <ArrowRight className="ml-2 h-5 w-5" strokeWidth={2.4} />
                </Link>
                <a
                  href="#workflow"
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 rounded-lg px-6 text-base font-bold')}
                >
                  See how it works
                  <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.4} />
                </a>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground" aria-label="Product benefits">
                {['No code required', 'Responsive by default', 'Built for teams'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={2.4} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section className="border-b border-border/70 bg-card" aria-label="Common form use cases">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p className="text-sm font-bold text-foreground">One workspace for the forms that move work forward</p>
            <div className="grid grid-cols-2 gap-x-7 gap-y-3 text-sm font-bold text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:gap-7">
              {['Registrations', 'Surveys', 'Applications', 'Feedback'].map((useCase) => (
                <span key={useCase} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                  {useCase}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 px-5 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Everything in one place</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  A simpler way to run your form workflow.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:ml-auto lg:text-lg">
                Move from a first draft to organized response data without stitching together disconnected tools or compromising the user experience.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-xl hover:shadow-plum-950/[0.06] sm:p-7"
                >
                  <span className="absolute right-5 top-4 text-4xl font-bold text-plum-100/80" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 border-y border-border/70 bg-muted/35 px-5 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">From idea to insight</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A clear path from blank page to useful data.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                A focused three-step flow keeps form creation understandable for every member of your team.
              </p>
            </div>

            <div className="relative mt-12 grid gap-4 lg:grid-cols-3">
              <div className="absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-primary/25 lg:block" aria-hidden="true" />
              {steps.map((step) => (
                <article key={step.number} className="relative rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground shadow-md shadow-primary/15">
                      <step.icon className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <span className="text-sm font-bold tracking-[0.15em] text-primary/70">{step.number}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="scroll-mt-24 px-5 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-white shadow-2xl shadow-plum-950/20 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
            <div className="auth-panel-pattern absolute inset-0 opacity-30" aria-hidden="true" />
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/[0.04]" aria-hidden="true" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/80">
                  <ShieldCheck className="h-4 w-4 text-brand-200" strokeWidth={2.4} />
                  Designed for responsible teams
                </div>
                <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  The control your team needs, without the complexity.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
                  Keep collaboration structured with organization workspaces, member roles, and clear form ownership—while giving respondents a polished experience.
                </p>
                <Link
                  to="/auth/signup"
                  className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'mt-8 h-12 rounded-lg px-6 font-bold shadow-lg')}
                >
                  Create your workspace
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.4} />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: LockKeyhole, title: 'Secure access', text: 'Keep account access and organization context clearly separated.' },
                  { icon: UsersRound, title: 'Role-aware teams', text: 'Organize the right level of access for each team member.' },
                  { icon: ShieldCheck, title: 'Reliable workflow', text: 'Manage forms and submissions from one consistent workspace.' },
                  { icon: Globe2, title: 'Responsive delivery', text: 'Give every respondent a clear experience on any screen.' },
                ].map((item) => (
                  <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
                    <item.icon className="h-5 w-5 text-brand-200" strokeWidth={2.25} />
                    <h3 className="mt-4 font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-5 text-white/60">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 border-y border-border/70 bg-muted/35 px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-xl shadow-plum-950/[0.05] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Simple pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Start free. Scale when you need to.</h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
                Create your first workflow without a credit card and bring more of your process into SifyForms as your needs grow.
              </p>
              <Link
                to="/auth/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'mt-7 h-12 rounded-lg px-6 text-base font-bold shadow-md shadow-primary/15')}
              >
                Get started free
                <ArrowRight className="ml-2 h-5 w-5" strokeWidth={2.4} />
              </Link>
            </div>

            <div className="border-t bg-brand-gradient-soft p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight text-foreground">$0</span>
                <span className="pb-1.5 text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-2 text-sm font-bold text-primary">Free forever</p>
              <ul className="mt-6 space-y-3.5">
                {freePlanFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm font-bold text-foreground/85">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
              <Sparkles className="h-5 w-5" strokeWidth={2.3} />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Your next form can be ready in minutes.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Give your team a better way to create, share, and understand the forms that keep work moving.
            </p>
            <Link
              to="/auth/signup"
              className={cn(buttonVariants({ size: 'lg' }), 'mt-8 h-12 rounded-lg px-7 text-base font-bold shadow-lg shadow-primary/20')}
            >
              Start building free
              <ArrowRight className="ml-2 h-5 w-5" strokeWidth={2.4} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-card px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted-foreground">Clear forms. Better responses.</p>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-muted-foreground" aria-label="Footer navigation">
              <a href="#features" className="transition-colors hover:text-foreground">Features</a>
              <a href="#workflow" className="transition-colors hover:text-foreground">How it works</a>
              <a href="#security" className="transition-colors hover:text-foreground">For teams</a>
              <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            </nav>
            <span className="hidden h-5 border-l sm:block" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">© 2026 SifyForms.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
