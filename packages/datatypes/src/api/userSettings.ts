/**
 * 用户设置数据库记录类型
 */
export interface UserSettings {
  id?: string;
  userId?: string;
  theme: string;
  language: string;
  timezone: string;
  currency: string;
  locale: string;
  otherInfo?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 用户设置更新数据类型
 */
export interface UserSettingsUpdate {
  theme?: string;
  language?: string;
  otherInfo?: Record<string, any>;
  updatedAt?: Date;
}
