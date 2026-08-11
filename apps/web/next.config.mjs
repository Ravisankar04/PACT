/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const empty = path.join(__dirname, "stubs/empty.js");

const nextConfig = {
  transpilePackages: ["@pact/shared"],
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": empty,
      "@x402/evm/exact/client": empty,
      "@x402/evm/upto/client": empty,
      "@x402/core": empty,
      "@x402/core/client": empty,
      "@x402/svm": empty,
      "@x402/svm/exact/client": empty,
    };
    config.externals = [...(config.externals || []), "pino-pretty", "encoding"];
    return config;
  },
};

export default nextConfig;
