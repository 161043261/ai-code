import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Post,
  Body,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { AiService, RagResult } from "./ai.service";
import { Report } from "./structured-output/structured-output.service";

@ApiTags("AI")
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get("chat")
  @ApiOperation({ summary: "流式对话" })
  @ApiQuery({ name: "memoryId", type: Number, description: "会话ID" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  async chat(
    @Query("memoryId") memoryId: number,
    @Query("message") message: string,
    @Res() res: Response,
  ) {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(HttpStatus.OK);

    try {
      const stream = this.aiService.chatStream(memoryId, message);

      for await (const chunk of stream) {
        res.write(`data: ${chunk}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error("Chat stream error:", error);
      res.write(`data: [ERROR] ${error.message}\n\n`);
      res.end();
    }
  }

  @Get("chat/sync")
  @ApiOperation({ summary: "同步对话" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  @ApiResponse({ status: 200, description: "AI响应内容", type: String })
  async chatSync(@Query("message") message: string): Promise<string> {
    return this.aiService.chat(message);
  }

  @Get("chat/report")
  @ApiOperation({ summary: "生成学习报告（结构化输出）" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  @ApiResponse({ status: 200, description: "学习报告" })
  async chatForReport(@Query("message") message: string): Promise<Report> {
    return this.aiService.chatForReport(message);
  }

  @Get("chat/rag")
  @ApiOperation({ summary: "带RAG的对话（返回来源）" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  @ApiResponse({ status: 200, description: "AI响应及引用来源" })
  async chatWithRag(@Query("message") message: string): Promise<RagResult> {
    return this.aiService.chatWithRag(message);
  }

  @Get("chat/tools")
  @ApiOperation({ summary: "带工具调用的对话" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  @ApiResponse({ status: 200, description: "AI响应及工具调用信息" })
  async chatWithTools(@Query("message") message: string): Promise<{
    content: string;
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  }> {
    return this.aiService.chatWithTools(message);
  }

  @Get("chat/mcp")
  @ApiOperation({ summary: "带MCP网络搜索的对话" })
  @ApiQuery({ name: "message", type: String, description: "用户消息" })
  @ApiResponse({ status: 200, description: "AI响应", type: String })
  async chatWithMcp(@Query("message") message: string): Promise<string> {
    return this.aiService.chatWithMcp(message);
  }
}
