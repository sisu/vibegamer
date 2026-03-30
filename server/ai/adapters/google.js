import { GoogleGenerativeAI } from '@google/generative-ai';

let _genAI;
function genAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  return _genAI;
}

export async function complete({ model, systemPrompt, messages }) {
  const geminiModel = genAI().getGenerativeModel({
    model: model.id,
    systemInstruction: systemPrompt,
  });

  // Gemini uses "model" instead of "assistant" for the role.
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const result = await geminiModel.generateContent({
    contents,
    generationConfig: { maxOutputTokens: parseInt(process.env.MAX_TOKENS ?? '2000') },
  });

  return result.response.text();
}
