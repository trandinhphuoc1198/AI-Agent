import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageBubble({ message }) {
  const isUser = message.type === "user";
  const content = message.content ?? "";

  const linkRenderer = ({ href, children, ...props }) => {
    const isAnchorLink = href?.startsWith("#");

    return (
      <a
        {...props}
        href={href}
        target={isAnchorLink ? undefined : "_blank"}
        rel={isAnchorLink ? undefined : "noreferrer"}
      >
        {children}
      </a>
    );
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-800 text-gray-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: linkRenderer }}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        {message.streaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
