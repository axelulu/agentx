/**
 * Editor State Types
 * Defines persistent state structures for Canvas and Video editors
 */

// ============================================================
// Base Types
// ============================================================

/**
 * Base interface for all editor states
 */
export interface EditorStateBase {
  /** Schema version for future migrations */
  version: number;
  /** Last edit timestamp (Unix timestamp in ms) */
  lastEditedAt: number;
}

/**
 * Editor type discriminator
 */
export type EditorType = "canvas" | "video";

// ============================================================
// Canvas Editor State
// ============================================================

/**
 * Serialized Fabric.js object
 * Using Record<string, unknown> for flexibility since Fabric.js types are complex
 */
export interface FabricObject {
  type: string;
  [key: string]: unknown;
}

/**
 * Canvas image metadata
 */
export interface CanvasImageMetadata {
  id: string;
  url: string;
  filename: string;
  source: "ai_generated" | "user_uploaded";
  timestamp: number;
  messageId: string;
}

/**
 * Fabric.js canvas serialization
 */
export interface FabricCanvasState {
  version: string;
  objects: FabricObject[];
  background?: string;
}

/**
 * Canvas viewport state
 */
export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Canvas layout configuration
 */
export interface CanvasLayout {
  columns: number;
  spacing: number;
}

/**
 * Complete Canvas Editor State
 */
export interface CanvasEditorState extends EditorStateBase {
  /** Fabric.js canvas state */
  fabricCanvas: FabricCanvasState;
  /** Image metadata */
  images: CanvasImageMetadata[];
  /** Viewport settings */
  viewport: CanvasViewport;
  /** Layout settings (deprecated, kept for backwards compatibility) */
  layout?: CanvasLayout;
}

// ============================================================
// Video Editor State
// ============================================================

/**
 * Video aspect ratio options
 */
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

/**
 * Video clip effects
 */
export interface VideoClipEffects {
  volume?: number; // 0-1 range
  filters?: string[]; // Array of filter names
}

/**
 * Video clip with user edits
 */
export interface VideoClipState {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;

  /** User edits */
  trimStart?: number; // Seconds trimmed from start
  trimEnd?: number; // Seconds trimmed from end
  order: number; // User-defined order (0-based)

  /** Effects/filters */
  effects?: VideoClipEffects;
}

/**
 * Timeline view settings
 */
export interface VideoTimelineState {
  zoomScale: number; // 1.0 = 100%, range typically 0.5 - 4.0
  scrollLeft: number; // Horizontal scroll position in pixels
}

/**
 * Video export configuration
 */
export interface VideoExportConfig {
  aspectRatio: VideoAspectRatio;
  fps: number;
  resolution?: {
    width: number;
    height: number;
  };
}

/**
 * Audio clip state for persistence
 */
export interface AudioClipState {
  id: string;
  audioUrl: string;
  name: string;
  duration: number;
  startTime: number;
  volume: number;
  index: number;
  audioType?: "speech" | "music" | "sound_effect";
  subtitle?: string;
  subtitleUrl?: string;
}

/**
 * Voice clip state for persistence
 */
export interface VoiceClipState {
  id: string;
  audioUrl: string;
  subtitle: string;
  duration: number;
  startTime: number;
  volume: number;
  index: number;
}

/**
 * Uploaded asset state for persistence
 */
export interface UploadedAssetState {
  id: string;
  url: string;
  name: string;
  type: "video" | "audio" | "voice";
  duration: number;
  thumbnailUrl?: string;
}

/**
 * Complete Video Editor State
 */
export interface VideoEditorState extends EditorStateBase {
  /** Video clips with user's custom order and edits */
  clips: VideoClipState[];
  /** Audio track clips */
  audioClips?: AudioClipState[];
  /** Voice track clips */
  voiceClips?: VoiceClipState[];
  /** User-uploaded assets */
  uploadedAssets?: UploadedAssetState[];
  /** Timeline view settings */
  timeline: VideoTimelineState;
  /** Export settings */
  export: VideoExportConfig;
}

// ============================================================
// Database Record Types
// ============================================================

/**
 * Editor state database record
 */
export interface EditorStateRecord<T = CanvasEditorState | VideoEditorState> {
  id: string;
  sessionId: string;
  messageId?: string;
  editorType: EditorType;
  state: T;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Type guard for CanvasEditorState
 */
export function isCanvasEditorState(
  state: CanvasEditorState | VideoEditorState
): state is CanvasEditorState {
  return "fabricCanvas" in state && "images" in state;
}

/**
 * Type guard for VideoEditorState
 */
export function isVideoEditorState(
  state: CanvasEditorState | VideoEditorState
): state is VideoEditorState {
  return "clips" in state && "timeline" in state;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * Save editor state request
 */
export interface SaveEditorStateRequest<T = CanvasEditorState | VideoEditorState> {
  sessionId: string;
  messageId?: string;
  editorType: EditorType;
  state: T;
}

/**
 * Save editor state response
 */
export interface SaveEditorStateResponse {
  success: boolean;
  id: string;
  version: number;
  updatedAt: string;
}

/**
 * Load editor state request params
 */
export interface LoadEditorStateParams {
  sessionId: string;
  editorType: EditorType;
}

/**
 * Load editor state response
 */
export interface LoadEditorStateResponse<T = CanvasEditorState | VideoEditorState> {
  success: boolean;
  data?: EditorStateRecord<T>;
  error?: string;
}

/**
 * Delete editor state request params
 */
export interface DeleteEditorStateParams {
  sessionId: string;
  editorType: EditorType;
}

/**
 * Delete editor state response
 */
export interface DeleteEditorStateResponse {
  success: boolean;
}

// ============================================================
// State Factory Functions
// ============================================================

/**
 * Create initial Canvas Editor State
 */
export function createInitialCanvasState(): CanvasEditorState {
  return {
    version: 1,
    lastEditedAt: Date.now(),
    fabricCanvas: {
      version: "5.3.0", // Fabric.js version
      objects: [],
      background: undefined,
    },
    images: [],
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };
}

/**
 * Create initial Video Editor State
 */
export function createInitialVideoState(
  aspectRatio: VideoAspectRatio = "16:9",
  fps: number = 30
): VideoEditorState {
  return {
    version: 1,
    lastEditedAt: Date.now(),
    clips: [],
    timeline: {
      zoomScale: 1,
      scrollLeft: 0,
    },
    export: {
      aspectRatio,
      fps,
    },
  };
}
