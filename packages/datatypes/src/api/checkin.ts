/**
 * User check-in record data type
 */
export interface CheckInRecord {
  id?: string;
  userId: string;
  checkInDate: string; // YYYY-MM-DD format
  creditsEarned: number;
  streak: number;
  bonusMultiplier: number;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}

/**
 * Check-in parameters
 */
export interface CheckInParams {
  userId: string;
  baseCredits?: number;
  bonusMultiplier?: number;
  metadata?: Record<string, any>;
}

/**
 * Check-in status response
 */
export interface CheckInStatusResponse {
  canCheckIn: boolean;
  todayCheckedIn: boolean;
  currentStreak: number;
  lastCheckInDate: string | null;
}

/**
 * CheckInPanel component data
 */
export interface CheckInPanelData {
  consecutiveDays: number;
  todayPoints: number;
  isCheckedIn: boolean;
}

/**
 * ReferralRewardsDialog 需要的数据
 */
export interface ReferralRewardsDialogData {
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
    avatar: string;
    earnedPoints: number;
  }>;
}
