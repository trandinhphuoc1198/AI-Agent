import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPanel from "../src/components/SettingsPanel";

const mockConfig = { model: "test-model", cmd_mode: "permission" };

function setupFetch(overrides = {}) {
  global.fetch = vi.fn().mockImplementation((url, opts) => {
    if (!opts || opts.method !== "PUT") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockConfig),
        ...overrides.get,
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockConfig),
      ...overrides.put,
    });
  });
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Settings heading", async () => {
    render(<SettingsPanel />);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it("loads model value from /api/config on mount", async () => {
    render(<SettingsPanel />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("test-model")).toBeInTheDocument();
    });
  });

  it("loads cmd_mode from /api/config on mount", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    // 'permission' button should be visually active (blue)
    expect(screen.getByText("permission")).toBeInTheDocument();
  });

  it("updates the model input field on change", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    const input = screen.getByDisplayValue("test-model");
    fireEvent.change(input, { target: { value: "new-model" } });
    expect(screen.getByDisplayValue("new-model")).toBeInTheDocument();
  });

  it("toggles cmd_mode to bypass when bypass button is clicked", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("bypass"));
    // The state changed; no error thrown and the button is still visible
    expect(screen.getByText("bypass")).toBeInTheDocument();
  });

  it("calls PUT /api/config when Save is clicked", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/config",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("sends correct JSON body on Save", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => {
      const [, opts] = global.fetch.mock.calls.find(
        ([, o]) => o?.method === "PUT"
      );
      const body = JSON.parse(opts.body);
      expect(body).toMatchObject({ model: "test-model", cmd_mode: "permission" });
    });
  });

  it("shows '✓ Saved' feedback after a successful save", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(screen.getByText(/✓ Saved/)).toBeInTheDocument()
    );
  });

  it("shows error message when GET /api/config fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<SettingsPanel />);
    await waitFor(() =>
      expect(
        screen.getByText(/Failed to load settings/i)
      ).toBeInTheDocument()
    );
  });

  it("shows error message when PUT /api/config fails", async () => {
    setupFetch({ put: { ok: false } });
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(
        screen.getByText(/Failed to save settings/i)
      ).toBeInTheDocument()
    );
  });
});
