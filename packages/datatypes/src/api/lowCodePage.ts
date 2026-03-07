// Low-code page types

export interface LowCodePageMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  twitterImage?: string;
}

// ============ Section Config Types ============

// Hero Section
export interface HeroSectionConfig {
  badge?: {
    icon?: string; // Lucide icon name
    text: string;
  };
  title?: {
    gradient?: string;
    subtitle?: string;
  };
  description?: string;
  cta?: {
    text: string;
    link: string;
  };
  metrics?: Array<{
    value: string;
    label: string;
  }>;
}

// Features Section
export interface FeaturesSectionConfig {
  badge?: string;
  title: string;
  description?: string;
  features: Array<{
    icon: string; // Lucide icon name
    title: string;
    description: string;
    metric: string;
    metricLabel: string;
  }>;
}

// Capabilities Section
export interface CapabilitiesSectionConfig {
  badge?: string;
  title: string;
  description?: string;
  capabilities: Array<{
    icon: string; // Lucide icon name
    title: string;
    description: string;
    examples: string[];
  }>;
}

// FAQ Section
export interface FAQSectionConfig {
  badge?: string;
  title: string;
  description?: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  bottomCTA?: {
    text: string;
    link: string;
    linkText: string;
  };
}

// CTA Section
export interface CTASectionConfig {
  badge?: string;
  title: string;
  description?: string;
  primaryButton?: {
    text: string;
    link: string;
  };
  secondaryButton?: {
    text: string;
    link: string;
  };
  stats?: Array<{
    icon: string; // Lucide icon name
    value: string;
    label: string;
  }>;
}

// ============ Section Union Types ============

export type LowCodePageSection =
  | { type: "hero"; config: HeroSectionConfig }
  | { type: "features"; config: FeaturesSectionConfig }
  | { type: "capabilities"; config: CapabilitiesSectionConfig }
  | { type: "faq"; config: FAQSectionConfig }
  | { type: "cta"; config: CTASectionConfig };

// Helper type to extract config type from section type
export type SectionConfigType<T extends LowCodePageSection["type"]> = Extract<
  LowCodePageSection,
  { type: T }
>["config"];

export interface LowCodePage {
  id: string;
  route: string;
  title: string;
  description: string | null;
  metadata: LowCodePageMetadata | null;
  sections: LowCodePageSection[] | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export interface NewLowCodePage {
  id: string;
  route: string;
  title: string;
  description?: string;
  metadata?: LowCodePageMetadata;
  sections?: LowCodePageSection[];
  status?: string;
}

export interface UpdateLowCodePageRequest {
  title?: string;
  description?: string;
  metadata?: LowCodePageMetadata;
  sections?: LowCodePageSection[];
}

export interface CreateLowCodePageRequest {
  route: string;
  title: string;
  description?: string;
  metadata?: LowCodePageMetadata;
  sections?: LowCodePageSection[];
}
