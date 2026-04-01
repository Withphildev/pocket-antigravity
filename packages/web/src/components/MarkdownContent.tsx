import { memo, useState, useMemo } from "react";
import { IconCopy, IconCheck } from "./Icons";

/**
 * Split an HTML string into alternating segments of "non-pre" and "pre" blocks.
 * Returns an array of { type: 'html' | 'pre', content: string }.
 */
interface Segment {
  type: "html" | "pre";
  content: string; // for html: raw html string; for pre: code text
  rawHtml: string; // original html for re-rendering
}

function splitPreBlocks(html: string): Segment[] {
  const segments: Segment[] = [];
  // Match <pre> blocks (possibly containing <code>)
  const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = preRegex.exec(html)) !== null) {
    // Add preceding non-pre html
    if (match.index > lastIndex) {
      const htmlBefore = html.slice(lastIndex, match.index);
      if (htmlBefore.trim()) {
        segments.push({
          type: "html",
          content: htmlBefore,
          rawHtml: htmlBefore,
        });
      }
    }

    // Extract text content from the <pre> block (strip HTML tags for copy)
    const innerHtml = match[1];
    const textContent = innerHtml.replace(/<[^>]*>/g, "");
    segments.push({
      type: "pre",
      content: textContent,
      rawHtml: match[0],
    });
    lastIndex = match.index + match[0].length;
  }

  // Add trailing html
  if (lastIndex < html.length) {
    const trailing = html.slice(lastIndex);
    if (trailing.trim()) {
      segments.push({ type: "html", content: trailing, rawHtml: trailing });
    }
  }

  return segments;
}

/** Copy button for code blocks */
function CodeCopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="code-copy-btn"
      title="Copy code"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
    </button>
  );
}

interface MarkdownContentProps {
  html: string;
  /** If true, skip copy buttons on pre blocks (e.g. inside step cards) */
  skipCopyButtons?: boolean;
}

/**
 * Renders markdown HTML with React-managed copy buttons on code blocks.
 * Replaces the old DOM injection approach.
 */
export const MarkdownContent = memo(function MarkdownContent({
  html,
  skipCopyButtons = false,
}: MarkdownContentProps) {
  const segments = useMemo(() => splitPreBlocks(html), [html]);

  // Fast path: no <pre> blocks, just render as-is
  if (segments.length <= 1 && segments[0]?.type === "html") {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.type === "html") {
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: seg.content }} />
          );
        }
        // Pre block: render with copy button
        return (
          <div key={i} style={{ position: "relative" }}>
            <pre
              dangerouslySetInnerHTML={{
                __html: seg.rawHtml.replace(/^<pre[^>]*>|<\/pre>$/gi, ""),
              }}
            />
            {!skipCopyButtons && <CodeCopyBtn text={seg.content} />}
          </div>
        );
      })}
    </div>
  );
});
