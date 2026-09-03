import { z } from 'zod';

/**
 * Bounds mirror the user-management service's own validators exactly.
 *
 * It rejects a two-character first name, an eleven-digit phone number and a
 * username outside 3-25 characters. Checking here first means the person filling
 * in the form gets our message rather than a raw validation error from a service
 * they have never heard of.
 */

const optionalBounded = (min: number, max: number, label: string) =>
  z
    .union([
      z
        .string()
        .min(min, `${label} must be at least ${min} characters long`)
        .max(max, `${label} cannot exceed ${max} characters`),
      z.literal(''),
    ])
    .optional();

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email format. Only letters, numbers, and dots are allowed.'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters'),
  firstName: optionalBounded(3, 25, 'First name'),
  lastName: optionalBounded(3, 25, 'Last name'),
  phone: z.union([z.string().max(10, 'Phone number cannot exceed 10 digits'), z.literal('')]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: optionalBounded(3, 50, 'Address'),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').max(25, 'Username cannot exceed 25 characters').optional(),
  firstName: optionalBounded(3, 25, 'First name'),
  lastName: optionalBounded(3, 25, 'Last name'),
  phone: z.union([z.string().max(10, 'Phone number cannot exceed 10 digits'), z.literal('')]).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  address: optionalBounded(3, 50, 'Address'),
  additionalDetails: z.record(z.string(), z.unknown()).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ConfirmForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  confirmationCode: z.string().min(1, 'Confirmation code is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ConfirmForgotPasswordInput = z.infer<typeof ConfirmForgotPasswordSchema>;
