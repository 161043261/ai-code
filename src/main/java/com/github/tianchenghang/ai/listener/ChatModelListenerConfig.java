package com.github.tianchenghang.ai.listener;

import static org.slf4j.LoggerFactory.getLogger;

import dev.langchain4j.model.chat.listener.ChatModelErrorContext;
import dev.langchain4j.model.chat.listener.ChatModelListener;
import dev.langchain4j.model.chat.listener.ChatModelRequestContext;
import dev.langchain4j.model.chat.listener.ChatModelResponseContext;
import org.slf4j.Logger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatModelListenerConfig {

  private static final Logger log = getLogger(ChatModelListenerConfig.class);

  @Bean
  ChatModelListener chatModelListener() {
    return new ChatModelListener() {
      @Override
      public void onRequest(ChatModelRequestContext requestContext) {
        log.info("onRequest(): {}", requestContext.chatRequest());
      }

      @Override
      public void onResponse(ChatModelResponseContext responseContext) {
        log.info("onResponse(): {}", responseContext.chatResponse());
      }

      @Override
      public void onError(ChatModelErrorContext errorContext) {
        log.info("onError(): {}", errorContext.error().getMessage());
      }
    };
  }
}
