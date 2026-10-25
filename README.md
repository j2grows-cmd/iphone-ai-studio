# iPhone AI Studio

A £0, local-first AI studio designed for iPhone and modern browsers. The goal is to give you direct control over prompts, system instructions and generation settings, while keeping inference on your device wherever browser support allows.

## Current status

- **Text Studio:** browser-local inference using WebLLM and a small Qwen2.5 instruct model.
- **Image Studio:** interface and capability diagnostics are included, but a compatible image-generation backend still needs to be integrated and tested. The page will not pretend image generation works when it does not.
- **No paid inference API:** the app does not send prompts to a hosted inference endpoint.
- **First-run downloads:** model files must be downloaded from their public hosts; after that, the browser attempts local inference.
- **iPhone limitations:** WebGPU, memory availability and model compatibility depend on iOS version, device and browser. Browser storage may be evicted by iOS.

## Run locally

1. Install a current Node.js LTS release.
2. Run `npm install`.
3. Run `npm run dev -- --host 0.0.0.0`.
4. Open the local development URL in a compatible browser. For iPhone testing, deploy over HTTPS or use a suitable local HTTPS setup.

Build with `npm run build`.

## Privacy and control

Text prompts and generated responses are processed in the browser by WebLLM. Model files are fetched from the configured public model host when needed. Chat history is kept in page memory only and is cleared when the page is reloaded. The system prompt and sampling controls are editable.

This is an experimental browser app, not a guarantee that every model prompt will be followed. A browser-local model may still have model-level limitations and may fail on devices without enough memory or supported WebGPU features.
