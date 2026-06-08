"use client";

import { useEffect, useRef } from "react";

export interface DraftOrderEntry {
  userId: string;
  name: string;
  real?: string | null;
  colorIndex: number;
}

export function DraftOrderStrip({
  participants,
  activeUserId,
  currentUserId,
}: {
  participants: DraftOrderEntry[];
  activeUserId: string | null;
  currentUserId: string;
}) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeUserId]);

  return (
    <div className="order-strip">
      {participants.map((p, idx) => {
        const isActive = p.userId === activeUserId;
        const isMe = p.userId === currentUserId;
        return (
          <div
            key={p.userId}
            ref={isActive ? activeRef : null}
            className={`order-chip m${p.colorIndex % 8}${isActive ? " on" : ""}${isMe ? " me" : ""}`}
          >
            <span className="chip-dot" />
            <span className="chip-num">{idx + 1}</span>
            <span className="chip-name">
              {p.name}
              {p.real && !isActive && (
                <span className="chip-real">{p.real}</span>
              )}
              {isMe && <span className="chip-real">you</span>}
            </span>
            {isActive && <span className="chip-clk">picking…</span>}
          </div>
        );
      })}
    </div>
  );
}
