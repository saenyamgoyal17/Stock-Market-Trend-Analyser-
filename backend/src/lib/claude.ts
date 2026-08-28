import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';

export const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey || 'placeholder-key',
});
