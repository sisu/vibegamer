import { getModel, getDefaultModel } from './models.js';
import { buildSystemPrompt } from './prompt.js';
import { validateCode } from './validate.js';
import * as anthropic from './adapters/anthropic.js';
import * as openai    from './adapters/openai.js';
import * as google    from './adapters/google.js';
import * as ollama    from './adapters/ollama.js';

const ADAPTERS = { anthropic, openai, google, ollama };

export async function generateGame({ description, platform, assetManifest, modelId }) {
  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(platform, assetManifest);
  const messages = [{ role: 'user', content: description }];

  const code = await ADAPTERS[model.provider].complete({ model, systemPrompt, messages });
  return { code, modelId: model.id, ...validateCode(code) };
}

export async function refineGame({ existingCode, promptHistory, instruction, platform, assetManifest, modelId }) {
  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(platform, assetManifest);

  const messages = [
    ...promptHistory.map(p => ({ role: p.role, content: p.content })),
    { role: 'assistant', content: existingCode },
    { role: 'user', content: instruction },
  ];

  const code = await ADAPTERS[model.provider].complete({ model, systemPrompt, messages });
  return { code, modelId: model.id, ...validateCode(code) };
}

function resolveModel(modelId) {
  const model = modelId ? getModel(modelId) : getDefaultModel();
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}
