import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

interface IProps {
  disabled: boolean;
  sendMessage: (message: string) => void;
  placeholder?: string;
}

export default function ChatInput(props: IProps) {
  const { disabled, placeholder = "请输入你的编程问题", sendMessage } = props;
  const [inputMessage, setInputMessage] = useState<string>("");

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && !disabled) {
      sendMessage(inputMessage.trim());
      setInputMessage("");
      adjustHeight();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 正常输入也会触发 keydown 事件
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto"
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    });
  };

  useEffect(() => {
    adjustHeight();
  }, [])

  return (
    <>
      <textarea
        ref={textareaRef}
        value={inputMessage}
        onChange={handleInput}
        disabled={disabled}
        rows={1}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <button
        disabled={disabled || !inputMessage.trim()}
        onClick={handleSendMessage}
      >
        Send
      </button>
    </>
  );
}
