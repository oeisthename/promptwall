import React from "react";
import * as Diff from "diff";

interface DiffViewerProps {
  original: string;
  sanitized: string;
}

export function DiffViewer({ original, sanitized }: DiffViewerProps) {
  // Compute word differences
  const diff = Diff.diffWordsWithSpace(original, sanitized);

  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {/* Original View */}
      <div className="rounded-md border border-white/10 bg-black/60 overflow-hidden">
        <div className="bg-white/5 border-b border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Original Prompt
        </div>
        <div className="p-4 whitespace-pre-wrap font-mono text-sm leading-relaxed text-white break-words">
          {diff.map((part, index) => {
            // In the original view, we show added stuff as missing (not rendered here) and removed stuff as highlighted red
            if (part.added) return null;
            return (
              <span
                key={index}
                className={part.removed ? "bg-red-500/20 text-red-300 rounded px-1" : ""}
              >
                {part.value}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sanitized View */}
      <div className="rounded-md border border-white/10 bg-black/60 overflow-hidden">
        <div className="bg-white/5 border-b border-white/10 px-3 py-2 text-xs font-semibold text-emerald-500/80 uppercase tracking-wider">
          Sanitized Prompt
        </div>
        <div className="p-4 whitespace-pre-wrap font-mono text-sm leading-relaxed text-white break-words">
          {diff.map((part, index) => {
            // In the sanitized view, we show removed stuff as missing and added stuff as highlighted green
            if (part.removed) return null;
            return (
              <span
                key={index}
                className={part.added ? "bg-emerald-500/20 text-emerald-300 font-bold rounded px-1" : ""}
              >
                {part.value}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
