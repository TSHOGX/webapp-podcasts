"use client";

import { useEffect, useState } from "react";

const themes = [
  { id: "olive", name: "Olive", color: "hsl(82, 25%, 42%)" },
  { id: "mauve", name: "Mauve", color: "hsl(280, 15%, 50%)" },
  { id: "mist", name: "Mist", color: "hsl(200, 25%, 48%)" },
  { id: "taupe", name: "Taupe", color: "hsl(30, 15%, 45%)" },
];

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState("olive");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get initial theme from document
    const initialTheme = document.documentElement.getAttribute("data-theme") || "olive";
    setCurrentTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", currentTheme);
    }
  }, [currentTheme, mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="w-6 h-6 rounded-full border-2 border-transparent animate-pulse bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => setCurrentTheme(theme.id)}
          className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
            currentTheme === theme.id
              ? "border-foreground scale-110"
              : "border-transparent hover:scale-105"
          }`}
          style={{ backgroundColor: theme.color }}
          title={theme.name}
          aria-label={`Select ${theme.name} theme`}
        />
      ))}
    </div>
  );
}
