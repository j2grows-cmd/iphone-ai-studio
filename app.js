import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { Txt2ImgWorkerClient } from "web-txt2img";

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


// Image Studio: SD-Turbo runs in a dedicated worker and uses WebGPU locally.
let imageClient = null;
let imageModelReady = false;
let imageBusy = false;
let currentImageAbort = null;
let currentImageUrl = null;

function setImageModelStatus(message) {
  $("image-model-status").textContent = message;
}
function setImageStatus(message) {
  $("image-status").textContent = message;
}
function setImageProgress(progress) {
  if (typeof progress?.pct === "number") $("image-progress").value = Math.max(0, Math.min(100, progress.pct));
  const detail = progress?.message || progress?.phase || "Working…";
  const pct = typeof progress?.pct === "number" ? ` ${progress.pct}%` : "";
  const downloaded = typeof progress?.bytesDownloaded === "number" && typeof progress?.totalBytesExpected === "number"
    ? ` · ${(progress.bytesDownloaded / 1048576).toFixed(0)} / ${(progress.totalBytesExpected / 1048576).toFixed(0)} MB`
    : "";
  setImageStatus(`${detail}${pct}${downloaded}`);
}

$("load-image-model").addEventListener("click", async () => {
  if (imageBusy || imageModelReady) return;
  if (!window.isSecureContext) {
    setImageModelStatus("HTTPS is required for browser GPU features. Open the deployed app over HTTPS.");
    return;
  }
  if (!navigator.gpu) {
    setImageModelStatus("WebGPU is not available in this browser. This image model cannot use a remote fallback.");
    return;
  }

  imageBusy = true;
  $("load-image-model").disabled = true;
  $("image-progress").hidden = false;
  $("image-progress").value = 0;
  setImageModelStatus("Checking WebGPU and preparing the image worker…");
  setImageStatus("First load downloads the model files. Keep this tab open and avoid switching apps.");
  try {
    imageClient = Txt2ImgWorkerClient.createDefault();
    const caps = await imageClient.detect();
    if (!caps?.webgpu) throw new Error("The image runtime did not detect WebGPU support.");
    const loaded = await imageClient.load("sd-turbo", { backendPreference: ["webgpu"] }, setImageProgress);
    if (!loaded?.ok) throw new Error(loaded?.message || loaded?.reason || "Image model failed to load.");
    imageModelReady = true;
    $("load-image-model").textContent = "Image model ready";
    $("generate-image").disabled = false;
    setImageModelStatus("SD-Turbo loaded. Image inference runs locally in this browser.");
    setImageStatus("Ready to generate at 512 × 512. The first download may be several gigabytes.");
    $("image-progress").value = 100;
  } catch (error) {
    console.error("Image model load failed:", error);
    try { await imageClient?.unload(); } catch {}
    imageClient = null;
    imageModelReady = false;
    $("load-image-model").disabled = false;
    setImageModelStatus(`Could not load SD-Turbo: ${error?.message || "unknown error"}. Check WebGPU support, free memory and the browser console.`);
    setImageStatus("No remote inference service was used.");
  } finally {
    imageBusy = false;
  }
});

$("generate-image").addEventListener("click", async () => {
  const prompt = $("image-prompt").value.trim();
  if (!imageClient || !imageModelReady || !prompt || imageBusy) {
    if (!prompt) setImageStatus("Enter an image prompt first.");
    return;
  }
  imageBusy = true;
  $("generate-image").disabled = true;
  $("cancel-image").disabled = false;
  $("image-progress").hidden = false;
  $("image-progress").value = 0;
  setImageStatus("Preparing local image generation…");
  try {
    const seedValue = $("image-seed").value.trim();
    const params = { prompt };
    if (seedValue !== "") {
      const seed = Number(seedValue);
      if (!Number.isSafeInteger(seed) || seed < 0) throw new Error("Seed must be a non-negative whole number.");
      params.seed = seed;
    }
    const job = imageClient.generate(
      params,
      (progress) => setImageProgress({ ...progress, message: progress?.phase ? `Generating · ${progress.phase}` : "Generating locally" }),
      { busyPolicy: "queue", debounceMs: 0 }
    );
    currentImageAbort = job.abort;
    const result = await job.promise;
    if (!result?.ok) throw new Error(result?.message || result?.reason || "Image generation failed.");
    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = currentImageUrl;
    image.alt = prompt;
    image.className = "generated-image";
    const output = $("image-output");
    output.replaceChildren(image);
    const download = $("download-image");
    download.href = currentImageUrl;
    download.download = `iphone-ai-studio-${Date.now()}.png`;
    download.classList.remove("disabled-link");
    download.setAttribute("aria-disabled", "false");
    setImageStatus(`Image generated locally${typeof result.timeMs === "number" ? ` in ${(result.timeMs / 1000).toFixed(1)} seconds` : ""}. Use Download PNG to save it.`);
  } catch (error) {
    console.error("Image generation failed:", error);
    setImageStatus(`Generation failed: ${error?.message || "unknown error"}. Try a shorter prompt or reload the model if memory is low.`);
  } finally {
    currentImageAbort = null;
    imageBusy = false;
    $("generate-image").disabled = !imageModelReady;
    $("cancel-image").disabled = true;
  }
});

$("cancel-image").addEventListener("click", async () => {
  if (!currentImageAbort) return;
  $("cancel-image").disabled = true;
  setImageStatus("Cancelling image generation…");
  try { await currentImageAbort(); }
  catch (error) { console.warn("Image cancellation reported:", error); }
});
