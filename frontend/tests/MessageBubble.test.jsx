import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageBubble from "../src/components/MessageBubble";

describe("MessageBubble", () => {
  it("renders user message content", () => {
    render(
      <MessageBubble message={{ id: "1", type: "user", content: "Hello!" }} />
    );
    expect(screen.getByText("Hello!")).toBeInTheDocument();
  });

  it("renders AI message content", () => {
    render(
      <MessageBubble
        message={{ id: "2", type: "ai", content: "Hi there!" }}
      />
    );
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("renders markdown formatting for AI messages", () => {
    render(
      <MessageBubble
        message={{
          id: "6",
          type: "ai",
          content: "This is **bold** and `inline code`\n\n- first item",
        }}
      />
    );

    expect(screen.getByText("bold", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("inline code", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByText("first item", { selector: "li" })).toBeInTheDocument();
  });

  it("aligns user message to the right", () => {
    const { container } = render(
      <MessageBubble message={{ id: "1", type: "user", content: "Hi" }} />
    );
    expect(container.firstChild).toHaveClass("justify-end");
  });

  it("aligns AI message to the left", () => {
    const { container } = render(
      <MessageBubble message={{ id: "2", type: "ai", content: "Hi" }} />
    );
    expect(container.firstChild).toHaveClass("justify-start");
  });

  it("shows streaming cursor when streaming=true", () => {
    const { container } = render(
      <MessageBubble
        message={{ id: "3", type: "ai", content: "Thinking…", streaming: true }}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("hides streaming cursor when streaming=false", () => {
    const { container } = render(
      <MessageBubble
        message={{ id: "4", type: "ai", content: "Done", streaming: false }}
      />
    );
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("hides streaming cursor when streaming is undefined", () => {
    const { container } = render(
      <MessageBubble message={{ id: "5", type: "ai", content: "Done" }} />
    );
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });
});
