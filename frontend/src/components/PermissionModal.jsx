export default function PermissionModal({ command, onApprove, onDeny }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-title"
    >
      <div className="bg-gray-900 border border-yellow-600 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 space-y-4">
        <h2 id="perm-title" className="text-lg font-semibold text-yellow-400">
          Shell Permission Required
        </h2>
        <p className="text-sm text-gray-300">
          The AI agent wants to run the following command:
        </p>
        <pre className="bg-gray-950 rounded-lg px-4 py-3 text-sm text-orange-300 font-mono overflow-x-auto">
          {command}
        </pre>
        <p className="text-xs text-gray-500">
          Only approve commands you trust. Denied commands will not be executed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
            onClick={onDeny}
          >
            Deny
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-medium transition-colors"
            onClick={onApprove}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
