// @ts-check
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const base = require("./base");

/** Shared ESLint flat config for React-based apps (Next.js, React Native). */
module.exports = [
  ...base,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];
