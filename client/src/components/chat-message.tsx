import { marked } from "marked";
import { useMemo } from "react";

interface IProps {
  content: string;
  role: "ai" | "user";
  timestamp: number;
}

export default function ChatMessage(props: IProps) {
  const { content, role, timestamp } = props;

  const renderedMessage = useMemo(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    return marked(content);
  }, [content]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="from-primary-500 to-primary-600 shadow-apple rounded-2xl rounded-tr-md bg-gradient-to-br px-4 py-3 text-white">
            <pre className="m-0 font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </pre>
          </div>
          <span className="mt-1.5 mr-1 text-xs text-gray-400">
            {formatTime(timestamp)}
          </span>
        </div>
        <div className="from-primary-200 to-primary-300 shadow-apple flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br">
          <svg
            className="text-primary-700 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
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
      <div className="flex max-w-[80%] flex-col">
        <div className="shadow-apple rounded-2xl rounded-tl-md border border-gray-200 bg-white p-4">
          <div
            className="markdown-content text-sm text-gray-600"
            dangerouslySetInnerHTML={{ __html: renderedMessage }}
          />
        </div>
        <span className="mt-1.5 ml-1 text-xs text-gray-400">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}
