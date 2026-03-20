import {
  ACCESS_CODE_PREFIX,
  ModelProvider,
  RequestFormat,
  getRequestFormatForServiceProvider,
  isOpenAIImageRequestFormat,
  ServiceProvider,
} from "../constant";
import {
  ChatMessageTool,
  ModelType,
  useAccessStore,
  useChatStore,
} from "../store";
import { ChatGPTApi, DalleRequestPayload } from "./platforms/openai";
import { GeminiProApi } from "./platforms/google";
import { ClaudeApi } from "./platforms/anthropic";
import { ErnieApi } from "./platforms/baidu";
import { DoubaoApi } from "./platforms/bytedance";
import { QwenApi } from "./platforms/alibaba";
import { HunyuanApi } from "./platforms/tencent";
import { MoonshotApi } from "./platforms/moonshot";
import { SparkApi } from "./platforms/iflytek";
import { DeepSeekApi } from "./platforms/deepseek";
import { XAIApi } from "./platforms/xai";
import { ChatGLMApi } from "./platforms/glm";
import { SiliconflowApi } from "./platforms/siliconflow";
import { OpenAIResponsesApi } from "./platforms/openai-responses";
import { OpenAIImageApi } from "./platforms/openai-image";
import {
  GptImageBackground,
  GptImageModeration,
  GptImageOutputFormat,
  GptImageQuality,
  GptImageSize,
  OpenAIReasoningEffort,
} from "../typing";

export const ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof ROLES)[number];

export const Models = ["gpt-3.5-turbo", "gpt-4"] as const;
export const TTSModels = ["tts-1", "tts-1-hd"] as const;
export type ChatModel = ModelType;

export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface MultimodalContentForAlibaba {
  text?: string;
  image?: string;
}

export interface RequestMessage {
  role: MessageRole;
  content: string | MultimodalContent[];
}

export interface LLMConfig {
  model: string;
  providerName?: string;
  requestFormat?: RequestFormat;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  size?: DalleRequestPayload["size"];
  quality?: DalleRequestPayload["quality"];
  style?: DalleRequestPayload["style"];
  gptImageSize?: GptImageSize;
  gptImageQuality?: GptImageQuality;
  gptImageBackground?: GptImageBackground;
  gptImageOutputFormat?: GptImageOutputFormat;
  gptImageOutputCompression?: number;
  gptImageModeration?: GptImageModeration;
  reasoningEffort?: OpenAIReasoningEffort;
}

export interface SpeechOptions {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
  onController?: (controller: AbortController) => void;
}

export interface ChatOptions {
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: RequestMessage["content"], responseRes: Response) => void;
  onError?: (err: Error) => void;
  onController?: (controller: AbortController) => void;
  onBeforeTool?: (tool: ChatMessageTool) => void;
  onAfterTool?: (tool: ChatMessageTool) => void;
  buildFinalMessage?: (
    message: string,
    responseRes?: Response,
  ) => RequestMessage["content"];
  hasFinalContent?: (message: string) => boolean;
}

export interface LLMUsage {
  used: number;
  total: number;
}

export interface LLMModel {
  name: string;
  displayName?: string;
  available: boolean;
  provider: LLMModelProvider;
  sorted: number;
}

export interface LLMModelProvider {
  id: string;
  providerName: string;
  providerType: string;
  sorted: number;
}

export abstract class LLMApi {
  abstract chat(options: ChatOptions): Promise<void>;
  abstract speech(options: SpeechOptions): Promise<ArrayBuffer>;
  abstract usage(): Promise<LLMUsage>;
  abstract models(): Promise<LLMModel[]>;
}

type ProviderName = "openai" | "azure" | "claude" | "palm";

interface Model {
  name: string;
  provider: ProviderName;
  ctxlen: number;
}

interface ChatProvider {
  name: ProviderName;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    summaryModel: Model;
  };
  models: Model[];

  chat: () => void;
  usage: () => void;
}

export class ClientApi {
  public llm: LLMApi;

  constructor(
    provider: ModelProvider = ModelProvider.GPT,
    requestFormat: RequestFormat = RequestFormat.OpenAIChat,
  ) {
    if (requestFormat === RequestFormat.OpenAIResponses) {
      this.llm = new OpenAIResponsesApi();
      return;
    }

    if (isOpenAIImageRequestFormat(requestFormat)) {
      this.llm = new OpenAIImageApi();
      return;
    }

    switch (provider) {
      case ModelProvider.GeminiPro:
        this.llm = new GeminiProApi();
        break;
      case ModelProvider.Claude:
        this.llm = new ClaudeApi();
        break;
      case ModelProvider.Ernie:
        this.llm = new ErnieApi();
        break;
      case ModelProvider.Doubao:
        this.llm = new DoubaoApi();
        break;
      case ModelProvider.Qwen:
        this.llm = new QwenApi();
        break;
      case ModelProvider.Hunyuan:
        this.llm = new HunyuanApi();
        break;
      case ModelProvider.Moonshot:
        this.llm = new MoonshotApi();
        break;
      case ModelProvider.Iflytek:
        this.llm = new SparkApi();
        break;
      case ModelProvider.DeepSeek:
        this.llm = new DeepSeekApi();
        break;
      case ModelProvider.XAI:
        this.llm = new XAIApi();
        break;
      case ModelProvider.ChatGLM:
        this.llm = new ChatGLMApi();
        break;
      case ModelProvider.SiliconFlow:
        this.llm = new SiliconflowApi();
        break;
      default:
        this.llm = new ChatGPTApi();
    }
  }

  config() {}

  prompts() {}

  masks() {}
}

export function getBearerToken(
  apiKey: string,
  noBearer: boolean = false,
): string {
  return validString(apiKey)
    ? `${noBearer ? "" : "Bearer "}${apiKey.trim()}`
    : "";
}

export function validString(x: string): boolean {
  return x?.length > 0;
}

export function getHeaders(ignoreHeaders: boolean = false) {
  const accessStore = useAccessStore.getState();
  const chatStore = useChatStore.getState();
  let headers: Record<string, string> = {};
  if (!ignoreHeaders) {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }
  function getConfig() {
    const modelConfig = chatStore.currentSession().mask.modelConfig;
    const requestFormat =
      modelConfig.requestFormat ??
      getRequestFormatForServiceProvider(modelConfig.providerName);
    const useSharedCustomConfig = accessStore.useCustomConfig;
    const isGoogle = requestFormat === RequestFormat.Gemini;
    const isAzure = modelConfig.providerName === ServiceProvider.Azure;
    const isAnthropic = requestFormat === RequestFormat.Anthropic;
    const isBaidu = modelConfig.providerName == ServiceProvider.Baidu;
    const isByteDance = modelConfig.providerName === ServiceProvider.ByteDance;
    const isAlibaba = modelConfig.providerName === ServiceProvider.Alibaba;
    const isMoonshot = modelConfig.providerName === ServiceProvider.Moonshot;
    const isIflytek = modelConfig.providerName === ServiceProvider.Iflytek;
    const isDeepSeek = modelConfig.providerName === ServiceProvider.DeepSeek;
    const isXAI = modelConfig.providerName === ServiceProvider.XAI;
    const isChatGLM = modelConfig.providerName === ServiceProvider.ChatGLM;
    const isSiliconFlow =
      modelConfig.providerName === ServiceProvider.SiliconFlow;
    const isEnabledAccessControl = accessStore.enabledAccessControl();
    const apiKey = useSharedCustomConfig
      ? accessStore.openaiApiKey
      : isGoogle
      ? accessStore.googleApiKey
      : isAzure
      ? accessStore.azureApiKey
      : isAnthropic
      ? accessStore.anthropicApiKey
      : isByteDance
      ? accessStore.bytedanceApiKey
      : isAlibaba
      ? accessStore.alibabaApiKey
      : isMoonshot
      ? accessStore.moonshotApiKey
      : isXAI
      ? accessStore.xaiApiKey
      : isDeepSeek
      ? accessStore.deepseekApiKey
      : isChatGLM
      ? accessStore.chatglmApiKey
      : isSiliconFlow
      ? accessStore.siliconflowApiKey
      : isIflytek
      ? accessStore.iflytekApiKey && accessStore.iflytekApiSecret
        ? accessStore.iflytekApiKey + ":" + accessStore.iflytekApiSecret
        : ""
      : accessStore.openaiApiKey;
    return {
      isGoogle,
      isAzure,
      isAnthropic,
      isBaidu,
      isByteDance,
      isAlibaba,
      isMoonshot,
      isIflytek,
      isDeepSeek,
      isXAI,
      isChatGLM,
      isSiliconFlow,
      apiKey,
      isEnabledAccessControl,
    };
  }

  function getAuthHeader(): string {
    return isAzure
      ? "api-key"
      : isAnthropic
      ? "x-api-key"
      : isGoogle
      ? "x-goog-api-key"
      : "Authorization";
  }

  const {
    isGoogle,
    isAzure,
    isAnthropic,
    isBaidu,
    isByteDance,
    isAlibaba,
    isMoonshot,
    isIflytek,
    isDeepSeek,
    isXAI,
    isChatGLM,
    isSiliconFlow,
    apiKey,
    isEnabledAccessControl,
  } = getConfig();
  // Baidu direct calls use an access_token in the URL instead of auth headers.
  if (isBaidu) return headers;

  const authHeader = getAuthHeader();

  const bearerToken = getBearerToken(
    apiKey,
    isAzure || isAnthropic || isGoogle,
  );

  if (bearerToken) {
    headers[authHeader] = bearerToken;
  } else if (isEnabledAccessControl && validString(accessStore.accessCode)) {
    headers["Authorization"] = getBearerToken(
      ACCESS_CODE_PREFIX + accessStore.accessCode,
    );
  }

  return headers;
}

export function getClientApi(
  provider: ServiceProvider,
  requestFormat: RequestFormat = RequestFormat.OpenAIChat,
): ClientApi {
  switch (requestFormat) {
    case RequestFormat.Gemini:
      return new ClientApi(ModelProvider.GeminiPro, requestFormat);
    case RequestFormat.Anthropic:
      return new ClientApi(ModelProvider.Claude, requestFormat);
    case RequestFormat.OpenAIResponses:
    case RequestFormat.OpenAIImage:
    case RequestFormat.OpenAIGPTImage:
      return new ClientApi(ModelProvider.GPT, requestFormat);
  }

  switch (provider) {
    case ServiceProvider.Google:
      return new ClientApi(ModelProvider.GeminiPro, requestFormat);
    case ServiceProvider.Anthropic:
      return new ClientApi(ModelProvider.Claude, requestFormat);
    case ServiceProvider.Baidu:
      return new ClientApi(ModelProvider.Ernie, requestFormat);
    case ServiceProvider.ByteDance:
      return new ClientApi(ModelProvider.Doubao, requestFormat);
    case ServiceProvider.Alibaba:
      return new ClientApi(ModelProvider.Qwen, requestFormat);
    case ServiceProvider.Tencent:
      return new ClientApi(ModelProvider.Hunyuan, requestFormat);
    case ServiceProvider.Moonshot:
      return new ClientApi(ModelProvider.Moonshot, requestFormat);
    case ServiceProvider.Iflytek:
      return new ClientApi(ModelProvider.Iflytek, requestFormat);
    case ServiceProvider.DeepSeek:
      return new ClientApi(ModelProvider.DeepSeek, requestFormat);
    case ServiceProvider.XAI:
      return new ClientApi(ModelProvider.XAI, requestFormat);
    case ServiceProvider.ChatGLM:
      return new ClientApi(ModelProvider.ChatGLM, requestFormat);
    case ServiceProvider.SiliconFlow:
      return new ClientApi(ModelProvider.SiliconFlow, requestFormat);
    default:
      return new ClientApi(ModelProvider.GPT, requestFormat);
  }
}
