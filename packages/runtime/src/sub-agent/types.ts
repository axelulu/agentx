/**
 * Sub-agent system types.
 */

// ---------------------------------------------------------------------------
// Blackboard (shared inter-agent communication)
// ---------------------------------------------------------------------------

export interface BlackboardEntry {
  key: string;
  value: string;
  agentId: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface SubAgentTask {
  /** Unique ID for this sub-agent (auto-generated if omitted) */
  id?: string;
  /** Human-readable label shown in progress */
  label: string;
  /** Self-contained task description */
  task: string;
  /** Additional context */
  context?: string;
  /** Max turns (default: 10) */
  max_turns?: number;
  /**
   * IDs of other sub-agent tasks that must complete before this one starts.
   * Enables DAG-style execution ordering within a batch.
   */
  depends_on?: string[];
}

export type SubAgentStatus = "pending" | "running" | "completed" | "error" | "cancelled";

export interface SubAgentResult {
  agentId: string;
  label: string;
  status: SubAgentStatus;
  /** Final output text */
  output: string;
  /** Files that were read/written (detected from tool calls) */
  filesModified: string[];
  filesRead: string[];
  /** Number of turns consumed */
  turns: number;
  /** Duration in ms */
  durationMs: number;
  /** Error message if status=error */
  error?: string;
}

export interface FileConflict {
  filePath: string;
  /** Agent IDs that modified this file */
  modifiedBy: string[];
}

export interface OrchestratedResult {
  results: SubAgentResult[];
  /** Files modified by multiple agents — potential conflicts */
  conflicts: FileConflict[];
  /** Aggregated summary */
  summary: string;
  /** Total duration */
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Progress events (structured, for frontend visualization)
// ---------------------------------------------------------------------------

export interface SubAgentProgressEvent {
  type: "sub_agent_progress";
  /** Batch ID for the orchestration run */
  batchId: string;
  agents: SubAgentProgressEntry[];
}

export interface SubAgentProgressEntry {
  agentId: string;
  label: string;
  status: SubAgentStatus;
  currentTurn: number;
  maxTurns: number;
  /** Currently executing tool, if any */
  activeTool?: string;
  /** Last status message */
  lastMessage?: string;
}
