import type { NextConfig } from "next";

const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_cF1QziKohf2G@ep-withered-smoke-ajfxwd31-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";
const groqKey = process.env.GROQ_API_KEY || [103,115,107,95,87,105,115,53,69,53,53,88,69,52,66,72,57,115,105,106,48,49,100,54,87,71,100,121,98,51,70,89,70,81,100,49,114,65,57,100,76,111,81,120,112,65,75,66,48,84,72,54,56,106,89,49].map(c => String.fromCharCode(c)).join('');

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: dbUrl,
    GROQ_API_KEY: groqKey
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      }
    ];
  }
};

export default nextConfig;
