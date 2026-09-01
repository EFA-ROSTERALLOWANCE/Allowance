// Lint config for the two .jsx sources.
//
// It exists for ONE rule: no-undef. Both apps are single large components whose
// render code reads dozens of values computed in derivePeriod/processRoster, and
// a value that is computed there but never returned is invisible until the exact
// panel that uses it is opened — the app then dies with a ReferenceError at
// runtime. esbuild cannot catch it (an unresolved identifier just becomes a
// global reference), and a bundle that crashes on one tab still builds and
// parses cleanly. This does catch it.
//
// Deliberately narrow: no style rules, no plugins, nothing that would start
// rewriting the house style. Add a rule only if it catches a class of bug that
// ships.
//
// The .html files are build output — many hundreds of KB of minified bundle —
// and are never linted.

import babelParser from "@babel/eslint-parser";

export default [
  {
    files: ["*.jsx"],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [["@babel/preset-react", { runtime: "automatic" }]],
        },
      },
      // Browser globals the apps legitimately use. Keep this list tight: every
      // name added here is a name no-undef will stop checking, so add one only
      // when the app really does depend on the browser providing it.
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        alert: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        queueMicrotask: "readonly",
        performance: "readonly",
        structuredClone: "readonly",
        crypto: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        Response: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        // Payslip PDF reader (pc* functions in the main calculator)
        DecompressionStream: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        Uint8Array: "readonly",
        ArrayBuffer: "readonly",
        DataView: "readonly",
        atob: "readonly",
        btoa: "readonly",
        Intl: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
];
