import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  magicLinkSchema,
  updateProfileSchema
} from '../schemas/auth.schema.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', {
    schema: { body: registerSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password, name } = request.body as any;
        const result = await authService.register(email, password, name);
        return reply.status(201).send(successResponse(result));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('REGISTER_FAILED', error.message));
      }
    }
  });

  fastify.post('/login', {
    schema: { body: loginSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password } = request.body as any;
        const result = await authService.login(email, password);
        return reply.send(successResponse(result));
      } catch (error: any) {
        return reply.status(401).send(errorResponse('LOGIN_FAILED', error.message));
      }
    }
  });

  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authService.logout(request.user!.id);
        return reply.send(successResponse({ success: true }));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('LOGOUT_FAILED', error.message));
      }
    }
  });

  fastify.post('/refresh', {
    schema: { body: refreshTokenSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await authService.refreshToken(request.body as any);
        return reply.send(successResponse(result));
      } catch (error: any) {
        return reply.status(401).send(errorResponse('REFRESH_FAILED', error.message));
      }
    }
  });

  fastify.post('/forgot-password', {
    schema: { body: forgotPasswordSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authService.forgotPassword(request.body as any);
        return reply.send(successResponse({ success: true }));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('FORGOT_PASSWORD_FAILED', error.message));
      }
    }
  });

  fastify.post('/reset-password', {
    schema: { body: resetPasswordSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token, newPassword } = request.body as any;
        await authService.resetPassword(token, newPassword);
        return reply.send(successResponse({ success: true }));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('RESET_PASSWORD_FAILED', error.message));
      }
    }
  });

  fastify.post('/magic-link', {
    schema: { body: magicLinkSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authService.sendMagicLink(request.body as any);
        return reply.send(successResponse({ success: true }));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('MAGIC_LINK_FAILED', error.message));
      }
    }
  });

  fastify.get('/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code } = request.query as { code: string };
      const result = await (authService as any).handleOAuthCallback(code);
      return reply.send(successResponse(result));
    } catch (error: any) {
      return reply.status(400).send(errorResponse('OAUTH_CALLBACK_FAILED', error.message));
    }
  });

  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const profile = await authService.getProfile(request.user!.id);
        return reply.send(successResponse(profile));
      } catch (error: any) {
        return reply.status(404).send(errorResponse('PROFILE_NOT_FOUND', error.message));
      }
    }
  });

  fastify.put('/me', {
    onRequest: [fastify.authenticate],
    schema: { body: updateProfileSchema },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const profile = await authService.updateProfile(request.user!.id, request.body as any);
        return reply.send(successResponse(profile));
      } catch (error: any) {
        return reply.status(400).send(errorResponse('UPDATE_PROFILE_FAILED', error.message));
      }
    }
  });

  fastify.delete('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authService.deleteAccount(request.user!.id);
        return reply.send(successResponse({ success: true }));
      } catch (error: any) {
        return reply.status(500).send(errorResponse('DELETE_ACCOUNT_FAILED', error.message));
      }
    }
  });
}
