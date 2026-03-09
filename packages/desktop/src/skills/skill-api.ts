import type { SkillDefinition } from "../types.js";

const API_BASE = "https://prompts.chat/api";

interface ApiPrompt {
  id: string;
  title: string;
  description: string;
  content: string;
  category?: { name: string } | null;
  tags?: Array<{ tag: { name: string } }>;
  author?: { name: string; username: string } | null;
  voteCount?: number;
}

interface ApiSearchResponse {
  prompts: ApiPrompt[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function mapApiPrompt(p: ApiPrompt): SkillDefinition {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    content: p.content,
    category: p.category?.name ?? "Other",
    tags: p.tags?.map((t) => t.tag.name) ?? [],
    author: p.author?.name ?? p.author?.username ?? "Unknown",
    voteCount: p.voteCount ?? 0,
  };
}

/**
 * Search the prompts.chat public API.
 *
 * NOTE: The REST `category` query-param is non-functional (always returns 0).
 * We use `tag` instead which works reliably. When no tag is provided the API
 * returns all prompts (1400+) sorted by newest.
 */
export async function searchSkills(
  query: string,
  tag?: string,
  perPage = 20,
): Promise<{ skills: SkillDefinition[]; total: number }> {
  const params = new URLSearchParams({ perPage: String(perPage) });
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);

  const url = `${API_BASE}/prompts?${params.toString()}`;
  console.log("[SkillAPI] Fetching:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[SkillAPI] HTTP error:", res.status, body);
    throw new Error(`Skills API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ApiSearchResponse;
  console.log("[SkillAPI] Got", data.prompts.length, "of", data.total, "results");
  return {
    skills: data.prompts.map(mapApiPrompt),
    total: data.total,
  };
}

export async function getSkill(id: string): Promise<SkillDefinition> {
  const res = await fetch(`${API_BASE}/prompts/${id}`);
  if (!res.ok) {
    throw new Error(`Skills API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ApiPrompt;
  return mapApiPrompt(data);
}
