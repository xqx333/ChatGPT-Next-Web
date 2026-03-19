import { useEffect, useMemo, useState } from "react";

import LoadingIcon from "../icons/three-dots.svg";
import ReloadIcon from "../icons/reload.svg";
import EditIcon from "../icons/edit.svg";
import Locale from "../locales";
import { IconButton } from "./button";
import { Avatar } from "./emoji";
import { Modal, Select, showToast } from "./ui-lib";
import styles from "./custom-model-manager.module.scss";
import { LLMModel } from "../client/api";
import { collectModelTableWithDefaultModel } from "../utils/model";

type ModelManagerOption = {
  name: string;
  displayName: string;
  available: boolean;
  inCatalog: boolean;
  isDefault?: boolean;
  providerLabel: string;
  sorted: number;
};

type RemoteModelEntry = {
  id: string;
  owned_by?: string;
  supported_endpoint_types?: string[];
};

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
    const existing = merged.get(model.name);

    if (!existing) {
      merged.set(model.name, {
        name: model.name,
        displayName: model.displayName || model.name,
        available: model.available,
        inCatalog: catalogNames.has(model.name),
        isDefault: model.isDefault,
        providerLabel,
        sorted: model.sorted,
      });
      return;
    }

    existing.available = existing.available || model.available;
    existing.inCatalog = existing.inCatalog || catalogNames.has(model.name);
    existing.isDefault = existing.isDefault || model.isDefault;
    existing.sorted = Math.min(existing.sorted, model.sorted);
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.sorted !== b.sorted) return a.sorted - b.sorted;
    return a.name.localeCompare(b.name);
  });
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
  defaultModel: string;
  endpoint: string;
  apiKey: string;
  onChangeCustomModels: (customModels: string) => void;
  onMergeModels: (models: LLMModel[]) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");

  const options = useMemo(
    () =>
      buildModelManagerOptions(
        props.models,
        props.customModels,
        props.defaultModel,
      ),
    [props.customModels, props.defaultModel, props.models],
  );

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedNames(
      new Set(
        options.filter((model) => model.available).map((model) => model.name),
      ),
    );
  }, [options, showModal]);

  const selectedModels = useMemo(
    () => options.filter((model) => selectedNames.has(model.name)),
    [options, selectedNames],
  );

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return options.filter((model) => {
      const matchesSearch =
        keyword.length === 0 ||
        model.name.toLowerCase().includes(keyword) ||
        model.displayName.toLowerCase().includes(keyword) ||
        model.providerLabel.toLowerCase().includes(keyword);

      if (!matchesSearch) return false;
      if (filter === "enabled") return selectedNames.has(model.name);
      if (filter === "disabled") return !selectedNames.has(model.name);
      return true;
    });
  }, [filter, options, search, selectedNames]);

  const selectedSummary = selectedModels.slice(0, 12);
  const hiddenCount = Math.max(
    0,
    selectedModels.length - selectedSummary.length,
  );

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

  const loadModels = async () => {
    if (!props.apiKey.trim()) {
      showToast(Locale.Settings.Access.CustomModel.MissingConfig);
      return;
    }

    setLoadingModels(true);
    try {
      const modelsUrl = buildModelsUrl(props.endpoint);
      const res = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${props.apiKey.trim()}`,
        },
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
              onClick={() => setShowModal(true)}
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
            defaultMax
            onClose={() => setShowModal(false)}
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
              <IconButton
                key="cancel"
                text={Locale.UI.Cancel}
                bordered
                onClick={() => setShowModal(false)}
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
                  setShowModal(false);
                }}
              />,
            ]}
          >
            <div className={styles["manager-body"]}>
              <div className={styles["manager-toolbar"]}>
                <input
                  className={styles["manager-search"]}
                  value={search}
                  placeholder={
                    Locale.Settings.Access.CustomModel.Modal.SearchPlaceholder
                  }
                  onChange={(e) => setSearch(e.currentTarget.value)}
                />
                <Select
                  value={filter}
                  onChange={(e) =>
                    setFilter(
                      e.currentTarget.value as "all" | "enabled" | "disabled",
                    )
                  }
                >
                  <option value="all">
                    {Locale.Settings.Access.CustomModel.Modal.Filter.All}
                  </option>
                  <option value="enabled">
                    {Locale.Settings.Access.CustomModel.Modal.Filter.Enabled}
                  </option>
                  <option value="disabled">
                    {Locale.Settings.Access.CustomModel.Modal.Filter.Disabled}
                  </option>
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

              <div className={styles["manager-list"]}>
                {filteredModels.length === 0 ? (
                  <div className={styles["manager-empty"]}>
                    {Locale.Settings.Access.CustomModel.Modal.Empty}
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <div
                      key={model.name}
                      className={styles["manager-item"]}
                      onClick={() => toggleModel(model.name)}
                    >
                      <div className={styles["manager-item-main"]}>
                        <Avatar model={model.name as any} />
                        <div className={styles["manager-item-content"]}>
                          <div className={styles["manager-item-title"]}>
                            {model.displayName}
                          </div>
                          <div className={styles["manager-item-meta"]}>
                            <span className={styles["manager-item-tag"]}>
                              {model.providerLabel}
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
                      <input
                        type="checkbox"
                        checked={selectedNames.has(model.name)}
                        onChange={() => toggleModel(model.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}
