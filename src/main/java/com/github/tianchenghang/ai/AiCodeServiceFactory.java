package com.github.tianchenghang.ai;

import com.github.tianchenghang.ai.tools.InterviewQuestionTool;
import dev.langchain4j.mcp.McpToolProvider;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.service.AiServices;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiCodeServiceFactory {
  @Resource private ChatModel chatModel;

  @Resource private ContentRetriever retriever;

  @Resource private McpToolProvider mcpToolProvider;

  @Bean
  public IAiCodeService aiCodeService() {
    var chatMemory = MessageWindowChatMemory.withMaxMessages(10);
    //    var aiService = AiServices.create(IAiCodeService.class, chatModel);
    var aiService =
        AiServices.builder(IAiCodeService.class)
            .chatModel(chatModel)
            .chatMemory(chatMemory) // 会话记忆
            .contentRetriever(retriever) // 检索增强生成
            .tools(new InterviewQuestionTool()) // 工具
            .toolProvider(mcpToolProvider) // mcp 工具
            .build();
    return aiService;
  }
}
