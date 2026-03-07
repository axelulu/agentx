import { describe, expect, it } from "vitest";

import { mergeVariables, replaceVariables, replaceVariablesInObject } from "../variable-resolver";

describe("replaceVariables", () => {
  it("replaces known variables", () => {
    expect(replaceVariables("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("replaces multiple variables", () => {
    expect(replaceVariables("{{a}} and {{b}}", { a: "1", b: "2" })).toBe("1 and 2");
  });

  it("removes undefined variables by default", () => {
    expect(replaceVariables("Hello {{name}}!", {})).toBe("Hello !");
  });

  it("preserves undefined variables when flag is set", () => {
    expect(replaceVariables("Hello {{name}}!", {}, true)).toBe("Hello {{name}}!");
  });

  it("trims variable names", () => {
    expect(replaceVariables("{{ name }}", { name: "ok" })).toBe("ok");
  });

  it("converts non-string values to strings", () => {
    expect(replaceVariables("count: {{n}}", { n: 42 })).toBe("count: 42");
    expect(replaceVariables("flag: {{b}}", { b: true })).toBe("flag: true");
  });
});

describe("replaceVariablesInObject", () => {
  it("replaces in strings", () => {
    expect(replaceVariablesInObject("{{x}}", { x: "hello" })).toBe("hello");
  });

  it("replaces in arrays", () => {
    expect(replaceVariablesInObject(["{{a}}", "{{b}}"], { a: "1", b: "2" })).toEqual(["1", "2"]);
  });

  it("replaces in nested objects", () => {
    const obj = { top: { nested: "{{val}}" } };
    expect(replaceVariablesInObject(obj, { val: "ok" })).toEqual({ top: { nested: "ok" } });
  });

  it("passes through non-string/object/array values", () => {
    expect(replaceVariablesInObject(42 as unknown as string, {})).toBe(42);
    expect(replaceVariablesInObject(null as unknown as string, {})).toBeNull();
  });
});

describe("mergeVariables", () => {
  it("merges multiple sources", () => {
    expect(mergeVariables({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("later sources override earlier", () => {
    expect(mergeVariables({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("skips undefined sources", () => {
    expect(mergeVariables(undefined, { a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("returns empty object with no sources", () => {
    expect(mergeVariables()).toEqual({});
  });
});
