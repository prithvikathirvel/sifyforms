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
 * First-run onboarding for newly created accounts.
 *
 * Design notes: one question per screen inside a fixed-height card, so the
 * layout never jumps between steps; a single type scale (15px titles, 13px
 * body, 12px captions); one primary action per screen with a text-level Skip
 * beside it. Everything is skippable, and the flow is one-time: the account
 * is created with `additionalDetails.onboardingPending = true` (only new
 * sign-ups), and finishing or skipping clears that flag — so an account that
 * has seen it, or existed before it, is never shown it again.
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
const STEP_TITLES = ['Welcome', 'About you', 'Your details'];

/** One shared frame for every step: same card, same height, same footer. */
function Shell({
  step, onBack, onSkip, skipLabel, onNext, nextLabel, nextDisabled, saving, children,
}: {
  step: number;
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
    <div className="public-shell flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Progress: a thin bar that fills, with the step count beside it. */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(step / STEP_COUNT) * 100}%` }}
            />
          </div>
          <p className="flex-none text-[11px] font-semibold tracking-wide text-muted-foreground">
            {step} of {STEP_COUNT}
          </p>
        </div>

        <div className="flex min-h-[30rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Title block — identical on every step, so nothing shifts. */}
          <div className="border-b border-border/70 px-8 pb-5 pt-7 text-center">
            <div className="mb-4 flex justify-center">
              <Logo size="sm" />
            </div>
            <h1 className="font-display text-[15px] font-bold tracking-tight text-foreground">
              {STEP_TITLES[step - 1]}
            </h1>
          </div>

          {/* Content — centered vertically so short steps fill the same height. */}
          <div className="flex flex-1 flex-col justify-center px-8 py-6">
            {children}
          </div>

          {/* Footer — Back on the left, Skip and the primary action on the right. */}
          <div className="flex items-center gap-2 border-t border-border/70 bg-muted/25 px-8 py-3.5">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                className="h-8 flex-none rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground"
                onClick={onBack}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" strokeWidth={1.8} />
                Back
              </Button>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={onSkip}
              className="ml-auto px-2 text-[12.5px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {skipLabel}
            </button>
            <Button
              type="button"
              className="h-8 flex-none rounded-lg px-3.5 text-[12.5px] font-semibold"
              disabled={nextDisabled || saving}
              onClick={onNext}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {nextLabel}
              {!saving && <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.8} />}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          You can change any of this later from your profile.
        </p>
      </div>
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
  /** Existing accounts (no flag) and finished accounts (flag cleared) skip straight on. */
  const pending = existingDetails.onboardingPending === true;

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

  /** What the account carries once onboarding is over — the flag cleared, the answers kept. */
  const completionPayload = useMemo(() => {
    const details: Record<string, unknown> = {
      ...existingDetails,
      onboardingPending: false,
      onboardedAt: new Date().toISOString(),
    };
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

  if (!pending) return <Navigate to="/org/setup" replace />;

  return (
    <>
      {step === 1 && (
        <Shell
          step={1}
          onSkip={() => void finish(false)}
          skipLabel="Skip for now"
          onNext={() => setStep(2)}
          nextLabel="Get started"
        >
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                SifyForms turns questions into answers and answers into results.
                Three quick steps to set up your account — or skip them all.
              </p>
            </div>
            <div className="grid gap-2">
              {[
                { icon: FileText, title: 'Build', text: 'Pick a form type, add questions, publish when ready.' },
                { icon: ClipboardList, title: 'Collect', text: 'Share one link — answers arrive in real time.' },
                { icon: BarChart3, title: 'Understand', text: 'Results, scores and poll counts, ready to read.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-center gap-3 rounded-lg border border-border/70 px-3.5 py-2.5">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-primary/[0.07] text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <p className="min-w-0 text-[12.5px] leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="mx-1.5 text-border">·</span>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      )}

      {step === 2 && (
        <Shell
          step={2}
          onBack={() => setStep(1)}
          onSkip={() => setStep(3)}
          skipLabel="Skip this question"
          onNext={() => setStep(3)}
          nextLabel="Continue"
          nextDisabled={!heardAbout}
        >
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Where did you hear about us? One tap — it helps us know what works, and nothing else.
            </p>
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
                      'flex h-9 items-center gap-2.5 rounded-lg border px-3 text-left text-[12.5px] font-medium transition-colors',
                      active
                        ? 'border-primary/50 bg-accent text-foreground'
                        : 'border-border text-foreground hover:border-primary/35 hover:bg-accent/40'
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-none', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.8} />
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
                className="h-9 rounded-lg text-[12.5px]"
                aria-label="Tell us where"
              />
            )}
          </div>
        </Shell>
      )}

      {step === 3 && (
        <Shell
          step={3}
          onBack={() => setStep(2)}
          onSkip={() => void finish(false)}
          skipLabel="Skip for now"
          onNext={() => void finish(true)}
          nextLabel="Save and continue"
          saving={saving}
        >
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Add a little about yourself — used only for your account. Every field is optional.
            </p>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-first" className="text-[11px] font-semibold text-muted-foreground">First name</Label>
                <Input id="ob-first" value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} className="h-9 rounded-lg text-[12.5px]" maxLength={25} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-last" className="text-[11px] font-semibold text-muted-foreground">Last name</Label>
                <Input id="ob-last" value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} className="h-9 rounded-lg text-[12.5px]" maxLength={25} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-phone" className="text-[11px] font-semibold text-muted-foreground">Phone</Label>
                <Input id="ob-phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} className="h-9 rounded-lg text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-gender" className="text-[11px] font-semibold text-muted-foreground">Gender</Label>
                <Select
                  id="ob-gender"
                  value={profile.gender}
                  placeholder="Select"
                  className="h-9 rounded-lg text-[12.5px]"
                  options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]}
                  onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ob-address" className="text-[11px] font-semibold text-muted-foreground">Address</Label>
                <Textarea id="ob-address" rows={2} maxLength={50} placeholder="Optional" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} className="min-h-[2.75rem] rounded-lg text-[12.5px]" />
              </div>
            </div>
          </div>
        </Shell>
      )}
    </>
  );
}
