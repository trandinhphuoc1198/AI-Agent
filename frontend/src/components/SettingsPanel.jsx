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
  const [allTools, setAllTools] = useState([]);
  const [enabledTools, setEnabledTools] = useState(new Set());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/tools").then((r) => r.json()),
    ])
      .then(([config, tools]) => {
        setModel(config.model ?? "");
        setCmdMode(config.cmd_mode ?? "permission");
        setAllTools(tools);
        setEnabledTools(new Set(tools.filter((t) => t.enabled).map((t) => t.name)));
      })
      .catch(() => setStatus("error"));
  }, []);

  const toggleTool = (name) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, cmd_mode: cmdMode, enabled_tools: [...enabledTools] }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setModel(data.model ?? model);
      setCmdMode(data.cmd_mode ?? cmdMode);
      if (data.enabled_tools) setEnabledTools(new Set(data.enabled_tools));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
        <div className="flex rounded-lg overflow-hidden border border-gray-700 divide-x divide-gray-700 text-xs">
          {["permission", "bypass"].map((mode) => (
            <button
              key={mode}
              className={`flex-1 py-1.5 text-center capitalize transition-colors ${
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

      {allTools.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Tools</p>
          <div className="space-y-1.5">
            {allTools.map(({ name }) => {
              const isEnabled = enabledTools.has(name);
              return (
                <div key={name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 font-mono truncate">{name}</span>
                  <button
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => toggleTool(name)}
                    className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${
                      isEnabled ? "bg-blue-600" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors"
        onClick={handleSave}
      >
        {saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}
