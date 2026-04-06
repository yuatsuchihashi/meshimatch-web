import fs from "node:fs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // This repo is opened through a symlinked workspace path in Codex desktop.
    // Use the real project path so Turbopack resolves CSS tooling from the app root.
    root: fs.realpathSync(process.cwd()),
  },
};

export default nextConfig;
