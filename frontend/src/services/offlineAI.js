let engine = null;
let conversation = null;
let loadingPromise = null;

export const DEFAULT_OFFLINE_MODEL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm';

function emit(status, detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pashumitr:offline-ai-status', { detail: { status, ...detail } }));
  }
}

export function offlineAIStatus() {
  const model = localStorage.getItem('pashumitr-offline-model') || DEFAULT_OFFLINE_MODEL;
  if (conversation) return { ready: true, state: 'ready', model };
  if (loadingPromise) return { ready: false, state: 'loading', model };
  return { ready: false, state: 'not-prepared', model };
}

export async function prepareOfflineAI(modelUrl = DEFAULT_OFFLINE_MODEL) {
  if (conversation) return offlineAIStatus();
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    emit('loading');
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@litert-lm/core/+esm');
      const Engine = mod.Engine;
      if (!Engine) throw new Error('LiteRT-LM Engine was not found.');
      engine = await Engine.create({
        model: modelUrl,
        mainExecutorSettings: { maxNumTokens: 1024 }
      });
      conversation = await engine.createConversation({
        preface: {
          messages: [{
            role: 'system',
            content:
              'You are PashuMittr Offline AI. Answer briefly and safely for Indian dairy farmers. Use only the supplied PashuMittr context. Never invent lab results. Never claim a phone image proves aflatoxin, mycotoxins, or other chemical contamination. When evidence is insufficient, recommend retest or confirmatory lab testing. Reply in the user-selected language. Do not override the structured assessment or advisory.'
          }]
        }
      });
      localStorage.setItem('pashumitr-offline-model', modelUrl);
      emit('ready', { model: modelUrl });
      return offlineAIStatus();
    } catch (error) {
      emit('error', { message: error?.message || 'Offline AI could not be prepared.' });
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

export async function offlineChat({ query, lang, context = {} }) {
  if (!conversation) throw new Error('Offline AI is not prepared on this device.');
  const payload = {
    language: lang,
    query,
    structured_result: {
      status: context?.assessment?.status || context?.latest?.status || null,
      advisory: context?.assessment?.advisory || context?.latest?.advisory || null,
      actions: context?.assessment?.actions || context?.latest?.actions || []
    },
    farmer_profile: {
      species: context?.animalSpecies || context?.species || null,
      breed: context?.breed || null,
      production_stage: context?.productionStage || null,
      milk_yield_l_per_day: context?.milkYield || null
    },
    evidence: {
      nir: context?.nir || context?.latest?.nir || null,
      silage: context?.silage || context?.latest?.silage || null,
      test_type: context?.testType || context?.latest?.test_type || null
    }
  };
  const prompt = `${JSON.stringify(payload)}\n\nRespond to the farmer in ${lang}. Keep it concise, direct, and action-oriented.`;
  const response = await conversation.sendMessage(prompt);
  return response?.content?.[0]?.text || String(response?.content || '');
}

export async function releaseOfflineAI() {
  try { await engine?.delete?.(); } catch (_) {}
  engine = null;
  conversation = null;
  emit('not-prepared');
}
