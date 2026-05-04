import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentSocket } from "../src/api";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

const OPEN = 1;
const CLOSED = 3;

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = OPEN;
    this.sent = [];
    MockWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = CLOSED;
    this.onclose?.();
  }
}
MockWebSocket.instances = [];
MockWebSocket.OPEN = OPEN;

describe("AgentSocket", () => {
  let origWebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    origWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
    // jsdom does not expose window.location.protocol/host reliably; patch it
    Object.defineProperty(window, "location", {
      value: { protocol: "http:", host: "localhost:5173" },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    global.WebSocket = origWebSocket;
  });

  it("connects to the correct WebSocket URL", () => {
    const socket = new AgentSocket("abc-123", {});
    socket.connect();
    expect(MockWebSocket.instances[0].url).toBe(
      "ws://localhost:5173/ws/abc-123"
    );
  });

  it("uses wss:// when page protocol is https:", () => {
    window.location = { protocol: "https:", host: "example.com" };
    const socket = new AgentSocket("s1", {});
    socket.connect();
    expect(MockWebSocket.instances[0].url).toBe("wss://example.com/ws/s1");
  });

  it("sendMessage sends JSON with type 'message'", () => {
    const socket = new AgentSocket("s1", {});
    socket.connect();
    socket.sendMessage("hello");
    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: "message",
      content: "hello",
    });
  });

  it("sendPermissionResponse sends approved=true", () => {
    const socket = new AgentSocket("s1", {});
    socket.connect();
    socket.sendPermissionResponse(true);
    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: "permission_response",
      approved: true,
    });
  });

  it("sendPermissionResponse sends approved=false", () => {
    const socket = new AgentSocket("s1", {});
    socket.connect();
    socket.sendPermissionResponse(false);
    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: "permission_response",
      approved: false,
    });
  });

  it("does NOT send if WebSocket is not OPEN", () => {
    const socket = new AgentSocket("s1", {});
    socket.connect();
    MockWebSocket.instances[0].readyState = CLOSED;
    socket.sendMessage("silent");
    expect(MockWebSocket.instances[0].sent).toHaveLength(0);
  });

  it("calls onConnected when type='connected'", () => {
    const onConnected = vi.fn();
    const socket = new AgentSocket("s1", { onConnected });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "connected" }),
    });
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it("calls onToken with content", () => {
    const onToken = vi.fn();
    const socket = new AgentSocket("s1", { onToken });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "token", content: "Hello " }),
    });
    expect(onToken).toHaveBeenCalledWith("Hello ");
  });

  it("calls onToolStart with tool and input", () => {
    const onToolStart = vi.fn();
    const socket = new AgentSocket("s1", { onToolStart });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({
        type: "tool_start",
        tool: "calculator",
        input: { expression: "2+2" },
      }),
    });
    expect(onToolStart).toHaveBeenCalledWith("calculator", {
      expression: "2+2",
    });
  });

  it("calls onToolEnd with tool and output", () => {
    const onToolEnd = vi.fn();
    const socket = new AgentSocket("s1", { onToolEnd });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "tool_end", tool: "calculator", output: "4" }),
    });
    expect(onToolEnd).toHaveBeenCalledWith("calculator", "4");
  });

  it("calls onPermissionRequest with command", () => {
    const onPermissionRequest = vi.fn();
    const socket = new AgentSocket("s1", { onPermissionRequest });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "permission_request", command: "ls -la" }),
    });
    expect(onPermissionRequest).toHaveBeenCalledWith("ls -la");
  });

  it("calls onDone when type='done'", () => {
    const onDone = vi.fn();
    const socket = new AgentSocket("s1", { onDone });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "done" }),
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("calls onError when type='error'", () => {
    const onError = vi.fn();
    const socket = new AgentSocket("s1", { onError });
    socket.connect();
    MockWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: "error", content: "Something went wrong" }),
    });
    expect(onError).toHaveBeenCalledWith("Something went wrong");
  });

  it("calls onDisconnect on ws close", () => {
    const onDisconnect = vi.fn();
    const socket = new AgentSocket("s1", { onDisconnect });
    socket.connect();
    MockWebSocket.instances[0].onclose();
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("calls onError on ws error", () => {
    const onError = vi.fn();
    const socket = new AgentSocket("s1", { onError });
    socket.connect();
    MockWebSocket.instances[0].onerror({});
    expect(onError).toHaveBeenCalledWith("WebSocket connection error");
  });

  it("disconnect closes the socket and nulls ws", () => {
    const socket = new AgentSocket("s1", {});
    socket.connect();
    socket.disconnect();
    expect(socket.ws).toBeNull();
  });

  it("silently ignores invalid JSON messages", () => {
    const onToken = vi.fn();
    const socket = new AgentSocket("s1", { onToken });
    socket.connect();
    // Should not throw
    expect(() => {
      MockWebSocket.instances[0].onmessage({ data: "not-json" });
    }).not.toThrow();
    expect(onToken).not.toHaveBeenCalled();
  });
});
