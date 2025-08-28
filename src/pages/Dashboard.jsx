import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import NavBar from "../components/NavBar";

function SectionCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-5"
    >
      <h3 className="font-semibold text-lg mb-3">{title}</h3>
      <div className="text-sm text-muted">{children}</div>
    </motion.div>
  );
}

function BeforeAfter({ item }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-black/30 border border-white/5">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">
          Before
        </div>
        <div className="text-foreground">{item.original}</div>
      </div>
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">
          After
        </div>
        <div className="text-foreground">{item.improved}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const data = state?.data;

  React.useEffect(() => {
    if (!data) navigate("/");
  }, [data, navigate]);
  if (!data) return null;

  const missing = data.keywords?.missing || [];
  const score = data.keywords?.score || 0;

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <SectionCard title="Grammar & Clarity">
            <p className="whitespace-pre-wrap leading-relaxed">
              {data.grammar}
            </p>
          </SectionCard>
          <SectionCard title="Job Fit Analysis">
            <p className="whitespace-pre-wrap leading-relaxed">{data.jobFit}</p>
          </SectionCard>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <SectionCard title="ATS Score">
            <div className="flex items-center justify-between mb-2">
              <span>Score</span>
              <span className="font-semibold">{score}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </SectionCard>
          <SectionCard title="Missing Keywords">
            {missing.length ? (
              <div className="flex flex-wrap gap-2">
                {missing.map((k, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-foreground text-xs"
                  >
                    {k}
                  </span>
                ))}
              </div>
            ) : (
              <p>Looks good! No obvious gaps detected.</p>
            )}
          </SectionCard>
          <SectionCard title="Tone & Readability">
            <p className="whitespace-pre-wrap leading-relaxed">{data.tone}</p>
          </SectionCard>
        </div>

        <SectionCard title="Bullet Point Improvements">
          <div className="space-y-4">
            {(data.bulletPoints || []).map((bp, idx) => (
              <BeforeAfter key={idx} item={bp} />
            ))}
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
