import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToolCallCard from "../src/components/ToolCallCard";

const baseTool = {
  id: "1",
  type: "tool",
  tool: "calculator",
  input: { expression: "2+2" },
  output: null,
  pending: true,
};

describe("ToolCallCard", () => {
  it("renders the tool name", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    expect(screen.getByText("calculator")).toBeInTheDocument();
  });

  it("shows 'running…' indicator while pending", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it("does not show 'done' while pending", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    expect(screen.queryByText("done")).not.toBeInTheDocument();
  });

  it("shows 'done' when output is present and not pending", () => {
    render(
      <ToolCallCard toolCall={{ ...baseTool, output: "4", pending: false }} />
    );
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("is collapsed by default (no Input label)", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    expect(screen.queryByText("Input")).not.toBeInTheDocument();
  });

  it("expands to show input JSON when clicked", () => {
    render(
      <ToolCallCard toolCall={{ ...baseTool, output: "4", pending: false }} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Input")).toBeInTheDocument();
  });

  it("shows output when expanded and output is present", () => {
    render(
      <ToolCallCard toolCall={{ ...baseTool, output: "4", pending: false }} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("does not show Output section when output is null", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Output")).not.toBeInTheDocument();
  });

  it("collapses when clicked a second time", () => {
    render(
      <ToolCallCard toolCall={{ ...baseTool, output: "4", pending: false }} />
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.getByText("Input")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("Input")).not.toBeInTheDocument();
  });

  it("renders aria-expanded attribute on the button", () => {
    render(<ToolCallCard toolCall={baseTool} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});
