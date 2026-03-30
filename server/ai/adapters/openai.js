import OpenAI from 'openai';

let _client;
function client() {
  if (!_client) _client = new OpenAI(); // reads OPENAI_API_KEY from env
  return _client;
}

export async function complete({ model, systemPrompt, messages }) {
  const res = await client().chat.completions.create({
    model: model.id,
    max_tokens: parseInt(process.env.MAX_TOKENS ?? '2000'),
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });
  return res.choices[0].message.content;
}
