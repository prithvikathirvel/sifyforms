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

const signupSchema = z.object({
  email: z.string().email('Invalid email format. Only letters, numbers, and dots are allowed.'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string(),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters'),
  firstName: z.union([z.string().min(3, 'First name must be at least 3 characters long').max(25, 'First name cannot exceed 25 characters'), z.literal('')]).optional(),
  lastName: z.union([z.string().min(3, 'Last name must be at least 3 characters long').max(25, 'Last name cannot exceed 25 characters'), z.literal('')]).optional(),
  phone: z.union([z.string().max(10, 'Phone number cannot exceed 10 digits'), z.literal('')]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: z.union([z.string().min(3).max(50), z.literal('')]).optional(),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;
type FormError = { message?: string } | undefined;

const inputClassName = 'h-11 rounded-lg text-base sm:text-sm';

function OptionalLabel() {
  return <span className="ml-1 font-normal text-muted-foreground">(optional)</span>;
}

function FieldError({ id, error }: { id: string; error: FormError }) {
  if (!error?.message) return null;

  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm leading-5 text-destructive">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {error.message}
    </p>
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
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
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const addKvPair = () => setKvPairs((prev) => [...prev, { key: '', value: '' }]);
  const removeKvPair = (i: number) => setKvPairs((prev) => prev.filter((_, idx) => idx !== i));
  const updateKvPair = (i: number, field: 'key' | 'value', val: string) =>
    setKvPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);

    try {
      const rest = { ...data };
      delete (rest as Partial<SignupFormData>).confirmPassword;

      const additionalDetails = Object.fromEntries(
        kvPairs
          .filter((p) => p.key.trim())
          .map((p) => [p.key.trim(), p.value])
      );

      const result = await dispatch(
        registerUser({ ...rest, additionalDetails })
      );

      if (registerUser.fulfilled.match(result)) {
        const payload = result.payload as { userDetails?: { id?: string } };
        const keycloakId = payload.userDetails?.id as string;
        const regResult = await dispatch(
          registerAuth({ ...rest, additionalDetails, id: keycloakId })
        );

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
    <AuthLayout
      title="Set up a workspace that scales with you."
      description="Start with your profile, then bring your team and form workflows together when you are ready."
      highlights={[
        'Create and publish responsive forms quickly',
        'Organize access across roles and teams',
        'Review every submission in one place',
      ]}
      contentClassName="items-start"
    >
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-[hsl(var(--success))] px-4 py-3 text-sm font-bold text-[hsl(var(--success-foreground))] shadow-xl sm:right-6 sm:top-6"
        >
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
          {successMsg}
        </div>
      )}

      <Card className="w-full max-w-3xl overflow-hidden border-border/80 shadow-xl shadow-plum-950/[0.06]">
        <CardHeader className="space-y-3 border-b border-border/70 px-6 pb-7 pt-7 text-left sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
              <UserRound className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Start for free</p>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl leading-tight tracking-tight">Create your account</CardTitle>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Add your sign-in details first. You can complete the optional profile information now or update it later.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-8 px-6 py-7 sm:px-8 sm:py-8">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.07] px-4 py-3 text-sm leading-5 text-destructive"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span>{error}</span>
              </div>
            )}

            <section aria-labelledby="account-details-heading" className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border/70 pb-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                  <KeyRound className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div>
                  <h2 id="account-details-heading" className="font-bold text-foreground">Account details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Required information used to access your workspace.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username" className="font-bold">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. johndoe"
                    className={inputClassName}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'username-error' : 'username-hint'}
                    {...register('username')}
                  />
                  {!errors.username && <p id="username-hint" className="text-xs text-muted-foreground">3–25 characters</p>}
                  <FieldError id="username-error" error={errors.username} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold">Email address</Label>
                  <Input
                    id="email"
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

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-bold">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPasswords ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className={`${inputClassName} pr-11`}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'signup-password-error' : undefined}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((visible) => !visible)}
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                      aria-pressed={showPasswords}
                    >
                      {showPasswords ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  <FieldError id="signup-password-error" error={errors.password} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-bold">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      className={`${inputClassName} pr-11`}
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                      {...register('confirmPassword')}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
                      {showPasswords ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </span>
                  </div>
                  <FieldError id="confirm-password-error" error={errors.confirmPassword} />
                </div>
              </div>
            </section>

            <section aria-labelledby="profile-details-heading" className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border/70 pb-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                  <UserRound className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div>
                  <h2 id="profile-details-heading" className="font-bold text-foreground">Profile details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Optional information that helps personalize your account.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-bold">First name <OptionalLabel /></Label>
                  <Input
                    id="firstName"
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

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-bold">Last name <OptionalLabel /></Label>
                  <Input
                    id="lastName"
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

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-bold">Phone <OptionalLabel /></Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit phone number"
                    maxLength={10}
                    className={inputClassName}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                    onKeyDown={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (!/^\d+$/.test(pasted)) e.preventDefault();
                    }}
                    {...register('phone')}
                  />
                  <FieldError id="phone-error" error={errors.phone} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender" className="font-bold">Gender <OptionalLabel /></Label>
                  <Select
                    id="gender"
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

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address" className="font-bold">Address <OptionalLabel /></Label>
                  <Textarea
                    id="address"
                    autoComplete="street-address"
                    placeholder="Enter your address"
                    rows={3}
                    maxLength={50}
                    className="min-h-24 resize-y rounded-lg text-base sm:text-sm"
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={errors.address ? 'address-error' : 'address-hint'}
                    {...register('address')}
                  />
                  {!errors.address && <p id="address-hint" className="text-xs text-muted-foreground">Up to 50 characters</p>}
                  <FieldError id="address-error" error={errors.address} />
                </div>
              </div>
            </section>

            <details className="group overflow-hidden rounded-xl border border-border bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5">
                <div>
                  <h2 className="font-bold text-foreground">Additional details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Add any custom profile information you want to keep.</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.25} />
                </span>
              </summary>

              <div className="space-y-4 border-t border-border bg-background px-4 py-5 sm:px-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs leading-5 text-muted-foreground">Use a short label and its corresponding value.</p>
                  <Button type="button" variant="outline" size="sm" onClick={addKvPair} className="shrink-0 font-bold">
                    <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
                    Add field
                  </Button>
                </div>

                {kvPairs.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                    No custom details added.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kvPairs.map((pair, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Input
                          aria-label={`Additional detail ${i + 1} label`}
                          placeholder="Label"
                          value={pair.key}
                          className={inputClassName}
                          onChange={(e) => updateKvPair(i, 'key', e.target.value)}
                        />
                        <Input
                          aria-label={`Additional detail ${i + 1} value`}
                          placeholder="Value"
                          value={pair.value}
                          className={`${inputClassName} col-span-2 row-start-2 sm:col-span-1 sm:row-auto`}
                          onChange={(e) => updateKvPair(i, 'value', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeKvPair(i)}
                          className="col-start-2 row-start-1 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:col-start-3"
                          aria-label={`Remove additional detail ${i + 1}`}
                        >
                          <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </CardContent>

          <CardFooter className="flex-col gap-4 border-t bg-muted/30 px-6 py-6 sm:px-8">
            <Button
              type="submit"
              className="h-12 w-full rounded-lg text-base font-bold shadow-md shadow-primary/15"
              disabled={submitting || isLoading}
            >
              {submitting || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/auth/login" className="font-bold text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
