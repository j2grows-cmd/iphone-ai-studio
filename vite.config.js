import { defineConfig } from "vite";

// web-txt2img uses a module worker with code-split dependencies.
// Vite's default IIFE worker output cannot bundle dynamic/code-split imports.
export default defineConfig({
  worker: {
    format: "es",
  },
});
