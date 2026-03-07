/**
 * Subscription plan configuration from SubscriptionInitializer
 * This is the full configuration with all pricing and feature details
 */
export interface SubscriptionPlan {
  planCode: string;
  planName: string;
  description: string;
  monthlyCredits: number;
  concurrentTasks: number;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  pricing: {
    monthly: {
      price: number;
      originalPrice: number | null;
      discount: string | null;
    };
    yearly: {
      price: number;
      originalPrice: number | null;
      discount: string | null;
    };
  };
  limits: {
    agents: string;
    credits: string;
    privateProjects: string;
    customTriggers?: string;
  };
  features: {
    monthlyCredits: number;
    concurrentAgents: number;
    privateProjects: number;
    customTriggers?: number;
    customAbilities?: boolean;
    integrations?: number;
    premiumAiModels?: boolean;
    advancedAiCapabilities?: boolean;
    prioritySupport?: boolean;
    featureList: string[];
    capabilities: string[];
  };
  cta: string;
  popular: boolean;
  enterprise: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Membership plan configuration data type
 */
export interface MembershipPlan {
  id?: string;
  planCode: string;
  planName: string;
  description?: string | null;
  monthlyCredits: number;
  concurrentTasks: number;
  monthlyPrice: number;
  yearlyPrice: number;
  features?: Record<string, any> | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User membership information data type
 */
export interface UserMembership {
  id?: string;
  userId: string;
  planCode: string;
  status: "active" | "cancelled" | "expired" | "paused";
  billingCycle: "monthly" | "yearly";
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextBillingDate?: Date | null;
  cancelledAt?: Date | null;
  autoRenew: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  trialEndsAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User permissions configuration
 */
export interface MembershipPermissions {
  planCode: string;
  planName: string;
  concurrentTasks: number;
  monthlyCredits: number;
  features: Record<string, any>;
}

/**
 * User permissions configuration response
 */
export interface MembershipPermissionsResponse {
  planCode: string;
  planName: string;
  concurrentTasks: number;
  monthlyCredits: number;
  features: Record<string, any>;
}

/**
 * User statistics information response
 */
export interface UserStatsResponse {
  credits: {
    currentBalance: number;
    totalEarned: number;
    totalSpent: number;
  };
  checkIn: {
    currentStreak: number;
    canCheckInToday: boolean;
    lastCheckInDate: string | null;
  };
  subscription: {
    planCode: string;
    planName: string;
    concurrentTasks: number;
    monthlyCredits: number;
  };
}
