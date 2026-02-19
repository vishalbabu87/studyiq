import { describe, it, expect } from 'vitest';

describe('API Tests', () => {
  it('should get a response from the chatbot API', async () => {
    const response = await fetch('http://localhost:4001/api/quiz/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, chatbot!',
        settings: {
          provider: process.env.PROVIDER,
          geminiKey: process.env.GEMINI_API_KEY,
          openaiKey: process.env.OPENAI_API_KEY,
        },
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('reply');
    expect(data.provider).toBe('Gemini');
  });
});
