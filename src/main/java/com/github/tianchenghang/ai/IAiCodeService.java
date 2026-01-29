package com.github.tianchenghang.ai;


import dev.langchain4j.service.SystemMessage;

import java.util.List;

public interface IAiCodeService {
//  @SystemMessage("你好, 我是编程专家, 你可以叫我神人, 你有什么问题吗?")
  @SystemMessage(fromResource =  "system-prompt.txt")
  String chat(String useMessage);

  @SystemMessage(fromResource = "suggestion-prompt.txt")
  Report charForReport(String userMessage);

  record  Report(String name, List<String> suggestionList) {}
}
