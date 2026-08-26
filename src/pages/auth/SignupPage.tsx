import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { registerUser, register as registerAuth, clearError } from '../../store/authSlice';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Logo } from '../../components/ui/Logo';

const signupSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters'),
  firstName: z.string().min(3, 'First name must be at least 3 characters long').max(25, 'First name cannot exceed 25 characters'),
  lastName: z.string().min(3, 'Last name must be at least 3 characters long').max(25, 'Last name cannot exceed 25 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must contain exactly 10 digits'),
  gender: z.enum(['Male', 'Female', 'Other'], { error: 'Gender is required' }),
  address: z.string().min(3, 'Address must be at least 3 characters long').max(50, 'Address cannot exceed 50 characters'),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;
type FormError = { message?: string } | undefined;

const inputClassName = 'h-10 min-w-0 rounded-lg border-input bg-background text-base placeholder:text-[13px] sm:text-[13px]';

function RequiredMark() {
  return <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>;
}

function FieldError({ id, error }: { id: string; error: FormError }) {
  if (!error?.message) return null;

  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs font-medium leading-5 text-destructive">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {error.message}
    </p>
  );
}

function SectionHeading({ icon: Icon, title, description }: {
  icon: typeof KeyRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 pb-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary shadow-sm">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div>
        <h2 className="font-display text-sm font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [kvPairs, setKvPairs] = useState<{ key: string; value: string }[]>([]);
  const [detailsError, setDetailsError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      phone: '',
      gender: undefined,
      address: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const addKvPair = () => setKvPairs((prev) => [...prev, { key: '', value: '' }]);
  const removeKvPair = (i: number) => {
    setKvPairs((prev) => prev.filter((_, idx) => idx !== i));
    setDetailsError('');
  };
  const updateKvPair = (i: number, field: 'key' | 'value', val: string) => {
    setKvPairs((prev) => prev.map((pair, idx) => (idx === i ? { ...pair, [field]: val } : pair)));
    setDetailsError('');
  };

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);

    try {
      const hasIncompleteDetail = kvPairs.some(
        (pair) => !pair.key.trim() || !pair.value.trim()
      );
      if (hasIncompleteDetail) {
        setDetailsError('Complete both the label and value for each custom field.');
        return;
      }
      setDetailsError('');

      const rest = { ...data };
      delete (rest as Partial<SignupFormData>).confirmPassword;

      const additionalDetails = Object.fromEntries(
        kvPairs
          .filter((pair) => pair.key.trim())
          .map((pair) => [pair.key.trim(), pair.value])
      );

      const result = await dispatch(registerUser({ ...rest, additionalDetails }));

      if (registerUser.fulfilled.match(result)) {
        const payload = result.payload as { userDetails?: { id?: string } };
        const keycloakId = payload.userDetails?.id as string;
        const regResult = await dispatch(registerAuth({ ...rest, additionalDetails, id: keycloakId }));

        if (registerAuth.fulfilled.match(regResult)) {
          setSuccessMsg('Account created successfully!');
          setTimeout(() => {
            setSuccessMsg('');
            navigate('/auth/login');
          }, 2500);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout contentClassName="items-start lg:items-center">
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-[hsl(var(--success))] px-4 py-3 text-xs font-semibold text-[hsl(var(--success-foreground))] shadow-xl sm:right-6 sm:top-6"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
          {successMsg}
        </div>
      )}

      <Card className="w-full max-w-6xl overflow-hidden rounded-2xl border-border bg-card shadow-xl shadow-foreground/[0.045]">
        <CardHeader className="flex-row items-center gap-3 space-x-0 space-y-0 border-b border-border/70 px-5 py-4 text-left sm:gap-4 sm:px-7">
          <Logo variant="icon" size="md" className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="font-display text-xl font-bold leading-tight tracking-[-0.03em] text-foreground">
              Create your account
            </CardTitle>
            <p className="max-w-2xl text-xs font-medium leading-5 text-muted-foreground">
              Complete every field below to set up your SifyForms account.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4 px-5 py-4 sm:px-7 sm:py-5">
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.045] px-3.5 py-3 text-[13px] font-medium leading-5 text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border/70">
              <section aria-labelledby="account-details-heading" className="min-w-0 space-y-3 lg:pr-6">
                <div id="account-details-heading">
                  <SectionHeading icon={KeyRound} title="Account details" description="Required information used to access your workspace." />
                </div>

                <div className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="username" className="text-xs font-semibold">Username <RequiredMark /></Label>
                    <Input
                      id="username"
                      required
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. johndoe"
                      className={inputClassName}
                      aria-invalid={Boolean(errors.username)}
                      aria-describedby={errors.username ? 'username-error' : 'username-hint'}
                      {...register('username')}
                    />
                    {!errors.username && <p id="username-hint" className="text-[11px] font-medium text-muted-foreground">3–25 characters</p>}
                    <FieldError id="username-error" error={errors.username} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">Email address <RequiredMark /></Label>
                    <Input
                      id="email"
                      required
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      className={inputClassName}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'signup-email-error' : undefined}
                      {...register('email')}
                    />
                    <FieldError id="signup-email-error" error={errors.email} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold">Password <RequiredMark /></Label>
                    <div className="relative">
                      <Input
                        id="password"
                        required
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Create a password"
                        className={`${inputClassName} pr-10`}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'signup-password-error' : undefined}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((visible) => !visible)}
                        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        aria-pressed={showPasswords}
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FieldError id="signup-password-error" error={errors.password} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm password <RequiredMark /></Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        required
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                        className={`${inputClassName} pr-10`}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                        {...register('confirmPassword')}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </span>
                    </div>
                    <FieldError id="confirm-password-error" error={errors.confirmPassword} />
                  </div>
                </div>
              </section>

              <section aria-labelledby="profile-details-heading" className="min-w-0 space-y-3 border-t border-border/70 pt-5 lg:border-t-0 lg:pl-6 lg:pt-0">
                <div id="profile-details-heading">
                  <SectionHeading icon={UserRound} title="Profile details" description="Required information used to complete your profile." />
                </div>

                <div className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-semibold">First name <RequiredMark /></Label>
                    <Input
                      id="firstName"
                      required
                      type="text"
                      autoComplete="given-name"
                      placeholder="John"
                      className={inputClassName}
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={errors.firstName ? 'first-name-error' : undefined}
                      {...register('firstName')}
                    />
                    <FieldError id="first-name-error" error={errors.firstName} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-semibold">Last name <RequiredMark /></Label>
                    <Input
                      id="lastName"
                      required
                      type="text"
                      autoComplete="family-name"
                      placeholder="Doe"
                      className={inputClassName}
                      aria-invalid={Boolean(errors.lastName)}
                      aria-describedby={errors.lastName ? 'last-name-error' : undefined}
                      {...register('lastName')}
                    />
                    <FieldError id="last-name-error" error={errors.lastName} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">Phone <RequiredMark /></Label>
                    <Input
                      id="phone"
                      required
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="10-digit phone number"
                      maxLength={10}
                      className={inputClassName}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? 'phone-error' : undefined}
                      onKeyDown={(event) => {
                        if (event.key.length === 1 && !/[0-9]/.test(event.key) && !event.ctrlKey && !event.metaKey) {
                          event.preventDefault();
                        }
                      }}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData('text');
                        if (!/^\d+$/.test(pasted)) event.preventDefault();
                      }}
                      {...register('phone')}
                    />
                    <FieldError id="phone-error" error={errors.phone} />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="gender" className="text-xs font-semibold">Gender <RequiredMark /></Label>
                    <Select
                      id="gender"
                      required
                      options={[
                        { label: 'Male', value: 'Male' },
                        { label: 'Female', value: 'Female' },
                        { label: 'Other', value: 'Other' },
                      ]}
                      placeholder="Select gender"
                      className={inputClassName}
                      aria-invalid={Boolean(errors.gender)}
                      aria-describedby={errors.gender ? 'gender-error' : undefined}
                      {...register('gender')}
                    />
                    <FieldError id="gender-error" error={errors.gender} />
                  </div>

                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                    <Label htmlFor="address" className="text-xs font-semibold">Address <RequiredMark /></Label>
                    <Textarea
                      id="address"
                      required
                      autoComplete="street-address"
                      placeholder="Enter your address"
                      rows={2}
                      maxLength={50}
                      className="min-h-[4.5rem] min-w-0 resize-y rounded-lg border-input bg-background text-base placeholder:text-[13px] sm:text-[13px]"
                      aria-invalid={Boolean(errors.address)}
                      aria-describedby={errors.address ? 'address-error' : 'address-hint'}
                      {...register('address')}
                    />
                    {!errors.address && <p id="address-hint" className="text-[11px] font-medium text-muted-foreground">Up to 50 characters</p>}
                    <FieldError id="address-error" error={errors.address} />
                  </div>
                </div>
              </section>
            </div>

            <details className="group overflow-hidden rounded-xl border border-border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 marker:hidden sm:px-5">
                <div>
                  <h2 className="font-display text-[13px] font-bold tracking-tight text-foreground">Additional details</h2>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">Add custom profile information if needed.</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2} />
                </span>
              </summary>

              <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] font-medium leading-5 text-muted-foreground">Use a short label and its corresponding value.</p>
                  <Button type="button" variant="outline" size="sm" onClick={addKvPair} className="shrink-0 rounded-lg text-xs font-semibold">
                    <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
                    Add field
                  </Button>
                </div>

                {kvPairs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background px-4 py-4 text-center text-xs font-medium text-muted-foreground">
                    No custom details added.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kvPairs.map((pair, index) => (
                      <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Input
                          aria-label={`Additional detail ${index + 1} label`}
                          aria-invalid={Boolean(detailsError && !pair.key.trim())}
                          aria-describedby={detailsError ? 'custom-details-error' : undefined}
                          required
                          placeholder="Label"
                          value={pair.key}
                          className={inputClassName}
                          onChange={(event) => updateKvPair(index, 'key', event.target.value)}
                        />
                        <Input
                          aria-label={`Additional detail ${index + 1} value`}
                          aria-invalid={Boolean(detailsError && !pair.value.trim())}
                          aria-describedby={detailsError ? 'custom-details-error' : undefined}
                          required
                          placeholder="Value"
                          value={pair.value}
                          className={`${inputClassName} col-span-2 row-start-2 sm:col-span-1 sm:row-auto`}
                          onChange={(event) => updateKvPair(index, 'value', event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeKvPair(index)}
                          className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:col-start-3"
                          aria-label={`Remove additional detail ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>

            {detailsError && (
              <p id="custom-details-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {detailsError}
              </p>
            )}
          </CardContent>

          <CardFooter className="flex-col-reverse justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5 sm:flex-row sm:px-7">
            <p className="text-center text-xs font-medium text-muted-foreground sm:text-left">
              Already have an account?{' '}
              <Link to="/auth/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
            <Button type="submit" className="h-10 w-full rounded-lg px-7 text-[13px] font-semibold shadow-sm shadow-primary/15 sm:w-auto" disabled={submitting || isLoading}>
              {submitting || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
