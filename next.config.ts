import fs from "node:fs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 並行セッションが同じリポジトリで dev サーバーを立てられるよう、
  // ビルドディレクトリを環境変数で分離できるようにする (.next のロック回避)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    // This repo is opened through a symlinked workspace path in Codex desktop.
    // Use the real project path so Turbopack resolves CSS tooling from the app root.
    root: fs.realpathSync(process.cwd()),
  },
};

export default nextConfig;
