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

  return (
    <>
      <div>{role}</div>
      <div>
        <div>
          {role === "user" && <pre>{content}</pre>}
          {role === "ai" && (
            <div dangerouslySetInnerHTML={{ __html: renderedMessage }} />
          )}
        </div>
        <div>{new Date(timestamp).toLocaleDateString()}</div>
      </div>
    </>
  );
}
