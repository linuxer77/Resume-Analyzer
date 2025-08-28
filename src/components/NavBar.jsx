import React from "react";
import { Moon, Sun } from "lucide-react";

export default function NavBar() {
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="nav">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">RR</span>
          </div>
          <span className="text-sm text-muted">Resume Reviewer</span>
        </div>
        <button
          className="btn"
          onClick={() => setDark((d) => !d)}
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
