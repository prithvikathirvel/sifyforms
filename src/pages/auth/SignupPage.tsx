import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { register as registerAuth, clearError } from '../../store/authSlice';
import { payloadFieldErrors } from '../../lib/apiError';
import { PasswordStrengthMeter } from '../../components/ui/password-strength';
import { emailForIdentity, usernameForIdentity } from '../../lib/identity';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

/**
 * Five fields and out: first name, last name, username (an email also works),
 * password, confirmation. Everything else the account needs is derived —
 * email comes from the username — or collected later from the profile.
 */
const signupSchema = z.object({
  firstName: z.string().min(3, 'First name must be at least 3 characters long').max(25, 'First name cannot exceed 25 characters'),
  lastName: z.string().min(3, 'Last name must be at least 3 characters long').max(25, 'Last name cannot exceed 25 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(50, 'Username cannot exceed 50 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

/** Fields the server is allowed to attach a message to. */
const FIELD_NAMES: Record<keyof SignupFormData, true> = {
  firstName: true,
  lastName: true,
  username: true,
  password: true,
  confirmPassword: true,
};

const inputClassName = 'h-10 min-w-0 rounded-lg border-input bg-background text-base placeholder:text-[13px] sm:text-[13px]';

function FieldError({ id, error }: { id: string; error?: { message?: string } }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      {error.message}
    </p>
  );
}

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: { firstName: '', lastName: '', username: '', password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password') ?? '';

  // Registration failures go to the shared toaster, next to the field they name.
  useEffect(() => {
    if (!error) return;
    import('../../components/ui/toast').then(({ toast }) =>
      toast.error({ title: 'Could not create your account', description: error })
    );
    dispatch(clearError());
  }, [error, dispatch]);

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);
    try {
      const result = await dispatch(registerAuth({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        username: usernameForIdentity(data.username),
        email: emailForIdentity(data.username),
        password: data.password,
      }));

      if (registerAuth.fulfilled.match(result)) {
        import('../../components/ui/toast').then(({ toast }) =>
          toast.success({ title: 'Account created', description: 'Sign in with your new credentials to continue.' })
        );
        setTimeout(() => navigate('/auth/login'), 1200);
        return;
      }

      payloadFieldErrors(result.payload).forEach((detail) => {
        const field = detail.field as keyof SignupFormData;
        if (field && field in FIELD_NAMES) setError(field, { type: 'server', message: detail.message });
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout contentClassName="items-start lg:items-center">
      <Card className="w-full max-w-md overflow-hidden rounded-2xl border-border bg-card shadow-xl shadow-foreground/[0.045]">
        <CardHeader className="flex-row items-center gap-3 space-x-0 space-y-0 border-b border-border/70 px-5 py-4 text-left sm:px-7">
          <Logo variant="icon" size="md" className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="font-display text-xl font-bold leading-tight tracking-[-0.03em] text-foreground">
              Create your account
            </CardTitle>
            <p className="text-xs font-medium leading-5 text-muted-foreground">
              Five fields and you are in.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-3.5 px-5 py-5 sm:px-7">
            <div className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-semibold">First name</Label>
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
                <Label htmlFor="lastName" className="text-xs font-semibold">Last name</Label>
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold">Username</Label>
              <Input
                id="username"
                required
                type="text"
                autoComplete="username"
                placeholder="johndoe or you@company.com"
                className={inputClassName}
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? 'username-error' : 'username-hint'}
                {...register('username')}
              />
              {!errors.username && (
                <p id="username-hint" className="text-[11px] font-medium text-muted-foreground">
                  A username, or your email address — you sign in with the same.
                </p>
              )}
              <FieldError id="username-error" error={errors.username} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  required
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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
              {/* Live strength read-out — the rule that gates registration
                  lives on the server; this shows whether they're heading there. */}
              <PasswordStrengthMeter value={passwordValue} id="signup-password-strength" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm password</Label>
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
