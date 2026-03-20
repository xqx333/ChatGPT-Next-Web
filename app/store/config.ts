import { LLMModel } from "../client/api";
import {
  DalleQuality,
  DalleStyle,
  GptImageBackground,
  GptImageModeration,
  GptImageOutputFormat,
  GptImageQuality,
  GptImageSize,
  ModelSize,
} from "../typing";
import { getClientConfig } from "../config/client";
import {
  DEFAULT_INPUT_TEMPLATE,
  DEFAULT_MODELS,
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_TTS_ENGINE,
  DEFAULT_TTS_ENGINES,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_MODELS,
  DEFAULT_TTS_VOICE,
  DEFAULT_TTS_VOICES,
  getRequestFormatForServiceProvider,
  getServiceProviderForRequestFormat,
  RequestFormat,
  StoreKey,
  ServiceProvider,
} from "../constant";
import { createPersistStore } from "../utils/store";
import type { Voice } from "rt-client";

export type ModelType = (typeof DEFAULT_MODELS)[number]["name"];
export type TTSModelType = (typeof DEFAULT_TTS_MODELS)[number];
export type TTSVoiceType = (typeof DEFAULT_TTS_VOICES)[number];
export type TTSEngineType = (typeof DEFAULT_TTS_ENGINES)[number];

export type ModelCategory = {
  id: string;
  label: string;
  matchers: string;
  avatarModel: string;
};

export const DEFAULT_MODEL_CATEGORIES: ModelCategory[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    matchers: "gpt|chatgpt|o1|o3|o4",
    avatarModel: "gpt-4o",
  },
  {
    id: "claude",
    label: "Claude",
    matchers: "claude",
    avatarModel: "claude-3-5-sonnet",
  },
  {
    id: "cohere",
    label: "Cohere",
    matchers: "cohere|command",
    avatarModel: "cohere",
  },
  {
    id: "comfyui",
    label: "ComfyUI",
    matchers: "comfyui",
    avatarModel: "comfyui",
  },
  {
    id: "dalle",
    label: "DALL-E",
    matchers: "dall-e|dalle|gpt-image",
    avatarModel: "dall-e-3",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    matchers: "deepseek",
    avatarModel: "deepseek-chat",
  },
  {
    id: "doubao",
    label: "DouBao",
    matchers: "doubao|seedream|seedance|ep-",
    avatarModel: "doubao-pro",
  },
  {
    id: "flux",
    label: "Flux",
    matchers: "flux",
    avatarModel: "flux-1",
  },
  {
    id: "gemini",
    label: "Gemini",
    matchers: "gemini|gemma|palm",
    avatarModel: "gemini-1.5-pro",
  },
  {
    id: "glm",
    label: "GLM",
    matchers: "glm|cogview|cogvideox",
    avatarModel: "glm-4",
  },
  {
    id: "grok",
    label: "Grok",
    matchers: "grok",
    avatarModel: "grok-2",
  },
  {
    id: "llama",
    label: "Llama",
    matchers: "llama",
    avatarModel: "llama-3.1",
  },
  {
    id: "mistral",
    label: "Mistral",
    matchers: "mistral|mixtral|codestral",
    avatarModel: "mistral-large",
  },
  {
    id: "moonshot",
    label: "MoonShot",
    matchers: "moonshot|kimi",
    avatarModel: "moonshot-v1-8k",
  },
  {
    id: "qwen",
    label: "Qwen",
    matchers: "qwen|qwq",
    avatarModel: "qwen-max",
  },
  {
    id: "other",
    label: "其他",
    matchers: "",
    avatarModel: "default",
  },
];

export enum SubmitKey {
  Enter = "Enter",
  CtrlEnter = "Ctrl + Enter",
  ShiftEnter = "Shift + Enter",
  AltEnter = "Alt + Enter",
  MetaEnter = "Meta + Enter",
}

export enum Theme {
  Auto = "auto",
  Dark = "dark",
  Light = "light",
}

const config = getClientConfig();

export const DEFAULT_CONFIG = {
  lastUpdate: Date.now(), // timestamp, to merge state

  submitKey: SubmitKey.Enter,
  avatar: "1f603",
  fontSize: 14,
  fontFamily: "",
  theme: Theme.Auto as Theme,
  tightBorder: !!config?.isApp,
  sendPreviewBubble: true,
  enableAutoGenerateTitle: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,

  enableArtifacts: true, // show artifacts config

  enableCodeFold: true, // code fold config

  disablePromptHint: false,

  dontShowMaskSplashScreen: false, // dont show splash screen when create chat
  hideBuiltinMasks: false, // dont add builtin masks

  customModels: "",
  modelCategories: DEFAULT_MODEL_CATEGORIES,
  models: DEFAULT_MODELS as any as LLMModel[],

  modelConfig: {
    model: "gpt-4o-mini" as ModelType,
    providerName: getServiceProviderForRequestFormat(
      RequestFormat.OpenAIChat,
    ) as ServiceProvider,
    requestFormat: RequestFormat.OpenAIChat,
    temperature: 0.5,
    top_p: 1,
    max_tokens: 4000,
    presence_penalty: 0,
    frequency_penalty: 0,
    sendMemory: true,
    historyMessageCount: 4,
    compressMessageLengthThreshold: 1000,
    compressModel: "",
    compressProviderName: "",
    enableInjectSystemPrompts: true,
    template: config?.template ?? DEFAULT_INPUT_TEMPLATE,
    size: "1024x1024" as ModelSize,
    quality: "standard" as DalleQuality,
    style: "vivid" as DalleStyle,
    gptImageSize: "auto" as GptImageSize,
    gptImageQuality: "auto" as GptImageQuality,
    gptImageBackground: "auto" as GptImageBackground,
    gptImageOutputFormat: "png" as GptImageOutputFormat,
    gptImageOutputCompression: 100,
    gptImageModeration: "auto" as GptImageModeration,
  },

  ttsConfig: {
    enable: false,
    autoplay: false,
    engine: DEFAULT_TTS_ENGINE,
    model: DEFAULT_TTS_MODEL,
    voice: DEFAULT_TTS_VOICE,
    speed: 1.0,
  },

  realtimeConfig: {
    enable: false,
    provider: "OpenAI" as ServiceProvider,
    model: "gpt-4o-realtime-preview-2024-10-01",
    apiKey: "",
    azure: {
      endpoint: "",
      deployment: "",
    },
    temperature: 0.9,
    voice: "alloy" as Voice,
  },
};

export type ChatConfig = typeof DEFAULT_CONFIG;

export type ModelConfig = ChatConfig["modelConfig"];
export type TTSConfig = ChatConfig["ttsConfig"];
export type RealtimeConfig = ChatConfig["realtimeConfig"];

export function mergeModelConfigPreservingRequestFormat(
  globalModelConfig: ModelConfig,
  currentModelConfig: ModelConfig,
): ModelConfig {
  const requestFormat =
    currentModelConfig.requestFormat ??
    globalModelConfig.requestFormat ??
    RequestFormat.OpenAIChat;
  const providerName =
    currentModelConfig.providerName ??
    getServiceProviderForRequestFormat(requestFormat);

  return {
    ...globalModelConfig,
    requestFormat,
    providerName,
    compressProviderName:
      currentModelConfig.compressProviderName || providerName,
  };
}

export function limitNumber(
  x: number,
  min: number,
  max: number,
  defaultValue: number,
) {
  if (isNaN(x)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, x));
}

export const TTSConfigValidator = {
  engine(x: string) {
    return x as TTSEngineType;
  },
  model(x: string) {
    return x as TTSModelType;
  },
  voice(x: string) {
    return x as TTSVoiceType;
  },
  speed(x: number) {
    return limitNumber(x, 0.25, 4.0, 1.0);
  },
};

export const ModalConfigValidator = {
  model(x: string) {
    return x as ModelType;
  },
  max_tokens(x: number) {
    return limitNumber(x, 0, 512000, 1024);
  },
  presence_penalty(x: number) {
    return limitNumber(x, -2, 2, 0);
  },
  frequency_penalty(x: number) {
    return limitNumber(x, -2, 2, 0);
  },
  temperature(x: number) {
    return limitNumber(x, 0, 2, 1);
  },
  top_p(x: number) {
    return limitNumber(x, 0, 1, 1);
  },
  gptImageOutputCompression(x: number) {
    return limitNumber(x, 0, 100, 100);
  },
};

export const useAppConfig = createPersistStore(
  { ...DEFAULT_CONFIG },
  (set, get) => ({
    reset() {
      set(() => ({ ...DEFAULT_CONFIG }));
    },

    mergeModels(newModels: LLMModel[]) {
      if (!newModels || newModels.length === 0) {
        return;
      }

      const oldModels = get().models;
      const modelMap: Record<string, LLMModel> = {};

      for (const model of oldModels) {
        model.available = false;
        modelMap[`${model.name}@${model?.provider?.id}`] = model;
      }

      for (const model of newModels) {
        model.available = true;
        modelMap[`${model.name}@${model?.provider?.id}`] = model;
      }

      set(() => ({
        models: Object.values(modelMap),
      }));
    },

    allModels() {},
  }),
  {
    name: StoreKey.Config,
    version: 4.4,

    merge(persistedState, currentState) {
      const state = persistedState as ChatConfig | undefined;
      if (!state) return { ...currentState };
      const models = currentState.models.slice();
      state.models.forEach((pModel) => {
        const idx = models.findIndex(
          (v) => v.name === pModel.name && v.provider === pModel.provider,
        );
        if (idx !== -1) models[idx] = pModel;
        else models.push(pModel);
      });
      return { ...currentState, ...state, models: models };
    },

    migrate(persistedState, version) {
      const state = persistedState as ChatConfig;

      if (!state.modelConfig.requestFormat) {
        state.modelConfig.requestFormat = getRequestFormatForServiceProvider(
          state.modelConfig.providerName,
        );
      }
      state.modelConfig.providerName = getServiceProviderForRequestFormat(
        state.modelConfig.requestFormat,
      );

      if (version < 3.4) {
        state.modelConfig.sendMemory = true;
        state.modelConfig.historyMessageCount = 4;
        state.modelConfig.compressMessageLengthThreshold = 1000;
        state.modelConfig.frequency_penalty = 0;
        state.modelConfig.top_p = 1;
        state.modelConfig.template = DEFAULT_INPUT_TEMPLATE;
        state.dontShowMaskSplashScreen = false;
        state.hideBuiltinMasks = false;
      }

      if (version < 3.5) {
        state.customModels = "claude,claude-100k";
      }

      if (version < 3.6) {
        state.modelConfig.enableInjectSystemPrompts = true;
      }

      if (version < 3.7) {
        state.enableAutoGenerateTitle = true;
      }

      if (version < 3.8) {
        state.lastUpdate = Date.now();
      }

      if (version < 3.9) {
        state.modelConfig.template =
          state.modelConfig.template !== DEFAULT_INPUT_TEMPLATE
            ? state.modelConfig.template
            : config?.template ?? DEFAULT_INPUT_TEMPLATE;
      }

      if (version < 4.1) {
        state.modelConfig.compressModel =
          DEFAULT_CONFIG.modelConfig.compressModel;
        state.modelConfig.compressProviderName =
          DEFAULT_CONFIG.modelConfig.compressProviderName;
      }

      if (version < 4.3) {
        state.modelConfig.gptImageSize =
          DEFAULT_CONFIG.modelConfig.gptImageSize;
        state.modelConfig.gptImageQuality =
          DEFAULT_CONFIG.modelConfig.gptImageQuality;
        state.modelConfig.gptImageBackground =
          DEFAULT_CONFIG.modelConfig.gptImageBackground;
        state.modelConfig.gptImageOutputFormat =
          DEFAULT_CONFIG.modelConfig.gptImageOutputFormat;
        state.modelConfig.gptImageOutputCompression =
          DEFAULT_CONFIG.modelConfig.gptImageOutputCompression;
        state.modelConfig.gptImageModeration =
          DEFAULT_CONFIG.modelConfig.gptImageModeration;
      }

      if (version < 4.4 || !state.modelCategories?.length) {
        state.modelCategories = DEFAULT_MODEL_CATEGORIES;
      }

      state.modelConfig.gptImageSize ??=
        DEFAULT_CONFIG.modelConfig.gptImageSize;
      state.modelConfig.gptImageQuality ??=
        DEFAULT_CONFIG.modelConfig.gptImageQuality;
      state.modelConfig.gptImageBackground ??=
        DEFAULT_CONFIG.modelConfig.gptImageBackground;
      state.modelConfig.gptImageOutputFormat ??=
        DEFAULT_CONFIG.modelConfig.gptImageOutputFormat;
      state.modelConfig.gptImageOutputCompression ??=
        DEFAULT_CONFIG.modelConfig.gptImageOutputCompression;
      state.modelConfig.gptImageModeration ??=
        DEFAULT_CONFIG.modelConfig.gptImageModeration;
      state.modelCategories ??= DEFAULT_MODEL_CATEGORIES;

      return state as any;
    },
  },
);
