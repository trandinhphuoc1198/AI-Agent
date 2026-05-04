import { useState, useEffect, useRef, useCallback } from "react";
import { AgentSocket } from "./api";
import ChatWindow from "./components/ChatWindow";
import SettingsPanel from "./components/SettingsPanel";
import PermissionModal from "./components/PermissionModal";

let _msgCounter = 0;
const nextId = () => String(++_msgCounter);

function makeSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [pendingPermission, setPendingPermission] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const sessionId = useRef(makeSessionId()).current;
  // Holds the id of the currently-streaming AI message
  const streamingIdRef = useRef(null);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateToolCallOutput = useCallback((tool, output) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].type === "tool" && next[i].tool === tool && next[i].pending) {
          next[i] = { ...next[i], output, pending: false };
          break;
        }
      }
      return next;
    });
  }, []);

  const closeStreamingMessage = useCallback(() => {
    if (!streamingIdRef.current) return;
    const id = streamingIdRef.current;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, streaming: false } : m))
    );
    streamingIdRef.current = null;
  }, []);

  useEffect(() => {
    const socket = new AgentSocket(sessionId, {
      onConnected: () => setConnected(true),

      onToken: (content) => {
        setMessages((prev) => {
          if (streamingIdRef.current) {
            return prev.map((m) =>
              m.id === streamingIdRef.current
                ? { ...m, content: m.content + content }
                : m
            );
          }
          // First token of a new AI turn — create the message
          const id = nextId();
          streamingIdRef.current = id;
          return [...prev, { id, type: "ai", content, streaming: true }];
        });
      },

      onToolStart: (tool, input) => {
        closeStreamingMessage();
        appendMessage({
          id: nextId(),
          type: "tool",
          tool,
          input,
          output: null,
          pending: true,
        });
      },

      onToolEnd: (tool, output) => {
        updateToolCallOutput(tool, output);
      },

      onPermissionRequest: (command) => {
        setPendingPermission({ command });
      },

      onDone: () => {
        closeStreamingMessage();
        setIsThinking(false);
      },

      onError: (content) => {
        closeStreamingMessage();
        appendMessage({ id: nextId(), type: "error", content });
        setIsThinking(false);
      },

      onDisconnect: () => setConnected(false),
    });

    socketRef.current = socket;
    socket.connect();
    return () => socket.disconnect();
  }, [sessionId, appendMessage, updateToolCallOutput, closeStreamingMessage]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    appendMessage({ id: nextId(), type: "user", content: text });
    setInput("");
    setIsThinking(true);
    streamingIdRef.current = null;
    socketRef.current?.sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePermission = (approved) => {
    setPendingPermission(null);
    socketRef.current?.sendPermissionResponse(approved);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold">AI Agent</h1>
          <p
            className={`text-xs mt-1 ${
              connected ? "text-green-400" : "text-gray-500"
            }`}
          >
            {connected ? "● Connected" : "○ Disconnected"}
          </p>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <SettingsPanel />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="px-4 py-3 border-b border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-500">
            Session: {sessionId.slice(0, 8)}…
          </span>
        </header>

        <ChatWindow messages={messages} isThinking={isThinking} />

        {/* Input area */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
              rows={3}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
            />
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors self-end"
              onClick={handleSend}
              disabled={isThinking || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Permission modal */}
      {pendingPermission && (
        <PermissionModal
          command={pendingPermission.command}
          onApprove={() => handlePermission(true)}
          onDeny={() => handlePermission(false)}
        />
      )}
    </div>
  );
}
