/**
 * 用户查询返回字段类型
 */
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  profileVisible: boolean | null;
  twoFactorEnabled: boolean | null;
  role: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 用户更新字段类型
 */
export interface UserUpdate {
  name?: string;
  bio?: string;
  image?: string;
  profileVisible?: boolean;
  updatedAt: Date;
}

/**
 * 更新用户信息参数
 */
export interface UpdateUserInfoParams {
  name?: string;
  bio?: string;
  image?: string;
  profileVisible?: boolean;
}

/**
 * 更新用户设置参数
 */
export interface UpdateUserSettingsParams {
  theme?: string;
  language?: string;
  integrations?: {
    slack?: boolean;
    discord?: boolean;
    webhook?: boolean;
  };
  otherInfo?: Record<string, any>;
}

/**
 * 组合用户信息更新参数
 */
export interface CombinedUserInfoUpdate {
  user?: UpdateUserInfoParams;
  settings?: UpdateUserSettingsParams;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  user: UserInfo;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
