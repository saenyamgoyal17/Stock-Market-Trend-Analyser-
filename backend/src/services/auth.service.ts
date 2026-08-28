import { prisma } from '../lib/prisma.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

class AuthService {
  async register(email: string, password: string, name?: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: 'FREE' }
        }
      });
      
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      const user = await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          name: name || null,
          role: 'FREE',
          provider: 'email',
          country: 'US',
          currency: 'USD'
        }
      });

      return { success: true, data: user };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in register');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async login(email: string, password: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { success: true, data: data.session };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in login');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async logout(accessToken: string) {
    try {
      const { error } = await supabaseAdmin.auth.signOut({ scope: 'local' });
      if (error) throw error;
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in logout');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw error;
      return { success: true, data: data.session };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in refreshToken');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async forgotPassword(email: string) {
    try {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.app.frontendUrl}/reset-password`
      });
      if (error) throw error;
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in forgotPassword');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const { error } = await supabaseAdmin.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in resetPassword');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async sendMagicLink(email: string) {
    try {
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: config.app.frontendUrl }
      });
      if (error) throw error;
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in sendMagicLink');
      return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
    }
  }

  async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');
      return { success: true, data: user };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getProfile');
      return { success: false, error: { code: 'USER_NOT_FOUND', message: error.message } };
    }
  }

  async updateProfile(userId: string, data: { name?: string; country?: string; currency?: string }) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data
      });
      return { success: true, data: user };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in updateProfile');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async deleteAccount(userId: string) {
    try {
      await prisma.user.delete({ where: { id: userId } });
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in deleteAccount');
      return { success: false, error: { code: 'DELETE_FAILED', message: error.message } };
    }
  }

  async getOrCreateUser(supabaseUser: any) {
    try {
      let user = await prisma.user.findUnique({ where: { id: supabaseUser.id } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
            avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
            provider: supabaseUser.app_metadata?.provider || 'email',
            role: 'FREE',
            country: 'US',
            currency: 'USD'
          }
        });
      }
      return { success: true, data: user };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getOrCreateUser');
      return { success: false, error: { code: 'USER_SYNC_FAILED', message: error.message } };
    }
  }
}

export const authService = new AuthService();
