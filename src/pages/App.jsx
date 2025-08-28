import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { uploadFile, reviewResume } from "../lib/api";
import NavBar from "../components/NavBar";
import { Upload, FileText, Sparkles } from "lucide-react";

export default function App() {
  const [resumeText, setResumeText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const { text } = await uploadFile(file);
    setResumeText((t) => (t ? t + "\n\n" : "") + text);
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { text } = await uploadFile(file);
    setResumeText((t) => (t ? t + "\n\n" : "") + text);
  }

  async function onReview() {
    if (!resumeText || resumeText.length < 10) return;
    setLoading(true);
    try {
      const data = await reviewResume({
        resume: resumeText,
        jobDescription: jobDesc,
      });
      navigate("/dashboard", { state: { data } });
    } catch (e) {
      alert("Failed to review. Ensure server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Make your resume shine
          </h1>
          <p className="text-muted mt-3">
            Upload your resume and get instant, AI-powered feedback tailored to
            your target role.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium flex items-center gap-2">
                <FileText size={18} /> Resume
              </h2>
              <label className="btn btn-primary cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={onPick}
                />
                <Upload size={16} className="mr-2" /> Upload
              </label>
            </div>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-white/10 rounded-2xl p-5 text-center text-muted hover:border-white/20 transition-colors"
            >
              Drag & drop PDF/DOCX here
            </div>
            <textarea
              className="input w-full h-56 mt-4 p-3"
              placeholder="Or paste your resume text here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card p-5"
          >
            <h2 className="font-medium mb-3">Optional Job Description</h2>
            <textarea
              className="input w-full h-72 p-3"
              placeholder="Paste the job description here..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            />
          </motion.div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            className="btn btn-primary text-lg px-6"
            onClick={onReview}
            disabled={loading}
          >
            <Sparkles size={18} className="mr-2" />{" "}
            {loading ? "Reviewing..." : "Review Resume"}
          </button>
        </div>
      </main>
    </div>
  );
}
