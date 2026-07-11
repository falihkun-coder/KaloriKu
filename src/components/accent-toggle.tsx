"use client";

import { useEffect, useState } from "react";

const ACCENTS = [
  { id: "terra", color: "#DC6B2A", label: "Terakota" },
  { id: "forest", color: "#1E8A5B", label: "Forest green" },
  { id: "indigo", color: "#4F46E5", label: "Indigo" },
];

export function AccentToggle() {
  const [accent, setAccent] = useState<string | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.accent || localStorage.getItem("accent") || "terra";
    setAccent(current);
  }, []);

  const pick = (id: string) => {
    setAccent(id);
    document.documentElement.dataset.accent = id;
    try {
      localStorage.setItem("accent", id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-2">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-label={a.label}
          onClick={() => pick(a.id)}
          className={`h-6 w-6 rounded-full transition-transform ${
            accent === a.id ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background scale-110" : "opacity-55 hover:opacity-100"
          }`}
          style={{ backgroundColor: a.color }}
        />
      ))}
    </div>
  );
}
