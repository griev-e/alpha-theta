import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // New in eslint-plugin-react-hooks 7 (React Compiler lint set). The
    // codebase's SSR-safe localStorage hydration and paint-then-compute
    // patterns (useAsyncCompute, useLiveData, the stores) trip them by
    // design — keep them visible as warnings rather than build-failing
    // errors until those patterns are revisited.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
