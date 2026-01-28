import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ChatModelService } from "./model/chat-model.service";
import { RagService } from "./rag/rag.service";
import { PersistentVectorStoreService } from "./rag/persistent-vector-store.service";
import { McpService } from "./mcp/mcp.service";
import { McpClientService } from "./mcp/mcp-client.service";
import { InterviewQuestionTool } from "./tools/interview-question.tool";
import { ToolProviderService } from "./tools/tool-provider.service";
import { SafeInputGuardrail } from "./guardrail/safe-input.guardrail";
import { ChatMemoryService } from "./memory/chat-memory.service";
import { ChatModelListenerService } from "./listener/chat-model-listener.service";
import { StructuredOutputService } from "./structured-output/structured-output.service";

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    ChatModelService,
    RagService,
    PersistentVectorStoreService,
    McpService,
    McpClientService,
    InterviewQuestionTool,
    ToolProviderService,
    SafeInputGuardrail,
    ChatMemoryService,
    ChatModelListenerService,
    StructuredOutputService,
  ],
  exports: [
    AiService,
    ChatModelListenerService,
    StructuredOutputService,
    ToolProviderService,
    PersistentVectorStoreService,
  ],
})
export class AiModule {}
