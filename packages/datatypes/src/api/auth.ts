/**
 * User account information (linked provider accounts)
 */
export interface UserAccountInfo {
  id: string;
  providerId: string; // e.g., "google", "github", "credential"
  accountId: string; // Provider's unique identifier
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response for getting user linked accounts
 */
export interface GetUserAccountsResponse {
  accounts: UserAccountInfo[];
}
