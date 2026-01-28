import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

@Injectable()
export class ChatModelService implements OnModuleInit {
  private readonly logger = new Logger(ChatModelService.name);
  private chatModel: BaseChatModel;
  private streamingChatModel: BaseChatModel;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = this.configService.get<string>("LLM_PROVIDER", "ollama");

    if (provider === "ollama") {
      this.initOllama();
    } else {
      this.initDashScope();
    }
  }

  private initOllama() {
    const baseUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );
    const modelName = this.configService.get<string>(
      "OLLAMA_MODEL",
      "qwen2.5:7b",
    );

    this.chatModel = new ChatOllama({
      baseUrl,
      model: modelName,
    }) as unknown as BaseChatModel;

    this.streamingChatModel = new ChatOllama({
      baseUrl,
      model: modelName,
    }) as unknown as BaseChatModel;

    this.logger.log(`Ollama model initialized: ${modelName} at ${baseUrl}`);
  }

  private initDashScope() {
    const apiKey = this.configService.get<string>("DASHSCOPE_API_KEY");
    const modelName = this.configService.get<string>(
      "DASHSCOPE_CHAT_MODEL",
      "qwen-max",
    );

    if (!apiKey) {
      this.logger.warn("DASHSCOPE_API_KEY not configured, using mock model");
    }

    const baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey || "mock-key",
      modelName: modelName,
      configuration: { baseURL },
    }) as unknown as BaseChatModel;

    this.streamingChatModel = new ChatOpenAI({
      openAIApiKey: apiKey || "mock-key",
      modelName: modelName,
      streaming: true,
      configuration: { baseURL },
    }) as unknown as BaseChatModel;

    this.logger.log(`DashScope model initialized: ${modelName}`);
  }

  getChatModel(): BaseChatModel {
    return this.chatModel;
  }

  getStreamingChatModel(): BaseChatModel {
    return this.streamingChatModel;
  }
}
