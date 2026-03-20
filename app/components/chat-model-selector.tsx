import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import type { LLMModel } from "../client/api";
import CloseIcon from "../icons/close.svg";
import DownIcon from "../icons/down.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import Locale from "../locales";
import { Avatar } from "./emoji";
import styles from "./chat-model-selector.module.scss";

type ChatModelSelectorItem = Omit<LLMModel, "provider"> & {
  provider?: LLMModel["provider"];
  isDefault?: boolean;
};

function inferModelCategory(model: ChatModelSelectorItem) {
  const name = model.name.toLowerCase();
  const fallback = model.provider?.providerName ?? "Other";

  if (
    name.startsWith("gpt") ||
    name.startsWith("chatgpt") ||
    name.startsWith("o1") ||
    name.startsWith("o3") ||
    name.startsWith("o4") ||
    name.startsWith("dall-e") ||
    name.startsWith("dalle") ||
    name.startsWith("gpt-image") ||
    name.startsWith("chatgpt-image") ||
    name.startsWith("advanced-voice") ||
    name.startsWith("sora")
  ) {
    return { id: "chatgpt", label: "ChatGPT" };
  }
  if (name.includes("deepseek")) return { id: "deepseek", label: "DeepSeek" };
  if (name.startsWith("claude")) return { id: "claude", label: "Claude" };
  if (name.startsWith("qwen") || name.startsWith("qwq")) {
    return { id: "qwen", label: "Qwen" };
  }
  if (
    name.startsWith("gemini") ||
    name.startsWith("gemma") ||
    name.includes("learnlm")
  ) {
    return { id: "gemini", label: "Gemini" };
  }
  if (name.startsWith("grok")) return { id: "grok", label: "Grok" };
  if (
    name.includes("glm") ||
    name.startsWith("cogview") ||
    name.startsWith("cogvideox")
  ) {
    return { id: "glm", label: "GLM" };
  }
  if (name.startsWith("moonshot") || name.startsWith("kimi")) {
    return { id: "moonshot", label: "MoonShot" };
  }
  if (
    name.startsWith("doubao") ||
    name.startsWith("seedream") ||
    name.startsWith("seedance")
  ) {
    return { id: "doubao", label: "DouBao" };
  }
  if (name.startsWith("ernie") || name.startsWith("wenxin")) {
    return { id: "baidu", label: "Baidu" };
  }
  if (name.startsWith("hunyuan")) {
    return { id: "tencent", label: "Tencent" };
  }
  if (name.includes("llama")) return { id: "llama", label: "Llama" };
  if (name.startsWith("mixtral") || name.startsWith("mistral")) {
    return { id: "mistral", label: "Mistral" };
  }
  if (name.startsWith("command") || name.startsWith("cohere")) {
    return { id: "cohere", label: "Cohere" };
  }
  if (name.startsWith("flux")) return { id: "flux", label: "Flux" };

  return {
    id: fallback.toLowerCase().replace(/\s+/g, "-"),
    label: fallback,
  };
}

export function ChatModelSelector(props: {
  models: readonly ChatModelSelectorItem[];
  currentModel: string;
  onClose: () => void;
  onSelect: (model: string) => void;
}) {
  const { currentModel, models, onClose, onSelect } = props;
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const modelItems = useMemo(
    () =>
      models.map((model) => ({
        model,
        category: inferModelCategory(model),
      })),
    [models],
  );

  const providerOptions = useMemo(() => {
    const providers = new Map<string, string>();

    modelItems.forEach(({ category }) => {
      providers.set(category.id, category.label);
    });

    return [
      {
        value: "all",
        label: Locale.Settings.Access.CustomModel.Modal.Filter.All,
      },
      ...Array.from(providers.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [modelItems]);

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return modelItems.filter(({ model, category }) => {
      if (providerFilter !== "all" && category.id !== providerFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [model.displayName ?? model.name, model.name, category.label]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [modelItems, providerFilter, search]);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div
        className={clsx(styles["model-selector"], {
          [styles["model-selector-expanded"]]: expanded,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["model-selector-header"]}>
          <div className={styles["model-selector-title"]}>
            {Locale.Settings.Access.CustomModel.Modal.Title}
          </div>

          <div className={styles["model-selector-toolbar"]}>
            <div className={styles["model-selector-search-wrap"]}>
              <input
                autoFocus
                className={styles["model-selector-search"]}
                value={search}
                placeholder={
                  Locale.Settings.Access.CustomModel.Modal.SearchPlaceholder
                }
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
            </div>

            <div className={styles["model-selector-filter"]}>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.currentTarget.value)}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <DownIcon />
            </div>
          </div>

          <div className={styles["model-selector-actions"]}>
            <button
              type="button"
              className={styles["model-selector-action"]}
              title={Locale.Chat.Actions.FullScreen}
              aria-label={Locale.Chat.Actions.FullScreen}
              onClick={() => setExpanded((state) => !state)}
            >
              {expanded ? <MinIcon /> : <MaxIcon />}
            </button>
            <button
              type="button"
              className={styles["model-selector-action"]}
              title={Locale.UI.Close}
              aria-label={Locale.UI.Close}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className={styles["model-selector-list"]}>
          {filteredModels.length === 0 ? (
            <div className={styles["model-selector-empty"]}>
              {Locale.Settings.Access.CustomModel.Modal.Empty}
            </div>
          ) : (
            filteredModels.map(({ model, category }) => {
              const selected = model.name === currentModel;

              return (
                <button
                  type="button"
                  key={`${model.name}-${model.provider?.id ?? "model"}`}
                  className={clsx(styles["model-selector-item"], {
                    [styles["model-selector-item-selected"]]: selected,
                  })}
                  onClick={() => onSelect(model.name)}
                >
                  <div className={styles["model-selector-item-main"]}>
                    <div className={styles["model-selector-item-avatar"]}>
                      <Avatar model={model.name} />
                    </div>

                    <div className={styles["model-selector-item-content"]}>
                      <div className={styles["model-selector-item-title"]}>
                        {model.displayName ?? model.name}
                      </div>
                      <div className={styles["model-selector-item-provider"]}>
                        {category.label}
                      </div>
                    </div>
                  </div>

                  <div className={styles["model-selector-item-indicator"]} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
