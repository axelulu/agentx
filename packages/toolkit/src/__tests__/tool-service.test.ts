import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";

import { ToolService } from "../tool-service";
import { CapabilityRegistry } from "../capability-registry";
import type { ToolHandler } from "../types";

describe("ToolService", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `toolkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupToolYaml(
    category: string,
    module: string,
    tools: Array<{
      name: string;
      description: string;
      category: string;
      input_schema: Record<string, unknown>;
      toolType?: string;
    }>,
    variables?: Record<string, unknown>,
  ) {
    const dir = join(tmpDir, "capabilities", category, module, "tools", "prompts");
    mkdirSync(dir, { recursive: true });

    const content = {
      meta: { name: `${category}.${module}` },
      ...(variables ? { variables: { static: variables } } : {}),
      tools,
    };

    writeFileSync(join(dir, "en.yaml"), stringifyYaml(content));
  }

  function setupGlobalVars(vars: Record<string, unknown>) {
    const dir = join(tmpDir, "config", "en");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "variables.yaml"), stringifyYaml({ variables: { static: vars } }));
  }

  function createService() {
    return new ToolService({
      capabilitiesPath: join(tmpDir, "capabilities"),
      skillsPath: join(tmpDir, "skills"),
      configPath: join(tmpDir, "config", "en"),
      language: "en",
    });
  }

  function createCapabilityRegistry() {
    return new CapabilityRegistry({
      capabilitiesPath: join(tmpDir, "capabilities"),
      skillsPath: join(tmpDir, "skills"),
      language: "en",
    });
  }

  // -------------------------------------------------------
  // YAML loading tests (from tool-loader.test.ts)
  // -------------------------------------------------------

  it("loads tool definitions from YAML", () => {
    setupToolYaml("sandbox", "file", [
      {
        name: "file_read",
        description: "Read a file",
        category: "sandbox",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ]);

    const service = createService();
    service.initialize();
    const tools = service.getAllDefinitions();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("file_read");
    expect(tools[0]!.description).toBe("Read a file");
  });

  it("replaces variables in tool descriptions", () => {
    setupGlobalVars({ app_name: "AgentX" });
    setupToolYaml("search", "web", [
      {
        name: "web_search",
        description: "Search the web using ${app_name}",
        category: "search",
        input_schema: { type: "object", properties: {} },
      },
    ]);

    const service = createService();
    service.initialize();
    const tool = service.getDefinition("web_search");
    expect(tool?.description).toBe("Search the web using AgentX");
  });

  it("merges file-level variables with global variables", () => {
    setupGlobalVars({ global_var: "GLOBAL" });
    setupToolYaml(
      "gen",
      "image",
      [
        {
          name: "gen_image",
          description: "${global_var} - ${local_var}",
          category: "generation",
          input_schema: { type: "object", properties: {} },
        },
      ],
      { local_var: "LOCAL" },
    );

    const service = createService();
    service.initialize();
    const tool = service.getDefinition("gen_image");
    expect(tool?.description).toBe("GLOBAL - LOCAL");
  });

  it("handles missing capabilities directory gracefully", () => {
    const service = createService();
    service.initialize();
    expect(service.getAllDefinitions()).toEqual([]);
  });

  it("getDefinition returns undefined for unknown tool", () => {
    const service = createService();
    service.initialize();
    expect(service.getDefinition("nonexistent")).toBeUndefined();
  });

  it("preserves toolType when present", () => {
    setupToolYaml("agent", "message", [
      {
        name: "attempt_completion",
        description: "Complete the task",
        category: "agent",
        input_schema: { type: "object", properties: {} },
        toolType: "terminal",
      },
    ]);

    const service = createService();
    service.initialize();
    const tool = service.getDefinition("attempt_completion");
    expect(tool?.toolType).toBe("terminal");
  });

  // -------------------------------------------------------
  // Handler registration tests (from registry.test.ts)
  // -------------------------------------------------------

  it("registers and checks handler existence", () => {
    const service = createService();
    const handler: ToolHandler = async () => ({ content: "ok" });

    service.registerHandler("file_read", handler);

    expect(service.hasHandler("file_read")).toBe(true);
    expect(service.hasHandler("nonexistent")).toBe(false);
  });

  it("unregisters a handler", () => {
    const service = createService();
    service.registerHandler("file_read", async () => ({ content: "ok" }));

    service.unregisterHandler("file_read");

    expect(service.hasHandler("file_read")).toBe(false);
  });

  // -------------------------------------------------------
  // buildTool tests
  // -------------------------------------------------------

  it("buildTool merges YAML definition with handler", () => {
    setupToolYaml("sandbox", "file", [
      {
        name: "file_read",
        description: "Read a file",
        category: "sandbox",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ]);

    const service = createService();
    service.initialize();

    const handler: ToolHandler = async () => ({ content: "file content" });
    const tool = service.buildTool("file_read", handler, { category: "parallel" });

    expect(tool.name).toBe("file_read");
    expect(tool.description).toBe("Read a file");
    expect(tool.category).toBe("parallel");
  });

  it("buildTool works without YAML definition", () => {
    const service = createService();
    service.initialize();

    const handler: ToolHandler = async () => ({ content: "result" });
    const tool = service.buildTool("custom_tool", handler);

    expect(tool.name).toBe("custom_tool");
    expect(tool.description).toBe("custom_tool");
  });

  it("built tool executes correctly", async () => {
    const service = createService();
    service.initialize();

    const handler: ToolHandler = async (args) => ({
      content: `got ${args.input}`,
    });
    const tool = service.buildTool("test_tool", handler);

    const result = await tool.execute({ input: "hello" }, { signal: AbortSignal.timeout(5000) });
    expect(result.content).toBe("got hello");
  });

  // -------------------------------------------------------
  // buildTools tests
  // -------------------------------------------------------

  it("buildTools returns only tools with both definition and handler", () => {
    setupToolYaml("sandbox", "file", [
      {
        name: "file_read",
        description: "Read a file",
        category: "sandbox",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "file_create",
        description: "Create a file",
        category: "sandbox",
        input_schema: { type: "object", properties: {} },
      },
    ]);

    const service = createService();
    service.initialize();

    // Only register handler for file_read
    service.registerHandler("file_read", async () => ({ content: "read" }), {
      category: "parallel",
    });

    const registry = createCapabilityRegistry();
    registry.initialize();

    const capabilities = registry.getAllIds();
    const tools = service.buildTools(registry, capabilities);

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("file_read");
    expect(tools[0]!.category).toBe("parallel");
  });

  it("buildTools returns empty for no matching handlers", () => {
    setupToolYaml("sandbox", "file", [
      {
        name: "file_read",
        description: "Read",
        category: "sandbox",
        input_schema: { type: "object", properties: {} },
      },
    ]);

    const service = createService();
    service.initialize();

    const registry = createCapabilityRegistry();
    registry.initialize();

    const tools = service.buildTools(registry, registry.getAllIds());
    expect(tools).toHaveLength(0);
  });
});
