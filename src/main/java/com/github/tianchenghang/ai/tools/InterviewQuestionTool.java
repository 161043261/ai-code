package com.github.tianchenghang.ai.tools;

import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

@Slf4j
public class InterviewQuestionTool {
  @Tool(
      name = "InterviewQuestionTool",
      value =
          """
      Retrieves relevant interview questions from mianshiya.com based on a keyword.
      Use this tool when the user asks for interview questions about computer network.
      The input should be a clear search keyword.
      """)
  public String searchInterviewQuestions(@P(value = "the keyword to search") String keyword) {
    var questions = new ArrayList<String>();
    var encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
    var url = "https://mianshiya.com/search/all?searchText=" + encodedKeyword;
    log.info(
        "Retrieves relevant interview questions from mianshiya.com based on keyword: {}", keyword);
    Document doc;
    try {
      doc = Jsoup.connect(url).userAgent("Mozilla/5.0").timeout(5000).get();
    } catch (IOException err) {
      log.error("Error connecting to mianshiya.com", err);
      return err.getMessage();
    }
    var elems = doc.select(".ant-table-cell > a");
    elems.forEach(el -> questions.add(el.text().trim()));
    return String.join("\n", questions);
  }
}
