import Anthropic from '@anthropic-ai/sdk';

let _client;
function client() {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export async function complete({ model, systemPrompt, messages }) {
  const res = await client().messages.create({
    model: model.id,
    max_tokens: parseInt(process.env.MAX_TOKENS ?? '2000'),
    system: systemPrompt,
    messages,
  });
  return res.content[0].text;
}
