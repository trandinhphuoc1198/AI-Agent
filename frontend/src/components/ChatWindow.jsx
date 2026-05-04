import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import ToolCallCard from "./ToolCallCard";

export default function ChatWindow({ messages, isThinking }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Send a message to start chatting
        </div>
      )}

      {messages.map((msg) => {
        if (msg.type === "user" || msg.type === "ai") {
          return <MessageBubble key={msg.id} message={msg} />;
        }
        if (msg.type === "tool") {
          return <ToolCallCard key={msg.id} toolCall={msg} />;
        }
        if (msg.type === "error") {
          return (
            <div
              key={msg.id}
              className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2 border border-red-800"
            >
              Error: {msg.content}
            </div>
          );
        }
        return null;
      })}

      {isThinking && (
        <div className="flex gap-1 items-center pl-1">
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
