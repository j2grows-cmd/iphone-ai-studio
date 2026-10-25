import { CreateMLCEngine } from "@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const $ = (id) => document.getElementById(id);
let engine = null;
let busy = false;
let history = [];

function setStatus(message) { $("model-status").textContent = message; }

function checkCapabilities() {
  const pill = $("gpu-pill");
  if (!window.isSecureContext) {
    pill.textContent = "HTTPS needed";
    setStatus("Open this app over HTTPS to use browser GPU features.");
    $("load-model").disabled = true;
    return false;
  }
  if (!navigator.gpu) {
    pill.textContent = "WebGPU unavailable";
    setStatus("This browser does not expose WebGPU. Text generation cannot start here. Try a supported browser/device; prompts are not sent to a remote inference API.");
    $("load-model").disabled = true;
    return false;
  }
  pill.textContent = "WebGPU detected";
  setStatus("WebGPU detected. Load the model to begin. The first download may be large.");
  return true;
}

function addMessage(role, content) {
  const empty = document.querySelector(".empty");
  if (empty) empty.remove();
  const item = document.createElement("article");
  item.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "AI";
  const body = document.createElement("div");
  body.textContent = content;
  item.append(label, body);
  $("messages").append(item);
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("temperature").addEventListener("input", () => {
  $("temperature-value").value = $("temperature").value;
  $("temperature-value").textContent = $("temperature").value;
});

$("load-model").addEventListener("click", async () => {
  if (busy || engine || !checkCapabilities()) return;
  busy = true;
  $("load-model").disabled = true;
  $("progress").hidden = false;
  setStatus("Loading model and downloading files…");
  try {
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        if (progress?.text) setStatus(progress.text);
        if (typeof progress?.progress === "number") $("progress").value = Math.round(progress.progress * 100);
      }
    });
    setStatus("Model ready. Prompts and responses run in this browser.");
    $("load-model").textContent = "Model loaded";
    $("send").disabled = false;
  } catch (error) {
    console.error(error);
    engine = null;
    $("load-model").disabled = false;
    setStatus(`Could not load model: ${error?.message || "unknown error"}. Check WebGPU support, memory and the browser console.`);
  } finally {
    busy = false;
  }
});

$("send").addEventListener("click", async () => {
  const input = $("user-prompt");
  const content = input.value.trim();
  if (!engine || !content || busy) return;
  busy = true;
  $("send").disabled = true;
  input.value = "";
  history.push({ role: "user", content });
  addMessage("user", content);
  setStatus("Generating locally…");
  try {
    const messages = [
      { role: "system", content: $("system-prompt").value.trim() || "You are a helpful assistant." },
      ...history
    ];
    const result = await engine.chat.completions.create({
      messages,
      temperature: Number($("temperature").value),
      max_tokens: Number($("max-tokens").value)
    });
    const answer = result.choices?.[0]?.message?.content ?? "";
    history.push({ role: "assistant", content: answer });
    addMessage("assistant", answer || "(The model returned an empty response.)");
    setStatus("Ready.");
  } catch (error) {
    console.error(error);
    if (history.at(-1)?.role === "user") history.pop();
    setStatus(`Generation failed: ${error?.message || "unknown error"}`);
  } finally {
    busy = false;
    $("send").disabled = !engine;
    input.focus();
  }
});

$("user-prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("send").click();
  }
});

$("clear-chat").addEventListener("click", () => {
  history = [];
  $("messages").replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Conversation cleared. Your system instructions are unchanged.";
  $("messages").append(empty);
});

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  const mode = tab.dataset.mode;
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
  $("text-panel").hidden = mode !== "text";
  $("image-panel").hidden = mode !== "image";
}));

checkCapabilities();
