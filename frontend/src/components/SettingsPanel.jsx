import { useState, useEffect } from "react";

export default function SettingsPanel() {
  const [model, setModel] = useState("");
  const [cmdMode, setCmdMode] = useState("permission");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setModel(data.model ?? "");
        setCmdMode(data.cmd_mode ?? "permission");
      })
      .catch(() => setError("Failed to load settings"));
  }, []);

  const handleSave = async () => {
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, cmd_mode: cmdMode }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setModel(data.model ?? model);
      setCmdMode(data.cmd_mode ?? cmdMode);
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
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
          {["permission", "bypass"].map((mode) => (
            <button
              key={mode}
              className={`flex-1 py-1.5 capitalize transition-colors ${
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

      <button
        className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors"
        onClick={handleSave}
      >
        {saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}
