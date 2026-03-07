/**
 * User points account data type
 */
export interface UserPoints {
  id?: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastRefillAt?: Date | null;
  lastCheckInAt?: Date | null;
  checkInStreak: number;
  registrationCreditsGiven: boolean;
  referralCode: string;
  totalReferrals: number;
  referralCreditsEarned: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Points transaction record data type
 */
export interface PointsTransaction {
  id?: string;
  userId: string;
  type:
    | "earn"
    | "spend"
    | "refill"
    | "bonus"
    | "refund"
    | "check_in"
    | "registration"
    | "subscription"
    | "referral_reward" // Referrer reward
    | "referral_bonus"; // Referee reward
  amount: number;
  description: string;
  relatedType?: string | null;
  relatedId?: string | null;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}

/**
 * Points transaction type parameters
 */
export interface PointsTransactionParams {
  userId: string;
  type:
    | "earn"
    | "spend"
    | "refill"
    | "bonus"
    | "refund"
    | "check_in"
    | "registration"
    | "subscription";
  amount: number;
  description: string;
  relatedType?: string;
  relatedId?: string;
  metadata?: Record<string, any>;
}

/**
 * Points usage parameters
 */
export interface PointsUsageParams {
  userId: string;
  amount: number;
  description: string;
  relatedType?: string;
  relatedId?: string;
}

/**
 * Points earn parameters
 */
export interface PointsEarnParams {
  userId: string;
  amount: number;
  description: string;
  type?: "earn" | "refill" | "bonus" | "refund";
  relatedType?: string;
  relatedId?: string;
}

/**
 * Points history query parameters
 */
export interface PointsHistoryQuery {
  userId: string;
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
  type?:
    | "earn"
    | "spend"
    | "refill"
    | "bonus"
    | "refund"
    | "check_in"
    | "registration"
    | "subscription";
  relatedType?: string;
  relatedId?: string;
}

/**
 * Points statistics information
 */
export interface PointsStats {
  totalUsers: number;
  totalCreditsIssued: number;
  totalCreditsSpent: number;
  activeSubscriptions: number;
  byPlanType: Record<string, number>;
}

/**
 * Points balance query response
 */
export interface PointsBalanceResponse {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastRefillAt: Date | null;
  subscription: {
    planCode: string;
    planName: string;
    monthlyCredits: number;
    concurrentTasks: number;
    status: string;
  } | null;
}

/**
 * Redemption code data type
 */
export interface RedemptionCode {
  id?: string;
  code: string;
  credits: number;
  description?: string | null;
  maxUsageCount: number;
  currentUsageCount: number;
  expiresAt?: Date | null;
  isActive: boolean;
  createdBy?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Redemption history data type
 */
export interface RedemptionHistory {
  id?: string;
  redemptionCodeId: string;
  userId: string;
  code: string;
  creditsEarned: number;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}

/**
 * Create redemption code request parameters
 */
export interface CreateRedemptionCodeParams {
  code?: string;
  credits: number;
  description?: string;
  maxUsageCount: number;
  expiresAt?: Date;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Batch create redemption codes parameters
 */
export interface BatchCreateRedemptionCodesParams {
  prefix?: string;
  count: number;
  credits: number;
  description?: string;
  maxUsageCount: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Redemption code query parameters
 */
export interface RedemptionCodeQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  includeExpired?: boolean;
}

/**
 * Redemption history query parameters
 */
export interface RedemptionHistoryQuery {
  userId?: string;
  code?: string;
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Redeem code response
 */
export interface RedeemCodeResponse {
  success: boolean;
  creditsEarned: number;
  newBalance: number;
  message: string;
}
