import { describe, expect, it } from "vitest";

import { PromptCompiler } from "../prompt-service";
import type { PromptTemplate, SectionContent } from "../types";

describe("PromptCompiler", () => {
  const compiler = new PromptCompiler();

  describe("renderSection", () => {
    it("renders plain string sections", () => {
      expect(compiler.renderSection("Hello World", {})).toBe("Hello World");
    });

    it("replaces variables in plain strings", () => {
      expect(compiler.renderSection("Hello {{name}}", { name: "Brain" })).toBe("Hello Brain");
    });

    it("renders tagged sections", () => {
      const section: SectionContent = { tag: "rules", content: "Be nice" };
      expect(compiler.renderSection(section, {})).toBe("<rules>\nBe nice\n</rules>");
    });

    it("returns empty for tagged sections without content", () => {
      const section: SectionContent = { tag: "rules" };
      expect(compiler.renderSection(section, {})).toBe("");
    });

    it("renders conditional sections (truthy)", () => {
      const section: SectionContent = { $if: "{{mode}} == 'chat'", content: "Chat mode" };
      expect(compiler.renderSection(section, { mode: "chat" })).toBe("Chat mode");
    });

    it("renders conditional sections (falsy)", () => {
      const section: SectionContent = { $if: "{{mode}} == 'chat'", content: "Chat mode" };
      expect(compiler.renderSection(section, { mode: "loop" })).toBe("");
    });

    it("renders list sections", () => {
      const section: SectionContent = {
        items: [
          { name: "a", content: "First" },
          { name: "b", content: "Second" },
          { name: "c" }, // no content — should be filtered
        ],
      };
      expect(compiler.renderSection(section, {})).toBe("First\n\nSecond");
    });

    it("renders object with content property", () => {
      const section: SectionContent = { content: "Simple content" };
      expect(compiler.renderSection(section, {})).toBe("Simple content");
    });
  });

  describe("compile", () => {
    it("compiles a simple template", () => {
      const template: PromptTemplate = {
        meta: { name: "test" },
        sections: {
          intro: "Hello",
          body: "World",
        },
      };

      const compiled = compiler.compile(template);
      expect(compiled.name).toBe("test");
      expect(compiled.render()).toBe("Hello\n\nWorld");
    });

    it("applies static variables during compilation", () => {
      const template: PromptTemplate = {
        meta: { name: "test" },
        variables: { static: { app: "Brain" } },
        sections: {
          intro: "Welcome to {{app}}",
        },
      };

      const compiled = compiler.compile(template);
      expect(compiled.staticContent).toBe("Welcome to Brain");
    });

    it("preserves dynamic variables for render-time", () => {
      const template: PromptTemplate = {
        meta: { name: "test" },
        variables: {
          dynamic: {
            user: { type: "string", default: "Guest" },
          },
        },
        sections: {
          greeting: "Hello {{user}}",
        },
      };

      const compiled = compiler.compile(template);
      expect(compiled.dynamicVariables).toEqual(["user"]);
      expect(compiled.render()).toBe("Hello Guest");
      expect(compiled.render({ user: "Alice" })).toBe("Hello Alice");
    });

    it("uses custom separator", () => {
      const template: PromptTemplate = {
        meta: { name: "test" },
        sections: { a: "A", b: "B" },
        output: { separator: "\n---\n" },
      };

      expect(compiler.compile(template).render()).toBe("A\n---\nB");
    });

    it("defaults name to unnamed", () => {
      const template: PromptTemplate = {
        sections: { a: "A" },
      };
      expect(compiler.compile(template).name).toBe("unnamed");
    });
  });

  describe("condition evaluation", () => {
    it("evaluates equality operators", () => {
      const section = (cond: string): SectionContent => ({ $if: cond, content: "yes" });

      expect(compiler.renderSection(section("1 == 1"), {})).toBe("yes");
      expect(compiler.renderSection(section("1 === 1"), {})).toBe("yes");
      expect(compiler.renderSection(section("1 != 2"), {})).toBe("yes");
      expect(compiler.renderSection(section("1 !== 2"), {})).toBe("yes");
      expect(compiler.renderSection(section("1 == 2"), {})).toBe("");
    });

    it("evaluates comparison operators", () => {
      const section = (cond: string): SectionContent => ({ $if: cond, content: "yes" });

      expect(compiler.renderSection(section("2 > 1"), {})).toBe("yes");
      expect(compiler.renderSection(section("1 < 2"), {})).toBe("yes");
      expect(compiler.renderSection(section("2 >= 2"), {})).toBe("yes");
      expect(compiler.renderSection(section("2 <= 2"), {})).toBe("yes");
    });

    it("evaluates truthy/falsy values", () => {
      const section = (cond: string): SectionContent => ({ $if: cond, content: "yes" });

      expect(compiler.renderSection(section("true"), {})).toBe("yes");
      expect(compiler.renderSection(section("false"), {})).toBe("");
      expect(compiler.renderSection(section(""), {})).toBe("");
    });

    it("compares quoted strings", () => {
      const section: SectionContent = { $if: "'hello' == 'hello'", content: "yes" };
      expect(compiler.renderSection(section, {})).toBe("yes");
    });
  });
});
