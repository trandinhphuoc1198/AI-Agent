import { useState, useEffect } from "react";

async function applyConfig(patch) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

export default function SettingsPanel() {
  const [model, setModel] = useState("");
  const [committed, setCommitted] = useState(""); // last saved value
  const [cmdMode, setCmdMode] = useState("permission");
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | "error"

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setModel(data.model ?? "");
        setCommitted(data.model ?? "");
        setCmdMode(data.cmd_mode ?? "permission");
      })
      .catch(() => setStatus("error"));
  }, []);

  const save = async (patch) => {
    setStatus("saving");
    try {
      const data = await applyConfig(patch);
      if (patch.model !== undefined) {
        setModel(data.model ?? patch.model);
        setCommitted(data.model ?? patch.model);
      }
      if (patch.cmd_mode !== undefined) setCmdMode(data.cmd_mode ?? patch.cmd_mode);
      setStatus("saved");
      setTimeout(() => setStatus(null), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleModelBlur = () => {
    const trimmed = model.trim();
    if (trimmed && trimmed !== committed) save({ model: trimmed });
  };

  const handleModelKeyDown = (e) => {
    if (e.key === "Enter") {
      const trimmed = model.trim();
      if (trimmed && trimmed !== committed) save({ model: trimmed });
      e.target.blur();
    }
  };

  const handleCmdModeChange = (mode) => {
    setCmdMode(mode);
    save({ cmd_mode: mode });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settings
      </h2>

      {/* Model input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400" htmlFor="model-input">
            Model
          </label>
          {status === "saving" && (
            <span className="text-xs text-gray-500">saving…</span>
          )}
          {status === "saved" && (
            <span className="text-xs text-green-400">✓ applied</span>
          )}
          {status === "error" && (
            <span className="text-xs text-red-400">failed</span>
          )}
        </div>
        <input
          id="model-input"
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 placeholder-gray-600"
          placeholder="provider/model-name"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={handleModelBlur}
          onKeyDown={handleModelKeyDown}
        />
        <p className="text-xs text-gray-600">Takes effect on the next message</p>
      </div>

      {/* Command mode toggle */}
      <div className="space-y-1">
        <p className="text-xs text-gray-400">Command Mode</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
          {["permission", "bypass"].map((mode) => (
            <button
              key={mode}
              className={`flex-1 py-1.5 capitalize transition-colors ${
                cmdMode === mode
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              onClick={() => handleCmdModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
