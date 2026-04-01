import { getModel, getDefaultModel } from './models.js';
import { buildSystemPrompt } from './prompt.js';
import { validateCode } from './validate.js';
import { sandboxTest } from './sandbox.js';
import * as anthropic from './adapters/anthropic.js';
import * as openai    from './adapters/openai.js';
import * as google    from './adapters/google.js';
import * as ollama    from './adapters/ollama.js';

const ADAPTERS = { anthropic, openai, google, ollama };
const MAX_RETRIES = 5;

async function runWithSandboxRetry({ adapter, model, systemPrompt, messages }) {
  let msgs = [...messages];
  let code;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt}`);
    code = await adapter.complete({ model, systemPrompt, messages: msgs });
    const result = sandboxTest(code);
    if (result.valid) break;

    if (attempt < MAX_RETRIES) {
      msgs = [
        ...msgs,
        { role: 'assistant', content: code },
        { role: 'user', content: `The code produced this JavaScript error: ${result.error}. Fix it. Output only corrected JavaScript, no explanation.` },
      ];
    } else {
      console.warn(`[sandbox] Still invalid after ${MAX_RETRIES} retries: ${result.error}`);
    }
  }

  return code;
}

export async function generateGame({ description, platform, assetManifest, modelId }) {
  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(platform, assetManifest);
  const messages = [{ role: 'user', content: description }];
  const code = await runWithSandboxRetry({ adapter: ADAPTERS[model.provider], model, systemPrompt, messages });
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
  const code = await runWithSandboxRetry({ adapter: ADAPTERS[model.provider], model, systemPrompt, messages });
  return { code, modelId: model.id, ...validateCode(code) };
}

function resolveModel(modelId) {
  const model = modelId ? getModel(modelId) : getDefaultModel();
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}
