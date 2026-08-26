import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleAlert, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { login, getSession, clearError } from '../../store/authSlice';
import { setCurrentOrg } from '../../store/orgSlice';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { AuthLayout } from '../../components/auth/AuthLayout';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
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

  const onSubmit = async (data: LoginFormData) => {
    const loginResult = await dispatch(login(data));
    if (login.fulfilled.match(loginResult)) {
      // Signing in always returns to the organization chooser: a person may
      // belong to several, and may have invitations waiting. Clearing the
      // remembered selection is what stops the chooser bouncing straight
      // through to the dashboard.
      dispatch(setCurrentOrg(null));
      await dispatch(getSession());
      navigate('/org/setup');
    }
  };

  return (
    <AuthLayout
      title="Bring every response into focus."
      description="Create, manage, and understand your forms from one thoughtfully designed workspace."
      highlights={[
        'Build polished forms without writing code',
        'Keep teams and permissions organized',
        'Turn live responses into useful insights',
      ]}
    >
      <Card className="w-full max-w-[29rem] overflow-hidden border-border/80 shadow-xl shadow-plum-950/[0.06]">
        <CardHeader className="space-y-3 px-6 pb-7 pt-7 text-left sm:px-8 sm:pt-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
            <LockKeyhole className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Welcome back</p>
            <CardTitle className="text-3xl leading-tight tracking-tight">Sign in to your workspace</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Enter your account details to continue to SifyForms.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-5 px-6 pb-6 sm:px-8">
            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.07] px-4 py-3 text-sm leading-5 text-destructive"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold">
                Email address
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  className="h-12 rounded-lg pl-11 text-base sm:text-sm"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold">
                Password
              </Label>
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 rounded-lg px-11 text-base sm:text-sm"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-lg text-base font-bold shadow-md shadow-primary/15"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={2.25} />
              Your credentials are sent over a secure connection.
            </div>
          </CardContent>

          <CardFooter className="justify-center border-t bg-muted/30 px-6 py-5 sm:px-8">
            <p className="text-center text-sm text-muted-foreground">
              New to SifyForms?{' '}
              <Link to="/auth/signup" className="font-bold text-primary underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
