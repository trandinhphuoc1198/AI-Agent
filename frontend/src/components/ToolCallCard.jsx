import { useState } from "react";

export default function ToolCallCard({ toolCall }) {
  const [expanded, setExpanded] = useState(false);

  const inputStr = JSON.stringify(toolCall.input, null, 2);
  const outputStr = toolCall.output != null ? String(toolCall.output) : null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden text-xs font-mono bg-gray-900">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="text-purple-400">⚙</span>
        <span className="text-purple-300 font-semibold">{toolCall.tool}</span>
        {toolCall.pending && (
          <span className="ml-2 text-yellow-400 animate-pulse">running…</span>
        )}
        {!toolCall.pending && outputStr != null && (
          <span className="ml-2 text-green-400">done</span>
        )}
        <span className="ml-auto text-gray-500">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-2">
          <div>
            <p className="text-gray-500 uppercase tracking-wider mb-1">Input</p>
            <pre className="bg-gray-950 rounded p-2 text-green-300 overflow-x-auto whitespace-pre-wrap">
              {inputStr}
            </pre>
          </div>
          {outputStr != null && (
            <div>
              <p className="text-gray-500 uppercase tracking-wider mb-1">Output</p>
              <pre className="bg-gray-950 rounded p-2 text-blue-300 overflow-x-auto whitespace-pre-wrap">
                {outputStr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
