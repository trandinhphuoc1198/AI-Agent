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
    expect(screen.getByText("permission")).toBeInTheDocument();
  });

  it("updates the model input field on change", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    const input = screen.getByDisplayValue("test-model");
    fireEvent.change(input, { target: { value: "new-model" } });
    expect(screen.getByDisplayValue("new-model")).toBeInTheDocument();
  });

  it("auto-saves model on blur when value changed", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    const input = screen.getByDisplayValue("test-model");
    fireEvent.change(input, { target: { value: "my-new-model" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/config",
        expect.objectContaining({ method: "PUT" })
      );
      const putCall = global.fetch.mock.calls.find(([, o]) => o?.method === "PUT");
      const body = JSON.parse(putCall[1].body);
      expect(body).toMatchObject({ model: "my-new-model" });
    });
  });

  it("does not save on blur if value is unchanged", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    const input = screen.getByDisplayValue("test-model");
    fireEvent.blur(input);
    // Only the initial GET should have been called, no PUT
    const putCalls = global.fetch.mock.calls.filter(([, o]) => o?.method === "PUT");
    expect(putCalls).toHaveLength(0);
  });

  it("auto-saves model on Enter key", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    const input = screen.getByDisplayValue("test-model");
    fireEvent.change(input, { target: { value: "enter-model" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      const putCall = global.fetch.mock.calls.find(([, o]) => o?.method === "PUT");
      expect(putCall).toBeTruthy();
    });
  });

  it("auto-saves cmd_mode when bypass button is clicked", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("bypass"));
    await waitFor(() => {
      const putCall = global.fetch.mock.calls.find(([, o]) => o?.method === "PUT");
      const body = JSON.parse(putCall[1].body);
      expect(body).toMatchObject({ cmd_mode: "bypass" });
    });
  });

  it("shows '✓ applied' feedback after a successful save", async () => {
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("bypass"));
    await waitFor(() =>
      expect(screen.getByText(/✓ applied/i)).toBeInTheDocument()
    );
  });

  it("shows 'failed' status when GET /api/config fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<SettingsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    );
  });

  it("shows 'failed' status when PUT /api/config fails", async () => {
    setupFetch({ put: { ok: false } });
    render(<SettingsPanel />);
    await waitFor(() => screen.getByDisplayValue("test-model"));
    fireEvent.click(screen.getByText("bypass"));
    await waitFor(() =>
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    );
  });
});
