import { anthropic as claude } from '../lib/claude.js';
import { logger } from '../lib/logger.js';

class AIService {
  async analyzeEvent(event: { title: string; body: string; category: string; publishedAt: Date }) {
    try {
      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: "You are a quantitative financial analyst AI specializing in geopolitical and macroeconomic market impact analysis...",
        messages: [
          { role: 'user', content: `Analyze this event and provide a structured JSON response:\nTitle: ${event.title}\nBody: ${event.body}\nCategory: ${event.category}\nDate: ${event.publishedAt.toISOString()}` }
        ]
      });

      const text = (response.content[0] as any).text;
      const parsed = JSON.parse(text);
      return { success: true, data: parsed };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in analyzeEvent');
      return { success: false, error: { code: 'AI_FAILED', message: error.message } };
    }
  }

  async analyzeCustomText(text: string, targetSymbols?: string[]) {
    try {
      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: "You are a quantitative financial analyst AI. Analyze the user text for market impact.",
        messages: [
          { role: 'user', content: `Text: ${text}\nTargets: ${targetSymbols?.join(', ') || 'None'}` }
        ]
      });

      const resultText = (response.content[0] as any).text;
      return { success: true, data: JSON.parse(resultText) };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in analyzeCustomText');
      return { success: false, error: { code: 'AI_FAILED', message: error.message } };
    }
  }

  async semanticSearch(query: string) {
    try {
      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: "Extract search terms from the query. Return JSON with 'keywords' (array of strings), 'dateRange', and 'eventTypes'.",
        messages: [
          { role: 'user', content: `Query: ${query}` }
        ]
      });

      const resultText = (response.content[0] as any).text;
      return { success: true, data: JSON.parse(resultText) };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in semanticSearch');
      return { success: false, error: { code: 'AI_FAILED', message: error.message } };
    }
  }
}

export const aiService = new AIService();
