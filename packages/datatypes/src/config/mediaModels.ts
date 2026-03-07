export interface MediaModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportedAspectRatios: string[];
  supportedQualities?: string[];
  supportedStyles?: string[];
  speed: "fast" | "medium" | "slow";
  qualityTier: "high" | "medium" | "standard";
}

export const IMAGE_MODELS: MediaModelInfo[] = [
  {
    id: "gemini/image",
    name: "Gemini Image",
    provider: "Google",
    description: "Google Gemini native image generation",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    supportedQualities: ["standard", "hd"],
    supportedStyles: ["vivid", "natural"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/flux-pro-v1.1",
    name: "Flux Pro 1.1",
    provider: "Black Forest Labs",
    description: "High-quality professional image generation",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/flux-dev",
    name: "Flux Dev",
    provider: "Black Forest Labs",
    description: "Development model with good quality-speed balance",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
    speed: "medium",
    qualityTier: "medium",
  },
  {
    id: "fal/flux-schnell",
    name: "Flux Schnell",
    provider: "Black Forest Labs",
    description: "Fastest Flux model for rapid iteration",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
    speed: "fast",
    qualityTier: "standard",
  },
  {
    id: "fal/ideogram-v3",
    name: "Ideogram V3",
    provider: "Ideogram",
    description: "Excellent at text rendering and typography in images",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/recraft-v3",
    name: "Recraft V3",
    provider: "Recraft",
    description: "Professional design and illustration generation",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/stable-diffusion-v35-large",
    name: "SD 3.5 Large",
    provider: "Stability AI",
    description: "Stable Diffusion 3.5 Large model",
    supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    speed: "medium",
    qualityTier: "medium",
  },
];

export const VIDEO_MODELS: MediaModelInfo[] = [
  {
    id: "gemini/veo-3.1",
    name: "Veo 3.1",
    provider: "Google",
    description: "Latest Google video generation model",
    supportedAspectRatios: ["16:9", "9:16"],
    speed: "slow",
    qualityTier: "high",
  },
  {
    id: "fal/veo3-fast",
    name: "Veo 3 Fast",
    provider: "Google",
    description: "Fast Veo 3 via fal.ai",
    supportedAspectRatios: ["16:9", "9:16"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/kling-v2.1-pro",
    name: "Kling 2.1 Pro",
    provider: "Kuaishou",
    description: "High-quality cinematic video generation",
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    speed: "slow",
    qualityTier: "high",
  },
  {
    id: "fal/minimax-video-01",
    name: "MiniMax Video-01",
    provider: "MiniMax",
    description: "Fast and versatile video generation",
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    speed: "medium",
    qualityTier: "medium",
  },
  {
    id: "fal/luma-ray2",
    name: "Luma Ray2",
    provider: "Luma AI",
    description: "Luma Dream Machine Ray2 for creative video",
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    speed: "medium",
    qualityTier: "high",
  },
  {
    id: "fal/hunyuan-video",
    name: "HunyuanVideo",
    provider: "Tencent",
    description: "Open-source high-quality video generation",
    supportedAspectRatios: ["16:9", "9:16"],
    speed: "slow",
    qualityTier: "medium",
  },
];
