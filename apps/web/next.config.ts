import type { NextConfig } from "next";

const ORT = "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node";
const EMBEDDING_ROUTES = "/{api/capture,api/ask,api/webhooks/dodo,onboarding}";
const OTHER_ROUTES = "/{dashboard,dashboard/**,demo/**,dev/**,api/billing/**,api/explain,api/export,api/graph/**,api/gsql/**,api/learn-next,api/me,api/sources/**,api/vocabulary}";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Embeddings run in-process, but only these routes embed. Shipping ONNX (Linux x64 only) to the rest
  // would stop Vercel merging routes, and Hobby allows 12 functions per deployment.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "onnxruntime-web", "sharp"],
  outputFileTracingIncludes: {
    [EMBEDDING_ROUTES]: [
      `${ORT}/bin/napi-v6/linux/x64/**`,
      `${ORT}/dist/**`,
      `${ORT}/package.json`,
      "../../node_modules/.pnpm/onnxruntime-common@*/node_modules/onnxruntime-common/**",
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-common",
      "../../node_modules/.pnpm/@huggingface+transformers@*/node_modules/onnxruntime-node",
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      `${ORT}/bin/napi-v6/{darwin,win32}/**`,
      `${ORT}/bin/napi-v6/linux/arm64/**`,
      "../../node_modules/.pnpm/onnxruntime-web@*/node_modules/onnxruntime-web/dist/*.wasm",
      "../../node_modules/.pnpm/@huggingface+transformers@*/node_modules/@huggingface/transformers/dist/*.wasm",
    ],
    [OTHER_ROUTES]: [
      `${ORT}/**`,
      "../../node_modules/.pnpm/onnxruntime-web@*/**",
      "../../node_modules/.pnpm/@huggingface+transformers@*/**",
      "../../node_modules/.pnpm/sharp@*/**",
      "../../node_modules/.pnpm/@img+sharp*/**",
    ],
  },
};

export default nextConfig;
