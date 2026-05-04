/**
 * Placeholder test — ensures Vitest + jsdom + @testing-library/jest-dom
 * are wired up correctly before component tests are added in Phase 5.
 */
import { describe, it, expect } from "vitest";

describe("Frontend test infrastructure", () => {
  it("vitest is running", () => {
    expect(true).toBe(true);
  });

  it("jsdom environment is available", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });

  it("jest-dom matchers are available", () => {
    const el = document.createElement("div");
    el.textContent = "hello";
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    document.body.removeChild(el);
  });
});
