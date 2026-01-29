package com.github.tianchenghang.ai;

import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class AiCodeServiceTest {

  @Resource private IAiCodeService aiCodeService;

  @Test
  void chat() {
    var res = aiCodeService.chat("你好, 我是一名前端程序员");
    System.out.println(res);
  }

  @Test
  void chatWithMemory() {
    var res = aiCodeService.chat("你好, 我是一名前端程序员");
    System.out.println(res);
    var res2 = aiCodeService.chat("你好, 我是谁?");
    System.out.println(res2);
  }

  @Test
  void chatWithReport() {
    var message = "你好, 我是一名前端程序员, 我想学习 Node.js 后端, 请制定学习计划";
    var report = aiCodeService.charForReport(message);
    System.out.println(report);
  }

  @Test
  void chatWithRag() {

  }

  @Test
  void chatWithTools() {

  }

  @Test
  void chatWithMcp() {

  }

  @Test
  void chatWithGuardrail() {

  }
}
