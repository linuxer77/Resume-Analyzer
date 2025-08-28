import axios from "axios";

const DEFAULT_PROD_API = "https://resume-analyzer-1-7jse.onrender.com";
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env?.DEV ? "http://localhost:5000" : DEFAULT_PROD_API);

export async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(`${API_BASE}/api/upload`, form);
  return data;
}

export async function reviewResume({ resume, jobDescription }) {
  const { data } = await axios.post(`${API_BASE}/api/review`, {
    resume,
    jobDescription,
  });
  return data;
}
