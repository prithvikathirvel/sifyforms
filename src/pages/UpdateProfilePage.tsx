import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { updateProfile, fetchKeycloakUserByEmail } from '../store/authSlice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Loader2, UserCog, Plus, Trash2 } from 'lucide-react';

const schema = z.object({
    username: z.string().min(3, 'At least 3 characters').max(25, 'Max 25 characters'),
    firstName: z.string().max(25, 'Max 25 characters').optional().or(z.literal('')),
    lastName: z.string().min(3, 'At least 3 characters').max(25, 'Max 25 characters').optional().or(z.literal('')),
    phone: z.string().max(10, 'Max 10 digits').optional().or(z.literal('')),
    address: z.string().min(3, 'At least 3 characters').max(50, 'Max 50 characters').optional().or(z.literal('')),
    gender: z.enum(['Male', 'Female', 'Other', '']).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function UpdateProfilePage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { keycloakUser, user, isLoading, error } = useAppSelector((state) => state.auth);
    const [kvPairs, setKvPairs] = useState<{ key: string; value: string }[]>([]);
    const addKvPair = () => setKvPairs(prev => [...prev, { key: '', value: '' }]);
    const removeKvPair = (i: number) => setKvPairs(prev => prev.filter((_, idx) => idx !== i));
    const updateKvPair = (i: number, field: 'key' | 'value', val: string) =>
        setKvPairs(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

    // Fetch fresh keycloak user details on mount
    useEffect(() => {
        const email = user?.email || keycloakUser?.email;
        if (email) dispatch(fetchKeycloakUserByEmail(email));
    }, []);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
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
        if (keycloakUser) {
            reset({
                username: keycloakUser.username ?? '',
                firstName: keycloakUser.firstName ?? '',
                lastName: keycloakUser.lastName ?? '',
                phone: (keycloakUser as any).phone ?? '',
                address: (keycloakUser as any).address ?? '',
                gender: (keycloakUser as any).gender ?? '',
            });
            const ad = (keycloakUser as any).additionalDetails;
            if (ad && typeof ad === 'object') {
                setKvPairs(Object.entries(ad).map(([key, value]) => ({ key, value: String(value) })));
            }
        }
    }, [keycloakUser, reset]);

    const onSubmit = async (data: FormValues) => {
        const additionalDetails = Object.fromEntries(
            kvPairs.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value])
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
        if (updateProfile.fulfilled.match(result)) {
            navigate('/account');
        }
    };

    return (
        <div className="flex h-screen bg-muted/30">
            <Sidebar onCreateForm={() => {}} />

            <main className="flex-1 overflow-auto bg-gradient-to-br from-ink-50 to-ink-100">
                <div className="p-4 sm:p-6 lg:p-8">
                    {/* Header */}
                    <div className="mb-6 sm:mb-8">
                        <button
                            onClick={() => navigate('/account')}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to profile
                        </button>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Update Profile</h1>
                        <p className="text-base sm:text-lg text-muted-foreground">Edit your personal information</p>
                    </div>

                    <div className="max-w-lg">
                        <Card className="bg-white border-0 shadow-lg">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-brand-50 rounded-lg">
                                        <UserCog className="h-5 w-5 text-brand-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-semibold text-foreground">Profile Details</CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground">Update your account information</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                                    {/* Username */}
                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Username <span className="text-red-500">*</span></Label>
                                        <Input {...register('username')} placeholder="Enter username" />
                                        {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
                                    </div>

                                    {/* First Name & Last Name */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</Label>
                                            <Input {...register('firstName')} placeholder="First name" />
                                            {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
                                        </div>
                                        <div>
                                            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</Label>
                                            <Input {...register('lastName')} placeholder="Last name" />
                                            {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</Label>
                                        <Input {...register('phone')} placeholder="Phone number (max 10 digits)" maxLength={10} />
                                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Address</Label>
                                        <Input {...register('address')} placeholder="Enter address" />
                                        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
                                    </div>

                                    {/* Gender */}
                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Gender</Label>
                                        <select
                                            {...register('gender')}
                                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">Select gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender.message}</p>}
                                    </div>

                                    {/* Additional Details */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Additional Details</Label>
                                            <Button type="button" variant="outline" size="sm" onClick={addKvPair}>
                                                <Plus className="h-3 w-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                        {kvPairs.map((pair, i) => (
                                            <div key={i} className="flex gap-2 items-center mb-2">
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
                                                <button type="button" onClick={() => removeKvPair(i)} className="text-red-500 hover:opacity-70">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* API Error */}
                                    {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        <Button type="submit" disabled={isLoading} className="flex-1">
                                            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => navigate('/account')}>
                                            Cancel
                                        </Button>
                                    </div>

                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
