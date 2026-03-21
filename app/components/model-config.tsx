import {
  getServiceProviderForRequestFormat,
  isDalleImageRequestFormat,
  isGptImageRequestFormat,
  isOpenAIImageRequestFormat,
  RequestFormat,
  REQUEST_FORMAT_LABELS,
  REQUEST_FORMAT_OPTIONS,
  ServiceProvider,
} from "@/app/constant";
import { ModalConfigValidator, ModelConfig } from "../store";
import {
  DalleQuality,
  DalleStyle,
  GptImageBackground,
  GptImageModeration,
  GptImageOutputFormat,
  GptImageQuality,
  GptImageSize,
  OpenAIReasoningEffort,
} from "../typing";

import Locale from "../locales";
import { InputRange } from "./input-range";
import { ListItem, SearchSelect, Select } from "./ui-lib";
import { useAllModels } from "../utils/hooks";
import { useEffect, useMemo, useState } from "react";
import styles from "./model-config.module.scss";

function OptionalNumberInput(props: {
  ariaLabel: string;
  value?: number;
  min: number;
  max: number;
  step?: number | string;
  placeholder: string;
  validator: (value: number) => number;
  onValueChange: (value: number | undefined) => void;
}) {
  const [draftValue, setDraftValue] = useState(
    props.value === undefined ? "" : String(props.value),
  );

  useEffect(() => {
    setDraftValue(props.value === undefined ? "" : String(props.value));
  }, [props.value]);

  const commitValue = (rawValue: string) => {
    if (!rawValue.trim()) {
      setDraftValue("");
      props.onValueChange(undefined);
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      setDraftValue(props.value === undefined ? "" : String(props.value));
      return;
    }

    const nextValue = props.validator(parsedValue);
    setDraftValue(String(nextValue));
    props.onValueChange(nextValue);
  };

  return (
    <input
      aria-label={props.ariaLabel}
      type="number"
      min={props.min}
      max={props.max}
      step={props.step}
      placeholder={props.placeholder}
      value={draftValue}
      onChange={(e) => {
        const rawValue = e.currentTarget.value;
        setDraftValue(rawValue);

        if (!rawValue) {
          props.onValueChange(undefined);
          return;
        }

        if (Number.isFinite(e.currentTarget.valueAsNumber)) {
          props.onValueChange(props.validator(e.currentTarget.valueAsNumber));
        }
      }}
      onBlur={(e) => commitValue(e.currentTarget.value)}
    ></input>
  );
}

export function ModelConfigList(props: {
  modelConfig: ModelConfig;
  updateConfig: (updater: (config: ModelConfig) => void) => void;
  requestFormatReadonly?: boolean;
  onRequestFormatChange?: (requestFormat: RequestFormat) => void;
}) {
  const allModels = useAllModels();
  const models = useMemo(() => {
    const seen = new Set<string>();
    return allModels.filter((model) => {
      if (!model.available || /^-+$/.test(model.name)) {
        return false;
      }
      if (seen.has(model.name)) {
        return false;
      }
      seen.add(model.name);
      return true;
    });
  }, [allModels]);
  const value = props.modelConfig.model;
  const compressModelValue =
    props.modelConfig.compressModel || props.modelConfig.model;
  const requestFormat =
    props.modelConfig.requestFormat ?? RequestFormat.OpenAIChat;
  const isDalleImageRequest = isDalleImageRequestFormat(requestFormat);
  const isGptImageRequest = isGptImageRequestFormat(requestFormat);
  const isImageRequest = isOpenAIImageRequestFormat(requestFormat);
  const supportsReasoningEffort =
    requestFormat === RequestFormat.OpenAIChat ||
    requestFormat === RequestFormat.OpenAIResponses;
  const omitLabel = Locale.Settings.OptionalParam.Omit;
  const dalleSizes = ["1024x1024", "1792x1024", "1024x1792"] as const;
  const dalleQualities: DalleQuality[] = ["standard", "hd"];
  const dalleStyles: DalleStyle[] = ["vivid", "natural"];
  const gptImageSizes: GptImageSize[] = [
    "auto",
    "1024x1024",
    "1536x1024",
    "1024x1536",
  ];
  const gptImageQualities: GptImageQuality[] = [
    "auto",
    "low",
    "medium",
    "high",
  ];
  const gptImageBackgrounds: GptImageBackground[] = [
    "auto",
    "transparent",
    "opaque",
  ];
  const gptImageOutputFormats: GptImageOutputFormat[] = ["png", "jpeg", "webp"];
  const gptImageModerations: GptImageModeration[] = ["auto", "low"];
  const reasoningEfforts: OpenAIReasoningEffort[] = [
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ];
  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.name,
        label: model.displayName ?? model.name,
        keywords: `${model.name} ${model.displayName ?? ""} ${
          model.provider?.providerName ?? ""
        }`.trim(),
      })),
    [models],
  );

  return (
    <>
      <ListItem title={Locale.Settings.Model}>
        <SearchSelect
          ariaLabel={Locale.Settings.Model}
          className={styles["select-compress-model"]}
          compact
          value={value}
          options={modelOptions}
          searchPlaceholder={
            Locale.Settings.Access.CustomModel.Modal.SearchPlaceholder
          }
          noResultText={Locale.SearchChat.Page.NoResult}
          onChange={(nextValue) => {
            props.updateConfig((config) => {
              config.model = ModalConfigValidator.model(nextValue);
            });
          }}
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Provider.Title}
        subTitle={Locale.Settings.Access.Provider.SubTitle}
      >
        <Select
          aria-label={Locale.Settings.Access.Provider.Title}
          value={props.modelConfig.requestFormat ?? RequestFormat.OpenAIChat}
          disabled={props.requestFormatReadonly}
          onChange={(e) => {
            const requestFormat = e.currentTarget.value as RequestFormat;
            props.updateConfig((config) => {
              config.requestFormat = requestFormat;
              config.providerName =
                getServiceProviderForRequestFormat(requestFormat);
              config.compressProviderName = config.providerName;
            });
            props.onRequestFormatChange?.(requestFormat);
          }}
        >
          {REQUEST_FORMAT_OPTIONS.map((requestFormat) => (
            <option value={requestFormat} key={requestFormat}>
              {REQUEST_FORMAT_LABELS[requestFormat]}
            </option>
          ))}
        </Select>
      </ListItem>
      {isDalleImageRequest && (
        <>
          <ListItem
            title={Locale.Settings.ImageSize.Title}
            subTitle={Locale.Settings.ImageSize.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageSize.Title}
              value={props.modelConfig.size ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.size = e.currentTarget.value
                      ? (e.currentTarget.value as any)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {dalleSizes.map((size) => (
                <option value={size} key={size}>
                  {size}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageQuality.Title}
            subTitle={Locale.Settings.ImageQuality.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageQuality.Title}
              value={props.modelConfig.quality ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.quality = e.currentTarget.value
                      ? (e.currentTarget.value as any)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {dalleQualities.map((quality) => (
                <option value={quality} key={quality}>
                  {quality}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageStyle.Title}
            subTitle={Locale.Settings.ImageStyle.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageStyle.Title}
              value={props.modelConfig.style ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.style = e.currentTarget.value
                      ? (e.currentTarget.value as any)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {dalleStyles.map((style) => (
                <option value={style} key={style}>
                  {style}
                </option>
              ))}
            </Select>
          </ListItem>
        </>
      )}
      {isGptImageRequest && (
        <>
          <ListItem
            title={Locale.Settings.ImageSize.Title}
            subTitle={Locale.Settings.ImageSize.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageSize.Title}
              value={props.modelConfig.gptImageSize ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageSize = e.currentTarget.value
                      ? (e.currentTarget.value as GptImageSize)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {gptImageSizes.map((size) => (
                <option value={size} key={size}>
                  {size}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageQuality.Title}
            subTitle={Locale.Settings.ImageQuality.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageQuality.Title}
              value={props.modelConfig.gptImageQuality ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageQuality = e.currentTarget.value
                      ? (e.currentTarget.value as GptImageQuality)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {gptImageQualities.map((quality) => (
                <option value={quality} key={quality}>
                  {quality}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageBackground.Title}
            subTitle={Locale.Settings.ImageBackground.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageBackground.Title}
              value={props.modelConfig.gptImageBackground ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageBackground = e.currentTarget.value
                      ? (e.currentTarget.value as GptImageBackground)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {gptImageBackgrounds.map((background) => (
                <option value={background} key={background}>
                  {background}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageOutputFormat.Title}
            subTitle={Locale.Settings.ImageOutputFormat.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageOutputFormat.Title}
              value={props.modelConfig.gptImageOutputFormat ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageOutputFormat = e.currentTarget.value
                      ? (e.currentTarget.value as GptImageOutputFormat)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {gptImageOutputFormats.map((format) => (
                <option value={format} key={format}>
                  {format}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageOutputCompression.Title}
            subTitle={Locale.Settings.ImageOutputCompression.SubTitle}
          >
            <OptionalNumberInput
              ariaLabel={Locale.Settings.ImageOutputCompression.Title}
              value={props.modelConfig.gptImageOutputCompression}
              min={0}
              max={100}
              step={10}
              placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
              validator={ModalConfigValidator.gptImageOutputCompression}
              onValueChange={(value) =>
                props.updateConfig(
                  (config) => (config.gptImageOutputCompression = value),
                )
              }
            ></OptionalNumberInput>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageModeration.Title}
            subTitle={Locale.Settings.ImageModeration.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageModeration.Title}
              value={props.modelConfig.gptImageModeration ?? ""}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageModeration = e.currentTarget.value
                      ? (e.currentTarget.value as GptImageModeration)
                      : undefined),
                )
              }
            >
              <option value="">{omitLabel}</option>
              {gptImageModerations.map((moderation) => (
                <option value={moderation} key={moderation}>
                  {moderation}
                </option>
              ))}
            </Select>
          </ListItem>
        </>
      )}
      {!isImageRequest && (
        <>
          {supportsReasoningEffort && (
            <ListItem
              title={Locale.Settings.ReasoningEffort.Title}
              subTitle={Locale.Settings.ReasoningEffort.SubTitle}
            >
              <Select
                aria-label={Locale.Settings.ReasoningEffort.Title}
                value={props.modelConfig.reasoningEffort ?? ""}
                onChange={(e) =>
                  props.updateConfig((config) => {
                    config.reasoningEffort = e.currentTarget.value
                      ? (e.currentTarget.value as OpenAIReasoningEffort)
                      : undefined;
                  })
                }
              >
                <option value="">{omitLabel}</option>
                {reasoningEfforts.map((effort) => (
                  <option value={effort} key={effort}>
                    {effort}
                  </option>
                ))}
              </Select>
            </ListItem>
          )}
          <ListItem
            title={Locale.Settings.Temperature.Title}
            subTitle={Locale.Settings.Temperature.SubTitle}
          >
            <OptionalNumberInput
              ariaLabel={Locale.Settings.Temperature.Title}
              value={props.modelConfig.temperature}
              min={0}
              max={1}
              step={0.1}
              placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
              validator={ModalConfigValidator.temperature}
              onValueChange={(value) =>
                props.updateConfig((config) => (config.temperature = value))
              }
            ></OptionalNumberInput>
          </ListItem>
          <ListItem
            title={Locale.Settings.TopP.Title}
            subTitle={Locale.Settings.TopP.SubTitle}
          >
            <OptionalNumberInput
              ariaLabel={Locale.Settings.TopP.Title}
              value={props.modelConfig.top_p}
              min={0}
              max={1}
              step={0.1}
              placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
              validator={ModalConfigValidator.top_p}
              onValueChange={(value) =>
                props.updateConfig((config) => (config.top_p = value))
              }
            ></OptionalNumberInput>
          </ListItem>
          <ListItem
            title={Locale.Settings.MaxTokens.Title}
            subTitle={Locale.Settings.MaxTokens.SubTitle}
          >
            <OptionalNumberInput
              ariaLabel={Locale.Settings.MaxTokens.Title}
              value={props.modelConfig.max_tokens}
              min={1024}
              max={512000}
              placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
              validator={ModalConfigValidator.max_tokens}
              onValueChange={(value) =>
                props.updateConfig((config) => (config.max_tokens = value))
              }
            ></OptionalNumberInput>
          </ListItem>

          {props.modelConfig?.providerName == ServiceProvider.Google ? null : (
            <>
              <ListItem
                title={Locale.Settings.PresencePenalty.Title}
                subTitle={Locale.Settings.PresencePenalty.SubTitle}
              >
                <OptionalNumberInput
                  ariaLabel={Locale.Settings.PresencePenalty.Title}
                  value={props.modelConfig.presence_penalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
                  validator={ModalConfigValidator.presence_penalty}
                  onValueChange={(value) =>
                    props.updateConfig(
                      (config) => (config.presence_penalty = value),
                    )
                  }
                ></OptionalNumberInput>
              </ListItem>

              <ListItem
                title={Locale.Settings.FrequencyPenalty.Title}
                subTitle={Locale.Settings.FrequencyPenalty.SubTitle}
              >
                <OptionalNumberInput
                  ariaLabel={Locale.Settings.FrequencyPenalty.Title}
                  value={props.modelConfig.frequency_penalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  placeholder={Locale.Settings.OptionalParam.EmptyPlaceholder}
                  validator={ModalConfigValidator.frequency_penalty}
                  onValueChange={(value) =>
                    props.updateConfig(
                      (config) => (config.frequency_penalty = value),
                    )
                  }
                ></OptionalNumberInput>
              </ListItem>

              <ListItem
                title={Locale.Settings.InjectSystemPrompts.Title}
                subTitle={Locale.Settings.InjectSystemPrompts.SubTitle}
              >
                <input
                  aria-label={Locale.Settings.InjectSystemPrompts.Title}
                  type="checkbox"
                  checked={props.modelConfig.enableInjectSystemPrompts}
                  onChange={(e) =>
                    props.updateConfig(
                      (config) =>
                        (config.enableInjectSystemPrompts =
                          e.currentTarget.checked),
                    )
                  }
                ></input>
              </ListItem>

              <ListItem
                title={Locale.Settings.InputTemplate.Title}
                subTitle={Locale.Settings.InputTemplate.SubTitle}
              >
                <input
                  aria-label={Locale.Settings.InputTemplate.Title}
                  type="text"
                  value={props.modelConfig.template}
                  onChange={(e) =>
                    props.updateConfig(
                      (config) => (config.template = e.currentTarget.value),
                    )
                  }
                ></input>
              </ListItem>
            </>
          )}
          <ListItem
            title={Locale.Settings.HistoryCount.Title}
            subTitle={Locale.Settings.HistoryCount.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.HistoryCount.Title}
              title={props.modelConfig.historyMessageCount.toString()}
              value={props.modelConfig.historyMessageCount}
              min="0"
              max="64"
              step="1"
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.historyMessageCount = e.target.valueAsNumber),
                )
              }
            ></InputRange>
          </ListItem>

          <ListItem
            title={Locale.Settings.CompressThreshold.Title}
            subTitle={Locale.Settings.CompressThreshold.SubTitle}
          >
            <input
              aria-label={Locale.Settings.CompressThreshold.Title}
              type="number"
              min={500}
              max={4000}
              value={props.modelConfig.compressMessageLengthThreshold}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.compressMessageLengthThreshold =
                      e.currentTarget.valueAsNumber),
                )
              }
            ></input>
          </ListItem>
          <ListItem title={Locale.Memory.Title} subTitle={Locale.Memory.Send}>
            <input
              aria-label={Locale.Memory.Title}
              type="checkbox"
              checked={props.modelConfig.sendMemory}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.sendMemory = e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>
          <ListItem
            title={Locale.Settings.CompressModel.Title}
            subTitle={Locale.Settings.CompressModel.SubTitle}
          >
            <SearchSelect
              compact
              className={styles["select-compress-model"]}
              ariaLabel={Locale.Settings.CompressModel.Title}
              value={compressModelValue}
              options={modelOptions}
              searchPlaceholder={
                Locale.Settings.Access.CustomModel.Modal.SearchPlaceholder
              }
              noResultText={Locale.SearchChat.Page.NoResult}
              onChange={(nextValue) => {
                props.updateConfig((config) => {
                  config.compressModel = ModalConfigValidator.model(nextValue);
                  config.compressProviderName =
                    config.providerName || ServiceProvider.OpenAI;
                });
              }}
            />
          </ListItem>
        </>
      )}
    </>
  );
}
