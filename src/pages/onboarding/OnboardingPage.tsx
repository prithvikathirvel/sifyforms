import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { updateProfile } from '../../store/authSlice';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select } from '../../components/ui/select';
import { toast } from '../../components/ui/toast';
import { cn } from '../../lib/utils';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, ClipboardList, FileText,
  Loader2, Megaphone, MessageCircleQuestion, Search, Tv, Users,
} from 'lucide-react';

/**
 * First-run onboarding, in the shape quiet SaaS products use: one question per
 * screen, a dot of progress, a way out of every step. It appears exactly once
 * — after the first sign-in — and everything it asks is skippable. Whatever is
 * answered is stored on the account (updateProfile → the user-management
 * service); whatever is skipped is simply not. The last screen hands over to
 * the organization setup that already exists.
 */

type RawUser = {
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  address?: string;
  additionalDetails?: Record<string, unknown>;
};

const HEARD_ABOUT_OPTIONS = [
  { value: 'search', label: 'Search engine', icon: Search },
  { value: 'colleague', label: 'A colleague or friend', icon: Users },
  { value: 'social', label: 'Social media', icon: MessageCircleQuestion },
  { value: 'advertisement', label: 'An advertisement', icon: Tv },
  { value: 'existing', label: 'Used SifyForms before', icon: ClipboardList },
  { value: 'other', label: 'Other', icon: Megaphone },
] as const;

const STEP_COUNT = 3;

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === step - 1 ? 'w-5 bg-primary' : i < step - 1 ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'
          )}
        />
      ))}
    </div>
  );
}

function Shell({
  step, title, description, onBack, onSkip, skipLabel, onNext, nextLabel, nextDisabled, saving, children,
}: {
  step: number;
  title: string;
  description: string;
  onBack?: () => void;
  onSkip: () => void;
  skipLabel: string;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="public-shell flex min-h-[100dvh] flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex flex-col items-center gap-4">
            <Logo size="sm" />
            <StepDots step={step} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Step {step} of {STEP_COUNT}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border/70 px-6 py-5 text-center sm:px-8">
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h1>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-snug text-muted-foreground">{description}</p>
            </div>
            <div className="px-6 py-5 sm:px-8">{children}</div>
            <div className="flex items-center gap-2 border-t border-border/70 bg-muted/25 px-6 py-3.5 sm:px-8">
              {onBack ? (
                <Button type="button" variant="ghost" className="h-9 flex-none rounded-lg px-3 text-[13px]" onClick={onBack}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  Back
                </Button>
              ) : (
                <span className="flex-1" />
              )}
              {onBack && <span className="flex-1" />}
              <button
                type="button"
                onClick={onSkip}
                className="ml-auto text-[12.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {skipLabel}
              </button>
              <Button type="button" className="h-9 flex-none rounded-lg px-4 text-[13px]" disabled={nextDisabled || saving} onClick={onNext}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {nextLabel}
                {!saving && <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.8} />}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const accountUser = useAppSelector((state) => state.auth.accountUser) as RawUser | null;

  const existingDetails = useMemo(
    () => (accountUser?.additionalDetails ?? {}) as Record<string, unknown>,
    [accountUser?.additionalDetails]
  );
  const alreadyOnboarded = existingDetails.onboardedAt != null;

  const [step, setStep] = useState(1);
  const [heardAbout, setHeardAbout] = useState<string | null>(null);
  const [heardOther, setHeardOther] = useState('');
  const [profile, setProfile] = useState({
    firstName: accountUser?.firstName ?? '',
    lastName: accountUser?.lastName ?? '',
    phone: accountUser?.phone ?? '',
    gender: accountUser?.gender ?? '',
    address: accountUser?.address ?? '',
  });
  const [saving, setSaving] = useState(false);

  /** Everything the account should carry once onboarding is done, merged. */
  const completionPayload = useMemo(() => {
    const details: Record<string, unknown> = { ...existingDetails, onboardedAt: new Date().toISOString() };
    if (heardAbout) {
      details.heardAboutUs = heardAbout;
      if (heardAbout === 'other' && heardOther.trim()) details.heardAboutUsOther = heardOther.trim();
    }
    return details;
  }, [existingDetails, heardAbout, heardOther]);

  /** Save what this run collected, then leave. Never traps: a failure toasts and moves on. */
  const finish = async (includeProfile: boolean) => {
    setSaving(true);
    try {
      const payload: {
        username: string;
        additionalDetails?: Record<string, unknown>;
        firstName?: string;
        lastName?: string;
        phone?: string;
        gender?: string;
        address?: string;
      } = {
        username: accountUser?.username || '',
        additionalDetails: completionPayload,
      };
      if (includeProfile) {
        if (profile.firstName.trim()) payload.firstName = profile.firstName.trim();
        if (profile.lastName.trim()) payload.lastName = profile.lastName.trim();
        payload.phone = profile.phone.trim();
        payload.gender = profile.gender || undefined;
        payload.address = profile.address.trim() || undefined;
      }
      await dispatch(updateProfile(payload)).unwrap();
    } catch {
      // The answers are a courtesy, not a gate — onboarding ends regardless.
      toast.info({ title: 'Saved what we could', description: 'You can complete your profile any time from the Profile page.' });
    } finally {
      navigate('/org/setup', { replace: true });
    }
  };

  if (alreadyOnboarded) return <Navigate to="/org/setup" replace />;

  return (
    <>
      {step === 1 && (
        <Shell
          step={1}
          title="Welcome to SifyForms"
          description="Build forms, collect answers, see results. Three short steps — or skip them all."
          onSkip={() => void finish(false)}
          skipLabel="Skip for now"
          onNext={() => setStep(2)}
          nextLabel="Get started"
        >
          <div className="grid gap-2.5">
            {[
              { icon: FileText, title: 'Build', text: 'Pick a form type, add questions, publish when ready.' },
              { icon: ClipboardList, title: 'Collect', text: 'Share one link — answers arrive in real time.' },
              { icon: BarChart3, title: 'Understand', text: 'Results, scores and poll counts, ready to read.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-border/80 px-3.5 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Shell>
      )}

      {step === 2 && (
        <Shell
          step={2}
          title="Where did you hear about us?"
          description="One tap. It helps us know what works — and nothing else."
          onBack={() => setStep(1)}
          onSkip={() => setStep(3)}
          skipLabel="Skip this question"
          onNext={() => setStep(3)}
          nextLabel="Continue"
          nextDisabled={!heardAbout}
        >
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Where did you hear about us">
            {HEARD_ABOUT_OPTIONS.map((option) => {
              const active = heardAbout === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setHeardAbout(option.value)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                    active ? 'border-primary/50 bg-accent text-foreground' : 'border-border text-foreground hover:border-primary/35 hover:bg-accent/40'
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-none', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {active && <Check className="h-3.5 w-3.5 flex-none text-primary" />}
                </button>
              );
            })}
          </div>
          {heardAbout === 'other' && (
            <Input
              value={heardOther}
              onChange={(e) => setHeardOther(e.target.value)}
              placeholder="Where, in a word or two?"
              maxLength={120}
              className="mt-3 h-10 rounded-lg text-[13px]"
              aria-label="Tell us where"
            />
          )}
        </Shell>
      )}

      {step === 3 && (
        <Shell
          step={3}
          title="About you"
          description="Optional, and only for your account — phone for recovery, the rest for formatting."
          onBack={() => setStep(2)}
          onSkip={() => void finish(false)}
          skipLabel="Skip for now"
          onNext={() => void finish(true)}
          nextLabel="Save and continue"
          saving={saving}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ob-first" className="text-xs font-semibold">First name</Label>
              <Input id="ob-first" value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} className="h-10 rounded-lg text-[13px]" maxLength={25} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-last" className="text-xs font-semibold">Last name</Label>
              <Input id="ob-last" value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} className="h-10 rounded-lg text-[13px]" maxLength={25} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-phone" className="text-xs font-semibold">Phone</Label>
              <Input id="ob-phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} className="h-10 rounded-lg text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-gender" className="text-xs font-semibold">Gender</Label>
              <Select
                id="ob-gender"
                value={profile.gender}
                placeholder="Select"
                className="h-10 rounded-lg text-[13px]"
                options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]}
                onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ob-address" className="text-xs font-semibold">Address</Label>
              <Textarea id="ob-address" rows={2} maxLength={50} placeholder="Optional" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} className="min-h-[4rem] rounded-lg text-[13px]" />
            </div>
          </div>
        </Shell>
      )}
    </>
  );
}
