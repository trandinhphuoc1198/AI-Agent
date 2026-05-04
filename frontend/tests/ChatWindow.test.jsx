import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatWindow from "../src/components/ChatWindow";

const userMsg = { id: "1", type: "user", content: "Hello there" };
const aiMsg = { id: "2", type: "ai", content: "Hi! How can I help?", streaming: false };
const toolMsg = {
  id: "3",
  type: "tool",
  tool: "calculator",
  input: { expression: "1+1" },
  output: "2",
  pending: false,
};
const errMsg = { id: "4", type: "error", content: "Something exploded" };

describe("ChatWindow", () => {
  it("shows empty-state hint when there are no messages", () => {
    render(<ChatWindow messages={[]} isThinking={false} />);
    expect(
      screen.getByText(/Send a message to start chatting/i)
    ).toBeInTheDocument();
  });

  it("hides empty-state hint once messages are present", () => {
    render(<ChatWindow messages={[userMsg]} isThinking={false} />);
    expect(
      screen.queryByText(/Send a message to start chatting/i)
    ).not.toBeInTheDocument();
  });

  it("renders user message content", () => {
    render(<ChatWindow messages={[userMsg]} isThinking={false} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders AI message content", () => {
    render(<ChatWindow messages={[aiMsg]} isThinking={false} />);
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("renders markdown from AI messages", () => {
    render(
      <ChatWindow
        messages={[{ id: "5", type: "ai", content: "## Summary\n\n- Item" }]}
        isThinking={false}
      />
    );

    expect(screen.getByText("Summary", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText("Item", { selector: "li" })).toBeInTheDocument();
  });

  it("renders ToolCallCard for tool messages", () => {
    render(<ChatWindow messages={[toolMsg]} isThinking={false} />);
    expect(screen.getByText("calculator")).toBeInTheDocument();
  });

  it("renders error messages with 'Error:' prefix", () => {
    render(<ChatWindow messages={[errMsg]} isThinking={false} />);
    expect(screen.getByText(/Something exploded/i)).toBeInTheDocument();
  });

  it("shows 3 bouncing dots when isThinking=true", () => {
    const { container } = render(
      <ChatWindow messages={[]} isThinking={true} />
    );
    expect(container.querySelectorAll(".animate-bounce")).toHaveLength(3);
  });

  it("hides bouncing dots when isThinking=false", () => {
    const { container } = render(
      <ChatWindow messages={[]} isThinking={false} />
    );
    expect(container.querySelectorAll(".animate-bounce")).toHaveLength(0);
  });

  it("renders all message types in a mixed list", () => {
    render(
      <ChatWindow
        messages={[userMsg, aiMsg, toolMsg, errMsg]}
        isThinking={false}
      />
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
    expect(screen.getByText("calculator")).toBeInTheDocument();
    expect(screen.getByText(/Something exploded/i)).toBeInTheDocument();
  });
});
