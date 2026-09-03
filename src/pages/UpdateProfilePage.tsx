import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { updateProfile, fetchAccountDetails } from '../store/authSlice';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { ArrowLeft, CircleAlert, Loader2, Plus, Save, Trash2, UserCog } from 'lucide-react';

const schema = z.object({
  username: z.string().min(3, 'At least 3 characters').max(25, 'Max 25 characters'),
  firstName: z.string().max(25, 'Max 25 characters').optional().or(z.literal('')),
  lastName: z.string().min(3, 'At least 3 characters').max(25, 'Max 25 characters').optional().or(z.literal('')),
  phone: z.string().max(10, 'Max 10 digits').optional().or(z.literal('')),
  address: z.string().min(3, 'At least 3 characters').max(50, 'Max 50 characters').optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other', '']).optional(),
});

type FormValues = z.infer<typeof schema>;

type ExtendedProfile = {
  phone?: string;
  address?: string;
  gender?: FormValues['gender'];
  additionalDetails?: Record<string, unknown>;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

export default function UpdateProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { accountUser, isLoading, error } = useAppSelector((state) => state.auth);
  const extendedUser = accountUser as (NonNullable<typeof accountUser> & ExtendedProfile) | null;
  const [kvPairs, setKvPairs] = useState<{ key: string; value: string }[]>([]);

  const addKvPair = () => setKvPairs((prev) => [...prev, { key: '', value: '' }]);
  const removeKvPair = (i: number) => setKvPairs((prev) => prev.filter((_, idx) => idx !== i));
  const updateKvPair = (i: number, field: 'key' | 'value', val: string) =>
    setKvPairs((prev) => prev.map((pair, idx) => (idx === i ? { ...pair, [field]: val } : pair)));

  useEffect(() => {
    dispatch(fetchAccountDetails());
  }, [dispatch]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      gender: '',
    },
  });

  useEffect(() => {
    if (extendedUser) {
      reset({
        username: extendedUser.username ?? '',
        firstName: extendedUser.firstName ?? '',
        lastName: extendedUser.lastName ?? '',
        phone: extendedUser.phone ?? '',
        address: extendedUser.address ?? '',
        gender: extendedUser.gender ?? '',
      });
      const additionalDetails = extendedUser.additionalDetails;
      if (additionalDetails && typeof additionalDetails === 'object') {
        // Synchronize editable custom fields when the remote profile arrives.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setKvPairs(Object.entries(additionalDetails).map(([key, value]) => ({ key, value: String(value) })));
      }
    }
  }, [extendedUser, reset]);

  const onSubmit = async (data: FormValues) => {
    const additionalDetails = Object.fromEntries(
      kvPairs.filter((pair) => pair.key.trim()).map((pair) => [pair.key.trim(), pair.value])
    );
    const payload = {
      username: data.username,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      gender: data.gender || undefined,
      additionalDetails,
    };
    const result = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(result)) navigate('/account');
  };

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Edit profile"
          description="Update your personal and account information"
          actions={(
            <Button variant="outline" onClick={() => navigate('/account')} className="h-9 rounded-lg px-3.5">
              <ArrowLeft className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Back to profile</span>
              <span className="sm:hidden">Back</span>
            </Button>
          )}
        />
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-4xl">
            <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <UserCog className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Profile details</CardTitle>
                    <CardDescription className="mt-1 text-xs">Changes apply to your SifyForms account.</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <CardContent className="space-y-5 px-5 py-5 sm:px-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="profile-username">Username <span className="text-destructive">*</span></Label>
                      <Input id="profile-username" required autoComplete="username" {...register('username')} placeholder="Enter username" aria-invalid={Boolean(errors.username)} />
                      <FieldError message={errors.username?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-first-name">First name</Label>
                      <Input id="profile-first-name" autoComplete="given-name" {...register('firstName')} placeholder="First name" aria-invalid={Boolean(errors.firstName)} />
                      <FieldError message={errors.firstName?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-last-name">Last name</Label>
                      <Input id="profile-last-name" autoComplete="family-name" {...register('lastName')} placeholder="Last name" aria-invalid={Boolean(errors.lastName)} />
                      <FieldError message={errors.lastName?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone">Phone</Label>
                      <Input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel" {...register('phone')} placeholder="Phone number" maxLength={10} aria-invalid={Boolean(errors.phone)} />
                      <FieldError message={errors.phone?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-gender">Gender</Label>
                      <Select
                        id="profile-gender"
                        options={[
                          { label: 'Male', value: 'Male' },
                          { label: 'Female', value: 'Female' },
                          { label: 'Other', value: 'Other' },
                        ]}
                        placeholder="Select gender"
                        {...register('gender')}
                      />
                      <FieldError message={errors.gender?.message} />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="profile-address">Address</Label>
                      <Input id="profile-address" autoComplete="street-address" {...register('address')} placeholder="Enter address" maxLength={50} aria-invalid={Boolean(errors.address)} />
                      <FieldError message={errors.address?.message} />
                    </div>
                  </div>

                  <section className="rounded-xl border border-border bg-muted/20 p-4" aria-labelledby="additional-details-title">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 id="additional-details-title" className="font-display text-[13px] font-bold text-foreground">Additional details</h2>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">Custom information stored with your profile.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addKvPair} className="shrink-0">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add field
                      </Button>
                    </div>

                    {kvPairs.length > 0 && (
                      <div className="mt-3 space-y-2.5">
                        {kvPairs.map((pair, index) => (
                          <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <Input
                              aria-label={`Additional detail ${index + 1} label`}
                              placeholder="Label"
                              value={pair.key}
                              onChange={(event) => updateKvPair(index, 'key', event.target.value)}
                            />
                            <Input
                              aria-label={`Additional detail ${index + 1} value`}
                              placeholder="Value"
                              value={pair.value}
                              onChange={(event) => updateKvPair(index, 'value', event.target.value)}
                              className="col-span-2 row-start-2 sm:col-span-1 sm:row-auto"
                            />
                            <button
                              type="button"
                              onClick={() => removeKvPair(index)}
                              aria-label={`Remove additional detail ${index + 1}`}
                              className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/[0.07] hover:text-destructive sm:col-start-3"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-xs font-medium text-destructive">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
                  <Button type="button" variant="outline" onClick={() => navigate('/account')}>Cancel</Button>
                  <Button type="submit" disabled={isLoading} className="min-w-36">
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Save changes</>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
