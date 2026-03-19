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

export function ChatModelSelector(props: {
  models: readonly LLMModel[];
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

  const providerOptions = useMemo(() => {
    const providers = new Map<string, string>();

    models.forEach((model) => {
      if (model.provider?.id && model.provider?.providerName) {
        providers.set(model.provider.id, model.provider.providerName);
      }
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
  }, [models]);

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return models.filter((model) => {
      if (providerFilter !== "all" && model.provider?.id !== providerFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        model.displayName ?? model.name,
        model.name,
        model.provider?.providerName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [models, providerFilter, search]);

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
            filteredModels.map((model) => {
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
                        {model.provider?.providerName ?? model.name}
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
