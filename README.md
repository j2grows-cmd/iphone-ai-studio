# iPhone AI Studio

A £0, local-first AI studio designed for iPhone and modern browsers. The goal is to give you direct control over prompts, system instructions and generation settings while keeping inference on your device wherever browser support allows.

## Current features

- **Text Studio:** browser-local inference using WebLLM and Qwen2.5-0.5B-Instruct.
- **Image Studio:** integrated SD-Turbo text-to-image through `web-txt2img`, using a dedicated browser worker and WebGPU.
- **No paid inference API:** prompts are not sent to a hosted generation endpoint by this app.
- **Local image output:** generated PNGs are shown in the page and can be downloaded.
- **First-run downloads:** model weights and runtime files are downloaded from public model hosts. Subsequent loads may use browser caches.
- **Device limits:** WebGPU support, available memory, browser cache eviction and model compatibility vary by device. Large image-model downloads may fail on iPhones with limited available memory.

## Run locally

1. Install a current Node.js LTS release.
2. Run `npm install`.
3. Run `npm run dev -- --host 0.0.0.0`.
4. Open the local development URL in a compatible browser. For iPhone testing, deploy over HTTPS or use a suitable local HTTPS setup.

Build with `npm run build`.

## Image generation notes

Image Studio currently uses the `sd-turbo` model through the MIT-licensed `web-txt2img` JavaScript library. It requires WebGPU; the library documents its WASM fallback as experimental and not recommended. SD-Turbo produces 512×512 images in this integration. The browser UI reports model-loading and generation progress and supports a seed.

The image model weights have their own terms and are **not** licensed by this app's source-code licence. Review the [Stability AI SD-Turbo model card](https://huggingface.co/stabilityai/sd-turbo) and applicable model licence before commercial use or redistribution. The first download may be multiple gigabytes. Keep the tab open while loading/generating, and close other memory-heavy apps if the device struggles.

## Privacy and control

Text prompts and generated responses are processed in the browser by WebLLM. Image generation runs in a browser worker with WebGPU after the model is loaded. The app does not send prompts to a remote inference API. Model files are still downloaded from public model hosts, so network requests occur during first-time setup. Chat history is kept in page memory only and is cleared when the page is reloaded.

A browser-local model may still have model-level limitations and may fail on devices without enough memory or supported WebGPU features. A successful desktop build does not prove that image generation will run on a particular iPhone; test the deployed app on the target device.

## Deployment

The repository includes GitHub Actions workflows for build checks and GitHub Pages deployment. Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** before expecting the deploy workflow to publish the site.
