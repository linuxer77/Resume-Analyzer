require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
// CORS preflight for all routes
app.options("*", cors());

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

async function ocrWithOCRSpace(buffer, filename) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) return null;
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("file", buffer, { filename: filename || "upload.pdf" });
  form.append("language", "eng");
  form.append("isTable", "true");
  form.append("OCREngine", "2");

  const resp = await axios.post("https://api.ocr.space/parse/image", form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 60000,
  });
  const result = resp.data;
  if (!result || result.IsErroredOnProcessing) return null;
  const pages = result.ParsedResults || [];
  return pages
    .map((p) => p.ParsedText || "")
    .join("\n")
    .trim();
}

// Upload endpoint (PDF/DOCX/TXT to text) with Multer error handling
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const code = err.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            error: `File too large. Max allowed is ${MAX_UPLOAD_MB}MB`,
          });
        }
        return res.status(400).json({ error: `Upload error: ${code}` });
      }
      console.error("Upload error:", err);
      return res.status(400).json({ error: "Failed to receive file" });
    }

    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const mime = req.file.mimetype || "";
      const ext = path.extname(req.file.originalname || "").toLowerCase();
      let text = "";

      console.log("/api/upload", {
        name: req.file.originalname,
        mime,
        size: req.file.size,
        ext,
      });

      if (mime === "application/pdf" || ext === ".pdf") {
        const data = await pdfParse(req.file.buffer);
        text = (data.text || "").replace(/\u0000/g, "");
      } else if (
        mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === ".docx"
      ) {
        const result = await mammoth.extractRawText({
          buffer: req.file.buffer,
        });
        text = (result.value || "").replace(/\u0000/g, "");
      } else if (mime === "text/plain" || ext === ".txt") {
        text = req.file.buffer.toString("utf-8").replace(/\u0000/g, "");
      } else if (mime === "application/octet-stream") {
        // Fallback by extension when browser doesn't set a specific mimetype
        if (ext === ".pdf") {
          const data = await pdfParse(req.file.buffer);
          text = data.text || "";
        } else if (ext === ".docx") {
          const result = await mammoth.extractRawText({
            buffer: req.file.buffer,
          });
          text = result.value || "";
        } else if (ext === ".txt") {
          text = req.file.buffer.toString("utf-8");
        }
      }

      // If no extractable text (e.g., scanned PDF), attempt OCR if enabled
      if (!text || !text.trim()) {
        let ocrText = null;
        if (process.env.OCR_ENABLE === "true") {
          try {
            ocrText = await ocrWithOCRSpace(
              req.file.buffer,
              req.file.originalname
            );
          } catch (ocrErr) {
            console.error(
              "OCR error:",
              ocrErr?.response?.data || ocrErr.message
            );
          }
        }
        if (ocrText && ocrText.trim()) {
          return res.json({ text: ocrText });
        }

        return res.status(422).json({
          error:
            "No extractable text found. Your file may be a scanned/image-only PDF.",
          hint:
            process.env.OCR_ENABLE === "true"
              ? "OCR attempted but failed. Please upload a text-based PDF/DOCX or paste text."
              : "Enable OCR by setting OCR_ENABLE=true and OCR_SPACE_API_KEY in server env.",
          bytes: req.file.size,
          name: req.file.originalname,
          ext,
          mime,
        });
      }

      return res.json({ text });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to parse file" });
    }
  });
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
