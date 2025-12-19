
// Data Models

// 1. Character with Behaviors
export interface BehaviorExample {
  context: string; // The situation (e.g., "Betrayed by a friend")
  response: string; // How they act/speak
}

export interface Character {
  id: string;
  name: string;
  role: string; // Protagonist, Antagonist, Support
  tags: string[]; // e.g. "Brave", "Cynical"
  description: string;
  behaviorExamples: BehaviorExample[]; // New: Situational reactions
}

// 2. Blueprint Versioning
export interface StoryStructure {
  hook: string;
  incitingIncident: string;
  risingAction: string;
  climax: string;
  fallingAction: string;
  resolution: string;
}

export type StructureBeat = 'hook' | 'incitingIncident' | 'risingAction' | 'climax' | 'fallingAction' | 'resolution';

export const STRUCTURE_BEATS: StructureBeat[] = ['hook', 'incitingIncident', 'risingAction', 'climax', 'fallingAction', 'resolution'];

export interface Blueprint {
  id: string;
  versionName: string; // e.g. "Initial Draft", "V2 after plot twist"
  timestamp: number;
  data: StoryStructure;
  beatVersions?: Partial<Record<StructureBeat, BeatVersionState>>;
  // 章节逆向拆解内容：key为章节号，value为逆向拆解结果（向后兼容，新版本使用chapterDeconstructionVersions）
  chapterDeconstructions?: Record<number, string>;
  // 章节逆向拆解版本管理：key为章节号，value为版本状态
  chapterDeconstructionVersions?: Record<number, BeatVersionState>;
}

// 3. Volume & Chapter Hierarchy
export interface Volume {
  id: string;
  number: number;
  title: string;
  summary: string;
}

export interface ContentVersion {
  id: string;
  versionName: string; // e.g. "Draft 1", "AI Revision"
  timestamp: number;
  text: string;
  isLocked?: boolean; // 是否锁定（防止误删）
  isContext?: boolean; // 是否作为上下文发送给AI（只有一个版本可以开启）
  modelId?: string; // 生成此版本时使用的模型ID
}

export interface BeatVersionState {
  activeVersionId: string;
  versions: ContentVersion[];
}

export interface Chapter {
  id: string;
  volumeId?: string; // Link to a volume
  number: number; // Absolute number or relative to volume
  title: string; // Should include "ChX" prefix visually or logically
  summary: string; // 简洁版章纲（向后兼容，新版本使用summaryVersions）
  summaryDetailed?: string; // 详细版章纲（可选）
  useDetailedSummary?: boolean; // 是否使用详细版（默认 false，使用简洁版）
  
  // Versioned Content
  activeVersionId: string;
  contentVersions: ContentVersion[];
  
  // Versioned Summary (章纲版本管理)
  activeSummaryVersionId?: string;
  summaryVersions?: ContentVersion[];
}

// 4. World Building & Settings
export interface WorldEntry {
  id: string;
  category: string; 
  name: string;
  description: string;
}

// 5. Story Bible (故事圣经) - 动态跟踪故事状态（版本化，每章一个版本）
export interface StoryBibleVersion {
  chapterNumber: number; // 对应的章节号
  volumeNumber?: number; // 对应的卷号（可选）
  character_status: string; // 人物状态表：[角色名]：[状态/位置/关键变化]
  key_items_and_locations: string; // 物品与地点：关键道具的持有者变更、当前所在位置的环境特征
  active_plot_threads: string; // 当前未解决的伏笔：列出当前悬而未决的冲突或任务
  important_rules: string; // 临时规则/备注：本章新增的、对后续剧情有长期影响的设定
  timestamp: number; // 更新时间戳
}

export interface StoryBible {
  versions: StoryBibleVersion[]; // 版本列表，按章节号排序
  activeChapterNumber?: number; // 当前激活的章节号（最新章节）
  activeVolumeNumber?: number; // 当前激活的卷号（最新章节）
}

// 5. Writing Guidelines (Style & Technique)
export interface WritingGuideline {
  id: string;
  category: string; // e.g. "Style", "Dialogue", "Pacing", "通用"
  content: string; // The specific rule or advice
  isActive: boolean; // Future proofing: toggle specific rules on/off
}

// 6. Root State
export interface StoryState {
  title: string;
  alternativeTitles: string[];
  synopsis: string;
  
  // Versioned Blueprints
  activeBlueprintId: string;
  blueprints: Blueprint[]; 
  
  // Hierarchy
  volumes: Volume[];
  outline: Chapter[]; // Chapters link to volumes via volumeId
  
  characters: Character[];
  worldGuide: WorldEntry[];
  
  // New: Writing Guidance
  writingGuidelines: WritingGuideline[];
  
  // Story Bible: Dynamic world state tracking
  storyBible?: StoryBible;
}

// Chat Models
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isToolCall?: boolean;
  toolName?: string;
  reasoning?: string; // AI思维链/推理过程（不发送给AI）
  isStopped?: boolean; // 标记是否被用户停止
  excludeFromAI?: boolean; // 标记是否排除在AI历史记录之外（仅显示给用户，不发送给AI）
  timestamp?: number; // 消息生成时间
  latencyMs?: number; // AI响应耗时（毫秒）
}

export type MessageMode = 'general' | 'manuscript'; // 保留用于向后兼容，但不再在UI中显示

export type StoryGenre = 'none' | 'wuxia' | 'xianxia' | 'apocalypse' | 'urban' | 'historical' | 'sci-fi' | 'supernatural';

export type WritingMethod = 'default' | 'design_outline' | 'fanwen_style_imitation' | 'reverse_outline' | 'chat_only';

// 作家信息
export interface Author {
  id: string;
  name: string; // 作家名称，如"金庸"、"陈风笑"
  description: string; // 角色描述（可通过对话完善）
  famousWorks: string[]; // 代表作品列表
}

export type SelectedAuthorId = string | 'none'; // 'none' 表示不选择作家（默认）

export interface SendMessageOptions {
  mode?: MessageMode;
  editedSystemInstruction?: string; // Allow overriding system instruction
  reuseUserMessage?: Message; // Reuse existing user message without duplicating it
  skipAddingToMessages?: boolean; // Skip adding user message to chat window, but still send to AI
  isSilentOperation?: boolean; // 是否为静默操作（不显示提示词，只显示通知）
  silentOperationInfo?: { // 静默操作信息
    chapterNumber: number;
    volumeNumber?: number;
    operationType: 'write' | 'rewrite' | 'extract';
  };
  systemContent?: string; // Additional system content to append (e.g., previous/next chapters context)
}

// Session/Storage Models
export interface SavedSession {
  id: string;
  lastUpdated: number;
  story: StoryState;
  messages: Message[];
  apiConfig?: ApiConfig | null; // Save API config with session
}

// --- API Configuration Models ---
export type ApiProvider = 'google' | 'openai' | 'deepseek' | 'siliconflow' | 'custom';

// 工具调用模式
export type ToolCallMode = 'function_calling' | 'json_schema';

export interface ApiConfig {
  name?: string; // Configuration Name (Profile Name)
  provider: ApiProvider;
  apiKey: string;
  baseUrl: string; // Optional for Google (default), Required for others/proxies
  modelId: string; // Specific model ID (e.g., "deepseek-chat", "gpt-4o")
  useProxy?: boolean; // 是否使用反向代理
  proxyUrl?: string; // 反向代理服务地址
  proxyKey?: string; // 代理的 API Key（与 baseUrl 的 key 区分开来）
  availableModels?: string[]; // Available models fetched from API
  
  // 工具调用配置
  toolCallMode?: ToolCallMode; // 工具调用模式：function_calling（FC）、json_schema（JSON Schema）
}
