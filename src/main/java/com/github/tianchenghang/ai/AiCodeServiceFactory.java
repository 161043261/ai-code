package com.github.tianchenghang.ai;

import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.service.AiServices;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiCodeServiceFactory {
  @Resource
  private ChatModel chatModel;

  @Bean
  public IAiCodeService aiCodeService() {
    var chatMemory = MessageWindowChatMemory.withMaxMessages(10);
//    var aiService = AiServices.create(IAiCodeService.class, chatModel);
    var aiService = AiServices.builder(IAiCodeService.class)
      .chatModel(chatModel)
      .chatMemory(chatMemory)
      .build();
    return aiService;
  }
}
