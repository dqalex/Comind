import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      // React 17+ 不需要导入 React
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // TypeScript 相关规则
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      // React Hooks 规则
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off", // 这个规则过于严格
      // React Compiler 实验性规则 - 当前过于严格，暂时禁用
      "react-hooks/refs": "off", // 误报：从包含 ref 的对象访问属性被错误标记为访问 ref
      "react-hooks/preserve-manual-memoization": "off", // 过于严格的依赖检查
      "react-hooks/purity": "warn", // 保留警告级别，检测 Date.now() 等不纯函数
      // 通用规则
      "prefer-const": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-unused-vars": "off", // 使用 TypeScript 的规则
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: [
      ".next/*",
      "node_modules/*",
      "out/*",
      "public/*",
      "coverage/*",
      "*.cjs",
      "playwright-report/**", // 测试报告目录
      "next.config.js", // CommonJS 配置文件
      "postcss.config.js",
      "tailwind.config.*",
      "scripts/**/*.js", // 脚本文件允许 CommonJS
      "scripts/**/*.mjs",
      "scripts/diagnostics/**", // 诊断脚本
      "tests/**", // 测试文件
    ],
  },
];
