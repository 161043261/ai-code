import { Injectable, Logger } from '@nestjs/common';
import { ChatModelService } from '../model/chat-model.service';
import { ChatModelListenerService } from '../listener/chat-model-listener.service';
import { McpClientService } from '../mcp/mcp-client.service';
import { CodeQuestionTool } from './code-question-tool';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { BindToolsInput } from '@langchain/core/language_models/chat_models';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

@Injectable()
export class ToolProviderService {
  private readonly logger = new Logger(ToolProviderService.name);
  private tools = new Map<
    string,
    {
      definition: ToolDefinition;
      handler: (args: Record<string, unknown>) => Promise<string>;
    }
  >();

  constructor(
    private readonly chatModelService: ChatModelService,
    private readonly listenerService: ChatModelListenerService,
    private readonly mcpClientService: McpClientService,
    private readonly codeQuestionTool: CodeQuestionTool,
  ) {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools() {
    const definition: ToolDefinition = {
      name: 'CodeQuestionTool',
      description: `
        Find relevant code questions based on a keyword.
        Use this tool when the user asks for code questions.
        The input should be a clear search keyword.
      `,
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'The keyword to search',
          },
        },
        required: ['keyword'],
      },
    };
    const handler = async (args: Record<string, unknown>) => {
      return this.codeQuestionTool.searchCodeQuestions(String(args.keyword));
    };
    this.registerTool(definition, handler);
  }

  registerTool(
    definition: ToolDefinition,
    handler: (args: Record<string, unknown>) => Promise<string>,
  ): void {
    this.tools.set(definition.name, { definition, handler });
    this.logger.debug(`Tool registered: ${definition.name}`);
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    this.logger.log(`Executing tool: ${name}`);
    try {
      const result = await tool.handler(args);
      this.logger.log(`Tool ${name} completed`);
      return result;
    } catch (err) {
      this.logger.error(`Tool ${name} failed:`, err);
      throw err;
    }
  }

  async chatWithTools(
    messages: (SystemMessage | HumanMessage | AIMessage)[],
    systemPrompt: string,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const chatModel = this.chatModelService.getChatModel();
    const toolDefinitions = this.getAllToolDefinitions();
    const fullMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...messages,
    ];
    const requestId = this.listenerService.onRequest({
      messages: fullMessages,
      modelName: chatModel.getName(),
    });
    try {
      const toolsConfig: BindToolsInput[] = toolDefinitions.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      const modelWithTools = chatModel.bindTools?.(toolsConfig);
      if (!modelWithTools) {
        throw '';
      }
      const response = await modelWithTools.invoke(fullMessages);
      const content = response.content.toString();
      const toolCalls: ToolCall[] =
        response.tool_calls?.map((item) => ({
          id: item.id ?? String(Date.now()),
          name: item.name,
          args: item.args,
        })) ?? [];
      this.listenerService.onResponse({
        requestId,
        content,
        modelName: chatModel.getName(),
      });
      return { content, toolCalls };
    } catch (err) {
      this.listenerService.onError({
        requestId,
        error: err,
        messages: fullMessages,
        modelName: chatModel.getName(),
      });
      this.logger.error('chatWithTools failed:', err);
      throw err;
    }
  }

  getAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }
}
