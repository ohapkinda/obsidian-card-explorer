import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "main.ts",
  output: {
    dir: ".",
    sourcemap: "inline",
    format: "cjs",
    exports: "default"
  },
  external: ["obsidian"],
  plugins: [
    nodeResolve({ browser: true }),
    typescript({ tsconfig: "./tsconfig.json" })
  ]
};