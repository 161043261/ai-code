import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { chatWithSse } from "./api";
import ChatMessage from "./components/chat-message";
import ChatInput from "./components/chat-input";

interface IMessage {
  content: string;
  role: "ai" | "user";
  timestamp: number;
}

function App() {
  const memoryId = useRef<number>(0);
  const eventSource = useRef<EventSource | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>("");

  const aiResponseRef = useRef<string>("");

  const [connError, setConnError] = useState<boolean>(false);

  useEffect(() => {
    memoryId.current = Date.now();
    return () => {
      if (eventSource.current) {
        eventSource.current.close();
      }
    };
  }, []);

  const aiResponseRendered = useMemo(() => {
    if (!aiResponse) {
      return "";
    }
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    return marked(aiResponse);
  }, [aiResponse]);

  const sendMessage = (userMessage: string) => {
    addMessage(userMessage, "user");
    startAiResponse(userMessage);
  };

  const addMessage = (content: string, role: "ai" | "user") => {
    const message: IMessage = {
      content,
      role,
      // eslint-disable-next-line react-hooks/purity
      timestamp: Date.now(),
    };
    setMessages((messages) => [...messages, message]);
    scrollToBottom();
  };

  const startAiResponse = (userMessage: string) => {
    setIsAiThinking(true);
    setAiResponse("");
    setConnError(false);
    if (eventSource.current) {
      eventSource.current.close();
    }
    eventSource.current = chatWithSse(
      memoryId.current,
      userMessage,
      handleAiMessage,
      handleAiError,
      handleAiClose
    );
  };

  const handleAiMessage = (chunk: string) => {
    setAiResponse((resp) => {
      const newResp = resp + chunk;
      aiResponseRef.current = newResp;
      return newResp;
    });
    scrollToBottom();
  };

  const handleAiError = (err: unknown) => {
    console.error(err);
    setConnError(true);
    handleAiClose();
    setTimeout(() => {
      setConnError(false);
    }, 5000);
  };

  const handleAiClose = () => {
    const finalAiResp = aiResponseRef.current;
    if (finalAiResp.trim()) {
      addMessage(finalAiResp.trim(), "ai");
    }
    setIsAiThinking(false);
    setAiResponse("");
    aiResponseRef.current = "";
    setConnError(false);
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  };

  return (
    <>
      <div>我是编程专家, 你可以叫我神人</div>
      <div>我可以解决编程问题, 重点关注 3 个方向</div>
      <ul>
        <li>规划编程学习路线</li>
        <li>提供编程学习建议</li>
        <li>分享高频面试题</li>
      </ul>
      <div ref={containerRef}>
        {messages.length === 0 && <div>请提出你的问题</div>}

        {messages.map((message) => (
          <ChatMessage
            key={message.timestamp}
            content={message.content}
            role={message.role}
            timestamp={message.timestamp}
          />
        ))}

        {isAiThinking && (
          <>
            <div>AI 正在思考...</div>
            <div
              dangerouslySetInnerHTML={{
                __html: aiResponseRendered,
              }}
            />
          </>
        )}

        <ChatInput
          disabled={isAiThinking}
          placeholder="请输入你的编程问题"
          sendMessage={sendMessage}
        />

        {connError && <div>服务器错误</div>}
      </div>
    </>
  );
}

export default App;
