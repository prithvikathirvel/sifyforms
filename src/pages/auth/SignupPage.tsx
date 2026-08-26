import { useState, useEffect } from 'react';
import { Logo } from '../../components/ui/Logo';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { registerUser, register as registerAuth, clearError } from '../../store/authSlice';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';

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

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [showError, setShowError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
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
      const { confirmPassword, ...rest } = data;

      const additionalDetails = Object.fromEntries(
        kvPairs
          .filter((p) => p.key.trim())
          .map((p) => [p.key.trim(), p.value])
      );

      const result = await dispatch(
        registerUser({ ...rest, additionalDetails })
      );

      if (registerUser.fulfilled.match(result)) {
        const keycloakId = (result.payload as any)?.userDetails?.id as string;
        const regResult = await dispatch(
          registerAuth({ ...rest, additionalDetails, id: keycloakId })
        );

        if (registerAuth.fulfilled.match(regResult)) {
          setSuccessMsg("Account created successfully!");

          setTimeout(() => {
            setSuccessMsg("");
            navigate("/auth/login");
          }, 2500);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-8">
      {successMsg && (
        <div className="fixed top-5 right-5 z-50 bg-green-600 text-white text-sm px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <span>✓</span> {successMsg}
        </div>
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="lg" />
          </Link>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Get started with SifyForms.AI for free</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* <CardContent className="space-y-4">
            {showError && error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent> */}
          <CardContent className="space-y-4">
            {showError && error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit phone number"
                maxLength={10}
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
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select
                id="gender"
                options={[
                  { label: 'Male', value: 'Male' },
                  { label: 'Female', value: 'Female' },
                  { label: 'Other', value: 'Other' },
                ]}
                placeholder="Select gender"
                {...register('gender')}
              />
              {errors.gender && (
                <p className="text-sm text-destructive">{errors.gender.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="address"
                placeholder="Enter your address"
                rows={3}
                {...register('address')}
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Additional Details</Label>
                <Button type="button" variant="outline" size="sm" onClick={addKvPair}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {kvPairs.map((pair, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Key"
                    value={pair.key}
                    onChange={(e) => updateKvPair(i, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    value={pair.value}
                    onChange={(e) => updateKvPair(i, 'value', e.target.value)}
                  />
                  <button type="button" onClick={() => removeKvPair(i)} className="text-destructive hover:opacity-70">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={submitting || isLoading}>
              {submitting || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
