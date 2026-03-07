// ===== Shell执行工具参数 =====

/**
 * 运行命令工具输入参数
 */
export interface RunCommandParams {
  command: string;
  folder?: string;
  blocking?: boolean;
  timeout?: number;
}

/**
 * 检查命令输出工具输入参数
 */
export interface CheckCommandOutputParams {
  sessionName: string;
  killSession?: boolean;
}

/**
 * 终止命令工具输入参数
 */
export interface TerminateCommandParams {
  sessionName: string;
}

/**
 * 列出命令工具输入参数
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListCommandsParams {
  // 无参数
}

// ===== Shell执行工具返回结果 =====

export interface ShellExecutionResult {
  output?: string;
  sessionName?: string;
  cwd?: string;
  completed?: boolean;
  exitCode?: number;
  sessions?: string[];
}

export interface ShellExecutionResponse {
  success: boolean;
  message: string;
  result?: ShellExecutionResult;
}
