/**
 * User referral relationship data type
 */
export interface ReferralRelationship {
  id?: string;
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: "pending" | "completed" | "invalid";
  referrerCreditsEarned: number;
  refereeCreditsEarned: number;
  completedAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * ReferralRewardsDialog component data
 */
export interface ReferralRewardsData {
  stats: {
    totalPoints: number;
    checkInPoints: number;
    referralPoints: number;
    totalCheckIns: number;
    totalReferrals: number;
  };
  checkInHistory: Array<{
    date: string;
    points: number;
  }>;
  referralCode: string;
  referralUrl: string;
  isCheckedInToday: boolean;
  referralUsers: Array<{
    id: string;
    name: string;
    earnedPoints: number;
  }>;
  totalCreditsEarned: number;
}
