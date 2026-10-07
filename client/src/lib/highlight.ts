import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";

const ALIAS: Record<string, string> = { cpp: "cpp", "c++": "cpp", c: "c", python: "python", py: "python", java: "java" };

/** Prism-highlighted HTML of `code` (escaped by Prism); plain escaped text for unknown languages. */
export function highlight(code: string, lang: string): string {
  const grammar = Prism.languages[ALIAS[lang.toLowerCase()] ?? ""];
  if (!grammar) return code.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Prism.highlight(code, grammar, ALIAS[lang.toLowerCase()]);
}
