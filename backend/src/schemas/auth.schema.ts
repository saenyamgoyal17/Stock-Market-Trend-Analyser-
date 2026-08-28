import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional()
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128)
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const magicLinkSchema = z.object({
  email: z.string().email()
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional()
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
