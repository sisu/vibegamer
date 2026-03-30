export async function complete({ model, systemPrompt, messages }) {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.id,
      max_tokens: parseInt(process.env.MAX_TOKENS ?? '2000'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
