require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Upload endpoint (PDF/DOCX to text)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const mime = req.file.mimetype;
    let text = "";
    if (mime === "application/pdf") {
      const data = await pdfParse(req.file.buffer);
      text = data.text || "";
    } else if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value || "";
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    return res.json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to parse file" });
  }
});

const ReviewSchema = z.object({
  resume: z.string().min(10, "Resume text required"),
  jobDescription: z.string().optional().default(""),
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

function buildPrompt(resume, jd) {
  return `You are an expert resume reviewer. Analyze the following resume${
    jd ? " against the given Job Description" : ""
  } and return STRICT JSON matching the schema below. Do not include markdown fences.

Schema:
{
  "grammar": string,
  "keywords": { "missing": string[], "score": number },
  "bulletPoints": Array<{ "original": string, "improved": string }>,
  "jobFit": string,
  "tone": string
}

Resume:\n${resume}\n\n${jd ? `Job Description:\n${jd}` : ""}

Rules:
- JSON only, no comments.
- Bullet point rewrites must be specific, action-led, and quantified where possible.
- For keywords, compare resume vs JD; estimate ATS score.
- keywords.score MUST be an integer percentage from 0 to 100 (no decimals, do not return 0.x).
- Tone advice: highlight passive voice examples and rewrite confidently.`;
}

// Review endpoint
app.post("/api/review", async (req, res) => {
  try {
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { resume, jobDescription } = parsed.data;

    const prompt = buildPrompt(resume, jobDescription || "");
    const raw = await callGemini(prompt);

    // Best-effort JSON parsing (Gemini sometimes wraps in code fences)
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    let payload;
    try {
      payload = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: try to extract JSON block
      const match = cleaned.match(/\{[\s\S]*\}$/);
      if (match) payload = JSON.parse(match[0]);
    }

    if (!payload)
      return res
        .status(502)
        .json({ error: "LLM returned non-JSON response", raw });

    // Defensive shaping
    payload.keywords = payload.keywords || { missing: [], score: 0 };
    payload.keywords.missing = Array.isArray(payload.keywords.missing)
      ? payload.keywords.missing
      : [];

    // Normalize score to an integer 0–100
    const rawScoreStr = String(
      payload.keywords.score !== undefined ? payload.keywords.score : ""
    ).trim();
    let scoreNum = Number(rawScoreStr.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(scoreNum)) scoreNum = 0;
    if (scoreNum <= 1 && rawScoreStr.includes(".")) {
      // Likely 0.x scale — convert to percentage
      scoreNum = scoreNum * 100;
    }
    scoreNum = Math.round(scoreNum);
    scoreNum = Math.max(0, Math.min(100, scoreNum));
    payload.keywords.score = scoreNum;

    payload.bulletPoints = Array.isArray(payload.bulletPoints)
      ? payload.bulletPoints
      : [];

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to review resume" });
  }
});

// Serve client build in production (single service deployment)
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  // SPA fallback (exclude API routes)
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
