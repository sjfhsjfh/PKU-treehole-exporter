import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "树洞导出",
        namespace: "pku-treehole",
        match: ["https://treehole.pku.edu.cn/*"],
      },
      build: {
        externalGlobals: {
          // 大依赖走 CDN 减小体积
        },
      },
    }),
  ],
});
