# AgentX macOS Deep Integration — Feature Proposals

> 生成日期：2026-03-29
> 状态：提案阶段

---

## Tier 1 — 高价值核心功能

### 1. 系统级剪贴板 AI 管道 (Clipboard AI Pipeline)

- 监听系统剪贴板变化，自动识别内容类型（代码、文本、URL、图片）
- 快捷键触发 AI 处理：翻译、总结、代码解释、重写、格式转换
- 处理结果自动写回剪贴板，无缝粘贴
- 已有 `Alt+Space` 快捷键基础和 `global-shortcut` 插件，扩展成本低

**为什么重要**：最高频的交互场景，几乎每个用户每天都在复制粘贴

**技术依赖**：

- `tauri-plugin-global-shortcut`（已有）
- `tauri-plugin-clipboard-manager`（需新增）
- Rust 侧 `NSPasteboard` 监听

---

### 2. macOS Accessibility API 全屏幕感知

- 利用已有的 Accessibility 权限，读取任意 App 的 UI 元素树
- Agent 可以"看到"并理解当前前台应用的内容（不仅仅是截图 OCR）
- 实现"帮我把这个 Excel 表格的数据整理一下"、"帮我填这个表单"
- 已有 `com.apple.security.automation.apple-events` 权限和 `macOSPrivateApi: true`

**为什么重要**：这是真正的"桌面 AI Agent"——能看、能操作其他应用

**技术依赖**：

- macOS Accessibility API (`AXUIElement`)
- `com.apple.security.automation.apple-events`（已有）
- Rust FFI → Objective-C bindings

---

### 3. Finder 右键菜单集成 (Finder Context Menu)

- 注册 macOS Finder Extension / Services Menu
- 右键文件 → "用 AgentX 分析"、"用 AgentX 总结"、"用 AgentX 重命名"
- 支持批量文件处理（代码审查、文档摘要、图片描述）
- 已有文件系统读写能力和 `tauri-plugin-fs`

**为什么重要**：零摩擦的入口，用户不需要先打开 AgentX 再拖文件

**技术依赖**：

- Finder Sync Extension（独立 target）
- XPC 进程间通信
- `x-callback-url` 或 Deep Link 唤起 AgentX

---

### 4. macOS Shortcuts.app 集成

- 将 AgentX 的核心能力暴露为 Shortcuts Actions
- 用户可以在快捷指令中组合：选中文本 → AgentX 翻译 → 通知结果
- 与 Siri 语音联动："Hey Siri, 让 AgentX 总结我的剪贴板"
- 通过 App Intents framework 或 x-callback-url scheme 实现

**为什么重要**：接入 Apple 生态自动化体系，组合出无限可能

**技术依赖**：

- App Intents framework（macOS 13+）
- `x-callback-url` scheme 注册
- Siri Intent Extension

---

## Tier 2 — 高实用性功能

### 5. 智能通知中心 (Notification Intelligence)

- 读取 macOS 通知中心的通知流（通过 Accessibility API）
- AI 自动分类、优先级排序、聚合摘要
- 重要通知主动提醒，垃圾通知静默
- 结合已有的 Focus Mode 状态做智能决策

**为什么重要**：通知焦虑是真实痛点，AI 做通知管家很有价值

**技术依赖**：

- macOS Accessibility API
- `NSUserNotificationCenter` / `UNUserNotificationCenter`
- 已有 `tauri-plugin-notification`

---

### 6. 系统监控 AI 诊断 (System Health AI)

- 实时监控 CPU、内存、磁盘、网络、电池
- AI 智能诊断异常（"为什么风扇突然很响？"→ 分析进程列表）
- 主动告警："你的磁盘空间只剩 5GB，要帮你清理吗？"
- 通过 `sysctl`、`top`、`diskutil` 等命令获取数据，已有 shell 执行能力

**为什么重要**：把系统维护从"被动救火"变成"主动管家"

**技术依赖**：

- `sysctl` / `IOKit` / `mach_host_info`
- 已有 shell 执行工具
- 定时采集 + 异常检测逻辑

---

### 7. 日历/提醒事项/备忘录联动

- 通过 AppleScript/EventKit 读写 Calendar、Reminders、Notes
- "帮我把这个会议纪要加到日历"、"明天下午 3 点提醒我部署"
- Agent 可以在对话中引用日历上下文："你今天有 3 个会议"
- 已有 AppleScript 权限 (`apple-events`)

**为什么重要**：AI 助手 + 日程管理 = 真正的个人助理

**技术依赖**：

- EventKit framework 或 AppleScript bridge
- `com.apple.security.personal-information.calendars`
- `com.apple.security.personal-information.notes`

---

### 8. 全局 OCR 截屏识别

- 快捷键框选屏幕区域 → 截图 → Vision API 识别内容
- 识别后自动送入 Agent 对话：翻译、代码提取、表格转 CSV
- 利用 macOS 原生 Vision framework 做本地 OCR（零延迟）
- 已有截屏能力（`screen recording` 权限）和图片处理

**为什么重要**：打破"非文本内容无法喂给 AI"的壁垒

**技术依赖**：

- macOS Vision framework (`VNRecognizeTextRequest`)
- `CGWindowListCreateImage` 截屏（已有）
- Rust → Swift/Objective-C FFI

---

## Tier 3 — 差异化创新功能

### 9. AppleScript/JXA 自动化引擎

- Agent 可以生成并执行 AppleScript/JXA 脚本操作任意 macOS 应用
- "帮我把 Keynote 里的所有幻灯片标题导出来"
- "帮我在 Safari 里打开这 10 个链接"
- "帮我把 Finder 里选中的文件按日期分文件夹"
- 已有 AppleScript 权限，只需扩展 tool handler

**为什么重要**：让 AI Agent 真正成为 macOS 的"万能遥控器"

**技术依赖**：

- `NSAppleScript` / `osascript` 命令
- `com.apple.security.automation.apple-events`（已有）
- JXA (JavaScript for Automation) runtime

---

### 10. 菜单栏常驻模式 (Menu Bar Companion)

- 除了 Tray icon，增加 Menu Bar 面板（类似 Bartender/iStat）
- 一键显示：当前 Agent 状态、快速提问、最近对话
- 显示系统状态摘要、待处理通知数
- 鼠标悬停自动展开，点击外部自动收起
- 已有 `tray.rs` 和 `quickchat.rs` 基础

**为什么重要**：降低使用门槛，AI 助手应该"随时在身边"

**技术依赖**：

- 已有 `tray.rs`、`quickchat.rs`
- Tauri window `decorations: false` + 定位逻辑
- `NSPopover` 或自定义 panel window

---

### 11. 文件智能标签 & Spotlight 集成

- AI 自动分析文件内容，生成 macOS 文件标签 (Finder Tags)
- 通过 `xattr` 写入 Spotlight 可搜索的元数据
- Spotlight 搜索 → 打开 AgentX 查看 AI 分析结果
- 注册 Spotlight Importer 让 AgentX 对话可被全局搜索

**为什么重要**：AI 增强的文件组织，和 macOS 原生体验深度融合

**技术依赖**：

- `xattr` / `MDItemSetAttribute`
- Spotlight Importer plugin（`.mdimporter` bundle）
- Finder Tags API (`NSURLTagNamesKey`)

---

### 12. 拖拽万物 (Universal Drag & Drop)

- 从任意应用拖拽内容（文本、图片、文件、URL）到 AgentX 悬浮窗
- 自动识别类型并推荐操作：代码 → 解释/优化，图片 → 描述/编辑
- AgentX 结果可以拖出到其他应用
- 利用 macOS NSPasteboard 和 Tauri window 事件

**为什么重要**：最自然的交互方式，真正的"所拖即所得"

**技术依赖**：

- `NSPasteboard` drag types
- Tauri `on_drop_event` / `ondragover`
- 悬浮窗 drop zone UI

---

### 13. Focus Mode 联动

- 检测当前 macOS Focus 模式（工作/个人/睡眠/勿扰）
- 自动调整 Agent 行为：工作模式 → 编程助手人设；个人模式 → 生活助手
- 自动切换通知策略、快捷键集、默认 prompt
- 通过 `NSDoNotDisturb` API 获取状态

**为什么重要**：AI 理解你的场景，无需手动切换

**技术依赖**：

- `NSDoNotDisturbCenter`（private API）
- Focus Filter API（macOS 15+）
- 已有 `macOSPrivateApi: true`

---

### 14. Touch ID 安全保护

- 涉及敏感操作（发送消息到 Channel、执行 shell 命令、访问密钥）时要求 Touch ID
- API Key 存入 macOS Keychain（而非明文配置文件）
- 已有 `tauri-plugin-stronghold` 可用于安全存储

**为什么重要**：安全 + 便捷，AI Agent 有执行权限，安全不能松懈

**技术依赖**：

- `LocalAuthentication` framework (`LAContext`)
- macOS Keychain Services
- `tauri-plugin-stronghold`（已有可用）

---

## 实施优先级矩阵

| 优先级 | 功能                     | 工作量 | 影响力     | 技术风险 |
| ------ | ------------------------ | ------ | ---------- | -------- |
| **P0** | 剪贴板 AI 管道           | 中     | ⭐⭐⭐⭐⭐ | 低       |
| **P0** | Accessibility 全屏幕感知 | 高     | ⭐⭐⭐⭐⭐ | 中       |
| **P1** | AppleScript 自动化引擎   | 中     | ⭐⭐⭐⭐   | 低       |
| **P1** | 全局 OCR 截屏识别        | 中     | ⭐⭐⭐⭐   | 低       |
| **P1** | 日历/提醒/备忘录联动     | 中     | ⭐⭐⭐⭐   | 低       |
| **P2** | Finder 右键菜单          | 高     | ⭐⭐⭐⭐   | 高       |
| **P2** | Shortcuts.app 集成       | 高     | ⭐⭐⭐⭐   | 高       |
| **P2** | 菜单栏常驻模式           | 低     | ⭐⭐⭐     | 低       |
| **P3** | 系统监控 AI 诊断         | 低     | ⭐⭐⭐     | 低       |
| **P3** | 智能通知中心             | 中     | ⭐⭐⭐     | 中       |
| **P3** | 拖拽万物                 | 中     | ⭐⭐⭐     | 低       |
| **P3** | 文件标签 & Spotlight     | 中     | ⭐⭐⭐     | 中       |
| **P3** | Focus Mode 联动          | 低     | ⭐⭐       | 低       |
| **P3** | Touch ID 安全            | 低     | ⭐⭐       | 低       |

---

## 建议首批实施组合

**推荐先做：剪贴板 AI 管道 + AppleScript 自动化引擎**

这两个功能组合在一起，可以让 AgentX 成为真正的 macOS 自动化中枢：

1. 剪贴板管道覆盖最高频场景，用户感知最强
2. AppleScript 引擎复用已有权限，开发成本低，扩展性极高
3. 两者结合可实现：复制内容 → AI 处理 → 自动粘贴到目标应用
