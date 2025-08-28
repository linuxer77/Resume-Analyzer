import React from "react";

export function Tabs({ tabs, defaultTab, className = "" }) {
  const [active, setActive] = React.useState(defaultTab || tabs[0]?.value);
  return (
    <div className={className}>
      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-full overflow-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setActive(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              active === t.value
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tabs.map((t) => (
          <div key={t.value} hidden={active !== t.value}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
