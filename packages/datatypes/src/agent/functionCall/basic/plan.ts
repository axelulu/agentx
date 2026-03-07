// ===== 计划管理工具参数 =====

/**
 * 修订计划工具输入参数
 */
export interface RevisePlanParams {
  plan: string;
  activeStep: string;
  progressStatus: string;
  selfReflection: string;
}

/**
 * 继续计划工具输入参数
 */
export interface ContinuePlanParams {
  activeStep: string;
  progressStatus: string;
  selfReflection: string;
}
