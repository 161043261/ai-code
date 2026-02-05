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
      handleAiClose,
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
    <div className="from-primary-50 min-h-screen bg-gradient-to-b to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="from-primary-400 to-primary-600 shadow-apple flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-700">编程专家</h1>
              <p className="text-xs text-gray-400">AI 智能编程助手</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 pb-36">
        {/* Welcome Section */}
        {messages.length === 0 && (
          <div className="py-12">
            <div className="mb-10 text-center">
              <div className="from-primary-300 to-primary-500 shadow-apple-lg mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br">
                <svg
                  className="h-10 w-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-gray-700">
                你好，我是编程专家
              </h2>
              <p className="text-gray-400">
                你可以叫我神人，我可以帮你解决编程问题
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="group hover:border-primary-300 hover:shadow-apple cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300">
                <div className="bg-primary-100 text-primary-600 group-hover:bg-primary-500 mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors group-hover:text-white">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 font-medium text-gray-700">学习路线</h3>
                <p className="text-sm text-gray-400">
                  为你规划专属的编程学习路线
                </p>
              </div>

              <div className="group hover:border-primary-300 hover:shadow-apple cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300">
                <div className="bg-primary-100 text-primary-600 group-hover:bg-primary-500 mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors group-hover:text-white">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 font-medium text-gray-700">学习建议</h3>
                <p className="text-sm text-gray-400">
                  提供针对性的编程学习建议
                </p>
              </div>

              <div className="group hover:border-primary-300 hover:shadow-apple cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300">
                <div className="bg-primary-100 text-primary-600 group-hover:bg-primary-500 mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors group-hover:text-white">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 font-medium text-gray-700">面试题</h3>
                <p className="text-sm text-gray-400">分享高频编程面试题解析</p>
              </div>
            </div>

            {/* Prompt */}
            <div className="mt-10 text-center">
              <p className="text-sm text-gray-400">
                请在下方输入你的问题，开始对话 ↓
              </p>
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div ref={containerRef} className="space-y-4 py-6">
          {messages.map((message) => (
            <ChatMessage
              key={message.timestamp}
              content={message.content}
              role={message.role}
              timestamp={message.timestamp}
            />
          ))}

          {/* AI Thinking */}
          {isAiThinking && (
            <div className="flex gap-3">
              <div className="from-primary-400 to-primary-600 shadow-apple flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="shadow-apple mb-2 inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2">
                  <div className="flex gap-1">
                    <span
                      className="bg-primary-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="bg-primary-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="bg-primary-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                  <span className="text-sm text-gray-400">AI 正在思考...</span>
                </div>
                {aiResponse && (
                  <div className="shadow-apple rounded-2xl border border-gray-200 bg-white p-4">
                    <div
                      className="markdown-content text-gray-600"
                      dangerouslySetInnerHTML={{ __html: aiResponseRendered }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Fixed Input Area */}
      <div className="fixed right-0 bottom-0 left-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6">
        <div className="mx-auto max-w-3xl px-6">
          <ChatInput
            disabled={isAiThinking}
            placeholder="请输入你的编程问题..."
            sendMessage={sendMessage}
          />

          {/* Error Toast */}
          {connError && (
            <div className="shadow-apple absolute bottom-full left-1/2 mb-4 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              服务器连接错误，请稍后重试
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
