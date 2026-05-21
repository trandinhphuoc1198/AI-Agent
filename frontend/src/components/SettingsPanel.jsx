import { useState, useEffect } from "react";

export default function SettingsPanel() {
  const [model, setModel] = useState("");
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
      .catch(() => setError("Failed to load settings"));
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
      setError("Failed to save settings");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settings
      </h2>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="space-y-1">
        <label className="text-xs text-gray-400" htmlFor="model-input">
          Model
        </label>
        <input
          id="model-input"
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

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
              onClick={() => setCmdMode(mode)}
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
