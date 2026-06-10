import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Serves/copies the ONNX Runtime wasm-only build as static assets under
 * /ort/. ORT is deliberately not bundled: the engine worker imports
 * /ort/ort.wasm.min.mjs at runtime, keeping the multi-MB runtime out of the
 * app bundle (and under Cloudflare Pages' 25 MiB per-file limit).
 */
function ortAssets(): Plugin {
  const files = [
    "ort.wasm.min.mjs",
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.mjs",
  ];
  const sourceDir = resolve(here, "node_modules/onnxruntime-web/dist");
  const contentTypes: Record<string, string> = {
    ".wasm": "application/wasm",
    ".mjs": "text/javascript",
  };

  return {
    name: "ort-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/ort/")) return next();
        const file = url.slice("/ort/".length);
        if (!files.includes(file)) return next();
        const extension = file.slice(file.lastIndexOf("."));
        res.setHeader(
          "Content-Type",
          contentTypes[extension] ?? "application/octet-stream",
        );
        res.end(readFileSync(resolve(sourceDir, file)));
      });
    },
    closeBundle() {
      const outDir = resolve(here, "dist/ort");
      mkdirSync(outDir, { recursive: true });
      for (const file of files) {
        copyFileSync(resolve(sourceDir, file), resolve(outDir, file));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), ortAssets()],
  optimizeDeps: {
    // ORT is loaded at runtime from /ort/, never bundled.
    exclude: ["onnxruntime-web"],
  },
  worker: {
    // The engine worker uses dynamic import (code splitting), which the
    // default iife worker format does not support.
    format: "es",
  },
  server: {
    port: 5173,
    proxy: {
      "/rooms": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
