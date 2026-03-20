import { useEffect, useMemo, useRef, useState } from "react";

import LoadingIcon from "../icons/three-dots.svg";
import ReloadIcon from "../icons/reload.svg";
import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import ZoomIcon from "../icons/zoom.svg";
import Locale from "../locales";
import { IconButton } from "./button";
import { Avatar } from "./emoji";
import { Modal, Select, showToast } from "./ui-lib";
import styles from "./custom-model-manager.module.scss";
import { LLMModel } from "../client/api";
import { collectModelTableWithDefaultModel } from "../utils/model";
import { DEFAULT_MODEL_CATEGORIES, ModelCategory } from "../store/config";
import {
  Alibaba,
  Anthropic,
  Azure,
  ByteDance,
  ChatGLM,
  DeepSeek,
  Moonshot,
  OpenaiPath,
  RequestFormat,
  ServiceProvider,
  SiliconFlow,
  XAI,
} from "../constant";
import { getClientConfig } from "../config/client";

type ModelManagerOption = {
  name: string;
  displayName: string;
  available: boolean;
  inCatalog: boolean;
  isDefault?: boolean;
  providerLabel: string;
  categoryId: string;
  categoryLabel: string;
  categoryAvatarModel: string;
  sorted: number;
};

type RemoteModelEntry = {
  id: string;
  owned_by?: string;
  supported_endpoint_types?: string[];
};

type ModelTestState = {
  status: "idle" | "testing" | "success" | "failed";
  code?: number;
  durationMs?: number;
  message?: string;
};

const MODEL_TEST_TIMEOUT_MS = 5000;
const OPENAI_STYLE_PROVIDERS = new Set<ServiceProvider>([
  ServiceProvider.OpenAI,
  ServiceProvider.Azure,
  ServiceProvider.ByteDance,
  ServiceProvider.Alibaba,
  ServiceProvider.Moonshot,
  ServiceProvider.DeepSeek,
  ServiceProvider.XAI,
  ServiceProvider.ChatGLM,
  ServiceProvider.SiliconFlow,
]);
const UNSUPPORTED_TEST_PROVIDERS = new Set<ServiceProvider>([
  ServiceProvider.Baidu,
  ServiceProvider.Tencent,
  ServiceProvider.Iflytek,
]);
const REPLACEABLE_API_PATHS = [
  OpenaiPath.ListModelPath,
  OpenaiPath.ChatPath,
  OpenaiPath.ResponsesPath,
  OpenaiPath.ImagePath,
  OpenaiPath.ImageEditsPath,
  Anthropic.ChatPath,
  Anthropic.ChatPath1,
  ByteDance.ChatPath,
  Moonshot.ChatPath,
  DeepSeek.ChatPath,
  XAI.ChatPath,
  ChatGLM.ChatPath,
  ChatGLM.ImagePath,
  SiliconFlow.ChatPath,
  SiliconFlow.ListModelPath,
];

function isRemoteModelEntry(item: unknown): item is RemoteModelEntry {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as RemoteModelEntry).id === "string"
  );
}

function inferProviderLabel(name: string, fallback?: string) {
  const modelName = name.toLowerCase();

  if (
    modelName.startsWith("gpt") ||
    modelName.startsWith("chatgpt") ||
    modelName.startsWith("o1") ||
    modelName.startsWith("o3") ||
    modelName.startsWith("o4") ||
    modelName.startsWith("dall-e") ||
    modelName.startsWith("dalle") ||
    modelName.startsWith("sora")
  ) {
    return "OpenAI";
  }
  if (modelName.startsWith("claude")) return "Anthropic";
  if (
    modelName.startsWith("gemini") ||
    modelName.startsWith("gemma") ||
    modelName.includes("palm")
  ) {
    return "Google";
  }
  if (modelName.includes("deepseek")) return "DeepSeek";
  if (modelName.startsWith("qwen") || modelName.startsWith("qwq")) {
    return "Qwen";
  }
  if (modelName.startsWith("grok")) return "xAI";
  if (
    modelName.includes("glm") ||
    modelName.startsWith("cogview") ||
    modelName.startsWith("cogvideox")
  ) {
    return "ChatGLM";
  }
  if (modelName.startsWith("moonshot") || modelName.startsWith("kimi")) {
    return "Moonshot";
  }
  if (
    modelName.startsWith("doubao") ||
    modelName.startsWith("seedream") ||
    modelName.startsWith("seedance")
  ) {
    return "ByteDance";
  }
  if (modelName.startsWith("ernie") || modelName.startsWith("wenxin")) {
    return "Baidu";
  }
  if (modelName.startsWith("hunyuan")) return "Tencent";
  if (modelName.includes("llama")) return "Meta";
  if (modelName.startsWith("mixtral") || modelName.startsWith("mistral")) {
    return "Mistral";
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }
  return "Custom";
}

function normalizeMatchers(value: string) {
  return value
    .replaceAll("，", ",")
    .split(/[|,\n]+/)
    .map((matcher) => matcher.trim().toLowerCase())
    .filter(Boolean);
}

function sanitizeCategories(categories: ModelCategory[]) {
  const source = categories.length > 0 ? categories : DEFAULT_MODEL_CATEGORIES;
  const seen = new Set<string>();
  const next = source
    .map((category, index) => {
      const id =
        (category.id || `category-${index}`).trim() || `category-${index}`;
      if (seen.has(id)) {
        return null;
      }
      seen.add(id);
      return {
        id,
        label: category.label.trim() || `Category ${index + 1}`,
        matchers: category.matchers ?? "",
        avatarModel:
          category.avatarModel?.trim() ||
          normalizeMatchers(category.matchers)[0] ||
          category.label ||
          "default",
      };
    })
    .filter(Boolean) as ModelCategory[];

  if (!next.some((category) => category.id === "other")) {
    next.push(
      DEFAULT_MODEL_CATEGORIES.find((category) => category.id === "other")!,
    );
  }

  return next;
}

function resolveModelCategory(name: string, categories: ModelCategory[]) {
  const lowerName = name.toLowerCase();
  const sanitizedCategories = sanitizeCategories(categories);

  for (const category of sanitizedCategories) {
    if (category.id === "other") continue;

    const matched = normalizeMatchers(category.matchers).some((matcher) =>
      lowerName.includes(matcher),
    );
    if (matched) {
      return category;
    }
  }

  return (
    sanitizedCategories.find((category) => category.id === "other") ??
    sanitizedCategories[0]
  );
}

function createProviderMeta(modelName: string, ownedBy?: string) {
  const providerName = inferProviderLabel(modelName, ownedBy);
  const providerId = providerName.toLowerCase().replace(/\s+/g, "-");

  return {
    id: providerId,
    providerName,
    providerType: "remote",
    sorted: 5000,
  };
}

function buildModelsUrl(endpoint: string) {
  const rawEndpoint = endpoint.trim();
  if (!rawEndpoint) {
    throw new Error(Locale.Settings.Access.CustomModel.MissingConfig);
  }

  const normalizedEndpoint = /^https?:\/\//i.test(rawEndpoint)
    ? rawEndpoint
    : `https://${rawEndpoint}`;
  const url = new URL(normalizedEndpoint);
  url.hash = "";
  url.search = "";

  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/v1/models") || pathname.endsWith("/models")) {
    return url.toString();
  }
  if (pathname.endsWith("/v1/chat/completions")) {
    url.pathname = pathname.replace(/\/v1\/chat\/completions$/i, "/v1/models");
    return url.toString();
  }
  if (pathname.endsWith("/chat/completions")) {
    url.pathname = pathname.replace(/\/chat\/completions$/i, "/models");
    return url.toString();
  }
  if (pathname.endsWith("/v1/responses")) {
    url.pathname = pathname.replace(/\/v1\/responses$/i, "/v1/models");
    return url.toString();
  }
  if (pathname.endsWith("/responses")) {
    url.pathname = pathname.replace(/\/responses$/i, "/models");
    return url.toString();
  }
  if (pathname.endsWith("/v1")) {
    url.pathname = `${pathname}/models`;
    return url.toString();
  }

  url.pathname = `${pathname || ""}/v1/models`;
  return url.toString();
}

function normalizeEndpointUrl(endpoint: string) {
  const rawEndpoint = endpoint.trim();
  if (!rawEndpoint) {
    throw new Error(Locale.Settings.Access.CustomModel.MissingConfig);
  }

  const normalizedEndpoint = /^https?:\/\//i.test(rawEndpoint)
    ? rawEndpoint
    : `https://${rawEndpoint}`;
  const url = new URL(normalizedEndpoint);
  url.hash = "";
  return url;
}

function buildCompatibleUrl(endpoint: string, targetPath: string) {
  const url = normalizeEndpointUrl(endpoint);
  const [pathPart, queryString = ""] = targetPath.split("?");
  const currentPath = url.pathname.replace(/^\/+|\/+$/g, "");
  const matchedPath = REPLACEABLE_API_PATHS.find((candidate) =>
    currentPath.toLowerCase().endsWith(candidate.toLowerCase()),
  );

  url.search = "";

  if (matchedPath) {
    const prefix = currentPath
      .slice(0, currentPath.length - matchedPath.length)
      .replace(/\/+$/g, "");
    url.pathname = `/${[prefix, pathPart].filter(Boolean).join("/")}`;
  } else if (currentPath.endsWith("v1") && pathPart.startsWith("v1/")) {
    url.pathname = `/${[currentPath, pathPart.slice(3)].join("/")}`;
  } else {
    url.pathname = `/${[currentPath, pathPart].filter(Boolean).join("/")}`;
  }

  const params = new URLSearchParams(queryString);
  const search = params.toString();
  url.search = search ? `?${search}` : "";

  return url.toString();
}

function buildAzureUrl(
  endpoint: string,
  deploymentName: string,
  requestFormat: RequestFormat,
  apiVersion: string,
) {
  const path =
    requestFormat === RequestFormat.OpenAIImage
      ? Azure.ImagePath(deploymentName, apiVersion || "2023-08-01-preview")
      : Azure.ChatPath(deploymentName, apiVersion || "2023-08-01-preview");
  const url = normalizeEndpointUrl(endpoint);
  const [pathPart, queryString = ""] = path.split("?");
  const cleanedPath = url.pathname
    .replace(/\/+$/g, "")
    .replace(
      /\/deployments\/[^/]+\/(?:chat\/completions|images\/generations)$/i,
      "",
    );

  url.pathname = `/${[cleanedPath.replace(/^\/+/g, ""), pathPart]
    .filter(Boolean)
    .join("/")}`;
  const params = new URLSearchParams(queryString);
  const search = params.toString();
  url.search = search ? `?${search}` : "";

  return url.toString();
}

function buildGeminiUrl(
  endpoint: string,
  modelName: string,
  apiVersion: string,
) {
  const url = normalizeEndpointUrl(endpoint);
  const version = (apiVersion || "v1beta").replace(/^\/+|\/+$/g, "");
  const currentPath = url.pathname
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/models.*$/i, "");

  url.search = "";

  if (currentPath.endsWith(version)) {
    url.pathname = `/${[currentPath, `models/${modelName}:generateContent`]
      .filter(Boolean)
      .join("/")}`;
  } else {
    url.pathname = `/${[
      currentPath,
      version,
      `models/${modelName}:generateContent`,
    ]
      .filter(Boolean)
      .join("/")}`;
  }

  return url.toString();
}

function buildTestRequestUrl(
  endpoint: string,
  requestFormat: RequestFormat,
  provider: ServiceProvider,
  model: ModelManagerOption,
  versions: {
    azureApiVersion?: string;
    googleApiVersion?: string;
  },
) {
  if (provider === ServiceProvider.Azure) {
    return buildAzureUrl(
      endpoint,
      model.displayName || model.name,
      requestFormat,
      versions.azureApiVersion || "2023-08-01-preview",
    );
  }

  if (requestFormat === RequestFormat.Gemini) {
    return buildGeminiUrl(
      endpoint,
      model.name,
      versions.googleApiVersion || "v1beta",
    );
  }

  if (requestFormat === RequestFormat.Anthropic) {
    return buildCompatibleUrl(endpoint, Anthropic.ChatPath);
  }

  if (requestFormat === RequestFormat.OpenAIResponses) {
    return buildCompatibleUrl(endpoint, OpenaiPath.ResponsesPath);
  }

  if (requestFormat === RequestFormat.OpenAIImage) {
    if (provider === ServiceProvider.ChatGLM) {
      return buildCompatibleUrl(endpoint, ChatGLM.ImagePath);
    }
    return buildCompatibleUrl(endpoint, OpenaiPath.ImagePath);
  }

  if (requestFormat === RequestFormat.OpenAIGPTImage) {
    return buildCompatibleUrl(endpoint, OpenaiPath.ImagePath);
  }

  if (provider === ServiceProvider.ByteDance) {
    return buildCompatibleUrl(endpoint, ByteDance.ChatPath);
  }
  if (provider === ServiceProvider.Alibaba) {
    return buildCompatibleUrl(endpoint, Alibaba.ChatPath(model.name));
  }
  if (provider === ServiceProvider.Moonshot) {
    return buildCompatibleUrl(endpoint, Moonshot.ChatPath);
  }
  if (provider === ServiceProvider.DeepSeek) {
    return buildCompatibleUrl(endpoint, DeepSeek.ChatPath);
  }
  if (provider === ServiceProvider.XAI) {
    return buildCompatibleUrl(endpoint, XAI.ChatPath);
  }
  if (provider === ServiceProvider.ChatGLM) {
    return buildCompatibleUrl(endpoint, ChatGLM.ChatPath);
  }
  if (provider === ServiceProvider.SiliconFlow) {
    return buildCompatibleUrl(endpoint, SiliconFlow.ChatPath);
  }

  return buildCompatibleUrl(endpoint, OpenaiPath.ChatPath);
}

function getTestRequestHeaders(params: {
  requestFormat: RequestFormat;
  provider: ServiceProvider;
  apiKey: string;
  anthropicApiVersion?: string;
}) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const apiKey = params.apiKey.trim();

  if (params.provider === ServiceProvider.Azure) {
    headers["api-key"] = apiKey;
    return headers;
  }

  if (params.requestFormat === RequestFormat.Anthropic) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = params.anthropicApiVersion || "2023-06-01";
    return headers;
  }

  if (params.requestFormat === RequestFormat.Gemini) {
    headers["x-goog-api-key"] = apiKey;
    return headers;
  }

  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function buildTestRequestBody(
  model: ModelManagerOption,
  requestFormat: RequestFormat,
) {
  switch (requestFormat) {
    case RequestFormat.OpenAIResponses:
      return {
        model: model.name,
        input: [
          {
            role: "user",
            content: "hi",
          },
        ],
        stream: false,
        max_output_tokens: 16,
      };
    case RequestFormat.OpenAIImage:
      return {
        model: model.name,
        prompt: "hi",
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      };
    case RequestFormat.OpenAIGPTImage:
      return {
        model: model.name,
        prompt: "hi",
        n: 1,
        size: "auto",
        quality: "auto",
        background: "auto",
        output_format: "png",
        moderation: "auto",
      };
    case RequestFormat.Anthropic:
      return {
        model: model.name,
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: "hi",
          },
        ],
      };
    case RequestFormat.Gemini:
      return {
        contents: [
          {
            role: "user",
            parts: [{ text: "hi" }],
          },
        ],
      };
    default:
      return {
        model: model.name,
        stream: false,
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: "hi",
          },
        ],
      };
  }
}

function supportsModelTest(
  provider: ServiceProvider,
  requestFormat: RequestFormat,
) {
  if (requestFormat === RequestFormat.Gemini) return true;
  if (requestFormat === RequestFormat.Anthropic) return true;
  if (UNSUPPORTED_TEST_PROVIDERS.has(provider)) return false;
  return OPENAI_STYLE_PROVIDERS.has(provider);
}

async function fetchWithProxyFallback(requestUrl: string, init: RequestInit) {
  try {
    return await fetch(requestUrl, init);
  } catch (error) {
    if (getClientConfig()?.buildMode === "export") {
      throw error;
    }

    const targetUrl = new URL(requestUrl);
    const proxyUrl = new URL(
      `/api/proxy/${targetUrl.pathname.replace(/^\/+/g, "")}`,
      window.location.origin,
    );
    targetUrl.searchParams.forEach((value, key) =>
      proxyUrl.searchParams.append(key, value),
    );

    const headers = new Headers(init.headers);
    headers.set("X-Base-URL", targetUrl.origin);

    return fetch(proxyUrl.toString(), {
      ...init,
      headers,
    });
  }
}

function formatTestDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function extractRemoteModelEntries(payload: unknown): RemoteModelEntry[] {
  const payloadRecord =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : undefined;
  let rawModels: unknown[] = [];

  if (Array.isArray(payload)) {
    rawModels = payload;
  } else if (payloadRecord && Array.isArray(payloadRecord.data)) {
    rawModels = payloadRecord.data;
  } else if (payloadRecord && Array.isArray(payloadRecord.models)) {
    rawModels = payloadRecord.models;
  }

  const compatibleEndpointTypes = new Set([
    "openai",
    "anthropic",
    "gemini",
    "image-generation",
  ]);

  return rawModels
    .map((item: unknown) =>
      typeof item === "string"
        ? {
            id: item,
          }
        : item,
    )
    .filter(isRemoteModelEntry)
    .filter((item) => {
      if (!Array.isArray(item.supported_endpoint_types)) {
        return true;
      }
      return item.supported_endpoint_types.some((type) =>
        compatibleEndpointTypes.has(type),
      );
    });
}

function buildModelManagerOptions(
  models: readonly LLMModel[],
  customModels: string,
  defaultModel: string,
  categories: ModelCategory[],
) {
  const catalogNames = new Set(models.map((model) => model.name));
  const modelTable = collectModelTableWithDefaultModel(
    models,
    customModels,
    defaultModel,
  );
  const merged = new Map<string, ModelManagerOption>();

  Object.values(modelTable).forEach((model) => {
    const providerLabel = inferProviderLabel(
      model.name,
      model.provider?.providerName,
    );
    const category = resolveModelCategory(model.name, categories);
    const existing = merged.get(model.name);

    if (!existing) {
      merged.set(model.name, {
        name: model.name,
        displayName: model.displayName || model.name,
        available: model.available,
        inCatalog: catalogNames.has(model.name),
        isDefault: model.isDefault,
        providerLabel,
        categoryId: category.id,
        categoryLabel: category.label,
        categoryAvatarModel: category.avatarModel,
        sorted: model.sorted,
      });
      return;
    }

    existing.available = existing.available || model.available;
    existing.inCatalog = existing.inCatalog || catalogNames.has(model.name);
    existing.isDefault = existing.isDefault || model.isDefault;
    existing.sorted = Math.min(existing.sorted, model.sorted);
    existing.categoryId = category.id;
    existing.categoryLabel = category.label;
    existing.categoryAvatarModel = category.avatarModel;
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.sorted !== b.sorted) return a.sorted - b.sorted;
    return a.name.localeCompare(b.name);
  });
}

function mergeDraftModelOptions(
  options: ModelManagerOption[],
  draftCustomModels: string[],
  categories: ModelCategory[],
) {
  const merged = new Map(options.map((option) => [option.name, option]));

  draftCustomModels.forEach((name, index) => {
    if (merged.has(name)) return;
    const category = resolveModelCategory(name, categories);

    merged.set(name, {
      name,
      displayName: name,
      available: true,
      inCatalog: false,
      providerLabel: inferProviderLabel(name),
      categoryId: category.id,
      categoryLabel: category.label,
      categoryAvatarModel: category.avatarModel,
      sorted: 20000 + index,
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.sorted !== b.sorted) return a.sorted - b.sorted;
    return a.name.localeCompare(b.name);
  });
}

function parseManualModelNames(value: string) {
  return value
    .split(/[\n,，]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function buildCustomModelsValue(
  options: ModelManagerOption[],
  selectedNames: Set<string>,
) {
  const catalogModels = options.filter((model) => model.inCatalog);
  const selectedCatalogModels = catalogModels.filter((model) =>
    selectedNames.has(model.name),
  );
  const hiddenCatalogModels = catalogModels.filter(
    (model) => !selectedNames.has(model.name),
  );
  const selectedCustomModels = options.filter(
    (model) => !model.inCatalog && selectedNames.has(model.name),
  );

  const tokens: string[] = [];

  if (catalogModels.length > 0) {
    if (selectedCatalogModels.length === 0) {
      tokens.push("-all");
    } else if (hiddenCatalogModels.length <= selectedCatalogModels.length) {
      tokens.push(...hiddenCatalogModels.map((model) => `-${model.name}`));
    } else {
      tokens.push(
        "-all",
        ...selectedCatalogModels.map((model) => `+${model.name}`),
      );
    }
  }

  tokens.push(...selectedCustomModels.map((model) => model.name));

  return tokens.join(",");
}

export function CustomModelManager(props: {
  models: readonly LLMModel[];
  customModels: string;
  modelCategories: ModelCategory[];
  defaultModel: string;
  endpoint: string;
  apiKey: string;
  provider: ServiceProvider;
  requestFormat: RequestFormat;
  azureApiVersion?: string;
  googleApiVersion?: string;
  anthropicApiVersion?: string;
  onChangeCustomModels: (customModels: string) => void;
  onChangeModelCategories: (modelCategories: ModelCategory[]) => void;
  onMergeModels: (models: LLMModel[]) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [manualModelInput, setManualModelInput] = useState("");
  const [draftCustomModels, setDraftCustomModels] = useState<string[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<ModelCategory[]>(
    sanitizeCategories(props.modelCategories),
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string>();
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");
  const [editingCategoryMatchers, setEditingCategoryMatchers] = useState("");
  const [testStates, setTestStates] = useState<Record<string, ModelTestState>>(
    {},
  );
  const categories = useMemo(
    () => sanitizeCategories(props.modelCategories),
    [props.modelCategories],
  );

  const baseOptions = useMemo(
    () =>
      buildModelManagerOptions(
        props.models,
        props.customModels,
        props.defaultModel,
        categories,
      ),
    [categories, props.customModels, props.defaultModel, props.models],
  );

  const options = useMemo(
    () => mergeDraftModelOptions(baseOptions, draftCustomModels, categories),
    [baseOptions, categories, draftCustomModels],
  );

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const previousOptionNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!showModal) {
      previousOptionNamesRef.current = new Set();
      return;
    }

    const currentOptionNames = new Set(options.map((model) => model.name));

    setSelectedNames((prev) => {
      const next = new Set(
        Array.from(prev).filter((modelName) =>
          currentOptionNames.has(modelName),
        ),
      );

      options.forEach((model) => {
        if (
          !previousOptionNamesRef.current.has(model.name) &&
          model.available
        ) {
          next.add(model.name);
        }
      });

      return next;
    });

    previousOptionNamesRef.current = currentOptionNames;
  }, [options, showModal]);

  const selectedModels = useMemo(
    () => baseOptions.filter((model) => model.available),
    [baseOptions],
  );

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return options.filter((model) => {
      const matchesSearch =
        keyword.length === 0 ||
        model.name.toLowerCase().includes(keyword) ||
        model.displayName.toLowerCase().includes(keyword) ||
        model.providerLabel.toLowerCase().includes(keyword) ||
        model.categoryLabel.toLowerCase().includes(keyword);

      if (!matchesSearch) return false;
      if (filterCategoryId !== "all") {
        return model.categoryId === filterCategoryId;
      }
      return true;
    });
  }, [filterCategoryId, options, search]);
  const canTestModels = supportsModelTest(props.provider, props.requestFormat);

  const selectedSummary = selectedModels.slice(0, 12);
  const hiddenCount = Math.max(
    0,
    selectedModels.length - selectedSummary.length,
  );

  const openManager = () => {
    const initialSelectedNames = new Set(
      baseOptions.filter((model) => model.available).map((model) => model.name),
    );

    setSelectedNames(initialSelectedNames);
    setSearch("");
    setFilterCategoryId("all");
    setManualModelInput("");
    setDraftCustomModels([]);
    setCategoryDrafts(categories);
    setEditingCategoryId(undefined);
    setEditingCategoryLabel("");
    setEditingCategoryMatchers("");
    setTestStates({});
    setTestingAll(false);
    previousOptionNamesRef.current = new Set(
      baseOptions.map((model) => model.name),
    );
    setShowModal(true);
  };

  const closeManager = () => {
    setShowModal(false);
    setShowCategoryModal(false);
    setSearch("");
    setFilterCategoryId("all");
    setManualModelInput("");
    setDraftCustomModels([]);
    setCategoryDrafts(categories);
    setEditingCategoryId(undefined);
    setEditingCategoryLabel("");
    setEditingCategoryMatchers("");
    setTestStates({});
    setTestingAll(false);
  };

  const toggleModel = (modelName: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(modelName)) {
        next.delete(modelName);
      } else {
        next.add(modelName);
      }
      return next;
    });
  };

  const addManualModels = () => {
    const nextNames = parseManualModelNames(manualModelInput);

    if (nextNames.length === 0) {
      showToast(Locale.Settings.Access.CustomModel.Modal.AddEmpty);
      return;
    }

    const existingNames = new Set(
      options.map((model) => model.name.toLowerCase()),
    );
    const queuedNames = new Set<string>();
    const modelsToAdd: string[] = [];

    nextNames.forEach((name) => {
      const normalized = name.toLowerCase();
      if (existingNames.has(normalized) || queuedNames.has(normalized)) return;
      queuedNames.add(normalized);
      modelsToAdd.push(name);
    });

    if (modelsToAdd.length === 0) {
      showToast(Locale.Settings.Access.CustomModel.Modal.AddExists);
      return;
    }

    setDraftCustomModels((prev) => [...prev, ...modelsToAdd]);
    setSelectedNames((prev) => {
      const next = new Set(prev);
      modelsToAdd.forEach((name) => next.add(name));
      return next;
    });
    setManualModelInput("");
    showToast(
      Locale.Settings.Access.CustomModel.Modal.AddSuccess(modelsToAdd.length),
    );
  };

  const openCategoryEditor = () => {
    setCategoryDrafts(categories);
    setEditingCategoryId(undefined);
    setEditingCategoryLabel("");
    setEditingCategoryMatchers("");
    setShowCategoryModal(true);
  };

  const startEditCategory = (category: ModelCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryLabel(category.label);
    setEditingCategoryMatchers(category.matchers);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(undefined);
    setEditingCategoryLabel("");
    setEditingCategoryMatchers("");
  };

  const saveEditCategory = (categoryId: string) => {
    const nextCategories = categoryDrafts.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            label: editingCategoryLabel.trim() || category.label,
            matchers: editingCategoryMatchers
              .replaceAll("，", ",")
              .split(/[,\n]+/)
              .map((matcher) => matcher.trim())
              .filter(Boolean)
              .join("|"),
          }
        : category,
    );
    setCategoryDrafts(sanitizeCategories(nextCategories));
    cancelEditCategory();
  };

  const closeCategoryEditor = () => {
    const nextCategories = sanitizeCategories(categoryDrafts);
    setCategoryDrafts(nextCategories);
    props.onChangeModelCategories(nextCategories);
    setShowCategoryModal(false);
    cancelEditCategory();
  };

  const resetCategoryEditor = () => {
    setCategoryDrafts(sanitizeCategories(DEFAULT_MODEL_CATEGORIES));
    cancelEditCategory();
  };

  const loadModels = async () => {
    if (!props.apiKey.trim() || !props.endpoint.trim()) {
      showToast(Locale.Settings.Access.CustomModel.MissingConfig);
      return;
    }

    setLoadingModels(true);
    try {
      const modelsUrl = buildModelsUrl(props.endpoint);
      const headers = getTestRequestHeaders({
        requestFormat: props.requestFormat,
        provider: props.provider,
        apiKey: props.apiKey,
        anthropicApiVersion: props.anthropicApiVersion,
      });
      delete headers["Content-Type"];
      const res = await fetchWithProxyFallback(modelsUrl, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `${res.status} ${res.statusText}`.trim());
      }

      const payload = await res.json();
      const entries = extractRemoteModelEntries(payload);

      if (entries.length === 0) {
        throw new Error(Locale.Settings.Access.CustomModel.EmptyRemote);
      }

      const loadedModels: LLMModel[] = entries.map((model, index) => ({
        name: model.id,
        displayName: model.id,
        available: true,
        sorted: 10000 + index,
        provider: createProviderMeta(model.id, model.owned_by),
      }));

      props.onMergeModels([...props.models, ...loadedModels]);
      showToast(Locale.Settings.Access.CustomModel.LoadSuccess(entries.length));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : Locale.Settings.Access.CustomModel.LoadFailed;
      console.error("[Custom Models] failed to load model list", error);
      showToast(`${Locale.Settings.Access.CustomModel.LoadFailed}: ${message}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const testModel = async (model: ModelManagerOption) => {
    if (!props.apiKey.trim() || !props.endpoint.trim()) {
      showToast(Locale.Settings.Access.CustomModel.MissingConfig);
      return false;
    }

    if (!canTestModels) {
      showToast(Locale.Settings.Access.CustomModel.Modal.TestUnsupported);
      return false;
    }

    const startAt = performance.now();
    setTestStates((prev) => ({
      ...prev,
      [model.name]: {
        status: "testing",
      },
    }));

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      MODEL_TEST_TIMEOUT_MS,
    );

    try {
      const requestUrl = buildTestRequestUrl(
        props.endpoint,
        props.requestFormat,
        props.provider,
        model,
        {
          azureApiVersion: props.azureApiVersion,
          googleApiVersion: props.googleApiVersion,
        },
      );
      const headers = getTestRequestHeaders({
        requestFormat: props.requestFormat,
        provider: props.provider,
        apiKey: props.apiKey,
        anthropicApiVersion: props.anthropicApiVersion,
      });
      const response = await fetchWithProxyFallback(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(buildTestRequestBody(model, props.requestFormat)),
        signal: controller.signal,
      });
      const durationMs = performance.now() - startAt;

      if (response.status !== 200) {
        const errorText = await response.text();
        setTestStates((prev) => ({
          ...prev,
          [model.name]: {
            status: "failed",
            code: response.status,
            durationMs,
            message: errorText.slice(0, 200),
          },
        }));
        return false;
      }

      setTestStates((prev) => ({
        ...prev,
        [model.name]: {
          status: "success",
          code: response.status,
          durationMs,
        },
      }));
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? Locale.Settings.Access.CustomModel.Modal.TestTimeout
            : error.message
          : Locale.Settings.Access.CustomModel.Modal.TestFailed;

      setTestStates((prev) => ({
        ...prev,
        [model.name]: {
          status: "failed",
          message,
        },
      }));
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const testAllModels = async () => {
    if (!props.apiKey.trim() || !props.endpoint.trim()) {
      showToast(Locale.Settings.Access.CustomModel.MissingConfig);
      return;
    }

    if (!canTestModels) {
      showToast(Locale.Settings.Access.CustomModel.Modal.TestUnsupported);
      return;
    }

    const targets = filteredModels;
    if (targets.length === 0) {
      showToast(Locale.Settings.Access.CustomModel.Modal.Empty);
      return;
    }

    setTestingAll(true);
    let successCount = 0;

    try {
      for (const model of targets) {
        const isSuccess = await testModel(model);
        if (isSuccess) {
          successCount += 1;
        }
      }

      showToast(
        Locale.Settings.Access.CustomModel.Modal.TestAllSummary(
          successCount,
          targets.length,
        ),
      );
    } finally {
      setTestingAll(false);
    }
  };

  return (
    <>
      <div className={styles["custom-model-summary"]}>
        <div className={styles["custom-model-toolbar"]}>
          <div className={styles["custom-model-status"]}>
            {Locale.Settings.Access.CustomModel.Status(
              selectedModels.length,
              options.length,
            )}
          </div>
          <div className={styles["custom-model-actions"]}>
            <IconButton
              icon={loadingModels ? <LoadingIcon /> : <ReloadIcon />}
              text={
                loadingModels
                  ? Locale.Settings.Access.CustomModel.Loading
                  : Locale.Settings.Access.CustomModel.Load
              }
              bordered
              onClick={loadModels}
            />
            <IconButton
              icon={<EditIcon />}
              text={Locale.Settings.Access.CustomModel.Manage}
              bordered
              onClick={openManager}
            />
          </div>
        </div>

        <div className={styles["custom-model-chip-list"]}>
          {selectedSummary.map((model) => (
            <span key={model.name} className={styles["custom-model-chip"]}>
              {model.displayName}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className={styles["custom-model-chip-more"]}>
              +{hiddenCount}
            </span>
          )}
          {selectedModels.length === 0 && (
            <span className={styles["custom-model-empty"]}>
              {Locale.Settings.Access.CustomModel.Empty}
            </span>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-mask">
          <Modal
            title={Locale.Settings.Access.CustomModel.Modal.Title}
            onClose={closeManager}
            actions={[
              <IconButton
                key="reload"
                icon={loadingModels ? <LoadingIcon /> : <ReloadIcon />}
                text={
                  loadingModels
                    ? Locale.Settings.Access.CustomModel.Loading
                    : Locale.Settings.Access.CustomModel.Reload
                }
                bordered
                onClick={loadModels}
              />,
              <div key="timeout" className={styles["manager-timeout"]}>
                {Locale.Settings.Access.CustomModel.Modal.TestTimeoutHint(
                  MODEL_TEST_TIMEOUT_MS / 1000,
                )}
              </div>,
              <IconButton
                key="test-all"
                text={
                  testingAll
                    ? Locale.Settings.Access.CustomModel.Modal.TestingAll
                    : Locale.Settings.Access.CustomModel.Modal.TestAll
                }
                bordered
                disabled={
                  !canTestModels ||
                  testingAll ||
                  loadingModels ||
                  filteredModels.length === 0
                }
                onClick={() => void testAllModels()}
              />,
              <IconButton
                key="edit-categories"
                icon={<EditIcon />}
                text={Locale.Settings.Access.CustomModel.Modal.EditCategories}
                bordered
                onClick={openCategoryEditor}
              />,
              <IconButton
                key="cancel"
                text={Locale.UI.Cancel}
                bordered
                onClick={closeManager}
              />,
              <IconButton
                key="confirm"
                type="primary"
                text={Locale.UI.Confirm}
                bordered
                onClick={() => {
                  props.onChangeCustomModels(
                    buildCustomModelsValue(options, selectedNames),
                  );
                  closeManager();
                }}
              />,
            ]}
          >
            <div className={styles["manager-body"]}>
              <div className={styles["manager-toolbar"]}>
                <div className={styles["manager-add-row"]}>
                  <div
                    className={`${styles["manager-input-shell"]} ${styles["manager-add-shell"]}`}
                  >
                    <AddIcon className={styles["manager-input-icon"]} />
                    <input
                      className={styles["manager-input"]}
                      value={manualModelInput}
                      placeholder={
                        Locale.Settings.Access.CustomModel.Modal.AddPlaceholder
                      }
                      onChange={(e) =>
                        setManualModelInput(e.currentTarget.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addManualModels();
                        }
                      }}
                    />
                  </div>
                  <IconButton
                    text={Locale.Settings.Access.CustomModel.Modal.Add}
                    bordered
                    onClick={addManualModels}
                  />
                </div>
                <div className={styles["manager-search-row"]}>
                  <div
                    className={`${styles["manager-input-shell"]} ${styles["manager-search-shell"]}`}
                  >
                    <ZoomIcon className={styles["manager-input-icon"]} />
                    <input
                      className={styles["manager-input"]}
                      value={search}
                      placeholder={
                        Locale.Settings.Access.CustomModel.Modal
                          .SearchPlaceholder
                      }
                      onChange={(e) => setSearch(e.currentTarget.value)}
                    />
                  </div>
                  <Select
                    className={styles["manager-filter"]}
                    value={filterCategoryId}
                    onChange={(e) => setFilterCategoryId(e.currentTarget.value)}
                  >
                    <option value="all">
                      {Locale.Settings.Access.CustomModel.Modal.Filter.All}
                    </option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    text={Locale.Settings.Access.CustomModel.Modal.SelectAll}
                    bordered
                    onClick={() =>
                      setSelectedNames(
                        new Set(options.map((model) => model.name)),
                      )
                    }
                  />
                  <IconButton
                    text={Locale.Settings.Access.CustomModel.Modal.ClearAll}
                    bordered
                    onClick={() => setSelectedNames(new Set())}
                  />
                </div>
              </div>

              <div className={styles["manager-list"]}>
                {filteredModels.length === 0 ? (
                  <div className={styles["manager-empty"]}>
                    {Locale.Settings.Access.CustomModel.Modal.Empty}
                  </div>
                ) : (
                  filteredModels.map((model) => {
                    const testState = testStates[model.name];

                    return (
                      <div
                        key={model.name}
                        className={styles["manager-item"]}
                        onClick={() => toggleModel(model.name)}
                      >
                        <div className={styles["manager-item-main"]}>
                          <Avatar model={model.categoryAvatarModel as any} />
                          <div className={styles["manager-item-content"]}>
                            <div className={styles["manager-item-title"]}>
                              {model.displayName}
                            </div>
                            <div className={styles["manager-item-meta"]}>
                              <span className={styles["manager-item-tag"]}>
                                {model.categoryLabel}
                              </span>
                              {!model.inCatalog && (
                                <span className={styles["manager-item-tag"]}>
                                  {
                                    Locale.Settings.Access.CustomModel.Modal
                                      .CustomOnly
                                  }
                                </span>
                              )}
                              {model.isDefault && (
                                <span className={styles["manager-item-tag"]}>
                                  Default
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div
                          className={styles["manager-item-actions"]}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {testState?.status === "success" && (
                            <span
                              className={styles["manager-item-test-success"]}
                            >
                              {Locale.Settings.Access.CustomModel.Modal.TestSuccess(
                                testState.code ?? 200,
                                formatTestDuration(testState.durationMs ?? 0),
                              )}
                            </span>
                          )}
                          {testState?.status === "failed" && (
                            <span
                              className={styles["manager-item-test-failed"]}
                              title={testState.message}
                            >
                              {testState.code
                                ? Locale.Settings.Access.CustomModel.Modal.TestFailedWithCode(
                                    testState.code,
                                  )
                                : testState.message ||
                                  Locale.Settings.Access.CustomModel.Modal
                                    .TestFailed}
                            </span>
                          )}
                          <IconButton
                            text={
                              testState?.status === "testing"
                                ? Locale.Settings.Access.CustomModel.Modal
                                    .Testing
                                : Locale.Settings.Access.CustomModel.Modal.Test
                            }
                            bordered
                            disabled={
                              !canTestModels ||
                              loadingModels ||
                              testingAll ||
                              testState?.status === "testing"
                            }
                            onClick={() => void testModel(model)}
                          />
                          <input
                            type="checkbox"
                            checked={selectedNames.has(model.name)}
                            onChange={() => toggleModel(model.name)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Modal>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-mask">
          <Modal
            title={Locale.Settings.Access.CustomModel.CategoryModal.Title}
            onClose={closeCategoryEditor}
            actions={[
              <IconButton
                key="reset"
                icon={<ReloadIcon />}
                text={
                  Locale.Settings.Access.CustomModel.CategoryModal.ResetDefault
                }
                bordered
                onClick={resetCategoryEditor}
              />,
              <IconButton
                key="close"
                type="primary"
                text={Locale.Settings.Access.CustomModel.CategoryModal.Close}
                bordered
                onClick={closeCategoryEditor}
              />,
            ]}
          >
            <div className={styles["category-editor-list"]}>
              {categoryDrafts.map((category) => {
                const isEditing = editingCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className={styles["category-editor-item"]}
                  >
                    <div className={styles["category-editor-main"]}>
                      <Avatar model={category.avatarModel as any} />
                      <div className={styles["category-editor-content"]}>
                        {isEditing ? (
                          <>
                            <input
                              className={styles["category-editor-input"]}
                              value={editingCategoryLabel}
                              placeholder={
                                Locale.Settings.Access.CustomModel.CategoryModal
                                  .NamePlaceholder
                              }
                              onChange={(e) =>
                                setEditingCategoryLabel(e.currentTarget.value)
                              }
                            />
                            <input
                              className={styles["category-editor-input"]}
                              value={editingCategoryMatchers}
                              placeholder={
                                Locale.Settings.Access.CustomModel.CategoryModal
                                  .MatcherPlaceholder
                              }
                              onChange={(e) =>
                                setEditingCategoryMatchers(
                                  e.currentTarget.value,
                                )
                              }
                            />
                          </>
                        ) : (
                          <>
                            <div className={styles["category-editor-title"]}>
                              {category.label}
                            </div>
                            <div className={styles["category-editor-subtitle"]}>
                              {
                                Locale.Settings.Access.CustomModel.CategoryModal
                                  .MatcherPrefix
                              }
                              {category.matchers || "-"}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles["category-editor-actions"]}>
                      {isEditing ? (
                        <>
                          <IconButton
                            text={Locale.UI.Cancel}
                            bordered
                            onClick={cancelEditCategory}
                          />
                          <IconButton
                            text={Locale.UI.Confirm}
                            type="primary"
                            bordered
                            onClick={() => saveEditCategory(category.id)}
                          />
                        </>
                      ) : (
                        <IconButton
                          icon={<EditIcon />}
                          text={
                            Locale.Settings.Access.CustomModel.CategoryModal
                              .Edit
                          }
                          bordered
                          onClick={() => startEditCategory(category)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}
