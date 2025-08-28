import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env?.DEV
    ? "http://localhost:5000"
    : typeof window !== "undefined"
    ? window.location.origin
    : "");

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
