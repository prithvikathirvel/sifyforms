import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleAlert, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { login, getSession, clearError } from '../../store/authSlice';
import { setCurrentOrg } from '../../store/orgSlice';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Logo } from '../../components/ui/Logo';

const loginSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Enter a valid email address'),
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
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const onSubmit = async (data: LoginFormData) => {
    const loginResult = await dispatch(login(data));
    if (login.fulfilled.match(loginResult)) {
      // Signing in always returns to the organization chooser: a person may
      // belong to several, and may have invitations waiting.
      dispatch(setCurrentOrg(null));
      await dispatch(getSession());
      navigate('/org/setup');
    }
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-[27.5rem] overflow-hidden rounded-2xl border-border bg-card shadow-xl shadow-foreground/[0.045]">
        <CardHeader className="items-center space-y-0 px-6 pb-6 pt-7 text-center sm:px-8 sm:pt-8">
          <div className="mb-5 flex w-full justify-center">
            <Logo size="md" />
          </div>
          <div className="w-full space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Welcome back</p>
            <CardTitle className="font-display text-2xl font-bold leading-tight tracking-[-0.03em] text-foreground">
              Sign in to your account
            </CardTitle>
            <p className="text-[13px] font-medium leading-5 text-muted-foreground">
              Enter your details to continue to SifyForms.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4 px-6 pb-7 sm:px-8">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.045] px-3.5 py-3 text-[13px] font-medium leading-5 text-destructive"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-semibold text-foreground">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                <Input
                  id="email"
                  required
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  className="h-11 rounded-lg border-input bg-background pl-10 text-base placeholder:text-[13px] sm:text-[13px]"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-semibold text-foreground">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                <Input
                  id="password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-11 rounded-lg border-input bg-background px-10 text-base placeholder:text-[13px] sm:text-[13px]"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full rounded-lg text-[13px] font-semibold shadow-sm shadow-primary/15" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/70 bg-muted/25 px-6 py-5 sm:px-8">
            <p className="text-center text-xs font-medium text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/auth/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
