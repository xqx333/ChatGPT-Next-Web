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
} from "../typing";

import Locale from "../locales";
import { InputRange } from "./input-range";
import { ListItem, Select } from "./ui-lib";
import { useAllModels } from "../utils/hooks";
import { useMemo } from "react";
import styles from "./model-config.module.scss";

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

  return (
    <>
      <ListItem title={Locale.Settings.Model}>
        <Select
          aria-label={Locale.Settings.Model}
          value={value}
          align="left"
          onChange={(e) => {
            props.updateConfig((config) => {
              config.model = ModalConfigValidator.model(e.currentTarget.value);
            });
          }}
        >
          {models.map((model, index) => (
            <option value={model.name} key={index}>
              {model.displayName ?? model.name}
            </option>
          ))}
        </Select>
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
              value={props.modelConfig.size ?? "1024x1024"}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.size = e.currentTarget.value as any),
                )
              }
            >
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
              value={props.modelConfig.quality ?? "standard"}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.quality = e.currentTarget.value as any),
                )
              }
            >
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
              value={props.modelConfig.style ?? "vivid"}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.style = e.currentTarget.value as any),
                )
              }
            >
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
              value={props.modelConfig.gptImageSize ?? "auto"}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageSize = e.currentTarget
                      .value as GptImageSize),
                )
              }
            >
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
              value={props.modelConfig.gptImageQuality ?? "auto"}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageQuality = e.currentTarget
                      .value as GptImageQuality),
                )
              }
            >
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
              value={props.modelConfig.gptImageBackground ?? "auto"}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageBackground = e.currentTarget
                      .value as GptImageBackground),
                )
              }
            >
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
              value={props.modelConfig.gptImageOutputFormat ?? "png"}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageOutputFormat = e.currentTarget
                      .value as GptImageOutputFormat),
                )
              }
            >
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
            <InputRange
              aria={Locale.Settings.ImageOutputCompression.Title}
              title={`${props.modelConfig.gptImageOutputCompression ?? 100}%`}
              value={props.modelConfig.gptImageOutputCompression ?? 100}
              min="0"
              max="100"
              step="10"
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageOutputCompression =
                      ModalConfigValidator.gptImageOutputCompression(
                        e.currentTarget.valueAsNumber,
                      )),
                )
              }
            ></InputRange>
          </ListItem>

          <ListItem
            title={Locale.Settings.ImageModeration.Title}
            subTitle={Locale.Settings.ImageModeration.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.ImageModeration.Title}
              value={props.modelConfig.gptImageModeration ?? "auto"}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.gptImageModeration = e.currentTarget
                      .value as GptImageModeration),
                )
              }
            >
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
          <ListItem
            title={Locale.Settings.Temperature.Title}
            subTitle={Locale.Settings.Temperature.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.Temperature.Title}
              value={props.modelConfig.temperature?.toFixed(1)}
              min="0"
              max="1" // lets limit it to 0-1
              step="0.1"
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.temperature = ModalConfigValidator.temperature(
                      e.currentTarget.valueAsNumber,
                    )),
                );
              }}
            ></InputRange>
          </ListItem>
          <ListItem
            title={Locale.Settings.TopP.Title}
            subTitle={Locale.Settings.TopP.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.TopP.Title}
              value={(props.modelConfig.top_p ?? 1).toFixed(1)}
              min="0"
              max="1"
              step="0.1"
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.top_p = ModalConfigValidator.top_p(
                      e.currentTarget.valueAsNumber,
                    )),
                );
              }}
            ></InputRange>
          </ListItem>
          <ListItem
            title={Locale.Settings.MaxTokens.Title}
            subTitle={Locale.Settings.MaxTokens.SubTitle}
          >
            <input
              aria-label={Locale.Settings.MaxTokens.Title}
              type="number"
              min={1024}
              max={512000}
              value={props.modelConfig.max_tokens}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.max_tokens = ModalConfigValidator.max_tokens(
                      e.currentTarget.valueAsNumber,
                    )),
                )
              }
            ></input>
          </ListItem>

          {props.modelConfig?.providerName == ServiceProvider.Google ? null : (
            <>
              <ListItem
                title={Locale.Settings.PresencePenalty.Title}
                subTitle={Locale.Settings.PresencePenalty.SubTitle}
              >
                <InputRange
                  aria={Locale.Settings.PresencePenalty.Title}
                  value={props.modelConfig.presence_penalty?.toFixed(1)}
                  min="-2"
                  max="2"
                  step="0.1"
                  onChange={(e) => {
                    props.updateConfig(
                      (config) =>
                        (config.presence_penalty =
                          ModalConfigValidator.presence_penalty(
                            e.currentTarget.valueAsNumber,
                          )),
                    );
                  }}
                ></InputRange>
              </ListItem>

              <ListItem
                title={Locale.Settings.FrequencyPenalty.Title}
                subTitle={Locale.Settings.FrequencyPenalty.SubTitle}
              >
                <InputRange
                  aria={Locale.Settings.FrequencyPenalty.Title}
                  value={props.modelConfig.frequency_penalty?.toFixed(1)}
                  min="-2"
                  max="2"
                  step="0.1"
                  onChange={(e) => {
                    props.updateConfig(
                      (config) =>
                        (config.frequency_penalty =
                          ModalConfigValidator.frequency_penalty(
                            e.currentTarget.valueAsNumber,
                          )),
                    );
                  }}
                ></InputRange>
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
            <Select
              className={styles["select-compress-model"]}
              aria-label={Locale.Settings.CompressModel.Title}
              value={compressModelValue}
              onChange={(e) => {
                props.updateConfig((config) => {
                  config.compressModel = ModalConfigValidator.model(
                    e.currentTarget.value,
                  );
                  config.compressProviderName =
                    config.providerName || ServiceProvider.OpenAI;
                });
              }}
            >
              {models.map((model, index) => (
                <option value={model.name} key={index}>
                  {model.displayName ?? model.name}
                </option>
              ))}
            </Select>
          </ListItem>
        </>
      )}
    </>
  );
}
