import { z } from 'zod';

export const SignUpSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email format. Only letters, numbers, and dots are allowed.'),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters'),
  firstName: z.union([z.string().min(3, 'First name must be at least 3 characters long').max(25, 'First name cannot exceed 25 characters'), z.literal('')]).optional(),
  lastName: z.union([z.string().min(3, 'Last name must be at least 3 characters long').max(25, 'Last name cannot exceed 25 characters'), z.literal('')]).optional(),
  phone: z.union([z.string().max(10, 'Phone number cannot exceed 10 digits'), z.literal('')]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: z.union([z.string().min(3).max(50), z.literal('')]).optional(),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters').optional(),
  firstName: z.union([z.string().min(3, 'First name must be at least 3 characters long').max(25, 'First name cannot exceed 25 characters'), z.literal('')]).optional(),
  lastName: z.union([z.string().min(3, 'Last name must be at least 3 characters long').max(25, 'Last name cannot exceed 25 characters'), z.literal('')]).optional(),
  phone: z.union([z.string().max(10, 'Phone number cannot exceed 10 digits'), z.literal('')]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: z.union([z.string().min(3).max(50), z.literal('')]).optional(),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
