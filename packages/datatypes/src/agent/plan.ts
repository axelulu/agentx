/**
 * Plan execution related types
 */

/**
 * 步骤状态枚举
 */
export type StepStatus = "todo" | "doing" | "done" | "failed";

/**
 * 执行步骤接口
 */
export interface ExecutionStep {
  id: string;
  title: string;
  status: StepStatus;
}

/**
 * 执行计划接口
 */
export interface ExecutionPlan {
  plan?: string;
  activeStep: string;
  progressStatus: string;
  selfReflection: string;
}

/**
 * Plan decision types
 */
export type PlanDecision =
  | {
      action: "revise_plan";
      plan: ExecutionPlan;
    }
  | {
      action?: "continue_plan";
      plan: ExecutionPlan;
    };

/**
 * 计划生成请求
 */
export interface PlanGenerationRequest {
  userMessage: string;
  context?: Record<string, any>;
  preferences?: {
    detailLevel: "basic" | "detailed" | "comprehensive";
    includeTimeEstimates: boolean;
    includeDependencies: boolean;
  };
}

/**
 * 计划优化选项
 */
export interface PlanOptimizationOptions {
  parallelExecution: boolean;
  riskAssessment: boolean;
  resourceOptimization: boolean;
  fallbackStrategies: boolean;
}
