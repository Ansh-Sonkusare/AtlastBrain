import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Local-only embeddings: keep ONNX out of server bundles and Vercel function traces.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "onnxruntime-web", "sharp"],
  outputFileTracingExcludes: {
    "*": ["node_modules/onnxruntime-node/**", "node_modules/@huggingface/transformers/**", "node_modules/.pnpm/onnxruntime-*/**"],
  },
};

export default nextConfig;
