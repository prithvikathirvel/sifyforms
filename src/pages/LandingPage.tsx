import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Logo } from '../components/ui/Logo';
import {
  FileText,
  Zap,
  BarChart3,
  Shield,
  Users,
  Globe,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Drag & Drop Builder',
    description: 'Create beautiful forms with our intuitive drag-and-drop interface. No coding required.',
  },
  {
    icon: Zap,
    title: '10+ Templates',
    description: 'Start quickly with pre-built templates for events, surveys, job applications, and more.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track submissions, view responses, and export data in CSV or JSON format.',
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    description: 'Your data is encrypted and stored securely. GDPR compliant.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite team members to manage forms and view submissions together.',
  },
  {
    icon: Globe,
    title: 'Share Anywhere',
    description: 'Get shareable links, embed codes, and QR codes for your forms.',
  },
];

const testimonials = [
  {
    quote: "SifyForms.AI has transformed how we collect event registrations. It's incredibly easy to use!",
    author: "Sarah Johnson",
    role: "Event Manager",
  },
  {
    quote: "We switched from Typeform and saved 50% on costs while getting better features.",
    author: "Mike Chen",
    role: "Startup Founder",
  },
  {
    quote: "The drag-and-drop builder is so intuitive. I created my first form in under 5 minutes.",
    author: "Emily Davis",
    role: "Marketing Director",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex items-center space-x-4">
            <Link to="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth/signup">
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Create Registration Forms{' '}
            <span className="text-brand-gradient block sm:inline">in Minutes</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Build beautiful, responsive forms with our drag-and-drop builder.
            Collect submissions, analyze data, and grow your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/auth/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                Start Building Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                View Demo
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Free forever plan available
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Build Forms
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features to help you create, share, and analyze your forms.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-lg p-6 shadow-sm border"
              >
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Form</h3>
              <p className="text-muted-foreground">
                Use our drag-and-drop builder or start with a template
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Share Your Form</h3>
              <p className="text-muted-foreground">
                Get a shareable link, embed code, or QR code
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Collect Responses</h3>
              <p className="text-muted-foreground">
                View submissions in real-time and export data
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Loved by Thousands
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our customers have to say
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-background rounded-lg p-6 shadow-sm border"
              >
                <p className="text-lg mb-4">"{testimonial.quote}"</p>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start free, upgrade when you need more
          </p>
          <div className="max-w-md mx-auto bg-background rounded-lg p-8 shadow-lg border">
            <h3 className="text-2xl font-bold mb-2">Free Forever</h3>
            <p className="text-4xl font-bold mb-4">$0<span className="text-lg font-normal text-muted-foreground">/month</span></p>
            <ul className="text-left space-y-3 mb-6">
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Unlimited forms
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                100 submissions/month
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                All field types
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                CSV/JSON export
              </li>
            </ul>
            <Link to="/auth/signup">
              <Button className="w-full" size="lg">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Build Your First Form?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using SifyForms.AI to collect data and grow.
          </p>
          <Link to="/auth/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Building Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Logo size="sm" />
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 SifyForms.AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
