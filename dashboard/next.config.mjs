import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Include the sibling salesforce-mcp-server/dist in the serverless bundle
    // so the chat route can spawn it as a subprocess on Vercel.
    outputFileTracingRoot: path.join(__dirname, ".."),
    outputFileTracingIncludes: {
      "/api/chat": ["../salesforce-mcp-server/dist/**/*"],
    },
  },
};

export default nextConfig;
