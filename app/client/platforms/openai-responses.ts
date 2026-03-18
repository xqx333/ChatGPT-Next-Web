import { OpenaiPath } from "@/app/constant";
import {
  ChatMessageTool,
  useAppConfig,
  useChatStore,
  usePluginStore,
} from "@/app/store";
import {
  getMessageTextContent,
  getTimeoutMSByModel,
  isDalle3 as isDalle3Model,
  isVisionModel,
} from "@/app/utils";
import { preProcessImageContent, stream } from "@/app/utils/chat";
import { fetch } from "@/app/utils/stream";
import {
  ChatOptions,
  getHeaders,
  LLMModel,
  LLMUsage,
  SpeechOptions,
} from "../api";
import { ChatGPTApi } from "./openai";

type ResponsesInputContent =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
    };

type ResponsesInputMessage = {
  role: "developer" | "system" | "user" | "assistant";
  content: string | ResponsesInputContent[];
};

type ResponsesFunctionTool = {
  type: "function";
  name: string;
  description?: string;
  parameters: object;
};

type ResponsesToolOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type ResponsesRequestPayload = {
  model: string;
  input: ResponsesInputMessage[] | ResponsesToolOutput[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  previous_response_id?: string;
};

function extractOutputTextFromResponse(res: any): string {
  if (typeof res?.output_text === "string" && res.output_text.length > 0) {
    return res.output_text;
  }

  const texts: string[] = [];
  for (const item of res?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content ?? []) {
      const text = content?.text ?? content?.content?.[0]?.text;
      if (typeof text === "string" && text.length > 0) {
        texts.push(text);
      }
    }
  }

  return texts.join("\n\n");
}

export class OpenAIResponsesApi extends ChatGPTApi {
  private mapTool(tool: {
    function: { name: string; description?: string; parameters: object };
  }): ResponsesFunctionTool {
    return {
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    };
  }

  private async mapInputMessages(
    options: ChatOptions,
  ): Promise<ResponsesInputMessage[]> {
    const visionModel = isVisionModel(options.config.model);
    const messages: ResponsesInputMessage[] = [];

    for (const message of options.messages) {
      const content = visionModel
        ? await preProcessImageContent(message.content)
        : getMessageTextContent(message);

      if (typeof content === "string") {
        messages.push({
          role: message.role,
          content,
        });
        continue;
      }

      messages.push({
        role: message.role,
        content: content.map((part) =>
          part.type === "text"
            ? {
                type: "input_text" as const,
                text: part.text ?? "",
              }
            : {
                type: "input_image" as const,
                image_url: part.image_url?.url ?? "",
              },
        ),
      });
    }

    return messages;
  }

  async chat(options: ChatOptions): Promise<void> {
    if (isDalle3Model(options.config.model)) {
      return super.chat(options);
    }

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
        providerName: options.config.providerName,
      },
    };

    const requestPayload: ResponsesRequestPayload = {
      model: modelConfig.model,
      input: await this.mapInputMessages(options),
      stream: options.config.stream,
      temperature: modelConfig.temperature,
      top_p: modelConfig.top_p,
      max_output_tokens: modelConfig.max_tokens,
    };

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(OpenaiPath.ResponsesPath);

      if (shouldStream) {
        const [tools, funcs] = usePluginStore
          .getState()
          .getAsTools(
            useChatStore.getState().currentSession().mask?.plugin || [],
          );

        const itemIndexById = new Map<string, number>();
        let previousResponseId = "";

        return stream(
          chatPath,
          requestPayload,
          getHeaders(),
          tools.map((tool) => this.mapTool(tool)) as ResponsesFunctionTool[],
          funcs,
          controller,
          (text: string, runTools: ChatMessageTool[]) => {
            const chunk = JSON.parse(text);
            const type = chunk?.type;

            previousResponseId =
              chunk?.response?.id ?? previousResponseId ?? "";

            if (type === "response.output_text.delta") {
              return chunk?.delta ?? "";
            }

            if (type === "response.output_item.added") {
              const item = chunk?.item;
              if (item?.type === "function_call") {
                const tool: ChatMessageTool = {
                  id: item.call_id ?? item.id,
                  type: "function",
                  function: {
                    name: item.name,
                    arguments: item.arguments ?? "",
                  },
                };
                itemIndexById.set(item.id, runTools.length);
                runTools.push(tool);
              }
              return "";
            }

            if (type === "response.function_call_arguments.delta") {
              const index = itemIndexById.get(chunk?.item_id);
              if (index !== undefined) {
                // @ts-ignore
                runTools[index].function.arguments += chunk?.delta ?? "";
              }
              return "";
            }

            if (type === "response.output_item.done") {
              const item = chunk?.item;
              if (item?.type === "function_call") {
                const index = itemIndexById.get(item.id);
                if (index === undefined) {
                  runTools.push({
                    id: item.call_id ?? item.id,
                    type: "function",
                    function: {
                      name: item.name,
                      arguments: item.arguments ?? "",
                    },
                  });
                } else {
                  runTools[index] = {
                    id: item.call_id ?? item.id,
                    type: "function",
                    function: {
                      name: item.name,
                      arguments: item.arguments ?? "",
                    },
                  };
                }
              }
              return "";
            }

            return "";
          },
          (
            payload: ResponsesRequestPayload,
            _toolCallMessage: any,
            toolCallResult: Array<{ content: string; tool_call_id: string }>,
          ) => {
            payload.previous_response_id = previousResponseId;
            payload.input = toolCallResult.map((result) => ({
              type: "function_call_output" as const,
              call_id: result.tool_call_id,
              output: result.content,
            }));
          },
          options,
        );
      }

      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        getTimeoutMSByModel(options.config.model),
      );

      const res = await fetch(chatPath, {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: getHeaders(),
      });

      clearTimeout(requestTimeoutId);

      const resJson = await res.json();
      const message = extractOutputTextFromResponse(resJson);
      options.onFinish(message, res);
    } catch (e) {
      console.log("[Request] failed to make a responses request", e);
      options.onError?.(e as Error);
    }
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
