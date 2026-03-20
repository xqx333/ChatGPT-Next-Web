import {
  isDalleImageRequestFormat,
  isGptImageRequestFormat,
  OpenaiPath,
  RequestFormat,
} from "@/app/constant";
import { useAppConfig, useChatStore } from "@/app/store";
import {
  base64Image2Blob,
  cacheImageToBase64Image,
  uploadImage,
} from "@/app/utils/chat";
import {
  getMessageImages,
  getMessageTextContent,
  getTimeoutMSByModel,
} from "@/app/utils";
import { fetch } from "@/app/utils/stream";
import {
  GptImageBackground,
  GptImageModeration,
  GptImageOutputFormat,
  GptImageQuality,
  GptImageSize,
} from "@/app/typing";

import {
  ChatOptions,
  getHeaders,
  LLMModel,
  LLMUsage,
  MultimodalContent,
  SpeechOptions,
} from "../api";
import { ChatGPTApi, DalleRequestPayload } from "./openai";

type GptImageGenerateRequestPayload = {
  model: string;
  prompt: string;
  size?: GptImageSize;
  quality?: GptImageQuality;
  background?: GptImageBackground;
  output_format?: GptImageOutputFormat;
  moderation?: GptImageModeration;
  output_compression?: number;
  n: number;
};

export class OpenAIImageApi extends ChatGPTApi {
  private async extractLastInput(options: ChatOptions) {
    const lastMessage = options.messages.at(-1);
    const prompt = lastMessage ? getMessageTextContent(lastMessage) : "";
    const imageUrls = lastMessage ? getMessageImages(lastMessage) : [];
    const images = await Promise.all(
      imageUrls.map((imageUrl) => cacheImageToBase64Image(imageUrl)),
    );

    return { prompt, images };
  }

  private getRequestFormat(options: ChatOptions, fallback: RequestFormat) {
    return options.config.requestFormat ?? fallback;
  }

  private buildDalleRequestPayload(
    options: ChatOptions,
    prompt: string,
  ): DalleRequestPayload {
    return {
      model: options.config.model,
      prompt,
      response_format: "b64_json",
      n: 1,
      ...(options.config.size ? { size: options.config.size } : {}),
      ...(options.config.quality ? { quality: options.config.quality } : {}),
      ...(options.config.style ? { style: options.config.style } : {}),
    };
  }

  private buildGptImageRequestPayload(
    options: ChatOptions,
    prompt: string,
  ): GptImageGenerateRequestPayload {
    const outputFormat = options.config.gptImageOutputFormat ?? "png";
    const outputCompression = options.config.gptImageOutputCompression ?? 100;

    return {
      model: options.config.model,
      prompt,
      ...(options.config.gptImageSize
        ? { size: options.config.gptImageSize }
        : {}),
      ...(options.config.gptImageQuality
        ? { quality: options.config.gptImageQuality }
        : {}),
      ...(options.config.gptImageBackground
        ? { background: options.config.gptImageBackground }
        : {}),
      ...(options.config.gptImageOutputFormat
        ? { output_format: options.config.gptImageOutputFormat }
        : {}),
      ...(options.config.gptImageModeration
        ? { moderation: options.config.gptImageModeration }
        : {}),
      ...(outputFormat === "png"
        ? {}
        : options.config.gptImageOutputCompression !== undefined
        ? { output_compression: outputCompression }
        : {}),
      n: 1,
    };
  }

  private async buildGptImageEditFormData(
    options: ChatOptions,
    prompt: string,
    images: string[],
  ) {
    const formData = new FormData();
    const outputFormat = options.config.gptImageOutputFormat ?? "png";

    formData.append("model", options.config.model);
    formData.append("prompt", prompt);
    if (options.config.gptImageSize) {
      formData.append("size", options.config.gptImageSize);
    }
    if (options.config.gptImageQuality) {
      formData.append("quality", options.config.gptImageQuality);
    }
    if (options.config.gptImageBackground) {
      formData.append("background", options.config.gptImageBackground);
    }
    if (options.config.gptImageOutputFormat) {
      formData.append("output_format", options.config.gptImageOutputFormat);
    }
    if (options.config.gptImageModeration) {
      formData.append("moderation", options.config.gptImageModeration);
    }

    if (
      outputFormat !== "png" &&
      options.config.gptImageOutputCompression !== undefined
    ) {
      formData.append(
        "output_compression",
        String(options.config.gptImageOutputCompression ?? 100),
      );
    }

    const imageFieldName = images.length > 1 ? "image[]" : "image";
    for (const [index, image] of images.entries()) {
      const blob = await fetch(image).then((res) => res.blob());
      formData.append(
        imageFieldName,
        blob,
        `image-${index}.${this.getImageExtension(outputFormat)}`,
      );
    }

    return formData;
  }

  private getImageExtension(outputFormat: GptImageOutputFormat) {
    return outputFormat === "jpeg" ? "jpg" : outputFormat;
  }

  private getImageMimeType(outputFormat: GptImageOutputFormat) {
    switch (outputFormat) {
      case "jpeg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      default:
        return "image/png";
    }
  }

  async chat(options: ChatOptions) {
    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
        providerName: options.config.providerName,
      },
    };

    const { prompt, images } = await this.extractLastInput(options);
    const requestFormat = this.getRequestFormat(
      options,
      modelConfig.requestFormat,
    );
    const isDalleRequest = isDalleImageRequestFormat(requestFormat);
    const isGptImageRequest = isGptImageRequestFormat(requestFormat);

    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        getTimeoutMSByModel(options.config.model),
      );

      let chatPath = this.path(OpenaiPath.ImagePath);
      let body: BodyInit;
      let headers: HeadersInit;
      let outputFormat: GptImageOutputFormat = "png";

      if (isDalleRequest) {
        const requestPayload = this.buildDalleRequestPayload(options, prompt);
        console.log("[Request] openai dalle image payload: ", requestPayload);
        body = JSON.stringify(requestPayload);
        headers = getHeaders();
      } else if (isGptImageRequest && images.length > 0) {
        outputFormat = options.config.gptImageOutputFormat ?? "png";
        const requestPayload = await this.buildGptImageEditFormData(
          options,
          prompt,
          images,
        );
        console.log("[Request] openai gpt image edit payload: ", {
          model: options.config.model,
          prompt,
          imageCount: images.length,
          size: options.config.gptImageSize,
          quality: options.config.gptImageQuality,
          background: options.config.gptImageBackground,
          output_format: options.config.gptImageOutputFormat,
          moderation: options.config.gptImageModeration,
          output_compression: options.config.gptImageOutputCompression,
        });
        chatPath = this.path(OpenaiPath.ImageEditsPath);
        body = requestPayload;
        headers = getHeaders(true);
      } else {
        const requestPayload = this.buildGptImageRequestPayload(
          options,
          prompt,
        );
        outputFormat = requestPayload.output_format ?? "png";
        console.log("[Request] openai gpt image payload: ", requestPayload);
        body = JSON.stringify(requestPayload);
        headers = getHeaders();
      }

      const res = await fetch(chatPath, {
        method: "POST",
        body,
        signal: controller.signal,
        headers,
      });

      clearTimeout(requestTimeoutId);

      const resJson = await res.json();
      const message = await this.extractMessage(
        resJson,
        isDalleRequest ? "image/png" : this.getImageMimeType(outputFormat),
      );
      options.onFinish(message, res);
    } catch (e) {
      console.log("[Request] failed to make an image request", e);
      options.onError?.(e as Error);
    }
  }

  async extractMessage(
    res: any,
    mimeType: string = "image/png",
  ): Promise<string | MultimodalContent[]> {
    if (res.error) {
      return "```\n" + JSON.stringify(res, null, 4) + "\n```";
    }

    const image = res.data?.at(0);
    let url = image?.url ?? "";
    const b64Json = image?.b64_json ?? "";
    if (!url && b64Json) {
      url = await uploadImage(base64Image2Blob(b64Json, mimeType));
    }

    return [
      {
        type: "image_url" as const,
        image_url: {
          url,
        },
      },
    ];
  }

  speech(options: SpeechOptions): Promise<ArrayBuffer> {
    return super.speech(options);
  }

  usage(): Promise<LLMUsage> {
    return super.usage();
  }

  models(): Promise<LLMModel[]> {
    return super.models();
  }
}
