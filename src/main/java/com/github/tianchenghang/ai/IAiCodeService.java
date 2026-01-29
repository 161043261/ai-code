package com.github.tianchenghang.ai;

import com.github.tianchenghang.ai.guardrail.SafeInputGuardrail;
import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.guardrail.InputGuardrails;
import java.util.List;

// @AiService
@InputGuardrails({SafeInputGuardrail.class})
public interface IAiCodeService {
  //  @SystemMessage("你好, 我是编程专家, 你可以叫我神人, 你有什么问题吗?")
  @SystemMessage(fromResource = "system-prompt.txt")
  String chat(String useMessage);

  record Report(String name, List<String> suggestionList) {}

  @SystemMessage(fromResource = "system-prompt.txt")
  Report charForReport(String userMessage);

  @SystemMessage(fromResource = "system-prompt.txt")
  Result<String> chatWithRag(String userMessage);
}
