
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StoryState, StoryStructure, Character, Chapter, Message, SavedSession, WorldEntry, Blueprint, Volume, ContentVersion, ApiConfig, WritingGuideline, SendMessageOptions, StructureBeat, BeatVersionState, STRUCTURE_BEATS, WritingMethod, StoryGenre, StoryBibleVersion, ApiProvider, ToolCallMode } from './types';
import ChatInterface from './components/ChatInterface';
import StoryBoard from './components/StoryBoard';
import SessionSidebar from './components/SessionSidebar';
import ApiKeyModal from './components/ApiKeyModal';
import PromptConfirmModal from './components/PromptConfirmModal';
import { MessageSquare, BookOpen } from 'lucide-react';
import { toolsList } from './services/geminiTools';
import { LLMAdapter } from './services/llmAdapter';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_WRITING_GUIDELINES, DEFAULT_AUTHORS } from './defaultContent';
import * as dataService from './services/dataService';
import { 
  validateUpdateStoryboardArgs, 
  validateAddChapterArgs, 
  validateAddCharacterArgs, 
  validateAddWorldEntryArgs, 
  validateAddWritingGuidelineArgs 
} from './services/toolValidators';

// Configuration - 工具调用基础规则（通用部分，不包含调用方式说明）
const TOOL_CALLING_BASICS = `
## 🔧 工具调用规则（强制执行）

**⚠️ 核心原则：所有创作内容必须通过工具保存，否则不会出现在故事板上！**

### 必须调用工具的场景：

1. **更新标题和简介** → 调用 update_title_synopsis 工具
2. **更新故事模板** → 调用 update_structure 工具（beat参数：hook, incitingIncident, risingAction, climax, fallingAction, resolution）
3. **创建/更新章纲** → 调用 add_chapter 工具（number, title, summary, volumeNumber可选）
4. **生成正文** → **必须调用 update_storyboard 工具**（这是复合工具，推荐使用）
   - **必需参数**：chapterNumber（章节编号）、chapterTitle（章节标题，必须是描述性标题，不能只是"第X章"）、chapter_content（正文内容）、chapter_outline（详细章纲，500-1500字）
   - **可选参数**：volumeNumber（卷号，如果使用分卷）、createNewVersion（创建新版本时为true）、versionName（版本名称）
   - **同时更新其他信息**：在生成章节时，如果同时需要添加角色、世界观设定、写作指导等，可以在同一次工具调用中通过characters、worldEntries、writingGuidelines参数一起更新
   - 重写/新版本时：createNewVersion: true, versionName: "版本2"等
5. **添加角色** → 调用 add_character 工具（name, role, description），或者在生成章节时通过 update_storyboard 工具的 characters 参数一起添加
6. **添加世界观设定** → 调用 add_world_entry 工具（category, name, description），或者在生成章节时通过 update_storyboard 工具的 worldEntries 参数一起添加
7. **添加写作指导** → 调用 add_writing_guideline 工具（category, content），或者在生成章节时通过 update_storyboard 工具的 writingGuidelines 参数一起添加

### 禁止行为：
- ❌ 只在聊天中回复"好的，我记住了"而不调用工具
- ❌ 生成内容后不调用工具保存
- ❌ 假设内容会自动保存（不会！必须调用工具）

**记住：不调用工具 = 内容未保存 = 用户看不到内容！**
`;

// Function Calling 模式的工具调用说明（禁止在文本中写 JSON）
const FC_TOOL_CALLING_INSTRUCTIONS = `
### 工具调用方式（Function Calling 模式）

**Function Calling工作机制：**
- Function Calling是API层面的机制，**由API自动处理，你不需要在文本中写任何代码或JSON！**
- 当你需要调用工具时，API会在响应结构中**自动包含**工具调用信息
- 你只需要理解用户意图，决定是否需要调用工具
   - **不需要在文本中写任何代码、JSON或描述性文字**

**❌ 绝对禁止的错误做法：**
- ❌ 在文本回复中写JSON格式的工具调用
- ❌ 在文本中写代码块中的JSON
- ❌ 在文本中描述要调用什么工具（如"我将调用update_storyboard工具"）
- ❌ 说"已调用工具"、"准备调用工具"等描述性文字

**⚠️ 关键说明：**
- 文本中的任何代码、JSON或描述都只是文本，**不会被执行**
- **只有API在响应结构中自动返回的工具调用才会被执行！**
`;

// JSON Schema 模式的工具调用说明（需要在文本中写 JSON）
const JSON_SCHEMA_TOOL_CALLING_INSTRUCTIONS = `
### 🚨 工具调用方式（JSON Schema 模式）— 极其重要！

**⚠️ 警告：你必须在回复末尾输出 \`\`\`json 代码块才能保存内容！**

**❌ 错误示范（内容不会被保存）：**
- 只写"调用工具保存内容..."或"已更新"——这只是文字描述，不会执行任何操作
- 在正文后面不添加 JSON 代码块——正文会丢失
- 把正文写在 JSON 外面——只有 JSON 里的内容会被保存

**✅ 正确做法：**
1. 先简短说明（如"好的，这是第一章"）
2. **然后必须在最后输出 \`\`\`json 代码块**，正文放在 chapter_content 字段中

**格式（必须严格遵守）：**
\`\`\`json
{"tool_calls": [{"name": "update_storyboard", "args": {"chapterNumber": 1, "chapterTitle": "标题", "chapter_content": "正文写这里", "chapter_outline": "章纲写这里"}}]}
\`\`\`

**🔴 再次强调：没有 \`\`\`json 代码块 = 内容不会被保存！**

详细参数说明见系统提示词末尾。
`;

// 通用语言风格规则
const LANGUAGE_STYLE_RULES = `
## 💬 语言风格
- 使用中文（简体）与用户交流
- 保持专业但友好的语调
- **重要**：调用工具保存内容后，只需简短确认（如"已保存"、"已完成"），**不要重复输出已保存的正文内容**。正文内容已经通过工具保存到故事板，重复输出会造成冗余。
`;

// 根据工具调用模式生成完整的工具调用规则
const getToolCallingRules = (useJsonSchema: boolean): string => {
  if (useJsonSchema) {
    return TOOL_CALLING_BASICS + JSON_SCHEMA_TOOL_CALLING_INSTRUCTIONS + LANGUAGE_STYLE_RULES;
  }
  return TOOL_CALLING_BASICS + FC_TOOL_CALLING_INSTRUCTIONS + LANGUAGE_STYLE_RULES;
};

// 兼容性：保留 BASE_TOOL_CALLING_RULES 用于默认情况（FC 模式）
const BASE_TOOL_CALLING_RULES = getToolCallingRules(false);

// 提炼信息功能的专用系统提示词（根据工具调用模式生成）
const getExtractInfoSystemInstruction = (useJsonSchema: boolean): string => {
  const baseInstruction = `
你是 "StoryForge" 的信息提炼助手。你的任务是分析正文内容，提取关键信息并保存到故事板。

## 🔧 工具调用规则（强制执行）

**⚠️ 核心原则：所有提炼的信息必须通过工具保存，否则不会出现在故事板上！**

### 必须调用工具的场景：

1. **更新章纲** → 调用 add_chapter 工具（number, title, summary, summaryDetailed, volumeNumber可选）
2. **添加角色** → 调用 add_character 工具（name, role, description）
3. **添加世界观设定** → 调用 add_world_entry 工具（category, name, description）
4. **添加写作指导** → 调用 add_writing_guideline 工具（category, content）

### 禁止行为：
- ❌ 只在文本中描述提炼的信息而不调用工具保存
- ❌ 假设信息会自动保存（不会！必须调用工具）

记住：**不调用工具 = 信息未保存 = 用户看不到信息！**
`;

  if (useJsonSchema) {
    return baseInstruction + `
### 工具调用方式（JSON Schema 模式）

请在回复的最后使用 JSON 代码块格式调用工具，具体格式说明会在系统提示词末尾提供。
`;
  }
  
  return baseInstruction + `
### 工具调用方式（Function Calling 模式）

Function Calling是API层面的机制，**由API自动处理，你不需要在文本中写任何代码或JSON！**
- 当你需要调用工具时，API会在响应结构中**自动包含**工具调用信息
- **不需要在文本中写任何代码、JSON或描述性文字**

**❌ 绝对禁止：**
- ❌ 在文本中写JSON格式的工具调用
- ❌ 说"已调用工具"、"准备调用工具"等描述性文字
`;
};

// 根据工具调用模式生成设计章纲的工具调用说明
const getDesignOutlineToolCallInstructions = (chapterNum: number, useJsonSchema: boolean): string => {
  if (useJsonSchema) {
    return `【🚨 工具调用指令 - JSON Schema 模式】
**生成章纲后，必须在回复的最后输出一个 \`\`\`json 代码块来调用工具保存内容！**

**⚠️ 重要**：当前使用 JSON Schema 模式，你必须在回复最后添加以下格式的 JSON 代码块：

\`\`\`json
{"tool_calls": [{"name": "add_chapter", "args": {
  "number": ${chapterNum},
  "title": "[从章纲中提取的描述性标题，如'风起云涌'，不能只是'第X章']",
  "summary": "[详细章纲内容，500-1500字]",
  "summaryDetailed": "[可选，更详细的章纲版本]"
}}]}
\`\`\`

**❌ 以下行为都是错误的，不会保存任何内容：**
- ❌ 只在文本中写"调用工具保存内容..."——这只是文字，不会执行任何操作
- ❌ 不添加 JSON 代码块——章纲会丢失

**🔴 必填参数：**
- number: 章节编号（${chapterNum}）
- title: 章节标题（必须是描述性标题）
- summary: 详细章纲（500-1500字）

**🚨🚨🚨 再次强调：没有 \`\`\`json 代码块 = 章纲不会被保存！**`;
  } else {
    return `【🚨 工具调用指令 - 必须执行】
**生成章纲后，必须立即调用 add_chapter 工具保存，否则章纲不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。

**🚨 add_chapter 工具参数格式要求：**

1. **title（章节标题）**：
   - ✅ 正确示例："初入江湖"、"命运的转折"、"最后的决战"
   - ❌ 错误示例："第${chapterNum}章"、"Chapter ${chapterNum}"
   - 要求：必须是有意义的描述性标题

2. **summary（章纲概要）**：
   - 字数要求：500-1500字（最少500字，建议800-1500字）

工具参数列表（API会自动处理，你不需要在文本中写）：
- number: ${chapterNum}
- title: [从章纲中提取的描述性标题]
- summary: [详细章纲，500-1500字]
- summaryDetailed: [可选，更详细的章纲版本]`;
  }
};

// 根据工具调用模式生成自动写的工具调用说明（用于提示词中）
const getAutoWriteToolCallInstructions = (chapterNum: number, useJsonSchema: boolean, targetWordCount: number): string => {
  if (useJsonSchema) {
    return `【🚨 工具调用指令 - JSON Schema 模式】
**生成正文后，必须在回复的最后输出一个 \`\`\`json 代码块来调用工具保存内容！**

**⚠️ 重要**：当前使用 JSON Schema 模式，你必须在回复最后添加以下格式的 JSON 代码块：

\`\`\`json
{"tool_calls": [{"name": "update_storyboard", "args": {
  "chapterNumber": ${chapterNum},
  "chapterTitle": "[从正文中提炼的章节标题，必须是有意义的标题，不能只是'第X章']",
  "chapter_content": "[这里放完整的正文内容，所有正文都必须放在这个字段里！]",
  "chapter_outline": "[根据正文总结的详细章纲，500-1500字]",
  "updated_story_bible": {
    "character_status": "[人物状态表]",
    "key_items_and_locations": "[物品与地点]",
    "active_plot_threads": "[当前未解决的伏笔]",
    "important_rules": "[临时规则/备注]"
  },
  "createNewVersion": true
}}]}
\`\`\`

**❌ 以下行为都是错误的，不会保存任何内容：**
- ❌ 只在文本中写"调用工具保存内容..."——这只是文字，不会执行任何操作
- ❌ 只在文本中写"已更新"或"✅"——这只是描述，内容不会被保存
- ❌ 在正文后面不添加 JSON 代码块——内容会丢失
- ❌ 把正文写在 JSON 外面——正文必须放在 JSON 的 chapter_content 参数中

**🔴 必填参数（缺一不可）：**
- chapterNumber: 章节编号（${chapterNum}）
- chapterTitle: 章节标题（必须是描述性标题，如"风起云涌"，不能只是"第X章"）
- chapter_content: **完整的正文内容**（所有正文都必须放这里，不要放在 JSON 外面！）
- chapter_outline: 章纲（500-1500字）
- updated_story_bible: 故事圣经更新
- createNewVersion: true

**🚨🚨🚨 再次强调：没有 \`\`\`json 代码块 = 内容不会被保存！**`;
  } else {
    return `【🚨 工具调用指令 - 必须执行】
**生成正文后，必须立即调用 update_storyboard 工具保存，否则内容不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。工具参数如下：
- chapterNumber: ${chapterNum}
- chapterTitle: [从正文中提取的描述性标题，不能只是"第${chapterNum}章"]
- chapter_content: [生成的正文内容]
- chapter_outline: [根据正文总结的详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点]
- updated_story_bible: [根据本章剧情更新故事圣经（必需！）]，包含：
  * character_status: 人物状态表（格式：[角色名]：[状态/位置/关键变化]，必须明确标记"已死"的角色）
  * key_items_and_locations: 物品与地点（关键道具的持有者变更、当前所在位置）
  * active_plot_threads: 当前未解决的伏笔（列出悬而未决的冲突或任务，已解决的请删除）
  * important_rules: 临时规则/备注（本章新增的、对后续剧情有长期影响的设定）
- createNewVersion: true

**🚨🚨🚨 绝对必需**：
1. **必须调用工具**：Function Calling是API自动处理的，你不需要在文本中写任何代码或描述。只需要让API自动调用 update_storyboard 工具即可。
2. **必须更新故事圣经（updated_story_bible 参数）**：根据本章发生的事件，更新人物状态、物品位置、未解决的伏笔等，确保后续章节的逻辑一致性！**这是强制要求，不是可选项！**`;
  }
};

// 兼容性：保留静态版本用于默认情况
const EXTRACT_INFO_SYSTEM_INSTRUCTION = getExtractInfoSystemInstruction(false);

const createEmptyStructureData = (): StoryStructure => ({
  hook: '',
  incitingIncident: '',
  risingAction: '',
  climax: '',
  fallingAction: '',
  resolution: ''
});

const createBeatVersionsFromData = (data?: StoryStructure): Partial<Record<StructureBeat, BeatVersionState>> => {
  const beatVersions: Partial<Record<StructureBeat, BeatVersionState>> = {};
  STRUCTURE_BEATS.forEach((beat) => {
    const id = uuidv4();
    beatVersions[beat] = {
      activeVersionId: id,
      versions: [{
        id,
        versionName: '初始构思',
        timestamp: Date.now(),
        text: data?.[beat] || '',
        isContext: true
      }]
    };
  });
  return beatVersions;
};

const ensureBeatVersionsOnBlueprint = (blueprint: Blueprint): Blueprint => {
  const beatVersions = { ...(blueprint.beatVersions || {}) };
  let changed = false;
  STRUCTURE_BEATS.forEach((beat) => {
    const state = beatVersions[beat];
    if (!state || !state.versions || state.versions.length === 0) {
      const id = uuidv4();
      beatVersions[beat] = {
        activeVersionId: id,
        versions: [{
          id,
          versionName: '初始构思',
          timestamp: Date.now(),
          text: blueprint.data?.[beat] || '',
          isContext: true
        }]
      };
      changed = true;
    }
  });
  return changed ? { ...blueprint, beatVersions } : blueprint;
};

const INITIAL_STORY_STATE: StoryState = {
  title: "",
  alternativeTitles: [],
  synopsis: "",
  activeBlueprintId: "default",
  blueprints: [{
      id: "default",
      versionName: "初始构思",
      timestamp: Date.now(),
      data: createEmptyStructureData(),
      beatVersions: createBeatVersionsFromData(createEmptyStructureData())
  }],
  volumes: [],
  outline: [],
  characters: [],
  worldGuide: [],
  writingGuidelines: DEFAULT_WRITING_GUIDELINES
};

// Migration helper to fix old save data structures
const migrateStoryState = (story: any): StoryState => {
  if (!story) return INITIAL_STORY_STATE;
  
  // Migrate Blueprints
  let blueprints = story.blueprints;
  if (!blueprints || blueprints.length === 0) {
      const migratedData = story.structure || createEmptyStructureData();
      blueprints = [{
          id: uuidv4(),
          versionName: "自动迁移备份",
          timestamp: Date.now(),
          data: migratedData,
          beatVersions: createBeatVersionsFromData(migratedData)
      }];
  } else {
      blueprints = blueprints.map((bp: Blueprint) => ensureBeatVersionsOnBlueprint({
        ...bp,
        data: bp.data || createEmptyStructureData()
      }));
  }

  // Migrate Chapters (Content Versions)
  const outline = (story.outline || []).map((ch: any) => {
      if (!ch.contentVersions) {
          const initialContent = ch.content || "";
          const vId = uuidv4();
          return {
              ...ch,
              volumeId: ch.volumeId || undefined,
              contentVersions: [{ 
                  id: vId, 
                  versionName: "初始草稿", 
                  timestamp: Date.now(), 
                  text: initialContent,
                  isContext: true // 迁移的版本默认作为上下文
              }],
              activeVersionId: vId
          };
      }
      // Ensure existing versions have isContext fields
      return {
          ...ch,
          contentVersions: (ch.contentVersions || []).map((v: any) => ({
              ...v,
              isContext: v.isContext !== undefined ? v.isContext : (v.id === ch.activeVersionId) // 只有活跃版本默认作为上下文
          }))
      };
  });

  return {
    ...INITIAL_STORY_STATE,
    ...story,
    alternativeTitles: story.alternativeTitles || [],
    worldGuide: story.worldGuide || [],
    writingGuidelines: story.writingGuidelines || [],
    blueprints,
    activeBlueprintId: story.activeBlueprintId || blueprints[0].id,
    volumes: story.volumes || [],
    outline,
  };
};

const App: React.FC = () => {
  // Global State
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(2000);
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('storyforge_temperature');
    return saved ? Number(saved) : 0.75;
  });
  const [maxHistoryForAI, setMaxHistoryForAI] = useState(() => {
    const saved = localStorage.getItem('storyforge_max_history_for_ai');
    return saved ? Number(saved) : 10;
  });
  const [enableStreaming, setEnableStreaming] = useState(() => {
    const saved = localStorage.getItem('storyforge_enable_streaming');
    return saved ? saved === 'true' : false;
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  // Mobile tab state - 移动端标签页状态
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'storyboard'>(() => {
    const saved = localStorage.getItem('storyforge_mobile_active_tab');
    return (saved === 'chat' || saved === 'storyboard') ? saved : 'chat';
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const extractingOutlineRef = useRef<string | null>(null); // Track chapter being extracted: "chapterNumber:volumeNumber"
  
  // Cache for writing samples to avoid repeated localStorage reads
  const writingSamplesCacheRef = useRef<{ content: string; timestamp: number; enabled: boolean } | null>(null);
  const WRITING_SAMPLES_CACHE_TTL = 100; // Cache for 100ms to batch rapid reads
  
  // API Config State
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<ApiConfig[]>([]);

  // File System Sync State
  const [fileHandle, setFileHandle] = useState<any>(null); // FileSystemFileHandle
  const [workDirName, setWorkDirName] = useState<string | null>(null); // Name of the connected directory
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef<any>(null);

  // Auto Write State
  const [autoWriteEnabled, setAutoWriteEnabled] = useState(false);
  const [autoWriteChapters, setAutoWriteChapters] = useState(() => {
    const saved = localStorage.getItem('storyforge_auto_write_chapters');
    return saved ? Number(saved) : 1;
  });
  const [autoWriteCooldownDuration, setAutoWriteCooldownDuration] = useState(() => {
    const saved = localStorage.getItem('storyforge_auto_write_cooldown');
    return saved ? Number(saved) : 30;
  });
  const [autoWriteCurrentChapter, setAutoWriteCurrentChapter] = useState(0);
  const [autoWriteCooldown, setAutoWriteCooldown] = useState(0);
  const autoWriteTimerRef = useRef<any>(null);
  const autoWriteCooldownTimerRef = useRef<any>(null);
  
  // Regenerate Confirmation State (重新生成确认状态)
  const [pendingRegenerateInfo, setPendingRegenerateInfo] = useState<{
    messageId: string;
    userMessage: Message;
    historyOverride?: Message[];
  } | null>(null);
  const [showRegenerateConfirmModal, setShowRegenerateConfirmModal] = useState(false);

  // Persist mobile tab state
  useEffect(() => {
    localStorage.setItem('storyforge_mobile_active_tab', mobileActiveTab);
  }, [mobileActiveTab]);

  const isRestoring = useRef(false);

  // Derived State (Active Session)
  const activeSession = sessions.find(s => s.id === currentSessionId);
  
  // Initialization
  useEffect(() => {
    isRestoring.current = true;
    
    // Load Settings
    const savedWordCount = localStorage.getItem('storyforge_wordcount');
    if (savedWordCount) setTargetWordCount(Number(savedWordCount));
    
    const savedMaxHistory = localStorage.getItem('storyforge_max_history_for_ai');
    if (savedMaxHistory) setMaxHistoryForAI(Number(savedMaxHistory));

    // Load Saved API Profiles
    const savedConfigsStr = localStorage.getItem('storyforge_saved_api_configs');
    if (savedConfigsStr) {
        try {
            setSavedConfigs(JSON.parse(savedConfigsStr));
        } catch(e) {}
    }

    // Load Sessions first (before setting API config, as session may have its own config)
    // 优先从数据服务器加载，如果失败则回退到 localStorage
    const loadSessionsData = async () => {
      let sessionsData: SavedSession[] | null = null;
      
      // 1. 首先尝试从数据服务器加载
      try {
        const serverSessions = await dataService.loadSessions();
        if (serverSessions && Array.isArray(serverSessions) && serverSessions.length > 0) {
          console.log('✅ 从数据服务器加载会话数据成功');
          sessionsData = serverSessions;
        }
      } catch (e) {
        console.warn('⚠️ 从数据服务器加载会话数据失败，尝试从 localStorage 加载:', e);
      }
      
      // 2. 如果数据服务器加载失败，从 localStorage 加载
      if (!sessionsData) {
    const savedSessions = localStorage.getItem('storyforge_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('✅ 从 localStorage 加载会话数据成功');
              sessionsData = parsed;
            }
          } catch (e) {
            console.error("Failed to parse localStorage sessions", e);
          }
        }
      }
      
      // 3. 处理加载的数据
      let shouldCreateNew = false;
      if (sessionsData && sessionsData.length > 0) {
          // Migrate all sessions
        const migratedSessions = sessionsData.map((s: any) => ({
             ...s,
             story: migrateStoryState(s.story)
          }));
          setSessions(migratedSessions);
          // Set active session to the most recently updated one
          const mostRecent = migratedSessions.sort((a: SavedSession, b: SavedSession) => b.lastUpdated - a.lastUpdated)[0];
          setCurrentSessionId(mostRecent.id);
          
          // Load API config from active session if available
          if (mostRecent.apiConfig) {
              setApiConfig(mostRecent.apiConfig);
          }
        
        // 如果从 localStorage 加载成功，尝试同步到数据服务器（后台操作，不影响用户体验）
        if (sessionsData === JSON.parse(localStorage.getItem('storyforge_sessions') || '[]')) {
          dataService.saveSessions(migratedSessions).catch(() => {
            // 静默失败，不影响用户体验
          });
      }
    } else {
      shouldCreateNew = true;
    }
    
    if (shouldCreateNew) {
        const newSession: SavedSession = {
            id: uuidv4(),
            lastUpdated: Date.now(),
            story: INITIAL_STORY_STATE,
            messages: []
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
    }
    };
    
    loadSessionsData();

    // Load Active Config (fallback if session doesn't have config)
    // This will be handled after sessions are loaded
    const savedConfig = localStorage.getItem('storyforge_api_config');
    if (savedConfig) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            // Only set if we didn't load from session
            setTimeout(() => {
                setApiConfig(prev => prev || parsedConfig);
            }, 100);
        } catch(e) {
            console.error("Failed to parse saved API config", e);
        }
    } else {
        // Legacy migration
        const oldKey = localStorage.getItem('gemini_api_key');
        if (oldKey) {
            const legacyConfig = { provider: 'google', apiKey: oldKey, baseUrl: '', modelId: 'gemini-2.5-pro', name: 'Legacy Key' } as ApiConfig;
            setTimeout(() => {
                setApiConfig(prev => prev || legacyConfig);
                setSavedConfigs(prev => [...prev, legacyConfig]);
            }, 100);
        } else if (process.env.API_KEY) {
            const envConfig = { provider: 'google', apiKey: process.env.API_KEY, baseUrl: '', modelId: 'gemini-2.5-pro', name: 'Environment Key' } as ApiConfig;
            setTimeout(() => {
                setApiConfig(prev => prev || envConfig);
            }, 100);
        }
    }
    
    // Load and restore last working directory
    const lastWorkDirHandle = localStorage.getItem('storyforge_last_work_dir_handle');
    if (lastWorkDirHandle && 'showDirectoryPicker' in window && window.self === window.top) {
        try {
            // Note: File System Access API doesn't support restoring handles from localStorage directly
            // We need to prompt user again, but we can remember the path name
            const lastWorkDirName = localStorage.getItem('storyforge_last_work_dir_name');
            if (lastWorkDirName) {
                setWorkDirName(lastWorkDirName);
            }
        } catch (e) {
            console.error("Failed to restore work directory", e);
        }
    }
    
    // Release lock after a short delay
    setTimeout(() => { isRestoring.current = false; }, 500);
  }, []);

  // Persistence (Data Server + LocalStorage)
  useEffect(() => {
    if (isRestoring.current) return;
    
    // 1. 立即保存到 localStorage（快速可靠）
    try {
        localStorage.setItem('storyforge_sessions', JSON.stringify(sessions));
    } catch (e) {
        console.error("LocalStorage Save Failed (Quota Exceeded?)", e);
    }
    
    // 2. 后台异步保存到数据服务器（跨设备同步）
    dataService.saveSessions(sessions).catch(() => {
        // 静默失败，不影响用户体验（因为 localStorage 已保存）
    });
  }, [sessions]);

  // Persistence (Hard Drive Sync)
  useEffect(() => {
      if (!fileHandle || isRestoring.current) return;

      // Clear previous timer
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      // Set Syncing State
      setIsSyncing(true);

      // Debounce save (2 seconds)
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              const writable = await fileHandle.createWritable();
              await writable.write(JSON.stringify(sessions, null, 2));
              await writable.close();
              setIsSyncing(false);
          } catch (e) {
              console.error("Auto-sync failed", e);
              setIsSyncing(false); 
          }
      }, 2000);

      return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [sessions, fileHandle]);


  useEffect(() => {
    localStorage.setItem('storyforge_wordcount', targetWordCount.toString());
  }, [targetWordCount]);
  
  // Save maxHistoryForAI to localStorage when changed
  useEffect(() => {
    localStorage.setItem('storyforge_max_history_for_ai', maxHistoryForAI.toString());
  }, [maxHistoryForAI]);

  useEffect(() => {
    localStorage.setItem('storyforge_temperature', temperature.toString());
  }, [temperature]);


  // Session Management
  const createNewSession = useCallback(() => {
    const newSession: SavedSession = {
      id: uuidv4(),
      lastUpdated: Date.now(),
      story: INITIAL_STORY_STATE,
      messages: [],
      apiConfig: apiConfig // Save current API config with new session
    };
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    // Auto-close sidebar on mobile/tablet (anything smaller than xl)
    if (window.innerWidth < 1280) setSidebarOpen(false);
  }, [apiConfig]);

  const updateActiveSession = useCallback((updater: (session: SavedSession) => SavedSession) => {
      if (!currentSessionId) return;
      setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
              const updated = updater(s);
              // Always save current API config with session
              return { ...updated, apiConfig: apiConfig, lastUpdated: Date.now() };
          }
          return s;
      }));
  }, [currentSessionId, apiConfig]);

  const handleUpdateStory = useCallback((newStory: StoryState) => {
    updateActiveSession(s => ({ ...s, story: newStory }));
  }, [updateActiveSession]);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      localStorage.setItem('storyforge_sessions', JSON.stringify(newSessions));
      // 同时保存到数据服务器
      dataService.saveSessions(newSessions).catch(() => {
        // 静默失败，不影响用户体验
      });

      if (currentSessionId === id) {
          if (newSessions.length > 0) {
              setCurrentSessionId(newSessions[0].id);
          } else {
              const blankSession: SavedSession = {
                  id: uuidv4(),
                  lastUpdated: Date.now(),
                  story: INITIAL_STORY_STATE,
                  messages: []
              };
              setSessions([blankSession]);
              setCurrentSessionId(blankSession.id);
          }
      }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, story: { ...s.story, title: newTitle } } : s));
  };

  const handleSetWorkingDirectory = async () => {
      // Feature detection
      if (!('showDirectoryPicker' in window)) {
          alert("您的浏览器不支持文件夹访问 API (File System Access API)。请使用 Chrome/Edge 桌面版。");
          return;
      }

      // Security Check: Iframe
      if (window.self !== window.top) {
           alert("安全限制：为了保护您的文件安全，浏览器禁止在预览窗口(iframe)中直接访问本地硬盘。\n\n请在独立窗口(New Tab)中打开此应用以使用同步功能。");
           return;
      }

      try {
          // Use Directory Picker instead of File Picker
          // @ts-ignore
          const dirHandle = await window.showDirectoryPicker({
              mode: 'readwrite'
          });
          
          if (dirHandle) {
              setWorkDirName(dirHandle.name);
              
              // Save directory name to localStorage (we can't save the handle itself)
              localStorage.setItem('storyforge_last_work_dir_name', dirHandle.name);
              
              // Get or Create the backup file INSIDE the directory
              const fileH = await dirHandle.getFileHandle('storyforge_backup.json', { create: true });
              setFileHandle(fileH);
              
              // Immediate save to initialize
              const writable = await fileH.createWritable();
              await writable.write(JSON.stringify(sessions, null, 2));
              await writable.close();
          }
      } catch (err: any) {
          console.error("Directory picker error:", err);
          
          if (err.name === 'AbortError') {
              return; // User cancelled
          }

          if (err.message && err.message.includes('Cross origin sub frames')) {
              alert("环境限制：无法在预览窗口(iframe)中访问本地文件夹。\n\n请点击右上角的 'Open in New Tab' 或在独立窗口中打开此应用以使用同步功能。");
          } else {
              alert("连接文件夹失败: " + (err.message || "未知错误"));
          }
      }
  };

  const handleExportSessions = () => {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyforge_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    const titleSafe = (session.story.title || "Untitled").replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
    const blob = new Blob([JSON.stringify([session], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyforge_${titleSafe}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSessions = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const imported = JSON.parse(evt.target?.result as string);
            if (Array.isArray(imported)) {
                const migrated = imported.map((s: any) => ({
                    ...s,
                    id: uuidv4(),
                    story: migrateStoryState(s.story)
                }));
                setSessions(prev => [...prev, ...migrated]);
                if (migrated.length > 0) setCurrentSessionId(migrated[0].id);
            }
        } catch (err) {
            alert("导入失败：文件格式错误");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportApiConfigs = () => {
    const blob = new Blob([JSON.stringify(savedConfigs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyforge_api_configs_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportApiConfigs = (configs: ApiConfig[]) => {
    if (!Array.isArray(configs)) return;
    setSavedConfigs(configs);
    localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(configs));
    if (configs.length > 0) {
      const active = configs.find(c => 
        apiConfig && (
          (c.name && apiConfig.name && c.name === apiConfig.name) ||
          (c.apiKey === apiConfig.apiKey && c.provider === apiConfig.provider && c.baseUrl === apiConfig.baseUrl)
        )
      ) || configs[0];
      setApiConfig(active);
      localStorage.setItem('storyforge_api_config', JSON.stringify(active));
    } else {
      setApiConfig(null);
      localStorage.removeItem('storyforge_api_config');
    }
  };

  const handleExportWritingGuidelines = () => {
    if (!activeSession) return;
    const guidelines = activeSession.story.writingGuidelines || [];
    const blob = new Blob([JSON.stringify(guidelines, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyforge_writing_guidelines_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chat Logic
  // 支持单个或多个消息ID的删除
  const handleDeleteMessage = (idOrIds: string | string[]) => {
      if (!activeSession) return;
      const idsToDelete = Array.isArray(idOrIds) ? new Set(idOrIds) : new Set([idOrIds]);
      // 使用函数式更新，确保基于最新状态
      updateActiveSession(s => ({
          ...s,
          messages: s.messages.filter(m => !idsToDelete.has(m.id))
      }));
  };

  const handleEditMessage = (id: string, newText: string) => {
      if (!activeSession) return;
      const newMessages = activeSession.messages.map(m => m.id === id ? { ...m, text: newText } : m);
      updateActiveSession(s => ({ ...s, messages: newMessages }));
  };

  // 检查是否启用了提示词确认
  const isPromptConfirmationEnabled = () => {
    const saved = localStorage.getItem('storyforge_show_prompt_confirmation');
    return saved ? saved === 'true' : true; // 默认开启
  };

  // 执行重新生成（内部函数，实际发送消息）
  const executeRegenerate = (userMessage: Message, historyOverride?: Message[], skipAddingToMessages?: boolean) => {
    sendMessage(userMessage.text, { 
      reuseUserMessage: userMessage, 
      skipAddingToMessages: skipAddingToMessages 
    }, historyOverride);
  };

  // 处理重新生成确认后的发送
  const handleRegenerateConfirmSend = (editedUserMessage?: string, editedSystemInstruction?: string) => {
    if (!pendingRegenerateInfo) return;
    
    const { userMessage, historyOverride } = pendingRegenerateInfo;
    const finalMessage = editedUserMessage !== undefined ? editedUserMessage : userMessage.text;
    
    sendMessage(finalMessage, { 
      reuseUserMessage: { ...userMessage, text: finalMessage },
      skipAddingToMessages: !historyOverride, // 如果有 historyOverride，需要添加消息
      editedSystemInstruction
    }, historyOverride);
    
    setPendingRegenerateInfo(null);
    setShowRegenerateConfirmModal(false);
  };

  // 取消重新生成
  const handleRegenerateCancelSend = () => {
    setPendingRegenerateInfo(null);
    setShowRegenerateConfirmModal(false);
  };

  const handleRegenerate = (id: string) => {
    if (!activeSession) return;
    const index = activeSession.messages.findIndex(m => m.id === id);
    if (index === -1) return;

    const messageToRegenerate = activeSession.messages[index];
    if (messageToRegenerate.role !== 'model') return;

    // Find the last message (should be the one to regenerate)
    const lastMessage = activeSession.messages[activeSession.messages.length - 1];
    
    // If regenerating the last message, delete it and regenerate
    if (lastMessage && lastMessage.id === id) {
      const prevUserMsgIndex = index - 1;
      if (prevUserMsgIndex < 0 || activeSession.messages[prevUserMsgIndex].role !== 'user') {
        handleDeleteMessage(id);
        return;
      }
      
      const prevUserMsg = activeSession.messages[prevUserMsgIndex];
      // Delete the last message
      handleDeleteMessage(id);
      
      // 检查是否需要显示确认弹窗
      if (isPromptConfirmationEnabled()) {
        // 延迟设置状态，确保删除操作完成
      setTimeout(() => {
          setPendingRegenerateInfo({
            messageId: id,
            userMessage: prevUserMsg,
            historyOverride: undefined // 不需要 historyOverride，因为消息已在列表中
          });
          setShowRegenerateConfirmModal(true);
        }, 100);
      } else {
        // 直接发送
        setTimeout(() => {
          executeRegenerate(prevUserMsg, undefined, true);
      }, 200);
      }
    } else {
      // For non-last messages, use the old behavior
      const prevUserMsgIndex = index - 1;
      if (prevUserMsgIndex < 0 || activeSession.messages[prevUserMsgIndex].role !== 'user') {
        handleDeleteMessage(id);
        return;
      }

      const prevUserMsg = activeSession.messages[prevUserMsgIndex];
      const newMessages = activeSession.messages.slice(0, prevUserMsgIndex);
      // Update session to remove messages after the user message
      updateActiveSession(s => ({ ...s, messages: newMessages }));
      
      // 检查是否需要显示确认弹窗
      if (isPromptConfirmationEnabled()) {
        setPendingRegenerateInfo({
          messageId: id,
          userMessage: prevUserMsg,
          historyOverride: newMessages
        });
        setShowRegenerateConfirmModal(true);
      } else {
        // 直接发送
      sendMessage(prevUserMsg.text, { reuseUserMessage: prevUserMsg }, newMessages);
      }
    }
  };

  const handleReAnswerUser = (id: string) => {
    if (!activeSession) return;
    const index = activeSession.messages.findIndex(m => m.id === id);
    if (index === -1) return;
    const userMsg = activeSession.messages[index];
    if (userMsg.role !== 'user') return;

    const historyBefore = activeSession.messages.slice(0, index);
    // Update session to keep conversation up to the selected user message (without the user message itself)
    // The sendMessage function will add the user message when historyOverride is provided
    updateActiveSession(s => ({ ...s, messages: historyBefore }));

    // 检查是否需要显示确认弹窗
    if (isPromptConfirmationEnabled()) {
      setPendingRegenerateInfo({
        messageId: id,
        userMessage: userMsg,
        historyOverride: historyBefore
      });
      setShowRegenerateConfirmModal(true);
    } else {
      // 直接发送
    sendMessage(userMsg.text, { reuseUserMessage: userMsg }, historyBefore);
    }
  };

  // Handle Model Switching from UI (only valid for Google usually, or updates modelId in config)
  const handleModelIdChange = (newModelId: string) => {
      if (apiConfig) {
          const newConfig = { ...apiConfig, modelId: newModelId };
          setApiConfig(newConfig);
          localStorage.setItem('storyforge_api_config', JSON.stringify(newConfig));
          
          // Also update in saved configs if it exists
          const idx = savedConfigs.findIndex(c => c.name === apiConfig.name);
          if (idx >= 0) {
              const newSaved = [...savedConfigs];
              newSaved[idx] = newConfig;
              setSavedConfigs(newSaved);
              localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(newSaved));
          }
          
          // Also update the current session's apiConfig so it persists after refresh
          if (currentSessionId) {
              setSessions(prev => prev.map(s => 
                  s.id === currentSessionId 
                      ? { ...s, apiConfig: newConfig, lastUpdated: Date.now() }
                      : s
              ));
          }
      }
  };

  const handleConfigSelect = (config: ApiConfig) => {
      // Ensure we get the full config from savedConfigs with availableModels
      const fullConfig = savedConfigs.find(c => 
          c.name === config.name || 
          (c.apiKey === config.apiKey && c.provider === config.provider && c.baseUrl === config.baseUrl)
      ) || config;
      
      setApiConfig(fullConfig);
      localStorage.setItem('storyforge_api_config', JSON.stringify(fullConfig));
      
      // Also update the current session's apiConfig so it persists after refresh
      if (currentSessionId) {
          setSessions(prev => prev.map(s => 
              s.id === currentSessionId 
                  ? { ...s, apiConfig: fullConfig, lastUpdated: Date.now() }
                  : s
          ));
      }
  };

  // Helper function to get selected writing samples content (with caching)
  const getSelectedSamplesContent = useCallback((): string => {
    try {
      const now = Date.now();
      const enabled = localStorage.getItem('storyforge_writing_samples_enabled');
      const isEnabled = enabled !== 'false';
      
      // Check cache validity
      if (writingSamplesCacheRef.current) {
        const cacheAge = now - writingSamplesCacheRef.current.timestamp;
        if (cacheAge < WRITING_SAMPLES_CACHE_TTL && 
            writingSamplesCacheRef.current.enabled === isEnabled) {
          // Cache is still valid, return cached content
          return writingSamplesCacheRef.current.content;
        }
      }
      
      // Cache miss or expired, read from localStorage
      if (!isEnabled) {
        writingSamplesCacheRef.current = { content: '', timestamp: now, enabled: false };
        return '';
      }
      
      const saved = localStorage.getItem('storyforge_writing_samples');
      if (!saved) {
        writingSamplesCacheRef.current = { content: '', timestamp: now, enabled: true };
        return '';
      }
      
      const samples = JSON.parse(saved);
      const selected = samples.filter((s: any) => s.selected);
      if (selected.length === 0) {
        writingSamplesCacheRef.current = { content: '', timestamp: now, enabled: true };
        return '';
      }
      
      const content = selected.map((s: any) => `【${s.name}】\n${s.content}`).join('\n\n---\n\n');
      writingSamplesCacheRef.current = { content, timestamp: now, enabled: true };
      return content;
    } catch (e) {
      writingSamplesCacheRef.current = { content: '', timestamp: Date.now(), enabled: true };
      return '';
    }
  }, []);

  // Helper function to get writing samples block for system instruction
  // 范文对所有模式都有效，因为AI需要模仿范文的笔触、手法、思路来完成所有写作任务
  const getWritingSamplesBlock = useCallback((): string => {
    const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) {
      console.log('ℹ️ 未启用范文或未选择范文（幽灵注入：不显示在弹窗中）');
      return '';
    }
    
    console.log('✅ 范文已幽灵注入（不显示在弹窗中）:', {
      contentLength: samplesContent.length,
      preview: samplesContent.substring(0, 200) + '...'
    });
    
    return `

## 📖 范文参考（写作风格模仿）

**🚨 核心原则：这是最重要的参考内容！无论什么任务，都要先看范文，告诉AI这才是我要的内容效果！**

**重要原则**：
- 深入分析以下范文的"写作腔调"，包括但不限于：
  1. **写作任务**：范文完成了什么写作任务（如：塑造人物、推进情节、营造氛围、埋设伏笔等）
  2. **情节设计**：情节的推进方式、转折点的设置、冲突的构建方法
  3. **铺垫手法**：伏笔的埋设方式、悬念的营造技巧、线索的串联方法
  4. **文笔风格**：语言特色、句式特点、修辞手法、叙事节奏
  5. **角色塑造**：人物性格的展现方式、对话风格、行为逻辑
  6. **整体腔调**：综合以上要素形成的独特"写作腔调"

- **模仿腔调，不抄袭内容**：
  - 学习范文的"写作腔调"（套路和文风），包括文风、手法、情节推进方式、铺垫技巧等
  - 但创作**全新的故事内容**，不要一一对标甚至抄袭范文的情节、角色、场景
  - 要用自己的故事内容，但运用范文的写作手法和腔调
  - 创造全新的情节和角色，但保持范文的文风和叙事风格

**范文内容：**
${samplesContent}

**⚠️ 重要**：无论你是在构思讨论、设计章纲还是写正文，都要先仔细阅读并分析上述范文，然后运用这种腔调完成你的任务。范文的笔触、手法、思路是你最重要的参考，任何提示词的效果都不如给AI看范文！
`;
  }, [getSelectedSamplesContent]);

  // Build context for prompt confirmation
  // 注意：这个函数构建的系统提示词应该与实际发送给AI的一致（除了范文，因为范文是幽灵注入的）
  const shouldUseJsonSchema = useCallback((config?: ApiConfig): boolean => {
    if (!config) return false;
    // 移除自动模式，只根据用户手动选择
    const mode = config.toolCallMode || getDefaultToolCallMode(config.provider, config.useProxy);
    return mode === 'json_schema';
  }, []);
  
  // 获取默认工具调用模式（仅用于没有设置的情况）
  const getDefaultToolCallMode = (provider?: ApiProvider, useProxy?: boolean): ToolCallMode => {
    // Google 直连默认 FC，其余默认 JSON Schema
    if (provider === 'google' && !useProxy) return 'function_calling';
    return 'json_schema';
  };

  const getPromptContext = useCallback((userMessage?: string, mode?: 'general' | 'manuscript') => {
    if (!activeSession) return { systemInstruction: '', context: {}, history: [] };
    
    const activeBlueprint = activeSession.story.blueprints.find(b => b.id === activeSession.story.activeBlueprintId);
    
    // 获取当前写作方法和模式
    const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
    const currentMode = mode || 'general';
    
    // 判断是否使用 JSON Schema 模式（根据 API 配置和提供商）
    // 注意：纯聊天模式的完整系统提示词构建在后面（第1260行），这里不提前返回
    const useJsonSchema = shouldUseJsonSchema(apiConfig);
    const toolCallingRules = getToolCallingRules(useJsonSchema);
    
    // 获取作家信息（但不包含范文，因为范文是幽灵注入的）
    const selectedAuthorId = localStorage.getItem('storyforge_selected_author_id') || 'none';
    let authorBlock = '';
    if (selectedAuthorId !== 'none') {
      const defaultAuthorDescriptionsJson = localStorage.getItem('storyforge_default_author_descriptions');
      const defaultAuthorDescriptions: Record<string, string> = defaultAuthorDescriptionsJson ? JSON.parse(defaultAuthorDescriptionsJson) : {};
      const customAuthorsJson = localStorage.getItem('storyforge_custom_authors');
      const customAuthors: any[] = customAuthorsJson ? JSON.parse(customAuthorsJson) : [];
      const author = DEFAULT_AUTHORS.find(a => a.id === selectedAuthorId) || customAuthors.find(a => a.id === selectedAuthorId);
      if (author) {
        const authorDescription = defaultAuthorDescriptions[author.id] || author.description;
        if (authorDescription && authorDescription.trim()) {
          authorBlock = `\n\n## ✍️ 作家身份（🚨 核心身份）\n\n**你现在就是 ${author.name}。不是模仿，不是学习，你就是这位作家本人。**\n\n**你的写作特点：**\n${authorDescription}\n\n**🚨 核心要求：**\n- 以 ${author.name} 的身份进行创作，这是你的本能，不需要刻意模仿\n- 你的文字风格、叙事节奏、遣词造句都是你作为 ${author.name} 的自然表达\n- 保持文本的自然流畅，不要让读者感觉到"规则"的存在\n- **这是你的创作身份，贯穿所有写作任务！**\n\n`;
        }
      }
    }
    // 如果选择了作家，就不再声明“你是 StoryForge”
    const assistantIdentity = authorBlock ? '' : '你是 "StoryForge"，一个专业的小说创作AI助手。\n\n';
    
    // Build outline summary: show all chapters with summaries
    const outlineSummary = activeSession.story.outline.map((ch) => {
      const contextVersions = ch.contentVersions?.filter(v => v.isContext !== false) || [];
      const hasContent = contextVersions.some(v => v.text && v.text.trim());
      const contentPreview = hasContent ? `\n[已有正文]` : '';
      return `Ch${ch.number}: ${ch.title}\n概要: ${ch.summary}${contentPreview}`;
    }).join('\n\n');

    const guidelinesText = activeSession.story.writingGuidelines
      ?.filter(g => g.isActive !== false)
      ?.map(g => `[${g.category}] ${g.content}`)
      .join('\n') || '暂无写作指导';

    const charactersText = activeSession.story.characters
      ?.map(c => {
        const behaviors = c.behaviorExamples?.length > 0 
          ? `\n行为示例: ${c.behaviorExamples.map(b => `${b.context} -> ${b.response}`).join('; ')}`
          : '';
        return `${c.name} (${c.role}): ${c.description}${behaviors}`;
      })
      .join('\n\n') || '暂无角色设定';

    const worldSettingsByCategory = (activeSession.story.worldGuide || []).reduce((acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(`${entry.name}: ${entry.description}`);
      return acc;
    }, {} as Record<string, string[]>);
    
    const worldSettingsText = Object.entries(worldSettingsByCategory)
      .map(([cat, items]) => `[${cat}]\n${items.join('\n')}`)
      .join('\n\n') || '暂无世界观设定';

    const context = {
      title: activeSession.story.title || '未命名故事',
      synopsis: activeSession.story.synopsis || '暂无简介',
      blueprint: activeBlueprint?.data || null,
      volumes: activeSession.story.volumes.map(v => ({
        number: v.number,
        title: v.title,
        summary: v.summary
      })),
      chapters: outlineSummary,
      characters: charactersText,
      worldSettings: worldSettingsText,
      writingGuidelines: guidelinesText
    };

    // 构建与 sendMessage 中一致的系统提示词（但不包含范文，因为范文是幽灵注入的）
    // 根据不同的模式生成不同的系统提示词
    let systemInstruction = '';
    
    if (currentWritingMethod === 'chat_only') {
      // 注意：在纯聊天模式时，sendMessage 会自己获取 samplesBlock 并构建 finalSystemInstruction
      // 这里只返回一个简化的 systemInstruction，避免重复调用 getWritingSamplesBlock()
      // 实际上 sendMessage 不会使用这个 systemInstruction，只会使用 context
      const guidelinesBlock = `\n\n## ⚙️ 写作指导（可参考，也可忽略）\n${guidelinesText}`;
      systemInstruction = `${authorBlock}${assistantIdentity}## 🎯 当前模式：纯聊天模式

**规则：**
- 自由对话，不调用任何工具
- 不输出 JSON 代码块或函数调用格式
- 可以参考写作指导和作家设定，但无需生成正文/章纲

${guidelinesBlock}

## 🗂️ 故事背景（可参考，可忽略）
- 标题: ${context.title}
- 简介: ${context.synopsis}
`;
    } else if (currentWritingMethod === 'default' && currentMode === 'general') {
      // ========== 构思讨论模式 ==========
      systemInstruction = `${authorBlock}${assistantIdentity}## 🎯 当前模式：构思讨论模式

## 🎯 当前模式：构思讨论模式

**你现在处于"构思讨论模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **与用户讨论故事构思，提供创意建议**
   - 提供书名建议（多个版本，每个版本都要体现核心卖点）
   - 提供简介建议（多个版本，每个版本都要体现核心卖点）
   - 提供卷纲建议（故事的整体结构）
   - 提供角色设定建议
   - 提供世界观设定建议
   - 提供写作指导建议

2. **必须调用工具保存生成的内容**：
   - 当用户要求更新书名/简介时 → **必须调用 update_title_synopsis 工具**
   - 当用户要求更新卷纲时 → **必须调用 update_structure 工具**
   - 当用户明确要求生成正文时 → **必须调用 update_storyboard 工具**
   - 当用户明确要求生成章纲时 → **必须调用 add_chapter 工具**
   - **🚨 关键要求**：如果你在讨论中**生成或建议了角色、世界观设定、写作指导、故事圣经信息**，必须立即调用相应的工具保存：
     * 生成角色设定 → **必须调用 add_character 工具保存**（name, role, description）
     * 生成世界观设定 → **必须调用 add_world_entry 工具保存**（category, name, description）
     * 生成写作指导 → **必须调用 add_writing_guideline 工具保存**（category, content）
     * 更新故事圣经（角色状态、物品位置、伏笔等）→ 建议调用 add_writing_guideline 工具保存（category: "故事圣经", content: 详细内容）

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**自动生成正文内容（除非用户明确要求）
- ❌ **绝对禁止**自动生成章纲（除非用户明确要求）
- ❌ **绝对禁止**在用户没有明确要求的情况下调用 update_storyboard 工具生成正文
- ❌ **绝对禁止**在用户没有明确要求的情况下调用 add_chapter 工具生成章纲
- ❌ **绝对禁止**只在文本中描述这些信息而不调用工具保存！文本中的描述不会保存到故事板！

### ✅ 允许行为：
- ✅ 讨论故事构思、角色设定、世界观设定
- ✅ 当用户明确要求时，可以生成正文或章纲
- ✅ 调用 update_title_synopsis 工具更新书名和简介
- ✅ 调用 update_structure 工具更新卷纲（模板）
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在构思讨论模式下，你的主要职责是提供建议和讨论，而不是自动生成内容。只有在用户明确要求时，才生成正文或章纲。**但是，如果你在讨论中生成或建议了角色、世界观、写作指导等信息，必须立即调用工具保存，否则这些信息会丢失！**

${toolCallingRules}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${context.title}
- 简介: ${context.synopsis}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${context.volumes.length > 0 
  ? context.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${context.chapters || '暂无章纲'}

**角色设定：**
${context.characters}

**世界观设定：**
${context.worldSettings}

**⚠️ 写作指导原则：**
${context.writingGuidelines || '暂无写作指导'}
`;
    } else if (currentWritingMethod === 'design_outline') {
      // ========== 设计章纲模式 ==========
      systemInstruction = `${authorBlock}${assistantIdentity}## 🎯 当前模式：设计章纲模式

## 🎯 当前模式：设计章纲模式

**你现在处于"设计章纲模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **只生成章纲，禁止生成正文**
   - 根据用户要求或故事上下文，设计详细的章纲
   - 章纲必须包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点
   - 章纲字数要求：500-1500字（详细章纲）

2. **必须调用工具保存章纲**：
   - **必须调用 add_chapter 工具保存章纲**
   - **🚨 关键要求**：如果章纲中涉及到新角色、世界观设定、故事圣经更新，必须立即调用相应工具保存：
     * 如果章纲中提到了新角色 → **必须单独调用 add_character 工具保存**（name, role, description）
     * 如果章纲中提到了新的世界观设定 → **必须单独调用 add_world_entry 工具保存**（category, name, description）
     * 如果章纲中涉及到故事圣经更新（角色状态变化、物品位置、伏笔等）→ **建议单独调用 add_writing_guideline 工具保存**（category: "故事圣经", content: 详细内容），或者在 add_chapter 的 summary 中详细描述
     * **⚠️ 绝对禁止**：只在章纲文本中描述这些信息而不调用工具保存！文本中的描述不会保存到故事板！

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**生成正文内容
- ❌ **绝对禁止**调用 update_storyboard 工具（该工具会生成正文）
- ❌ **绝对禁止**只在文本中描述章纲而不调用 add_chapter 工具保存！文本中的描述不会保存到故事板！

### ✅ 允许行为：
- ✅ 设计详细的章纲
- ✅ 调用 add_chapter 工具保存章纲
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在设计章纲模式下，你的唯一任务是生成章纲，绝对不能生成正文。章纲必须通过 add_chapter 工具保存，否则不会出现在故事板上！

${toolCallingRules}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${context.title}
- 简介: ${context.synopsis}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${context.volumes.length > 0 
  ? context.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${context.chapters || '暂无章纲'}

**角色设定：**
${context.characters}

**世界观设定：**
${context.worldSettings}

**⚠️ 写作指导原则：**
${context.writingGuidelines || '暂无写作指导'}
`;
    } else if (currentWritingMethod === 'fanwen_style_imitation') {
      // ========== 直写正文模式 ==========
      const simplifiedCharacters = (activeSession.story.characters || [])
        .slice(0, 10)
        .map(c => `${c.name} (${c.role}): ${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}`)
        .join('\n') || '暂无角色设定';
      
      const simplifiedWorldSettings = (activeSession.story.worldGuide || [])
        .slice(0, 5)
        .map(entry => `${entry.name}: ${entry.description.substring(0, 80)}${entry.description.length > 80 ? '...' : ''}`)
        .join('\n') || '暂无世界观设定';
      
      systemInstruction = `${authorBlock}${assistantIdentity}## 🎯 当前模式：直写正文模式

## 🎯 当前模式：直写正文模式

**你现在处于"直写正文模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **先写正文，再写章纲**：
   - 根据用户要求或故事上下文，直接生成正文内容
   - 正文生成后，根据正文内容总结出详细的章纲（500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
   - **在一次工具调用中返回所有内容**（正文、章纲、故事圣经）

2. **必须调用工具保存所有内容**：
   - **必须调用 update_storyboard 工具保存**，参数包括：
     * chapterNumber（章节号）
     * chapterTitle（章节标题，必须是描述性标题，不能只是"第X章"）
     * chapter_content（正文内容）
     * chapter_outline（详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
     * updated_story_bible（根据本章剧情更新故事圣经，包含：character_status、key_items_and_locations、active_plot_threads、important_rules）
     * createNewVersion: true（创建新版本）

3. **如果生成的内容涉及新角色、世界观设定、写作指导，必须立即调用相应工具保存**：
   - 可以在 update_storyboard 工具的 characters、worldEntries、writingGuidelines 参数中一起更新
   - 或者单独调用 add_character、add_world_entry、add_writing_guideline 工具

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**只在文本中描述正文而不调用 update_storyboard 工具保存！文本中的描述不会保存到故事板！
- ❌ **绝对禁止**在文本中写"故事板已更新"或"已调用工具"等描述！必须真正调用工具！

**重要**：在直写正文模式下，你必须先写正文，再根据正文总结章纲，然后通过 update_storyboard 工具一次性保存所有内容。所有内容必须通过工具保存，否则不会出现在故事板上！

${toolCallingRules}

## 📚 当前故事上下文（精简版）

**基本信息：**
- 标题: ${context.title}
- 简介: ${context.synopsis}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${context.volumes.length > 0 
  ? context.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${context.chapters || '暂无章纲'}

**角色设定（精简版，仅显示前10个）：**
${simplifiedCharacters}

**世界观设定（精简版，仅显示前5个）：**
${simplifiedWorldSettings}

**⚠️ 写作指导原则：**
${context.writingGuidelines || '暂无写作指导'}
`;
    } else {
      // ========== 其他模式（默认模式，但mode为manuscript时） ==========
      systemInstruction = `${authorBlock}${assistantIdentity}## 🎯 当前模式：生成正文模式

## 🎯 当前模式：生成正文模式

**你现在处于"生成正文模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **生成正文和章纲**：
   - 根据用户要求或故事上下文，生成正文内容
   - 根据正文内容总结出详细的章纲（500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
   - **在一次工具调用中返回所有内容**（正文、章纲、故事圣经）

2. **必须调用工具保存所有内容**：
   - **必须调用 update_storyboard 工具保存**，参数包括：
     * chapterNumber（章节号）
     * chapterTitle（章节标题，必须是描述性标题，不能只是"第X章"）
     * chapter_content（正文内容）
     * chapter_outline（详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
     * updated_story_bible（根据本章剧情更新故事圣经，包含：character_status、key_items_and_locations、active_plot_threads、important_rules）
     * createNewVersion: true（创建新版本）

3. **如果生成的内容涉及新角色、世界观设定、写作指导，必须立即调用相应工具保存**：
   - 可以在 update_storyboard 工具的 characters、worldEntries、writingGuidelines 参数中一起更新
   - 或者单独调用 add_character、add_world_entry、add_writing_guideline 工具

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**只在文本中描述正文而不调用 update_storyboard 工具保存！文本中的描述不会保存到故事板！
- ❌ **绝对禁止**在文本中写"故事板已更新"或"已调用工具"等描述！必须真正调用工具！

**重要**：在生成正文模式下，你必须通过 update_storyboard 工具保存所有内容。所有内容必须通过工具保存，否则不会出现在故事板上！

${toolCallingRules}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${context.title}
- 简介: ${context.synopsis}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${context.volumes.length > 0 
  ? context.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${context.chapters || '暂无章纲'}

**角色设定：**
${context.characters}

**世界观设定：**
${context.worldSettings}

**⚠️ 写作指导原则：**
${context.writingGuidelines || '暂无写作指导'}
`;
    }

    // Get limited history for display in prompt confirmation modal
    // Filter out system messages that should be excluded from AI context
    const allMessages = activeSession.messages || [];
    const messagesForAI = allMessages.filter(msg => !msg.excludeFromAI);
    const maxHistory = maxHistoryForAI || 10;
    const limitedHistory = messagesForAI.length > maxHistory 
      ? messagesForAI.slice(-maxHistory).map(m => ({ role: m.role, text: m.text }))
      : messagesForAI.map(m => ({ role: m.role, text: m.text }));

    return { systemInstruction, context, history: limitedHistory };
  }, [activeSession, apiConfig, targetWordCount, maxHistoryForAI, getWritingSamplesBlock, shouldUseJsonSchema]);

  const sendMessage = useCallback(async (text: string, options?: SendMessageOptions, historyOverride?: Message[]) => {
    if (!activeSession && !historyOverride) return;
    const effectiveSessionId = activeSession?.id;
    
    if (!apiConfig || !apiConfig.apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    const requestStartedAt = Date.now();
    let responseDurationMs: number | undefined;

    const mode = options?.mode || 'general';
    const generationConfig = { temperature, enableStreaming };
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const reuseUserMessage = options?.reuseUserMessage;
    const userMsgId = reuseUserMessage?.id || uuidv4();
    
    // 获取用户消息的原始文本
    const originalText = reuseUserMessage ? reuseUserMessage.text : text;
    
    // 检查繁体引号设置，并在需要时追加指令（适用于所有请求，包括重新生成）
    let textToSend = originalText;
    
    // 🚨 清理用户消息中的范文内容（范文应该只在系统提示词中，不应该在用户消息中）
    // 无论什么模式，只要用户消息中包含范文内容，都应该清理
    if (textToSend.includes('📖 范文参考') || textToSend.includes('范文内容：') || textToSend.includes('【范文参考】') || textToSend.includes('【范文')) {
      // 更全面的范文清理逻辑
      const beforeClean = textToSend;
      textToSend = textToSend
        // 清理完整的范文参考块（包含标题、说明、内容）
        .replace(/## 📖 范文参考[\s\S]*?⚠️ 重要[\s\S]*?范文的笔触、手法、思路是你最重要的参考[^！]*！/g, '')
        .replace(/📖 范文参考[\s\S]*?⚠️ 重要[\s\S]*?范文的笔触、手法、思路是你最重要的参考[^！]*！/g, '')
        .replace(/📖 范文参考[\s\S]*?范文内容：[\s\S]*?(?=\n\n|$)/g, '')
        // 清理【范文参考】标记及其后的所有内容（直到下一个【】标记或文档结束）
        // 使用更贪婪的匹配，确保清理【范文参考】后的所有内容
        .replace(/【范文参考】[\s\S]*?(?=【[^范文参考][^】]*】|$)/g, '')
        .replace(/【范文[^】]*】[\s\S]*?(?=【[^范文][^】]*】|$)/g, '')
        // 如果【范文参考】后面没有其他【】标记，清理到文档结束
        .replace(/【范文参考】[\s\S]*$/g, '')
        .replace(/【范文[^】]*】[\s\S]*$/g, '')
        // 清理单独的范文标记
        .replace(/【范文[^】]*】/g, '')
        // 清理"范文内容："及其后的所有内容（直到下一个章节标记或文档结束）
        .replace(/范文内容：[\s\S]*?(?=【[^】]+】|$)/g, '')
        .replace(/范文内容：[\s\S]*$/g, '')
        // 清理可能包含范文内容的段落（如果整段都是范文相关）
        .replace(/^.*?范文.*?参考.*?$/gm, '')
        .replace(/^.*?范文.*?内容.*?$/gm, '')
        // 清理空行（可能由清理产生）
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (textToSend !== beforeClean) {
        console.log('🧹 已清理用户消息中的范文内容（范文应只在系统提示词中）', {
          originalLength: beforeClean.length,
          cleanedLength: textToSend.length,
          removed: beforeClean.length - textToSend.length
        });
      }
    }
    
    const useTraditionalQuotes = localStorage.getItem('storyforge_use_traditional_quotes') === 'true';
    if (useTraditionalQuotes && textToSend.trim() && !textToSend.includes('引号使用')) {
      textToSend = textToSend + '\n\n**重要**：请使用简体中文回答，引号使用「」和『』，不要使用其他引号符号。';
    }
    
    // 用户消息对象（显示在聊天窗口的，使用原始文本）
    const userTimestamp = Date.now();
    const userMsg: Message = reuseUserMessage 
      ? { ...reuseUserMessage, timestamp: reuseUserMessage.timestamp || userTimestamp }
      : { id: userMsgId, role: 'user', text, timestamp: userTimestamp };
    
    // Use edited system instruction if provided, otherwise build from context
    let finalSystemInstruction: string;
    // 获取当前写作方法（在函数顶层声明，避免重复声明）
    const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
    if (options?.editedSystemInstruction) {
      finalSystemInstruction = options.editedSystemInstruction;
      
      // 🚨 重要：在纯聊天模式下，强制覆盖系统提示词，确保不包含工具调用说明
      if (currentWritingMethod === 'chat_only') {
        const samplesBlock = getWritingSamplesBlock();
        const selectedAuthorId = localStorage.getItem('storyforge_selected_author_id') || 'none';
        let authorBlock = '';
        if (selectedAuthorId !== 'none') {
          const defaultAuthorDescriptionsJson = localStorage.getItem('storyforge_default_author_descriptions');
          const defaultAuthorDescriptions: Record<string, string> = defaultAuthorDescriptionsJson ? JSON.parse(defaultAuthorDescriptionsJson) : {};
          const customAuthorsJson = localStorage.getItem('storyforge_custom_authors');
          const customAuthors: any[] = customAuthorsJson ? JSON.parse(customAuthorsJson) : [];
          const author = DEFAULT_AUTHORS.find(a => a.id === selectedAuthorId) || customAuthors.find(a => a.id === selectedAuthorId);
          if (author) {
            const authorDescription = defaultAuthorDescriptions[author.id] || author.description;
            if (authorDescription && authorDescription.trim()) {
              authorBlock = `\n\n## ✍️ 作家身份（🚨 核心身份）\n\n**你现在就是 ${author.name}。不是模仿，不是学习，你就是这位作家本人。**\n\n**你的写作特点：**\n${authorDescription}\n\n**🚨 核心要求：**\n- 以 ${author.name} 的身份进行创作，这是你的本能，不需要刻意模仿\n- 你的文字风格、叙事节奏、遣词造句都是你作为 ${author.name} 的自然表达\n- 保持文本的自然流畅，不要让读者感觉到"规则"的存在\n- **这是你的创作身份，贯穿所有写作任务！**\n\n`;
            }
          }
        }
        const assistantIdentity = authorBlock ? '' : '你是 "StoryForge"，一个专业的小说创作AI助手。\n\n';
        const guidelinesText = options.systemContent ? '' : (getPromptContext?.(text, options?.mode)?.context?.writingGuidelines || '暂无写作指导');
        
        // 移除所有工具调用相关的指令，强制使用纯聊天模式
        // 更彻底地清理所有工具调用相关内容
        finalSystemInstruction = finalSystemInstruction
          // 清理工具调用指令块
          .replace(/【🚨 工具调用指令[^】]*】[\s\S]*?(?=\n\n|$)/g, '')
          .replace(/🚨 工具调用指令[\s\S]*?(?=\n\n|$)/g, '')
          // 清理 JSON Schema 相关说明
          .replace(/⚠️ 重要[^：]*：当前使用 JSON Schema 模式[^】]*```/g, '')
          .replace(/JSON Schema 模式[\s\S]*?```json[\s\S]*?```/g, '')
          .replace(/```json[\s\S]*?```/g, '')
          // 清理工具调用相关文字
          .replace(/必须调用.*?工具/g, '')
          .replace(/调用.*?工具保存/g, '')
          .replace(/update_storyboard|add_chapter|add_character|add_world_entry|add_writing_guideline/g, '')
          // 清理工具调用规则说明
          .replace(/工具调用方式[\s\S]*?(?=\n\n|$)/g, '')
          .replace(/Function Calling[\s\S]*?(?=\n\n|$)/g, '')
          // 清理所有包含"工具"和"调用"的段落
          .replace(/^.*?工具.*?调用.*?$/gm, '')
          .replace(/^.*?调用.*?工具.*?$/gm, '')
          // 清理空行
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        // 构建纯聊天模式的系统提示词（完全覆盖，不保留任何工具调用相关内容）
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：纯聊天模式

**🚨 重要规则（最高优先级）：**
- **绝对禁止调用任何工具**
- **绝对禁止输出 JSON 代码块或函数调用格式**
- **直接输出正文内容，不要任何工具调用或JSON格式**
- 可以参考写作指导和作家设定，但只需在对话中输出内容

${guidelinesText ? `## ⚙️ 写作指导（可参考，也可忽略）\n${guidelinesText}\n\n` : ''}`;
        
        console.log('✅ 纯聊天模式：已强制覆盖系统提示词，移除所有工具调用指令');
      } else {
        // 🚨 重要：确保范文被包含（幽灵注入）
        // 如果 editedSystemInstruction 不包含范文，在开头添加范文
        const samplesBlock = getWritingSamplesBlock();
        if (samplesBlock && !finalSystemInstruction.includes('📖 范文参考')) {
          // 范文应该在系统提示词的开头
          finalSystemInstruction = samplesBlock + finalSystemInstruction;
          console.log('✅ 已为编辑后的系统提示词添加范文（幽灵注入）');
        }
      }
      
      // 如果有 systemContent，追加到 editedSystemInstruction 后面
      if (options.systemContent) {
        finalSystemInstruction = finalSystemInstruction + options.systemContent;
      }
    } else {
      // 根据不同的写作方法和模式生成专门的系统提示词
      const currentMode = options?.mode || 'general';
      
      // 判断是否使用 JSON Schema 模式（根据用户选择）
      const useJsonSchema = shouldUseJsonSchema(apiConfig);
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);
      console.log('🔧 工具调用模式:', {
        toolCallMode: apiConfig?.toolCallMode || '未设置（使用默认）',
        provider: apiConfig?.provider,
        useProxy: apiConfig?.useProxy,
        useJsonSchema: useJsonSchema ? 'JSON Schema' : 'Function Calling',
        device: isMobile ? '移动端' : '桌面端',
        configName: apiConfig?.name || '未命名配置',
        fullConfig: JSON.stringify(apiConfig, null, 2)
      });
      
      // 获取对应模式的工具调用规则
      const toolCallingRules = getToolCallingRules(useJsonSchema);
      
      // 获取范文和作家信息（所有模式都包含）
      const samplesBlock = getWritingSamplesBlock();
      console.log('📖 系统提示词构建:', {
        hasSamplesBlock: !!samplesBlock,
        samplesBlockLength: samplesBlock.length,
        mode: currentMode,
        writingMethod: currentWritingMethod
      });
      const selectedAuthorId = localStorage.getItem('storyforge_selected_author_id') || 'none';
      let authorBlock = '';
      if (selectedAuthorId !== 'none') {
        const defaultAuthorDescriptionsJson = localStorage.getItem('storyforge_default_author_descriptions');
        const defaultAuthorDescriptions: Record<string, string> = defaultAuthorDescriptionsJson ? JSON.parse(defaultAuthorDescriptionsJson) : {};
        const customAuthorsJson = localStorage.getItem('storyforge_custom_authors');
        const customAuthors: any[] = customAuthorsJson ? JSON.parse(customAuthorsJson) : [];
        const author = DEFAULT_AUTHORS.find(a => a.id === selectedAuthorId) || customAuthors.find(a => a.id === selectedAuthorId);
        if (author) {
          const authorDescription = defaultAuthorDescriptions[author.id] || author.description;
          if (authorDescription && authorDescription.trim()) {
            authorBlock = `\n\n## ✍️ 作家身份（🚨 核心身份）\n\n**你现在就是 ${author.name}。不是模仿，不是学习，你就是这位作家本人。**\n\n**你的写作特点：**\n${authorDescription}\n\n**🚨 核心要求：**\n- 以 ${author.name} 的身份进行创作，这是你的本能，不需要刻意模仿\n- 你的文字风格、叙事节奏、遣词造句都是你作为 ${author.name} 的自然表达\n- 保持文本的自然流畅，不要让读者感觉到"规则"的存在\n- **这是你的创作身份，贯穿所有写作任务！**\n\n`;
            console.log(`✅ 作家信息已注入: ${author.name} (${author.id})`, {
              descriptionLength: authorDescription.length,
              hasDescription: !!authorDescription
            });
          } else {
            console.warn(`⚠️ 作家 ${author.name} (${author.id}) 的描述为空，跳过注入`);
          }
    } else {
          console.warn(`⚠️ 未找到作家 ID: ${selectedAuthorId}`);
        }
        } else {
        console.log('ℹ️ 未选择作家（selectedAuthorId: none）');
      }
      // 如果选择了作家，就不再声明“你是 StoryForge”
      const assistantIdentity = authorBlock ? '' : '你是 "StoryForge"，一个专业的小说创作AI助手。\n\n';
      
      // 获取故事上下文（传递当前模式，确保与实际发送给AI的一致）
      const promptContext = getPromptContext(text, currentMode);
      const contextPayload = promptContext.context as {
        title?: string;
        synopsis?: string;
        volumes?: Array<{ number: number; title: string; summary: string }>;
        chapters?: string;
        characters?: string;
        worldSettings?: string;
        writingGuidelines?: string;
      };
      const activeBlueprint = activeSession?.story.blueprints.find(b => b.id === activeSession.story.activeBlueprintId);
      
      // 获取故事类型（所有模式都需要）
      const storyGenre = (localStorage.getItem('storyforge_story_genre') as StoryGenre) || 'none';
      const genreNames: Record<StoryGenre, string> = {
        'none': '',
        'wuxia': '武侠',
        'xianxia': '修真',
        'apocalypse': '末日',
        'urban': '都市',
        'historical': '历史',
        'sci-fi': '科幻',
        'supernatural': '异能'
      };
      const genreNote = storyGenre !== 'none' ? `\n\n**⚠️ 故事类型要求**：当前故事题材为**${genreNames[storyGenre]}**，请严格根据${genreNames[storyGenre]}题材的特点、惯例、风格和读者期待来创作。这是硬性要求，必须贯穿所有创作任务！` : '';
      
      // 根据不同的设置生成专门的系统提示词
      if (currentWritingMethod === ('chat_only' as WritingMethod)) {
        // 使用已经获取的 promptContext，避免重复调用
        const guidelinesText = contextPayload?.writingGuidelines || '暂无写作指导';
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：纯聊天模式

**规则：**
- 自由对话，不调用任何工具
- 不输出 JSON 代码块或函数调用格式
- 可以参考写作指导和作家设定，但无需生成正文/章纲

## ⚙️ 写作指导（可参考，也可忽略）
${guidelinesText}

## 🗂️ 故事背景（可参考，可忽略）
- 标题: ${contextPayload?.title || '未命名故事'}
- 简介: ${contextPayload?.synopsis || '暂无简介'}
`;
      } else if (currentWritingMethod === 'default' && currentMode === 'general') {
        // ========== 构思讨论模式 ==========
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：构思讨论模式

## 🎯 当前模式：构思讨论模式

**你现在处于"构思讨论模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **与用户讨论故事构思，提供创意建议**
   - 提供书名建议（多个版本，每个版本都要体现核心卖点）
   - 提供简介建议（多个版本，每个版本都要体现核心卖点）
   - 提供卷纲建议（故事的整体结构）
   - 提供角色设定建议
   - 提供世界观设定建议
   - 提供写作指导建议

2. **必须调用工具保存生成的内容**：
   - 当用户要求更新书名/简介时 → **必须调用 update_title_synopsis 工具**
   - 当用户要求更新卷纲时 → **必须调用 update_structure 工具**
   - 当用户明确要求生成正文时 → **必须调用 update_storyboard 工具**
   - 当用户明确要求生成章纲时 → **必须调用 add_chapter 工具**
   - **🚨 关键要求**：如果你在讨论中**生成或建议了角色、世界观设定、写作指导、故事圣经信息**，必须立即调用相应的工具保存：
     * 生成角色设定 → **必须调用 add_character 工具保存**（name, role, description）
     * 生成世界观设定 → **必须调用 add_world_entry 工具保存**（category, name, description）
     * 生成写作指导 → **必须调用 add_writing_guideline 工具保存**（category, content）
     * 更新故事圣经（角色状态、物品位置、伏笔等）→ 建议调用 add_writing_guideline 工具保存（category: "故事圣经", content: 详细内容）

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**自动生成正文内容（除非用户明确要求）
- ❌ **绝对禁止**自动生成章纲（除非用户明确要求）
- ❌ **绝对禁止**在用户没有明确要求的情况下调用 update_storyboard 工具生成正文
- ❌ **绝对禁止**在用户没有明确要求的情况下调用 add_chapter 工具生成章纲
- ❌ **绝对禁止**只在文本中描述这些信息而不调用工具保存！文本中的描述不会保存到故事板！

### ✅ 允许行为：
- ✅ 讨论故事构思、角色设定、世界观设定
- ✅ 当用户明确要求时，可以生成正文或章纲
- ✅ 调用 update_title_synopsis 工具更新书名和简介
- ✅ 调用 update_structure 工具更新卷纲（模板）
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在构思讨论模式下，你的主要职责是提供建议和讨论，而不是自动生成内容。只有在用户明确要求时，才生成正文或章纲。**但是，如果你在讨论中生成或建议了角色、世界观、写作指导等信息，必须立即调用工具保存，否则这些信息会丢失！**

${toolCallingRules}
${genreNote}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${contextPayload.title || '未命名故事'}
- 简介: ${contextPayload.synopsis || '暂无简介'}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${contextPayload.volumes && contextPayload.volumes.length > 0 
  ? contextPayload.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${contextPayload.chapters || '暂无章纲'}

**角色设定：**
${contextPayload.characters || '暂无角色设定'}

**世界观设定：**
${contextPayload.worldSettings || '暂无世界观设定'}

**⚠️ 写作指导原则：**
${contextPayload.writingGuidelines || '暂无写作指导'}
`;
      } else if (currentWritingMethod === 'design_outline') {
        // ========== 设计章纲模式 ==========
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：设计章纲模式

## 🎯 当前模式：设计章纲模式

**你现在处于"设计章纲模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **只生成章纲，禁止生成正文**
   - 根据用户要求或故事上下文，设计详细的章纲
   - 章纲必须包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点
   - 章纲字数要求：500-1500字（详细章纲）

2. **必须调用工具保存章纲**：
   - **必须调用 add_chapter 工具保存章纲**
   - 工具参数：number（章节编号）、title（章节标题）、summary（详细章纲，500-1500字）、volumeNumber（卷号，可选）

3. **如果生成的内容涉及新角色、世界观设定、故事圣经更新，必须立即调用相应工具保存**：
   - 生成角色设定 → **必须调用 add_character 工具保存**（name, role, description）
   - 生成世界观设定 → **必须调用 add_world_entry 工具保存**（category, name, description）
   - 生成写作指导 → **必须调用 add_writing_guideline 工具保存**（category, content）
   - 更新故事圣经 → **必须调用 add_writing_guideline 工具保存**（category: "故事圣经", content: 详细内容）

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**生成正文内容
- ❌ **绝对禁止**调用 update_storyboard 工具（该工具会生成正文）
- ❌ **绝对禁止**在章纲中包含正文内容
- ❌ **绝对禁止**只在文本中描述章纲而不调用 add_chapter 工具保存！文本中的描述不会保存到故事板！

### ✅ 允许行为：
- ✅ 设计详细的章纲（500-1500字）
- ✅ 调用 add_chapter 工具保存章纲
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在设计章纲模式下，你的唯一任务是生成章纲，绝对不能生成正文。章纲必须通过 add_chapter 工具保存，否则不会出现在故事板上！

${toolCallingRules}
${genreNote}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${contextPayload.title || '未命名故事'}
- 简介: ${contextPayload.synopsis || '暂无简介'}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${contextPayload.volumes && contextPayload.volumes.length > 0 
  ? contextPayload.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${contextPayload.chapters || '暂无章纲'}

**角色设定：**
${contextPayload.characters || '暂无角色设定'}

**世界观设定：**
${contextPayload.worldSettings || '暂无世界观设定'}

**⚠️ 写作指导原则（与用户输入同等优先级 - 必须时刻谨记并隐式应用）：**
${contextPayload.writingGuidelines || '暂无写作指导'}

**重要**：上述写作指导原则与用户输入具有同等优先级！必须自然地融入文字中，通过描写展现风格，而不是在正文中复述规则。保持文本的自然流畅，不要让读者感觉到"规则"的存在。
`;
      } else if (currentWritingMethod === 'fanwen_style_imitation' && currentMode === 'manuscript') {
        // ========== 直写正文模式（精简版，专注学习范文） ==========
          const recentChapters = activeSession?.story.outline.slice(-3).map((ch, idx, arr) => {
            if (idx === arr.length - 1) {
              return `Ch${ch.number}: ${ch.title}\n概要: ${ch.summary}`;
            }
            return `Ch${ch.number}: ${ch.title}`;
          }).join('\n\n') || '暂无章纲';
          
          const simplifiedCharacters = activeSession?.story.characters
          ?.slice(0, 10)
            ?.map(c => `${c.name} (${c.role}): ${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}`)
            .join('\n') || '暂无角色设定';
          
          const simplifiedWorldSettings = (activeSession?.story.worldGuide || [])
            .slice(0, 5)
            .map(entry => `${entry.name}: ${entry.description.substring(0, 80)}${entry.description.length > 80 ? '...' : ''}`)
            .join('\n') || '暂无世界观设定';
          
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：直写正文模式

## 🎯 当前模式：直写正文模式

**你现在处于"直写正文模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **生成正文内容**
   - **生成顺序**：先写正文，再根据正文总结章纲
   - **字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchema ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchema ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出
   - **专注学习范文腔调**：深入分析范文的写作风格、叙事手法、文笔特色，然后运用这种腔调创作

2. **必须调用工具保存内容**：
   - **必须调用 update_storyboard 工具保存正文和章纲**
   - 工具参数：
     * chapterNumber（章节编号）
     * chapterTitle（章节标题，必须是描述性标题，不能只是"第X章"）
     * chapter_content（正文内容）
     * chapter_outline（详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
     * updated_story_bible（根据本章剧情更新故事圣经，包含：character_status、key_items_and_locations、active_plot_threads、important_rules）
     * createNewVersion: true（创建新版本）

3. **如果生成的内容涉及新角色、世界观设定、写作指导，必须立即调用相应工具保存**：
   - 可以在 update_storyboard 工具的 characters、worldEntries、writingGuidelines 参数中一起更新
   - 或者单独调用 add_character、add_world_entry、add_writing_guideline 工具

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**只在文本中描述正文而不调用 update_storyboard 工具保存！文本中的描述不会保存到故事板！
- ❌ **绝对禁止**在文本中写"故事板已更新"或"已调用工具"等描述！必须真正调用工具！

### ✅ 允许行为：
- ✅ 生成正文内容（先写正文，再总结章纲）
- ✅ 调用 update_storyboard 工具保存正文和章纲
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在直写正文模式下，你必须先写正文，再根据正文总结章纲，然后通过 update_storyboard 工具一次性保存所有内容。所有内容必须通过工具保存，否则不会出现在故事板上！

${toolCallingRules}
${genreNote}

## 📚 当前故事上下文（精简版）

**基本信息：**
- 标题: ${contextPayload.title || '未命名故事'}
- 目标字数: ${targetWordCount}字

**最近章节：**
${recentChapters}

**主要角色：**
${simplifiedCharacters}

**关键设定：**
${simplifiedWorldSettings}

${contextPayload.writingGuidelines ? `**写作指导：**
${contextPayload.writingGuidelines}
` : ''}

---
**⚠️ 生成正文时的核心要求：**

1. **专注学习范文腔调**：深入分析范文的写作风格、叙事手法、文笔特色，然后运用这种腔调创作。

2. **字数要求**：严格控制字数在 **${targetWordCount}字** 左右（±10%，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

3. **上下文一致性**：参考上述章节、角色、设定，保持情节连贯。

4. **工具调用**：生成正文后，立即调用 update_storyboard 工具保存。
`;
        } else {
        // ========== 其他模式（默认模式，但mode为manuscript时） ==========
        finalSystemInstruction = `${samplesBlock}${authorBlock}${assistantIdentity}## 🎯 当前模式：生成正文模式

## 🎯 当前模式：生成正文模式

**你现在处于"生成正文模式"，这是你的核心职责和任务：**

### ✅ 主要任务（必须执行）：
1. **生成正文内容**
   - **字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchema ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchema ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出
   - **上下文一致性**：必须参考所有上下文（卷纲、章纲、角色设定、世界观设定），保持情节和风格的连贯性

2. **必须调用工具保存内容**：
   - **必须调用 update_storyboard 工具保存正文和章纲**
   - 工具参数：
     * chapterNumber（章节编号）
     * chapterTitle（章节标题，必须是描述性标题，不能只是"第X章"）
     * chapter_content（正文内容）
     * chapter_outline（详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
     * updated_story_bible（根据本章剧情更新故事圣经，包含：character_status、key_items_and_locations、active_plot_threads、important_rules）
     * createNewVersion: true（创建新版本）

3. **如果生成的内容涉及新角色、世界观设定、写作指导，必须立即调用相应工具保存**：
   - 可以在 update_storyboard 工具的 characters、worldEntries、writingGuidelines 参数中一起更新
   - 或者单独调用 add_character、add_world_entry、add_writing_guideline 工具

### ❌ 禁止行为（绝对禁止）：
- ❌ **绝对禁止**只在文本中描述正文而不调用 update_storyboard 工具保存！文本中的描述不会保存到故事板！
- ❌ **绝对禁止**在文本中写"故事板已更新"或"已调用工具"等描述！必须真正调用工具！

### ✅ 允许行为：
- ✅ 生成正文内容
- ✅ 调用 update_storyboard 工具保存正文和章纲
- ✅ 调用 add_character、add_world_entry、add_writing_guideline 等工具添加设定

**重要**：在生成正文模式下，你必须通过 update_storyboard 工具保存所有内容。所有内容必须通过工具保存，否则不会出现在故事板上！

${toolCallingRules}
${genreNote}

## 📚 当前故事上下文

**基本信息：**
- 标题: ${contextPayload.title || '未命名故事'}
- 简介: ${contextPayload.synopsis || '暂无简介'}
- 目标字数: ${targetWordCount}字

**卷纲（故事结构）：**
${activeBlueprint ? `
- 开端: ${activeBlueprint.data.hook || '待完善'}
- 激励事件: ${activeBlueprint.data.incitingIncident || '待完善'}
- 上升动作: ${activeBlueprint.data.risingAction || '待完善'}
- 高潮: ${activeBlueprint.data.climax || '待完善'}
- 下降动作: ${activeBlueprint.data.fallingAction || '待完善'}
- 结局: ${activeBlueprint.data.resolution || '待完善'}
` : '暂无卷纲'}

**现有卷纲：**
${contextPayload.volumes && contextPayload.volumes.length > 0 
  ? contextPayload.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')
  : '暂无卷纲'}

**章纲：**
${contextPayload.chapters || '暂无章纲'}

**角色设定：**
${contextPayload.characters || '暂无角色设定'}

**世界观设定：**
${contextPayload.worldSettings || '暂无世界观设定'}

**⚠️ 写作指导原则（与用户输入同等优先级 - 必须时刻谨记并隐式应用）：**
${contextPayload.writingGuidelines || '暂无写作指导'}

**重要**：上述写作指导原则与用户输入具有同等优先级！必须自然地融入文字中，通过描写展现风格，而不是在正文中复述规则。保持文本的自然流畅，不要让读者感觉到"规则"的存在。

---
**⚠️ 生成正文时的核心要求（最高优先级）：**

1. **严格遵守写作指导原则**（与用户输入同等优先级）：
   - 必须隐式应用所有写作指导，融入文字而非复述规则
   - Show, Don't Tell：通过描写展现，而非说明
   - 保持自然流畅，不让读者感觉到规则的存在

2. **字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchema ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchema ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

3. **上下文一致性**：
   - 必须参考上述所有上下文（卷纲、章纲、角色设定、世界观设定）
- 角色行为必须符合角色设定中的描述和行为示例
   - 世界观设定必须严格遵守，不能出现矛盾

4. **工具调用**：生成正文后，必须立即调用 update_storyboard 工具保存。**重要**：Function Calling是API自动处理的，你不需要在文本中写任何代码或描述，只需要让API自动调用工具即可。

**再次强调**：写作指导原则与用户输入具有同等优先级，必须时刻谨记并严格遵守！
`;
      }
      
      // 如果有 systemContent，追加到构建的系统提示词后面（在范文之后）
      if (options?.systemContent) {
        finalSystemInstruction = finalSystemInstruction + options.systemContent;
      }
    }
    
    let apiHistory: Message[] = [];

    if (historyOverride) {
        if (effectiveSessionId && !options?.skipAddingToMessages) {
             setSessions(prev => prev.map(s => 
                s.id === effectiveSessionId 
                ? { ...s, messages: [...historyOverride, userMsg], lastUpdated: Date.now() } 
                : s
            ));
        }
        apiHistory = [...historyOverride, userMsg];
    } else {
        if (effectiveSessionId && !options?.skipAddingToMessages) {
             setSessions(prev => prev.map(s => 
                s.id === effectiveSessionId 
                ? { ...s, messages: [...s.messages, userMsg], lastUpdated: Date.now() } 
                : s
            ));
        }
        // 检查是否是提炼信息操作，如果是，不使用对话历史
        const isExtractOperation = options?.silentOperationInfo?.operationType === 'extract';
        
        if (isExtractOperation) {
          // 提炼信息操作：不使用对话历史，只发送用户消息
          apiHistory = [userMsg];
          console.log(`📨 提炼信息操作：仅发送用户消息，不使用对话历史`);
        } else {
          // Performance: Only send recent messages to AI (configurable)
          // This prevents AI from being distracted by too much history
          const allMessages = activeSession ? activeSession.messages : [];
          // Filter out messages that should be excluded from AI context
          const messagesForAI = allMessages.filter(msg => !msg.excludeFromAI);
          
          // For fanwen manuscript mode, use fewer history messages to focus on learning style
          const isFanwenManuscript = mode === 'manuscript' && 
            (currentWritingMethod === 'fanwen_style_imitation' || currentWritingMethod === 'design_outline');
          const effectiveMaxHistory = isFanwenManuscript ? Math.min(maxHistoryForAI, 3) : maxHistoryForAI;
          
          let limitedHistory = messagesForAI.length > effectiveMaxHistory 
            ? messagesForAI.slice(-effectiveMaxHistory)
            : messagesForAI;
          
          // 🚨 在纯聊天模式下，清理历史消息中的工具调用指令和范文内容
          if (currentWritingMethod === 'chat_only') {
            limitedHistory = limitedHistory.map(msg => {
              if (msg.role === 'user' && msg.text) {
                // 清理用户消息中的工具调用指令和范文内容（范文应该只在系统提示词中）
                let cleanedText = msg.text
                  // 清理工具调用指令
                  .replace(/【🚨 工具调用指令[^】]*】[\s\S]*?(?=\n\n|$)/g, '')
                  .replace(/⚠️ 重要[^：]*：当前使用 JSON Schema 模式[^】]*```/g, '')
                  .replace(/```json[\s\S]*?```/g, '')
                  .replace(/必须调用.*?工具/g, '')
                  .replace(/调用.*?工具保存/g, '')
                  .replace(/update_storyboard|add_chapter|add_character|add_world_entry|add_writing_guideline/g, '')
                  // 清理范文内容（范文应该只在系统提示词中，不应该在用户消息中）
                  // 使用更贪婪的匹配，确保清理【范文参考】后的所有内容直到下一个【】标记
                  .replace(/## 📖 范文参考[\s\S]*?⚠️ 重要[\s\S]*?范文的笔触、手法、思路是你最重要的参考[^！]*！/g, '')
                  .replace(/📖 范文参考[\s\S]*?⚠️ 重要[\s\S]*?范文的笔触、手法、思路是你最重要的参考[^！]*！/g, '')
                  .replace(/📖 范文参考[\s\S]*?范文内容：[\s\S]*?(?=\n\n|$)/g, '')
                  // 清理【范文参考】标记及其后的所有内容（直到下一个【】标记或文档结束）
                  // 先尝试匹配到下一个【】标记（排除【范文】本身）
                  .replace(/【范文参考】[\s\S]*?(?=【[^范文参考][^】]*】|$)/g, '')
                  // 如果没有其他【】标记，清理到文档结束
                  .replace(/【范文参考】[\s\S]*$/g, '')
                  // 清理其他范文标记
                  .replace(/【范文[^】]*】[\s\S]*?(?=【[^范文][^】]*】|$)/g, '')
                  .replace(/【范文[^】]*】[\s\S]*$/g, '')
                  .replace(/【范文[^】]*】/g, '')
                  // 清理"范文内容："及其后的所有内容
                  .replace(/范文内容：[\s\S]*?(?=【[^】]+】|$)/g, '')
                  .replace(/范文内容：[\s\S]*$/g, '')
                  // 清理可能包含范文内容的段落
                  .replace(/^.*?范文.*?参考.*?$/gm, '')
                  .replace(/^.*?范文.*?内容.*?$/gm, '')
                  // 清理空行
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();
                
                // 如果清理后消息为空或太短，保留原消息但添加说明
                if (cleanedText.length < 10 && msg.text.length > 50) {
                  // 消息被大幅清理，可能是工具调用指令或范文，保留核心内容
                  const lines = msg.text.split('\n');
                  const coreContent = lines.filter(line => 
                    !line.includes('工具调用') && 
                    !line.includes('JSON Schema') && 
                    !line.includes('```json') &&
                    !line.includes('update_storyboard') &&
                    !line.includes('必须调用') &&
                    !line.includes('📖 范文参考') &&
                    !line.includes('范文内容') &&
                    !line.includes('【范文')
                  ).join('\n').trim();
                  cleanedText = coreContent || msg.text.substring(0, 200) + '...';
                }
                
                return { ...msg, text: cleanedText };
              }
              return msg;
            });
            console.log('🧹 纯聊天模式：已清理历史消息中的工具调用指令和范文内容');
          }
          
          // Always include userMsg in apiHistory for AI, even if skipAddingToMessages is true
          apiHistory = [...limitedHistory, userMsg];
          console.log(`📨 Sending ${apiHistory.length} messages to AI (out of ${allMessages.length} total, ${allMessages.length - messagesForAI.length} excluded, limit: ${effectiveMaxHistory}${isFanwenManuscript ? ' [精简模式]' : ''}${currentWritingMethod === 'chat_only' ? ' [纯聊天模式-已清理工具指令]' : ''})`);
        }
    }

    try {
      // Use the Adapter
      const isChatOnlyMode = currentWritingMethod === 'chat_only';
      // 对于生成正文的场景，强制要求工具调用（使用 update_storyboard 保存内容）；纯聊天模式不强制也不提供工具
      const forceToolCall = isChatOnlyMode ? false : true;
      const effectiveTools = isChatOnlyMode ? [] : toolsList;
      
      // 记录最终系统提示词的摘要信息（用于调试）
      console.log('📤 发送给AI的系统提示词摘要:', {
        totalLength: finalSystemInstruction.length,
        hasSamplesBlock: finalSystemInstruction.includes('📖 范文参考'),
        hasAuthorBlock: finalSystemInstruction.includes('✍️ 作家身份'),
        samplesBlockPosition: finalSystemInstruction.indexOf('📖 范文参考'),
        authorBlockPosition: finalSystemInstruction.indexOf('✍️ 作家身份'),
        preview: finalSystemInstruction.substring(0, 500) + '...'
      });
      
      // 使用添加了繁体引号指令的 textToSend 发送给 AI（原始消息显示在聊天窗口，发送给AI的包含繁体引号指令）
      const result = await LLMAdapter.chat(
          apiConfig,
          apiHistory,
          textToSend,
          finalSystemInstruction,
          effectiveTools,
          abortController.signal,
          generationConfig,
          forceToolCall
      );
      responseDurationMs = Date.now() - requestStartedAt;

      let functionCalls = result.functionCalls;
      let modelText = result.text;
      
      let turns = 0;
      const maxTurns = 5;

      if (modelText) {
          // Extract reasoning/thinking from text if not already extracted
          let finalText = modelText;
          let extractedReasoning = result.reasoning;
          
          // Try to extract thinking tags from text (some models mix reasoning with content)
          const thinkingTagRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
          const thinkingMatch = modelText.match(thinkingTagRegex);
          
          if (thinkingMatch && thinkingMatch[1]) {
              extractedReasoning = (extractedReasoning || '') + (extractedReasoning ? '\n\n' : '') + thinkingMatch[1].trim();
              finalText = modelText.replace(thinkingTagRegex, '').trim();
          }
          
          // Also try <think> tags
          const thinkTagRegex = /<think>([\s\S]*?)<\/think>/i;
          const thinkMatch = finalText.match(thinkTagRegex);
          
          if (thinkMatch && thinkMatch[1]) {
              extractedReasoning = (extractedReasoning || '') + (extractedReasoning ? '\n\n' : '') + thinkMatch[1].trim();
              finalText = finalText.replace(thinkTagRegex, '').trim();
          }
          
          // Also try <reasoning> tags
          const reasoningTagRegex = /<reasoning>([\s\S]*?)<\/reasoning>/i;
          const reasoningMatch = finalText.match(reasoningTagRegex);
          
          if (reasoningMatch && reasoningMatch[1]) {
              extractedReasoning = (extractedReasoning || '') + (extractedReasoning ? '\n\n' : '') + reasoningMatch[1].trim();
              finalText = finalText.replace(reasoningTagRegex, '').trim();
          }
          
          // ⚠️ 重要：我们使用 OpenAI 兼容 SDK 的 Function Calling，不应该从文本中解析 JSON
          // 如果 API 没有返回工具调用，说明 API 可能不支持 Function Calling，应该报错而不是尝试解析文本
          if ((!functionCalls || functionCalls.length === 0) && finalText) {
              // 检查是否是强制工具调用场景（需要工具调用但 API 没有返回）
              // mode === 'manuscript' 表示生成正文，通常需要工具调用来保存内容
              const isManuscriptMode = options?.mode === 'manuscript';
              const isExtractOperation = options?.silentOperationInfo?.operationType === 'extract';
              // 检查是否是直写正文模式（fanwen_style_imitation）
              const isDirectWriteMode = currentWritingMethod === 'fanwen_style_imitation';
              const needsToolCall = isManuscriptMode || isExtractOperation || isDirectWriteMode;
              
              if (needsToolCall) {
                  // 根据当前模式显示不同的错误信息
                  const currentToolCallMode = apiConfig?.toolCallMode || 'auto';
                  const isUsingJsonSchema = currentToolCallMode === 'json_schema' || 
                    (currentToolCallMode === 'auto' && apiConfig?.provider !== 'google');
                  
                  if (isUsingJsonSchema) {
                    console.error("❌ JSON Schema 模式：AI 没有返回有效的工具调用 JSON。这通常意味着：");
                    console.error("   1. AI 返回的 JSON 格式有错误");
                    console.error("   2. AI 没有理解工具调用指令");
                    console.error("   3. AI 没有在回复末尾添加 JSON 代码块");
                    console.error("   建议：检查 AI 返回的文本，或切换到 Function Calling 模式");
                  } else {
                    console.error("❌ Function Calling 模式：API 没有返回工具调用。这通常意味着：");
                    console.error("   1. API 配置不支持 Function Calling");
                    console.error("   2. 使用的模型不支持 Function Calling");
                    console.error("   3. API 中转服务不支持 tool_choice: required");
                    console.error("   建议：切换到 JSON Schema 模式，或使用支持 FC 的 API（如 Gemini 2.5 Pro）");
                  }
                  
                  // 降级方案：尝试从文本中解析 JSON 格式的工具调用
                  // 某些 API（如"假流式"中转）可能不支持 Function Calling，但会在文本中返回 JSON
                  console.log("🔍 尝试从文本中解析 JSON 格式的工具调用（降级方案）...");
                  
                  let parsedToolCalls: any[] = [];
                  
                  // 尝试多种格式提取工具调用：
                  // 1. JSON 代码块（```json 或 ```tool_code）
                  // 2. HTML 标签（&lt;tool_call&gt; 或 &lt;execute_tool&gt;）
                  // 3. 纯 JSON 对象（在文本中直接出现）
                  
                  let toolData: any = null;
                  let extractedText = '';
                  
                  // 方法1: 尝试从代码块中提取 JSON
                  const toolCodeRegex = /```(?:json|tool_code)?\s*(\{[\s\S]*?"tool_name"[\s\S]*?\})\s*```/i;
                  const toolCodeMatch = finalText.match(toolCodeRegex);
                  
                  if (toolCodeMatch && toolCodeMatch[1]) {
                      extractedText = toolCodeMatch[1];
                      try {
                          toolData = JSON.parse(extractedText);
                          } catch (e) {
                          console.error("❌ 解析 tool_code 代码块中的 JSON 失败:", e);
                      }
                  }
                  
                  // 方法2: 尝试从 HTML 标签中提取 JSON
                  if (!toolData) {
                      const toolTagRegex = /<(?:tool_call|execute_tool)>\s*(\{[\s\S]*?\})\s*<\/(?:tool_call|execute_tool)>/i;
                      const toolTagMatch = finalText.match(toolTagRegex);
                      
                      if (toolTagMatch && toolTagMatch[1]) {
                          extractedText = toolTagMatch[1];
                          try {
                              toolData = JSON.parse(extractedText);
                          } catch (e) {
                              console.error("❌ 解析 HTML 标签中的 JSON 失败:", e);
                          }
                      }
                  }
                  
                  // 方法3: 尝试从文本中直接提取 JSON 对象（作为最后手段）
                  let jsonObjectRegex: RegExp | null = null;
                  if (!toolData) {
                      // 查找包含 "tool_name" 的 JSON 对象
                      jsonObjectRegex = /\{\s*"tool_name"\s*:\s*"[^"]+"[\s\S]*?\}/;
                      const jsonObjectMatch = finalText.match(jsonObjectRegex);
                      
                      if (jsonObjectMatch && jsonObjectMatch[0]) {
                          extractedText = jsonObjectMatch[0];
                          try {
                              toolData = JSON.parse(extractedText);
                          } catch (e) {
                              console.error("❌ 解析文本中的 JSON 对象失败:", e);
                          }
                      }
                  }
                  
                  if (toolData && toolData.tool_name) {
                      // 转换为标准格式
                      let args = toolData.tool_params || toolData.args || {};
                      
                      // 注意：updated_story_bible 的类型转换现在由验证器处理
                      // 这里只需要确保 args 是对象即可
                      
                      parsedToolCalls = [{
                          name: toolData.tool_name,
                          args: args,
                          id: `fallback_${Date.now()}`
                      }];
                      console.log("✅ 从文本中成功解析工具调用:", {
                          format: toolCodeMatch ? '代码块' : (finalText.match(/<(?:tool_call|execute_tool)>/i) ? 'HTML标签' : 'JSON对象'),
                          toolName: toolData.tool_name,
                          argsKeys: Object.keys(args)
                      });
                      // 从文本中移除工具调用（使用匹配到的原始文本）
                      if (toolCodeMatch) {
                          finalText = finalText.replace(toolCodeRegex, '').trim();
                      } else if (finalText.match(/<(?:tool_call|execute_tool)>/i)) {
                          finalText = finalText.replace(/<(?:tool_call|execute_tool)>[\s\S]*?<\/(?:tool_call|execute_tool)>/i, '').trim();
                      } else if (jsonObjectRegex) {
                          finalText = finalText.replace(jsonObjectRegex, '').trim();
                      }
                  }
                  
                  // 如果成功解析到工具调用，使用它们
                  if (parsedToolCalls.length > 0) {
                      console.log("✅ 使用从文本中解析的工具调用（降级方案）");
                      functionCalls = parsedToolCalls.map(tc => ({
                          name: tc.name,
                          args: tc.args,
                          id: tc.id
                      }));
                      // 继续处理，不要返回错误
                  } else {
                      // 如果无法解析，显示错误消息（根据当前模式）
                      const currentToolCallMode = apiConfig?.toolCallMode || 'auto';
                      const isUsingJsonSchema = currentToolCallMode === 'json_schema' || 
                        (currentToolCallMode === 'auto' && apiConfig?.provider !== 'google');
                      
                      // 🔍 调试：在控制台输出完整的AI返回内容（不截断）
                      console.log('========== 工具调用失败 - AI 完整返回内容 ==========');
                      console.log('📄 内容长度:', finalText.length, '字符');
                      console.log('📄 完整内容:');
                      console.log(finalText);
                      console.log('========== AI 完整返回内容结束 ==========');
                      
                      let errorText = '';
                      if (isUsingJsonSchema) {
                        // JSON Schema 模式：显示完整内容（不截断）
                        const textLength = finalText.length;
                        
                        errorText = `❌ **工具调用失败（JSON Schema 模式）**\n\n**AI 返回的内容中没有找到有效的工具调用 JSON。**\n\n**可能原因：**\n- AI 生成的 JSON 格式有语法错误（最常见）\n- AI 没有在回复末尾添加 JSON 代码块（\`\`\`json ... \`\`\`）\n- JSON 代码块的格式不符合要求\n\n**解决方案：**\n1. **查看下方 AI 完整回复**，检查 JSON 代码块是否完整、格式是否正确\n2. **重新生成**，有时 AI 第二次会生成正确的格式\n3. **更换模型**，尝试其他对 JSON 支持更好的模型（如 DeepSeek-V3）\n4. **简化提示词**，减少正文长度，让 AI 更容易生成正确的 JSON\n\n---\n\n**AI 完整回复（${textLength}字符）：**\n\n${finalText}`;
                      } else {
                        // Function Calling 模式：显示完整内容（不截断）
                        const textLength = finalText.length;
                        
                        errorText = `❌ **工具调用失败（Function Calling 模式）**\n\n**API 没有返回工具调用，且文本中也没有找到可解析的工具调用。**\n\n**可能原因：**\n- 当前 API 或模型不支持 Function Calling\n- API 中转服务不支持 \`tool_choice: required\`\n- 模型没有按要求调用工具\n\n**解决方案：**\n1. **切换到 JSON Schema 模式**（在 API 设置中选择，兼容性更好）\n2. **更换 API 配置**（推荐：Gemini 直连，支持原生 Function Calling）\n3. **检查 API 配置**是否正确\n\n---\n\n**AI 完整回复（${textLength}字符）：**\n\n${finalText}`;
                      }
                      
                      const errorMsg: Message = {
                          id: uuidv4(),
                          role: 'model',
                          text: errorText,
                          isToolCall: false,
                          excludeFromAI: true,  // 🔒 错误消息不发送给AI，避免污染上下文
                          timestamp: Date.now(),
                          latencyMs: responseDurationMs
                      };
                      if (effectiveSessionId) {
                          setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
                      }
                      return; // 停止处理，不继续执行
                  }
              }
              
              // 对于不需要强制工具调用的场景，只记录警告，不尝试解析
              console.warn("⚠️ API 没有返回工具调用，但当前操作不需要强制工具调用。继续处理文本响应。");
              
              // ⚠️ 已完全移除从文本中解析 JSON 的逻辑
              // 我们使用 OpenAI 兼容 SDK 的标准 Function Calling，工具调用应该通过 API 的结构化响应返回
              // 如果 API 不支持 Function Calling，应该明确报错，而不是尝试从文本中解析
              // 所有从文本中解析 JSON 的代码已被完全移除
          }
          
          // Check if this is an extract operation
          const isExtractOperation = options?.silentOperationInfo?.operationType === 'extract';
          const hasActualToolCall = functionCalls && functionCalls.length > 0;
          
          // For extract operations, check if extract-related tools were called
          if (isExtractOperation) {
              const extractTools = ['add_chapter', 'add_character', 'add_world_entry', 'add_writing_guideline'];
              const hasExtractToolCall = hasActualToolCall && functionCalls.some(fc => extractTools.includes(fc.name));
              
              // Check if AI claimed to have saved information but didn't actually call tools
              const extractClaimPattern = /(?:所有信息均已通过工具调用保存|已保存.*?信息|已完成.*?提炼|已更新.*?章纲|已添加.*?角色|已添加.*?世界观|已添加.*?写作指导|所有信息.*?已保存|已完成|我将调用|准备调用|现在开始|开始调用|调用以下工具)/i;
              const hasClaim = extractClaimPattern.test(finalText);
              
              if (hasClaim && !hasExtractToolCall) {
                  // AI claimed to have saved but didn't actually call tools
                  console.warn("⚠️ 提炼信息操作失败：AI声称已保存信息或准备调用工具，但未调用任何工具:", finalText.substring(0, 200));
                  
                  const warningText = '⚠️ **提炼信息失败**：AI在文本中描述了要调用工具或声称已保存信息，但实际上没有调用任何工具。\n\n**问题原因：**\n- Function Calling是API自动处理的机制，但API可能没有返回工具调用信息\n- 文本中的描述性文字（如"已保存"、"我将调用以下工具"、"准备调用"）不会触发任何保存操作\n- 只有API在响应结构中自动返回的工具调用才会真正执行\n- 文本中列出工具名称或描述要做什么只是描述，不会被执行\n\n**解决方案：**\n1. 请检查API配置是否支持Function Calling\n2. 如果API不支持Function Calling，请切换到支持Function Calling的API配置（如Gemini 2.5 Pro）\n3. 或者尝试重新提炼信息\n\n**注意：**信息尚未保存到故事板，请重新操作。';
                  
                  const warningMsg: Message = {
                      id: uuidv4(),
                      role: 'model',
                      text: warningText,
                      isToolCall: false,
                      excludeFromAI: true,  // 🔒 警告消息不发送给AI，避免污染上下文
                      timestamp: Date.now(),
                      latencyMs: responseDurationMs
                  };
                  if (effectiveSessionId) {
                      setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, warningMsg] } : s));
                  }
              }
          } else {
              // Check for general tool mention pattern for non-extract operations
              const toolMentionPattern = /(?:故事板已更新|已调用.*?(?:update_storyboard|update_chapter_content)|(?:update_storyboard|update_chapter_content).*?已调用)/i;
              const hasToolMention = toolMentionPattern.test(finalText);
              const hasRelevantToolCall = hasActualToolCall && functionCalls.some(fc => fc.name === 'update_storyboard' || fc.name === 'update_chapter_content');
              
              if (hasToolMention && !hasRelevantToolCall) {
                  console.warn("⚠️ Model mentioned tool call in text but didn't actually call it:", finalText.substring(0, 100));
                  const warningMsg: Message = {
                      id: uuidv4(),
                      role: 'model',
                      text: '⚠️ 检测到AI在文本中提到了"故事板已更新"，但并未真正调用工具。文本中的描述不会触发保存，只有真正的工具调用才会保存内容。请重新生成或提醒AI必须调用工具。',
                      isToolCall: false,
                      excludeFromAI: true,  // 🔒 警告消息不发送给AI，避免污染上下文
                      timestamp: Date.now(),
                      latencyMs: responseDurationMs
                  };
                  if (effectiveSessionId) {
                      setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, warningMsg] } : s));
                  }
              }
          }
          
          // If we extracted tool calls from text, add a warning message
          const extractedCount = (window as any).__extractedToolCalls || 0;
          if (extractedCount > 0) {
              const warningMsg: Message = {
                  id: uuidv4(),
                  role: 'model',
                  text: `⚠️ 注意：检测到AI在文本中写了JSON格式的工具调用（${extractedCount}个），已尝试解析并执行。但这种方式不够可靠，建议使用支持Function Calling的API配置。`,
                  isToolCall: false,
                  excludeFromAI: true,
                  timestamp: Date.now(),
                  latencyMs: responseDurationMs
              };
              if (effectiveSessionId) {
                  setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, warningMsg] } : s));
              }
              (window as any).__extractedToolCalls = 0; // Reset
          }
          
          const aiMsg: Message = { 
            id: uuidv4(), 
            role: 'model', 
            text: finalText,
            reasoning: extractedReasoning || undefined, // 保存思维链，但不发送给AI
            timestamp: Date.now(),
            latencyMs: responseDurationMs
          };
          if (effectiveSessionId) {
            setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s));
          }
      }

      // 用于跟踪工具调用成功的全局标记（用于自动写验证）
      // 使用 window 对象存储，以便自动写验证逻辑可以访问
      if (!(window as any).__toolCallSuccessMarkers) {
        (window as any).__toolCallSuccessMarkers = new Map();
      }
      const toolCallSuccessMarkers = (window as any).__toolCallSuccessMarkers as Map<string, { chapterNumber?: number; success: boolean; timestamp: number }>;
      
      while (functionCalls && functionCalls.length > 0 && turns < maxTurns) {
          turns++;
          
          // Add Tool execution results loop
          // We need to execute the tools locally
          const toolResults: any[] = [];
          
          for (const call of functionCalls) {
              console.log("🔧 Tool Call:", call.name, "Args:", JSON.stringify(call.args, null, 2));
              let toolResult: any = { success: true };
              let toolExecuted = false; // Track if tool was actually executed
              
              // 为自动写功能创建成功标记
              if (call.name === 'update_storyboard' && call.args?.chapterNumber) {
                const chapterNum = call.args.chapterNumber;
                toolCallSuccessMarkers.set(`chapter_${chapterNum}`, {
                  chapterNumber: chapterNum,
                  success: false,
                  timestamp: Date.now()
                });
                console.log(`📌 创建工具调用标记: 章节 ${chapterNum}`);
              }
              
              const applyStoryUpdate = (updater: (s: StoryState) => StoryState) => {
                  if (effectiveSessionId) {
                    setSessions(prev => {
                      const session = prev.find(s => s.id === effectiveSessionId);
                      if (!session) {
                        console.error("❌ Session not found:", effectiveSessionId);
                        return prev;
                      }
                      const updatedStory = updater(session.story);
                        console.log("✅ Story updated:", call.name, "New state keys:", Object.keys(updatedStory));
                      return prev.map(s => 
                        s.id === effectiveSessionId 
                          ? { ...s, story: updatedStory, lastUpdated: Date.now() }
                          : s
                      );
                    });
                  } else {
                    console.error("❌ No effectiveSessionId for update:", call.name);
                  }
              };

              // --- Tool Execution Logic ---
              // CRITICAL FIX: Ensure all ID/Number lookups use Number() casting to handle string inputs from LLM
              
              if (call.name === 'update_title_synopsis') {
                  try {
                      const { title, synopsis } = call.args as any;
                      if (!title && !synopsis) {
                          toolResult = { success: false, message: "Title or synopsis is required." };
                      } else {
                          applyStoryUpdate(s => ({ ...s, title: title || s.title, synopsis: synopsis || s.synopsis }));
                          toolResult = { success: true, message: "Title and Synopsis updated." };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'archive_blueprint') {
                  try {
                      const { versionName } = call.args as any;
                      if (!versionName) {
                          toolResult = { success: false, message: "Version name is required." };
                      } else {
                          applyStoryUpdate(s => {
                              const active = s.blueprints.find(b => b.id === s.activeBlueprintId) || s.blueprints[0];
                              if (!active) {
                                  throw new Error("No active blueprint found");
                              }
                              const newId = uuidv4();
                              const clonedBeatVersions: Partial<Record<StructureBeat, BeatVersionState>> = {};
                              STRUCTURE_BEATS.forEach((beat) => {
                                  const state = active?.beatVersions?.[beat];
                                  if (state) {
                                      clonedBeatVersions[beat] = {
                                          activeVersionId: state.activeVersionId,
                                          versions: state.versions.map(v => ({ ...v }))
                                      };
                                  }
                              });
                              const snapshot: Blueprint = { 
                                  ...active, 
                                  id: newId, 
                                  versionName: versionName, 
                                  timestamp: Date.now(),
                                  beatVersions: Object.keys(clonedBeatVersions).length > 0 ? clonedBeatVersions : active?.beatVersions
                              };
                              return { ...s, blueprints: [...s.blueprints, snapshot] }; 
                          });
                          toolResult = { success: true, message: "Blueprint archived." };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'update_structure') {
                  try {
                      const { beat, content } = call.args as any;
                      if (!beat || content === undefined) {
                          toolResult = { success: false, message: "Beat and content are required." };
                      } else {
                          console.log("Updating structure beat:", beat, "with content length:", content?.length);
                          applyStoryUpdate(s => {
                              const beatKey = (beat || 'hook') as StructureBeat;
                              let activeIdx = s.blueprints.findIndex(b => b.id === s.activeBlueprintId);
                              if (activeIdx === -1 && s.blueprints.length > 0) {
                                  activeIdx = 0;
                              }
                              if (activeIdx === -1 || s.blueprints.length === 0) {
                                  const newBlueprintId = uuidv4();
                                  const baseData = createEmptyStructureData();
                                  const baseBlueprint: Blueprint = {
                                      id: newBlueprintId,
                                      versionName: "初始构思",
                                      timestamp: Date.now(),
                                      data: { ...baseData, [beatKey]: content },
                                      beatVersions: createBeatVersionsFromData({ ...baseData, [beatKey]: content })
                                  };
                                  return { 
                                      ...s, 
                                      blueprints: [baseBlueprint],
                                      activeBlueprintId: newBlueprintId
                                  };
                              }
                              
                              const newBlueprints = [...s.blueprints];
                              const ensuredBlueprint = ensureBeatVersionsOnBlueprint(newBlueprints[activeIdx]);
                              const beatVersions = { ...(ensuredBlueprint.beatVersions || {}) };
                              const existingState = beatVersions[beatKey]!;
                              const newId = uuidv4();
                              const newVersion: ContentVersion = {
                                  id: newId,
                                  versionName: `AI更新 ${new Date().toLocaleTimeString()}`,
                                  timestamp: Date.now(),
                                  text: content,
                                  modelId: apiConfig?.modelId
                              };
                              beatVersions[beatKey] = {
                                  activeVersionId: newId,
                                  versions: [...existingState.versions, newVersion]
                              };
                              const updatedBlueprint: Blueprint = {
                                  ...ensuredBlueprint,
                                  data: { ...ensuredBlueprint.data, [beatKey]: content },
                                  beatVersions
                              };
                              newBlueprints[activeIdx] = updatedBlueprint;
                              console.log("Updated blueprint data:", updatedBlueprint.data[beatKey]?.substring(0, 50));
                              return { ...s, blueprints: newBlueprints, activeBlueprintId: s.activeBlueprintId || updatedBlueprint.id };
                          });
                          toolResult = { success: true, message: `Beat ${beat} updated.` };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              // manage_volume 工具已从工具列表中移除，不再处理
              // else if (call.name === 'manage_volume') { ... }
              else if (call.name === 'add_chapter') {
                  try {
                      // 使用验证函数验证参数
                      const validation = validateAddChapterArgs(call.args);
                      
                      if (!validation.isValid) {
                          toolResult = { 
                              success: false, 
                              message: `参数验证失败：\n${validation.errors.join('\n')}${validation.warnings.length > 0 ? `\n\n警告：\n${validation.warnings.join('\n')}` : ''}` 
                          };
                      } else {
                          // 使用标准化后的参数
                          const args = validation.normalized!;
                          const { number, title, summary, volumeNumber } = args;
                          
                          // 记录警告（如果有）
                          if (validation.warnings.length > 0) {
                              console.warn('⚠️ add_chapter 参数验证警告:', validation.warnings);
                          }
                          applyStoryUpdate(s => {
                      let volumeId = undefined;
                      if (volumeNumber) {
                          const vol = s.volumes.find(v => v.number === Number(volumeNumber));
                          if (vol) volumeId = vol.id;
                      } else if (s.volumes.length > 0) {
                          volumeId = s.volumes[s.volumes.length - 1].id;
                      }

                      const existingIdx = s.outline.findIndex(c => c.number === Number(number));
                      let newOutline = [...s.outline];
                      
                      // Ensure existing chapter has contentVersions initialized
                      const existingChapter = existingIdx >= 0 ? newOutline[existingIdx] : null;
                      const existingContentVersions = existingChapter?.contentVersions || [];
                      
                      // If no versions exist, create an initial empty version
                      let initialVersionId = existingChapter?.activeVersionId;
                      if (!existingContentVersions.length || !initialVersionId) {
                          initialVersionId = uuidv4();
                      }
                      
                      const chapterData: Chapter = {
                          id: existingIdx >= 0 ? newOutline[existingIdx].id : uuidv4(),
                          number: Number(number),
                          title,
                          summary,
                          volumeId,
                          activeVersionId: initialVersionId,
                          contentVersions: existingContentVersions.length > 0 ? [...existingContentVersions] : []
                      };
                      
                      // Always ensure at least one empty version exists for new chapters
                      // This is critical for update_chapter_content to work properly
                      if (chapterData.contentVersions.length === 0) {
                          chapterData.contentVersions.push({
                              id: chapterData.activeVersionId,
                              versionName: "初始草稿",
                              timestamp: Date.now(),
                              text: "",
                              isContext: true, // 默认作为上下文
                              modelId: apiConfig?.modelId // 保存生成此版本时使用的模型ID（初始草稿可能没有模型）
                          });
                          console.log("✅ Created initial empty version for chapter:", {
                              chapterNumber: number,
                              versionId: chapterData.activeVersionId
                          });
                      }

                      if (existingIdx >= 0) newOutline[existingIdx] = chapterData;
                      else newOutline.push(chapterData);
                      
                      return { ...s, outline: newOutline.sort((a,b) => a.number - b.number) };
                  });
                  toolResult = { success: true, message: `Chapter ${number} added/updated.` };
                  toolExecuted = true;
                  
                  // 如果这个 add_chapter 调用是为了更新章纲（提炼章纲的结果），清除标志
                  const updateKey = `${number}:${volumeNumber ?? 'none'}`;
                  if (extractingOutlineRef.current === updateKey) {
                      console.log('✅ 章纲提炼完成，清除标志');
                      extractingOutlineRef.current = null;
                  }
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              // update_storyboard 工具：新的复合工具，推荐使用
              else if (call.name === 'update_storyboard') {
                  try {
                      // 调试：记录原始参数
                      console.log('🔍 update_storyboard 工具调用 - 原始参数:', {
                          hasChapterContent: !!(call.args?.chapter_content),
                          chapterContentType: typeof call.args?.chapter_content,
                          chapterContentLength: call.args?.chapter_content?.length || 0,
                          chapterContentPreview: call.args?.chapter_content?.substring(0, 100) || 'N/A',
                          hasChapterOutline: !!(call.args?.chapter_outline),
                          chapterOutlineLength: call.args?.chapter_outline?.length || 0,
                          allKeys: Object.keys(call.args || {})
                      });
                      
                      // 使用验证函数验证参数
                      const validation = validateUpdateStoryboardArgs(call.args);
                      
                      console.log('🔍 update_storyboard 验证结果:', {
                          isValid: validation.isValid,
                          errors: validation.errors,
                          warnings: validation.warnings,
                          hasNormalized: !!validation.normalized,
                          normalizedChapterContentLength: validation.normalized?.chapter_content?.length || 0
                      });
                      
                      if (!validation.isValid) {
                          console.error('❌ update_storyboard 参数验证失败:', validation.errors);
                          toolResult = { 
                              success: false, 
                              message: `参数验证失败：\n${validation.errors.join('\n')}${validation.warnings.length > 0 ? `\n\n警告：\n${validation.warnings.join('\n')}` : ''}` 
                          };
                          toolExecuted = false; // 明确标记工具未执行
                          // 清理工具调用标记（参数验证失败）
                          if (call.args?.chapterNumber) {
                            const markerKey = `chapter_${call.args.chapterNumber}`;
                            toolCallSuccessMarkers.delete(markerKey);
                            console.log(`❌ 参数验证失败，已清理标记: 章节 ${call.args.chapterNumber}`);
                          }
                      } else {
                          // 使用标准化后的参数
                          const args = validation.normalized!;
                          const { 
                              chapterNumber, 
                              chapterTitle, 
                              chapter_content, 
                              chapter_outline,
                              volumeNumber,
                              createNewVersion,
                              versionName,
                              updated_story_bible,
                              characters,
                              worldEntries,
                              writingGuidelines
                          } = args;
                          
                          // 调试：记录标准化后的参数
                          console.log('✅ update_storyboard 参数标准化后:', {
                              chapterNumber,
                              chapterTitle,
                              chapterContentLength: chapter_content?.length || 0,
                              chapterContentPreview: chapter_content?.substring(0, 100) || 'N/A',
                              chapterOutlineLength: chapter_outline?.length || 0
                          });
                          
                          // 记录警告（如果有）
                          if (validation.warnings.length > 0) {
                              console.warn('⚠️ update_storyboard 参数验证警告:', validation.warnings);
                          }
                          
                          // 首先检查章节是否存在
                          let chIdx = -1;
                          if (effectiveSessionId) {
                              const session = sessions.find(s => s.id === effectiveSessionId);
                              if (session) {
                                  if (volumeNumber !== undefined && volumeNumber !== null) {
                                      const vol = session.story.volumes.find(v => v.number === Number(volumeNumber));
                                      if (vol) {
                                          chIdx = session.story.outline.findIndex(c => c.number === Number(chapterNumber) && c.volumeId === vol.id);
                                      }
                                  }
                                  if (chIdx === -1) {
                                      chIdx = session.story.outline.findIndex(c => c.number === Number(chapterNumber));
                                  }
                              }
                          }
                          
                          // 章节存在或不存在，都执行更新（如果不存在则自动创建）
                              applyStoryUpdate(s => {
                                  // 查找章节
                                  let chIdx = -1;
                                  if (volumeNumber !== undefined && volumeNumber !== null) {
                                      const vol = s.volumes.find(v => v.number === Number(volumeNumber));
                                      if (vol) {
                                          chIdx = s.outline.findIndex(c => c.number === Number(chapterNumber) && c.volumeId === vol.id);
                                      }
                                  }
                                  if (chIdx === -1) {
                                      chIdx = s.outline.findIndex(c => c.number === Number(chapterNumber));
                                  }
                                  
                              // 如果章节不存在，自动创建
                              let currentOutline = [...s.outline];
                                  if (chIdx === -1) {
                                  console.log("📝 Chapter not found, auto-creating chapter:", {
                                      chapterNumber,
                                      volumeNumber,
                                      availableChapters: s.outline.map(ch => ({
                                          number: ch.number,
                                          title: ch.title,
                                          volumeId: ch.volumeId,
                                          volumeNumber: ch.volumeId ? s.volumes.find(v => v.id === ch.volumeId)?.number : undefined
                                      }))
                                  });
                                  
                                  // 确定 volumeId
                                  let volId = undefined;
                                  if (volumeNumber !== undefined && volumeNumber !== null) {
                                      const vol = s.volumes.find(v => v.number === Number(volumeNumber));
                                      if (vol) volId = vol.id;
                                  } else if (s.volumes.length > 0) {
                                      volId = s.volumes[s.volumes.length - 1].id;
                                  }
                                  
                                  // 创建初始版本ID
                                  const initialVerId = uuidv4();
                                  
                                  // 创建新章节
                                  const newChapter: Chapter = {
                                      id: uuidv4(),
                                      number: Number(chapterNumber),
                                      title: chapterTitle || `第${chapterNumber}章`,
                                      summary: chapter_outline || "",
                                      summaryDetailed: undefined, // 不再区分简洁/详细
                                      volumeId: volId,
                                      activeVersionId: initialVerId,
                                      contentVersions: [{
                                          id: initialVerId,
                                          versionName: "初始草稿",
                                          timestamp: Date.now(),
                                          text: "",
                                          isContext: true
                                      }]
                                  };
                                  
                                  // 将新章节添加到outline
                                  currentOutline = [...s.outline, newChapter].sort((a, b) => a.number - b.number);
                                  chIdx = currentOutline.findIndex(c => c.id === newChapter.id);
                                  }
                                  
                                  const chapter = { 
                                  ...currentOutline[chIdx],
                                  contentVersions: currentOutline[chIdx].contentVersions ? [...currentOutline[chIdx].contentVersions] : []
                                  };
                                  
                                  // 确保 contentVersions 数组存在
                                  if (!chapter.contentVersions || chapter.contentVersions.length === 0) {
                                      const initialVerId = uuidv4();
                                      chapter.contentVersions = [{
                                          id: initialVerId,
                                          versionName: "初始草稿",
                                          timestamp: Date.now(),
                                          text: "",
                                          isContext: true
                                      }];
                                      chapter.activeVersionId = initialVerId;
                                  }
                                  
                                  // 创建新版本或更新现有版本
                                  const newVerId = uuidv4();
                              
                              // 调试：检查 chapter_content 的值
                              console.log('📝 创建章节版本:', {
                                  chapterNumber,
                                  chapterTitle,
                                  chapterContentLength: chapter_content?.length || 0,
                                  chapterContentIsEmpty: !chapter_content || chapter_content.trim().length === 0,
                                  chapterContentPreview: chapter_content?.substring(0, 200) || 'N/A',
                                  chapterOutlineLength: chapter_outline?.length || 0
                              });
                              
                                  const newVer: ContentVersion = {
                                      id: newVerId,
                                      versionName: versionName || (chapter.contentVersions.length === 0 ? "初始草稿" : `版本 ${chapter.contentVersions.length + 1}`),
                                      timestamp: Date.now(),
                                  text: chapter_content || '', // 确保至少是空字符串
                                      isContext: true,
                                      modelId: apiConfig?.modelId
                                  };
                              
                              console.log('✅ 章节版本已创建:', {
                                  versionId: newVerId,
                                  textLength: newVer.text.length,
                                  textPreview: newVer.text.substring(0, 200)
                              });
                                  
                                  // 关闭之前活跃版本的上下文开关
                                  const updatedVersions = chapter.contentVersions.map(v => 
                                      v.id === chapter.activeVersionId ? { ...v, isContext: false } : v
                                  );
                                  
                                  chapter.contentVersions = [...updatedVersions, newVer];
                                  chapter.activeVersionId = newVerId;
                              
                              console.log('✅ 章节版本已添加到章节:', {
                                  chapterNumber,
                                  totalVersions: chapter.contentVersions.length,
                                  activeVersionId: chapter.activeVersionId,
                                  activeVersionTextLength: chapter.contentVersions.find(v => v.id === chapter.activeVersionId)?.text?.length || 0
                              });
                                  
                                  // 更新章节标题和章纲
                                  chapter.title = chapterTitle;
                              if (chapter_outline) {
                                  // 不再区分简洁版/详细版，直接用最新章纲覆盖
                                  chapter.summary = chapter_outline;
                                  chapter.summaryDetailed = undefined;
                              }
                                  
                                  // 更新故事板的其他信息
                                  let updatedStory = { ...s };
                                  
                                  // 更新角色
                                  if (characters && Array.isArray(characters)) {
                                      const newChars = [...updatedStory.characters];
                                      characters.forEach((char: any) => {
                                          const existingIdx = newChars.findIndex(c => c.name === char.name);
                                          const charData = {
                                              id: existingIdx >= 0 ? newChars[existingIdx].id : uuidv4(),
                                              name: char.name,
                                              role: char.role,
                                              tags: char.tags || [],
                                              description: char.description,
                                              behaviorExamples: char.behaviorExamples || (existingIdx >= 0 ? newChars[existingIdx].behaviorExamples : [])
                                          };
                                          if (existingIdx >= 0) {
                                              newChars[existingIdx] = charData;
                                          } else {
                                              newChars.push(charData);
                                          }
                                      });
                                      updatedStory.characters = newChars;
                                  }
                                  
                                  // 更新世界观设定
                                  if (worldEntries && Array.isArray(worldEntries)) {
                                      const newEntries = [...updatedStory.worldGuide];
                                      worldEntries.forEach((entry: any) => {
                                          const existingIdx = newEntries.findIndex(e => e.category === entry.category && e.name === entry.name);
                                          const entryData: WorldEntry = {
                                              id: existingIdx >= 0 ? newEntries[existingIdx].id : uuidv4(),
                                              category: entry.category,
                                              name: entry.name,
                                              description: entry.description
                                          };
                                          if (existingIdx >= 0) {
                                              newEntries[existingIdx] = entryData;
                                          } else {
                                              newEntries.push(entryData);
                                          }
                                      });
                                      updatedStory.worldGuide = newEntries;
                                  }
                                  
                                  // 更新写作指导
                                  if (writingGuidelines && Array.isArray(writingGuidelines)) {
                                      const newGuidelines = [...(updatedStory.writingGuidelines || [])];
                                      writingGuidelines.forEach((guideline: any) => {
                                          const guidelineData: WritingGuideline = {
                                              id: uuidv4(),
                                              category: guideline.category,
                                              content: guideline.content,
                                              isActive: guideline.isActive !== undefined ? guideline.isActive : true
                                          };
                                          newGuidelines.push(guidelineData);
                                      });
                                      updatedStory.writingGuidelines = newGuidelines;
                                  }
                              
                              // 更新故事圣经（Story Bible）
                              if (updated_story_bible) {
                                  console.log('📖 更新故事圣经:', {
                                      chapterNumber,
                                      volumeNumber,
                                      hasCharacterStatus: !!updated_story_bible.character_status,
                                      hasKeyItems: !!updated_story_bible.key_items_and_locations,
                                      hasPlotThreads: !!updated_story_bible.active_plot_threads,
                                      hasImportantRules: !!updated_story_bible.important_rules
                                  });
                                  
                                  // 确保 storyBible 存在
                                  if (!updatedStory.storyBible) {
                                      updatedStory.storyBible = {
                                          versions: [],
                                          activeChapterNumber: undefined,
                                          activeVolumeNumber: undefined
                                      };
                                  }
                                  
                                  // 创建新的故事圣经版本
                                  const newBibleVersion: StoryBibleVersion = {
                                      chapterNumber: Number(chapterNumber),
                                      volumeNumber: volumeNumber !== undefined && volumeNumber !== null ? Number(volumeNumber) : undefined,
                                      character_status: updated_story_bible.character_status || '',
                                      key_items_and_locations: updated_story_bible.key_items_and_locations || '',
                                      active_plot_threads: updated_story_bible.active_plot_threads || '',
                                      important_rules: updated_story_bible.important_rules || '',
                                      timestamp: Date.now()
                                  };
                                  
                                  // 移除该章节的旧版本（如果存在）
                                  const existingVersionIndex = updatedStory.storyBible.versions.findIndex(
                                      v => v.chapterNumber === Number(chapterNumber) && 
                                      (volumeNumber === undefined || volumeNumber === null || v.volumeNumber === Number(volumeNumber))
                                  );
                                  
                                  if (existingVersionIndex >= 0) {
                                      // 替换旧版本
                                      updatedStory.storyBible.versions[existingVersionIndex] = newBibleVersion;
                                  } else {
                                      // 添加新版本
                                      updatedStory.storyBible.versions.push(newBibleVersion);
                                  }
                                  
                                  // 更新激活的章节号
                                  updatedStory.storyBible.activeChapterNumber = Number(chapterNumber);
                                  if (volumeNumber !== undefined && volumeNumber !== null) {
                                      updatedStory.storyBible.activeVolumeNumber = Number(volumeNumber);
                                  }
                                  
                                  // 按章节号排序版本
                                  updatedStory.storyBible.versions.sort((a, b) => {
                                      if (a.volumeNumber !== b.volumeNumber) {
                                          return (a.volumeNumber || 0) - (b.volumeNumber || 0);
                                      }
                                      return a.chapterNumber - b.chapterNumber;
                                  });
                                  
                                  console.log('✅ 故事圣经已更新:', {
                                      totalVersions: updatedStory.storyBible.versions.length,
                                      activeChapter: updatedStory.storyBible.activeChapterNumber,
                                      activeVolume: updatedStory.storyBible.activeVolumeNumber
                                  });
                              } else {
                                  console.warn('⚠️ 未提供 updated_story_bible，跳过故事圣经更新');
                                  }
                                  
                                  // 更新章节
                              const newOutline = currentOutline.map((ch, idx) => 
                                      idx === chIdx ? chapter : ch
                                  );
                                  
                                  return { ...updatedStory, outline: newOutline };
                              });
                              
                              // 验证内容是否真正保存到故事板（通过检查更新后的状态）
                              let verificationPassed = false;
                              let verificationErrors: string[] = [];
                              
                              if (effectiveSessionId) {
                                  // 等待状态更新完成，然后验证
                                  setTimeout(() => {
                                      const session = sessions.find(s => s.id === effectiveSessionId);
                                      if (session) {
                                          const updatedChapter = session.story.outline.find(c => c.number === Number(chapterNumber));
                                          
                                          // 验证正文是否真正保存
                                          if (chapter_content && chapter_content.trim().length > 0) {
                                              const activeVersion = updatedChapter?.contentVersions?.find(v => v.id === updatedChapter.activeVersionId);
                                              if (!activeVersion || activeVersion.text !== chapter_content) {
                                                  verificationErrors.push('正文未正确保存到故事板');
                                              }
                                          }
                                          
                                          // 验证章纲是否真正保存
                                          if (chapter_outline && chapter_outline.trim().length > 0) {
                                              if (updatedChapter?.summaryDetailed !== chapter_outline && updatedChapter?.summary !== chapter_outline.substring(0, 500)) {
                                                  verificationErrors.push('章纲未正确保存到故事板');
                                              }
                                          }
                                          
                                          // 验证故事圣经是否真正保存
                                          if (updated_story_bible) {
                                              const bibleVersion = session.story.storyBible?.versions.find(v => v.chapterNumber === Number(chapterNumber));
                                              if (!bibleVersion) {
                                                  verificationErrors.push('故事圣经未正确保存到故事板');
                                              }
                                          }
                                      }
                                  }, 100);
                              }
                              
                              // 构建详细的更新信息（基于实际保存的内容）
                              const updatedItems: string[] = [];
                              const notUpdatedItems: string[] = [];
                              
                              // 记录原始参数（用于判断是模型未返回还是写入失败）
                              const originalArgs = call.args;
                              
                              // 检查正文是否真正保存
                              if (chapter_content && chapter_content.trim().length > 0) {
                                  updatedItems.push(`✅ 正文（${chapter_content.length}字）`);
                              } else {
                                  // 判断是模型未返回还是返回了但为空
                                  const hasChapterContentParam = originalArgs && 'chapter_content' in originalArgs;
                                  if (!hasChapterContentParam) {
                                      notUpdatedItems.push('❌ 正文（模型未返回此参数）');
                                  } else if (originalArgs.chapter_content === null || originalArgs.chapter_content === undefined) {
                                      notUpdatedItems.push('❌ 正文（模型返回了参数但值为空）');
                                  } else if (typeof originalArgs.chapter_content === 'string' && originalArgs.chapter_content.trim().length === 0) {
                                      notUpdatedItems.push('❌ 正文（模型返回了参数但内容为空字符串）');
                                  } else {
                                      notUpdatedItems.push('❌ 正文（写入故事板失败）');
                                  }
                              }
                              
                              // 检查章纲是否真正保存
                              if (chapter_outline && chapter_outline.trim().length > 0) {
                                  updatedItems.push(`✅ 章纲（${chapter_outline.length}字）`);
                              } else {
                                  const hasChapterOutlineParam = originalArgs && 'chapter_outline' in originalArgs;
                                  if (!hasChapterOutlineParam) {
                                      notUpdatedItems.push('❌ 章纲（模型未返回此参数）');
                                  } else if (originalArgs.chapter_outline === null || originalArgs.chapter_outline === undefined) {
                                      notUpdatedItems.push('❌ 章纲（模型返回了参数但值为空）');
                                  } else if (typeof originalArgs.chapter_outline === 'string' && originalArgs.chapter_outline.trim().length === 0) {
                                      notUpdatedItems.push('❌ 章纲（模型返回了参数但内容为空字符串）');
                                  } else {
                                      notUpdatedItems.push('❌ 章纲（写入故事板失败）');
                                  }
                              }
                              
                              // 检查故事圣经是否真正保存
                              if (updated_story_bible) {
                                  const bibleItems: string[] = [];
                                  const missingBibleFields: string[] = [];
                                  
                                  if (updated_story_bible.character_status && updated_story_bible.character_status.trim()) {
                                      bibleItems.push('角色状态');
                                  } else {
                                      missingBibleFields.push('角色状态');
                                  }
                                  if (updated_story_bible.key_items_and_locations && updated_story_bible.key_items_and_locations.trim()) {
                                      bibleItems.push('物品与地点');
                                  } else {
                                      missingBibleFields.push('物品与地点');
                                  }
                                  if (updated_story_bible.active_plot_threads && updated_story_bible.active_plot_threads.trim()) {
                                      bibleItems.push('未解决伏笔');
                                  } else {
                                      missingBibleFields.push('未解决伏笔');
                                  }
                                  if (updated_story_bible.important_rules && updated_story_bible.important_rules.trim()) {
                                      bibleItems.push('重要规则');
                                  } else {
                                      missingBibleFields.push('重要规则');
                                  }
                                  
                                  if (bibleItems.length > 0) {
                                      updatedItems.push(`✅ 故事圣经（${bibleItems.join('、')}）`);
                                  }
                                  
                                  if (missingBibleFields.length > 0) {
                                      const hasUpdatedStoryBibleParam = originalArgs && 'updated_story_bible' in originalArgs;
                                      if (!hasUpdatedStoryBibleParam) {
                                          notUpdatedItems.push(`❌ 故事圣经（模型未返回此参数，缺失字段：${missingBibleFields.join('、')}）`);
                                      } else {
                                          notUpdatedItems.push(`❌ 故事圣经（模型返回了参数但部分字段为空，缺失字段：${missingBibleFields.join('、')}）`);
                                      }
                                  }
                              } else {
                                  const hasUpdatedStoryBibleParam = originalArgs && 'updated_story_bible' in originalArgs;
                                  if (!hasUpdatedStoryBibleParam) {
                                      notUpdatedItems.push('❌ 故事圣经（模型未返回此参数）');
                                  } else if (originalArgs.updated_story_bible === null || originalArgs.updated_story_bible === undefined) {
                                      notUpdatedItems.push('❌ 故事圣经（模型返回了参数但值为空）');
                                  } else {
                                      notUpdatedItems.push('❌ 故事圣经（写入故事板失败）');
                                  }
                              }
                              
                              // 检查角色是否真正保存
                              if (characters && Array.isArray(characters) && characters.length > 0) {
                                  updatedItems.push(`✅ 角色（${characters.length}个）`);
                              } else {
                                  const hasCharactersParam = originalArgs && 'characters' in originalArgs;
                                  if (!hasCharactersParam) {
                                      // 角色参数是可选的，不显示未返回
                                  } else if (characters === null || characters === undefined) {
                                      notUpdatedItems.push('❌ 角色（模型返回了参数但值为空）');
                                  } else if (Array.isArray(characters) && characters.length === 0) {
                                      notUpdatedItems.push('❌ 角色（模型返回了参数但数组为空）');
                                  } else {
                                      notUpdatedItems.push('❌ 角色（写入故事板失败）');
                                  }
                              }
                              
                              // 检查世界观设定是否真正保存
                              if (worldEntries && Array.isArray(worldEntries) && worldEntries.length > 0) {
                                  updatedItems.push(`✅ 世界观设定（${worldEntries.length}个）`);
                              } else {
                                  const hasWorldEntriesParam = originalArgs && 'worldEntries' in originalArgs;
                                  if (!hasWorldEntriesParam) {
                                      // 世界观设定参数是可选的，不显示未返回
                                  } else if (worldEntries === null || worldEntries === undefined) {
                                      notUpdatedItems.push('❌ 世界观设定（模型返回了参数但值为空）');
                                  } else if (Array.isArray(worldEntries) && worldEntries.length === 0) {
                                      notUpdatedItems.push('❌ 世界观设定（模型返回了参数但数组为空）');
                                  } else {
                                      notUpdatedItems.push('❌ 世界观设定（写入故事板失败）');
                                  }
                              }
                              
                              // 检查写作指导是否真正保存
                              if (writingGuidelines && Array.isArray(writingGuidelines) && writingGuidelines.length > 0) {
                                  updatedItems.push(`✅ 写作指导（${writingGuidelines.length}个）`);
                              } else {
                                  const hasWritingGuidelinesParam = originalArgs && 'writingGuidelines' in originalArgs;
                                  if (!hasWritingGuidelinesParam) {
                                      // 写作指导参数是可选的，不显示未返回
                                  } else if (writingGuidelines === null || writingGuidelines === undefined) {
                                      notUpdatedItems.push('❌ 写作指导（模型返回了参数但值为空）');
                                  } else if (Array.isArray(writingGuidelines) && writingGuidelines.length === 0) {
                                      notUpdatedItems.push('❌ 写作指导（模型返回了参数但数组为空）');
                                  } else {
                                      notUpdatedItems.push('❌ 写作指导（写入故事板失败）');
                                  }
                              }
                              
                              const detailMessage = `第${chapterNumber}章 "${chapterTitle}" 已更新\n\n**已更新内容：**\n${updatedItems.length > 0 ? updatedItems.join('\n') : '无'}\n\n${notUpdatedItems.length > 0 ? `**未更新内容：**\n${notUpdatedItems.join('\n')}` : ''}`;
                              
                              // 只有真正保存成功才标记为成功
                              toolResult = { success: true, message: detailMessage };
                              toolExecuted = true;
                              
                              // 更新工具调用成功标记（用于自动写验证）
                              const markerKey = `chapter_${chapterNumber}`;
                              if (toolCallSuccessMarkers.has(markerKey)) {
                                toolCallSuccessMarkers.set(markerKey, {
                                  chapterNumber,
                                  success: true,
                                  timestamp: Date.now()
                                });
                                console.log(`✅ 工具调用成功标记已更新: 章节 ${chapterNumber}`);
                              }
                              
                              // 保存正文内容到消息列表
                              // 默认不隐藏，用户可以手动隐藏，或通过隐藏楼层设置控制
                              if (effectiveSessionId && chapter_content) {
                                  setSessions(prev => prev.map(s => {
                                      if (s.id === effectiveSessionId) {
                                          const newMessage: Message = {
                                              id: uuidv4(),
                                              role: 'model',
                                              text: chapter_content,
                                              excludeFromAI: false,  // 默认不隐藏，确保上下文连续性
                                              timestamp: Date.now(),
                                              latencyMs: responseDurationMs
                                          };
                                          return {
                                              ...s,
                                              messages: [...s.messages, newMessage],
                                              lastUpdated: Date.now()
                                          };
                                      }
                                      return s;
                                  }));
                              }
                          }
                      }
                  catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                      // 清理工具调用标记（如果存在）
                      if (call.name === 'update_storyboard' && call.args?.chapterNumber) {
                        const markerKey = `chapter_${call.args.chapterNumber}`;
                        toolCallSuccessMarkers.delete(markerKey);
                        console.log(`❌ 工具调用失败，已清理标记: 章节 ${call.args.chapterNumber}`);
                      }
                  }
              }
              // ⚠️ 已废弃：update_chapter_content 工具已废弃，应使用 update_storyboard 替代
              // 保留此处理逻辑仅用于向后兼容旧数据
              else if (call.name === 'update_chapter_content') {
                  try {
                      const { chapterNumber, content, createNewVersion, versionName, volumeNumber } = call.args as any;
                      
                      // Validate required parameters
                      if (!chapterNumber) {
                          toolResult = { success: false, message: "Chapter number is required." };
                      } else if (!content || content.trim().length === 0) {
                          toolResult = { success: false, message: "Content cannot be empty." };
                      } else {
                          console.log("🔧 update_chapter_content called with:", {
                              chapterNumber,
                              volumeNumber,
                              contentLength: content?.length || 0,
                              createNewVersion,
                              versionName
                          });
                          
                              // First, check if chapter exists before calling applyStoryUpdate
                          // We need to check this outside applyStoryUpdate to set toolExecuted correctly
                          let chIdx = -1;
                          if (effectiveSessionId) {
                              const session = sessions.find(s => s.id === effectiveSessionId);
                              if (session) {
                                  if (volumeNumber !== undefined && volumeNumber !== null) {
                                      const vol = session.story.volumes.find(v => v.number === Number(volumeNumber));
                                      if (vol) {
                                          chIdx = session.story.outline.findIndex(c => c.number === Number(chapterNumber) && c.volumeId === vol.id);
                                      }
                                  }
                                  if (chIdx === -1) {
                                      chIdx = session.story.outline.findIndex(c => c.number === Number(chapterNumber));
                                  }
                              }
                          }
                          
                          if (chIdx === -1) {
                              console.error("❌ ERROR: Chapter not found:", {
                                  chapterNumber,
                                  volumeNumber,
                                  availableChapters: activeSession?.story.outline.map(ch => ({
                                      number: ch.number,
                                      title: ch.title,
                                      volumeId: ch.volumeId,
                                      volumeNumber: ch.volumeId ? activeSession.story.volumes.find(v => v.id === ch.volumeId)?.number : undefined
                                  })) || []
                              });
                              toolResult = { success: false, message: `Chapter ${chapterNumber} not found. Please create the chapter first.` };
                          } else {
                              // Chapter exists, proceed with update
                              applyStoryUpdate(s => {
                      // Logic to find chapter: match number AND optional volumeNumber if provided
                      let chIdx = -1;
                      
                      console.log("📖 Searching for chapter:", {
                          requestedChapter: chapterNumber,
                          requestedVolume: volumeNumber,
                          totalChapters: s.outline.length,
                          totalVolumes: s.volumes.length,
                          chapters: s.outline.map(ch => ({
                              number: ch.number,
                              title: ch.title,
                              volumeId: ch.volumeId,
                              volumeNumber: ch.volumeId ? s.volumes.find(v => v.id === ch.volumeId)?.number : undefined
                          }))
                      });
                      
                      if (volumeNumber !== undefined && volumeNumber !== null) {
                          const vol = s.volumes.find(v => v.number === Number(volumeNumber));
                          console.log("📚 Volume lookup:", {
                              requestedVolumeNumber: volumeNumber,
                              foundVolume: vol ? { id: vol.id, number: vol.number, title: vol.title } : null,
                              allVolumes: s.volumes.map(v => ({ id: v.id, number: v.number, title: v.title }))
                          });
                          if (vol) {
                              chIdx = s.outline.findIndex(c => c.number === Number(chapterNumber) && c.volumeId === vol.id);
                              console.log("✅ Found chapter by volume:", {
                                  chapterIndex: chIdx,
                                  chapter: chIdx >= 0 ? {
                                      number: s.outline[chIdx].number,
                                      title: s.outline[chIdx].title,
                                      volumeId: s.outline[chIdx].volumeId
                                  } : null
                              });
                          } else {
                              console.warn("⚠️ Volume not found:", volumeNumber);
                          }
                      }
                      
                      // Fallback: search by number only (first match)
                      if (chIdx === -1) {
                          chIdx = s.outline.findIndex(c => c.number === Number(chapterNumber));
                          console.log("📝 Fallback search by chapter number:", {
                              chapterIndex: chIdx,
                              chapter: chIdx >= 0 ? {
                                  number: s.outline[chIdx].number,
                                  title: s.outline[chIdx].title,
                                  volumeId: s.outline[chIdx].volumeId
                              } : null
                          });
                      }
                      
                      if (chIdx === -1) {
                          console.error("❌ ERROR: Chapter not found in applyStoryUpdate:", {
                              chapterNumber,
                              volumeNumber
                          });
                          return s;
                      }
                      
                      console.log("✅ Chapter found at index:", chIdx, "Chapter:", {
                          number: s.outline[chIdx].number,
                          title: s.outline[chIdx].title,
                          volumeId: s.outline[chIdx].volumeId,
                          hasContentVersions: !!(s.outline[chIdx].contentVersions && s.outline[chIdx].contentVersions.length > 0),
                          activeVersionId: s.outline[chIdx].activeVersionId
                      });
                      
                      // Double-check: verify the chapter number matches
                      if (s.outline[chIdx].number !== Number(chapterNumber)) {
                          console.error("❌ WARNING: Chapter number mismatch!", {
                              requested: chapterNumber,
                              found: s.outline[chIdx].number,
                              index: chIdx
                          });
                      }
                      
                      // Create a deep copy of the chapter to ensure React detects changes
                      const chapter = { 
                          ...s.outline[chIdx],
                          contentVersions: s.outline[chIdx].contentVersions ? [...s.outline[chIdx].contentVersions] : []
                      };
                      
                      // Ensure contentVersions array exists
                      if (!chapter.contentVersions || chapter.contentVersions.length === 0) {
                          const initialVerId = uuidv4();
                          chapter.contentVersions = [{
                              id: initialVerId,
                              versionName: "初始草稿",
                              timestamp: Date.now(),
                              text: "",
                              isContext: true // 默认作为上下文
                          }];
                          chapter.activeVersionId = initialVerId;
                      }
                      
                      // SIMPLIFIED LOGIC: Always create a new version when AI generates content
                      // This ensures content is always saved, regardless of existing versions or empty content
                      console.log("📝 Creating new version for chapter content:", {
                          chapterNumber,
                          contentLength: content.length,
                          existingVersionsCount: chapter.contentVersions.length,
                          versionName: versionName || undefined
                      });
                      
                          const newVerId = uuidv4();
                          const newVer: ContentVersion = {
                              id: newVerId,
                          versionName: versionName || (chapter.contentVersions.length === 0 ? "初始草稿" : `版本 ${chapter.contentVersions.length + 1}`),
                              timestamp: Date.now(),
                          text: content,
                              isContext: true, // 新版本默认作为上下文
                              modelId: apiConfig.modelId // 保存生成此版本时使用的模型ID
                      };
                      
                      // 关闭之前活跃版本的上下文开关（如果存在）
                      const updatedVersions = chapter.contentVersions.map(v => 
                          v.id === chapter.activeVersionId ? { ...v, isContext: false } : v
                      );
                      
                      chapter.contentVersions = [...updatedVersions, newVer];
                          chapter.activeVersionId = newVerId;
                      
                      console.log("✅ New version created:", {
                          versionName: newVer.versionName,
                          versionId: newVerId,
                          totalVersions: chapter.contentVersions.length,
                          contentLength: content.length
                      });
                      
                      // Ensure contentVersions array is a new reference (deep copy each version)
                      const finalContentVersions = chapter.contentVersions.map(v => ({ ...v }));
                      
                      console.log("📝 Final chapter state:", {
                          chapterNumber,
                          versionsCount: finalContentVersions.length,
                          activeVersionId: chapter.activeVersionId,
                          activeVersionTextLength: finalContentVersions.find(v => v.id === chapter.activeVersionId)?.text.length || 0,
                          allVersionIds: finalContentVersions.map(v => v.id),
                          allVersionTextLengths: finalContentVersions.map(v => ({ id: v.id, length: v.text.length }))
                      });
                      
                      // Create new outline array with updated chapter to ensure React detects the change
                      // IMPORTANT: Must create new array and new chapter object to trigger React re-render
                      const newOutline = s.outline.map((ch, idx) => {
                          if (idx === chIdx) {
                              // Return a completely new chapter object with new contentVersions array
                              const updatedChapter = { 
                                  ...chapter,
                                  contentVersions: finalContentVersions // Use the new array reference
                              };
                              console.log("📝 Creating new chapter object for React:", {
                                  chapterNumber: updatedChapter.number,
                                  activeVersionId: updatedChapter.activeVersionId,
                                  versionsCount: updatedChapter.contentVersions.length
                              });
                              return updatedChapter;
                          }
                          return ch;
                      });
                      
                      console.log("📝 Outline updated, chapter index:", chIdx, "versions:", newOutline[chIdx]?.contentVersions?.length);
                      
                      return { ...s, outline: newOutline };
                  });
                  toolResult = { message: `Chapter ${chapterNumber} content updated successfully.` };
                  console.log("✅ update_chapter_content tool result:", {
                      chapterNumber,
                      contentLength: content?.length || 0,
                      versionCreated: true
                  });

                  // 保存正文内容到消息列表
                  // 默认不隐藏，用户可以手动隐藏，或通过隐藏楼层设置控制
                  if (effectiveSessionId && content) {
                      setSessions(prev => prev.map(s => {
                          if (s.id !== effectiveSessionId) return s;
                          const newMessage: Message = {
                              id: uuidv4(),
                              role: 'model',
                              text: content,
                              excludeFromAI: false,  // 默认不隐藏，确保上下文连续性，用户可手动隐藏或通过隐藏楼层控制
                              timestamp: Date.now(),
                              latencyMs: responseDurationMs
                          };
                          return {
                              ...s,
                              messages: [...s.messages, newMessage],
                              lastUpdated: Date.now()
                          };
                      }));
                      
                      // 如果使用"范文腔调"方法，自动触发提炼章纲
                      // 注意：这个逻辑必须在 setSessions 回调之外执行，避免在状态更新回调中产生副作用
                      const currentWritingMethod = localStorage.getItem('storyforge_writing_method') as WritingMethod;
                      if (currentWritingMethod === 'fanwen_style_imitation') {
                          // 使用 activeSession 获取当前会话信息
                          const session = activeSession;
                          if (session) {
                              const chapter = session.story.outline.find(ch => 
                                  ch.number === Number(chapterNumber) && 
                                  (volumeNumber === undefined || volumeNumber === null || 
                                   (ch.volumeId && session.story.volumes.find(v => v.id === ch.volumeId)?.number === Number(volumeNumber)))
                              );
                              
                              if (chapter) {
                                  // 生成唯一标识符，避免重复触发
                                  const extractionKey = `${chapterNumber}:${volumeNumber ?? 'none'}`;
                                  
                                  // 检查是否已经在进行提炼章纲的操作
                                  if (extractingOutlineRef.current === extractionKey) {
                                      console.log('⚠️ 正在提炼章纲，跳过重复触发');
                                      return;
                                  }
                                  
                                  // 设置标志，表示正在提炼章纲
                                  extractingOutlineRef.current = extractionKey;
                                  
                                  const vol = chapter.volumeId ? session.story.volumes.find(v => v.id === chapter.volumeId) : undefined;
                                  const volumeInfo = vol ? `第${vol.number}卷 ` : '';
                                  
                                  // 构建提炼章纲的提示词
                                  const volumeNumberParam = vol ? `- volumeNumber: ${vol.number}\n` : '';
                                  const outlineExtractionPrompt = '【写作方法：范文腔调｜阶段：提炼章纲】\n\n' +
                                      '【章节信息】\n' +
                                      `- 所属卷：${volumeInfo || '（未分卷）'}\n` +
                                      `- 章节：第${chapter.number}章《${chapter.title}》\n\n` +
                                      '【已生成的正文内容】\n' +
                                      `${content}\n\n` +
                                      '【任务目标】\n' +
                                      '请从以上正文中提炼出**极其详细**的章纲概要。章纲的作用是帮助AI记忆，保证后续创作不出现逻辑矛盾。\n\n' +
                                      '【核心要求】\n' +
                                      '**⚠️ 重要：章纲必须详细完整，不能过于简洁！**\n\n' +
                                      '【输出要求（必须全部包含）】\n' +
                                      '1. **剧情任务总结**：\n' +
                                      '   - 明确说明本章完成了什么核心剧情任务（例如：揭露某个秘密、完成某个重要转折、推进某条线索等）\n' +
                                      '   - 说明本章在整个故事中的作用和意义\n\n' +
                                      '2. **完整情节细节**：\n' +
                                      '   - 按时间顺序或逻辑顺序，详细梳理本章发生的**所有**情节节点\n' +
                                      '   - 包括但不限于：场景转换、人物行动、对话要点、心理活动、环境描写的作用等\n' +
                                      '   - 不要遗漏任何重要细节，确保章纲能够完整还原正文内容\n\n' +
                                      '3. **角色关系变化**：\n' +
                                      '   - 详细说明本章中角色之间的关系发生了哪些变化\n' +
                                      '   - 包括新出现的角色、角色之间的互动、冲突或合作等\n\n' +
                                      '4. **伏笔与悬念**：\n' +
                                      '   - 标注本章埋下的所有伏笔和悬念\n' +
                                      '   - 说明这些伏笔/悬念的作用和可能的后续发展\n\n' +
                                      '5. **情绪曲线与节奏**：\n' +
                                      '   - 详细描述本章的情绪起伏变化（从平静到紧张、从绝望到希望等）\n' +
                                      '   - 说明节奏的快慢变化和转折点\n\n' +
                                      '6. **关键信息点**：\n' +
                                      '   - 列出本章揭示的重要信息、线索或设定\n' +
                                      '   - 说明这些信息对后续剧情的影响\n\n' +
                                      '【格式要求】\n' +
                                      '- 章纲应该是一个完整的、连贯的叙述，而不是简单的列表\n' +
                                      '- 字数建议：500-1500字（根据正文长度调整，正文越长，章纲越详细）\n' +
                                      '- 确保章纲详细到足以让AI在后续创作时准确回忆起所有重要细节\n\n' +
                                      '【工具指令】\n' +
                                      '提炼完成后，必须调用 add_chapter 工具更新章纲：\n' +
                                      `- number: ${chapter.number}\n` +
                                      volumeNumberParam +
                                      `- title: "${chapter.title}"（保持不变）\n` +
                                      '- summary: [提炼出的详细章纲概要]\n\n' +
                                      '**重要：必须调用工具保存章纲！**';

                                  // 延迟发送，确保正文已保存
                                  // skipAddingToMessages: true 表示不将提示词显示在对话窗口，直接发给AI
                                  setTimeout(() => {
                                      sendMessage(outlineExtractionPrompt, { mode: 'general', skipAddingToMessages: true });
                                      
                                      // 设置超时清除标志，避免永久死锁（5分钟）
                                      setTimeout(() => {
                                          if (extractingOutlineRef.current === extractionKey) {
                                              console.log('⚠️ 提炼章纲超时，自动清除标志');
                                              extractingOutlineRef.current = null;
                                          }
                                      }, 5 * 60 * 1000);
                                  }, 500);
                              }
                          }
                      }
                  }
                          }
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'add_character') {
                  try {
                      // 使用验证函数验证参数
                      const validation = validateAddCharacterArgs(call.args);
                      
                      if (!validation.isValid) {
                          toolResult = { 
                              success: false, 
                              message: `参数验证失败：\n${validation.errors.join('\n')}${validation.warnings.length > 0 ? `\n\n警告：\n${validation.warnings.join('\n')}` : ''}` 
                          };
                      } else {
                          // 使用标准化后的参数
                          const args = validation.normalized!;
                          const { name, role, tags, description } = args;
                          
                          // 记录警告（如果有）
                          if (validation.warnings.length > 0) {
                              console.warn('⚠️ add_character 参数验证警告:', validation.warnings);
                          }
                          
                          applyStoryUpdate(s => {
                              const existingIdx = s.characters.findIndex(c => c.name === name);
                              const newChars = [...s.characters];
                              const charData = {
                                  id: existingIdx >= 0 ? newChars[existingIdx].id : uuidv4(),
                                  name, role, tags: tags || [], description,
                                  behaviorExamples: existingIdx >= 0 ? newChars[existingIdx].behaviorExamples : []
                              };
                              if (existingIdx >= 0) newChars[existingIdx] = charData;
                              else newChars.push(charData);
                              return { ...s, characters: newChars };
                          });
                          toolResult = { success: true, message: `Character ${name} saved.` };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'add_character_behavior') {
                  try {
                      const { characterName, context, response } = call.args as any;
                      if (!characterName || !context || !response) {
                          toolResult = { success: false, message: "Character name, context, and response are required." };
                      } else {
                          applyStoryUpdate(s => {
                              const charIdx = s.characters.findIndex(c => c.name === characterName);
                              if (charIdx === -1) {
                                  throw new Error(`Character "${characterName}" not found`);
                              }
                              const newChars = [...s.characters];
                              const char = { ...newChars[charIdx] };
                              char.behaviorExamples = [...(char.behaviorExamples || []), { context, response }];
                              newChars[charIdx] = char;
                              return { ...s, characters: newChars };
                          });
                          toolResult = { success: true, message: `Behavior for ${characterName} added.` };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'add_world_entry') {
                  try {
                      // 使用验证函数验证参数
                      const validation = validateAddWorldEntryArgs(call.args);
                      
                      if (!validation.isValid) {
                          toolResult = { 
                              success: false, 
                              message: `参数验证失败：\n${validation.errors.join('\n')}${validation.warnings.length > 0 ? `\n\n警告：\n${validation.warnings.join('\n')}` : ''}` 
                          };
                      } else {
                          // 使用标准化后的参数
                          const args = validation.normalized!;
                          const { category, name, description } = args;
                          
                          // 记录警告（如果有）
                          if (validation.warnings.length > 0) {
                              console.warn('⚠️ add_world_entry 参数验证警告:', validation.warnings);
                          }
                          
                          applyStoryUpdate(s => {
                              const newEntry: WorldEntry = { id: uuidv4(), category, name, description };
                              return { ...s, worldGuide: [...s.worldGuide, newEntry] };
                          });
                          toolResult = { success: true, message: `World entry ${name} added.` };
                          toolExecuted = true;
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                  }
              }
              else if (call.name === 'add_writing_guideline') {
                  try {
                      // 使用验证函数验证参数
                      const validation = validateAddWritingGuidelineArgs(call.args);
                      
                      if (!validation.isValid) {
                          toolResult = { 
                              success: false, 
                              message: `参数验证失败：\n${validation.errors.join('\n')}${validation.warnings.length > 0 ? `\n\n警告：\n${validation.warnings.join('\n')}` : ''}` 
                          };
                          toolExecuted = false;
                      } else {
                          // 使用标准化后的参数
                          const args = validation.normalized!;
                          const { category, content } = args;
                          
                          // 记录警告（如果有）
                          if (validation.warnings.length > 0) {
                              console.warn('⚠️ add_writing_guideline 参数验证警告:', validation.warnings);
                          }
                          
                          applyStoryUpdate(s => {
                              const newEntry: WritingGuideline = { id: uuidv4(), category, content, isActive: true };
                              return { ...s, writingGuidelines: [...(s.writingGuidelines || []), newEntry] };
                          });
                          toolResult = { success: true, message: `写作指导已添加：${category}` };
                          toolExecuted = true;
                          console.log('✅ 写作指导已保存:', { category, contentLength: content.length });
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                      toolExecuted = false;
                      console.error('❌ 保存写作指导失败:', e);
                  }
              }
              else if (call.name === 'update_chapter_deconstruction') {
                  try {
                      const { chapterNumber, content } = call.args as any;
                      
                      if (!chapterNumber || content === undefined) {
                          toolResult = { success: false, message: "章节号和内容都是必需的。" };
                          toolExecuted = false;
                      } else {
                          applyStoryUpdate(s => {
                              const activeIdx = s.blueprints.findIndex(b => b.id === s.activeBlueprintId);
                              const safeIdx = activeIdx === -1 ? 0 : activeIdx;
                              
                              if (safeIdx === -1 || s.blueprints.length === 0) {
                                  // 如果没有模板，创建一个
                                  const newBlueprintId = uuidv4();
                                  const baseData = createEmptyStructureData();
                                  const newBlueprint: Blueprint = {
                                      id: newBlueprintId,
                                      versionName: "初始构思",
                                      timestamp: Date.now(),
                                      data: baseData,
                                      beatVersions: createBeatVersionsFromData(baseData),
                                      chapterDeconstructions: {
                                          [Number(chapterNumber)]: content
                                      }
                                  };
                                  return { 
                                      ...s, 
                                      blueprints: [newBlueprint],
                                      activeBlueprintId: newBlueprintId
                                  };
                              }
                              
                              const newBlueprints = [...s.blueprints];
                              const updatedBlueprint = {
                                  ...newBlueprints[safeIdx],
                                  chapterDeconstructions: {
                                      ...(newBlueprints[safeIdx].chapterDeconstructions || {}),
                                      [Number(chapterNumber)]: content
                                  }
                              };
                              newBlueprints[safeIdx] = updatedBlueprint;
                              
                              return { ...s, blueprints: newBlueprints };
                          });
                          
                          toolResult = { success: true, message: `第${chapterNumber}章的逆向拆解结果已保存到模板。` };
                          toolExecuted = true;
                          console.log('✅ 逆向拆解结果已保存:', { chapterNumber, contentLength: content.length });
                      }
                  } catch (e: any) {
                      toolResult = { success: false, message: `Error: ${e.message || 'Unknown error'}` };
                      toolExecuted = false;
                      console.error('❌ 保存逆向拆解结果失败:', e);
                  }
              }

              // Update UI - Show tool call success message
              // excludeFromAI: true 工具调用通知不发送给AI，避免污染上下文
              // Only show success message if tool was actually executed
              if (toolExecuted && toolResult.success !== false) {
                  let toolMsgText = '';
                  
                  // 根据不同的工具生成详细的消息
                  if (call.name === 'update_storyboard') {
                      // update_storyboard 工具已经有详细的消息（在 toolResult.message 中）
                      toolMsgText = toolResult.message || `✅ 故事板已更新: ${call.name}`;
                  } else if (call.name === 'add_chapter') {
                      const { number, title, summary } = call.args as any;
                      toolMsgText = `✅ 章纲已保存到故事板\n\n**已更新内容：**\n✅ 第${number}章 "${title || '未命名'}" 章纲（${summary?.length || 0}字）`;
                  } else if (call.name === 'add_character') {
                      const { name, role } = call.args as any;
                      toolMsgText = `✅ 角色已保存到故事板\n\n**已更新内容：**\n✅ 角色 "${name || '未命名'}"（${role || '未指定角色'}）`;
                  } else if (call.name === 'add_world_entry') {
                      const { category, name } = call.args as any;
                      toolMsgText = `✅ 世界观设定已保存到故事板\n\n**已更新内容：**\n✅ ${category || '未分类'}: "${name || '未命名'}"`;
                  } else if (call.name === 'add_writing_guideline') {
                      const { category } = call.args as any;
                      toolMsgText = `✅ 写作指导已保存到故事板\n\n**已更新内容：**\n✅ 写作指导（类别: ${category || '未指定'}）\n\n您可以在"写作指导"模块中查看。`;
                  } else if (call.name === 'update_chapter_deconstruction') {
                      const { chapterNumber, content } = call.args as any;
                      toolMsgText = `✅ 逆向拆解结果已保存到模板\n\n**已更新内容：**\n✅ 第${chapterNumber}章的逆向拆解结果（${content?.length || 0}字）\n\n您可以在"模板"标签页中查看。`;
                  } else if (call.name === 'update_title_synopsis') {
                      const { title, synopsis } = call.args as any;
                      const updatedItems: string[] = [];
                      if (title) updatedItems.push(`✅ 标题: "${title}"`);
                      if (synopsis) updatedItems.push(`✅ 简介（${synopsis.length}字）`);
                      toolMsgText = `✅ 故事信息已更新\n\n**已更新内容：**\n${updatedItems.join('\n')}`;
                  } else if (call.name === 'update_structure') {
                      toolMsgText = `✅ 卷纲（故事结构）已更新\n\n**已更新内容：**\n✅ 卷纲/模板`;
                  } else {
                      // 默认消息：使用 toolResult.message（如果有），否则使用默认格式
                      toolMsgText = toolResult.message || `✅ 故事板已更新: ${call.name}`;
                  }
                  
                  const toolMsg: Message = { 
                      id: uuidv4(), 
                      role: 'model', 
                      text: toolMsgText, 
                      isToolCall: true, 
                      toolName: call.name,
                      excludeFromAI: true,  // 🔒 工具调用通知不发送给AI，避免下次对话成为上下文污染
                      timestamp: Date.now(),
                      latencyMs: responseDurationMs
                  };
                  if (effectiveSessionId) {
                      setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, toolMsg] } : s));
                  }
              } else if (toolResult.success === false) {
                  // Show error message if tool execution failed
                  const errorMsg: Message = {
                      id: uuidv4(),
                      role: 'model',
                      text: `❌ 工具调用失败: ${call.name}\n错误: ${toolResult.message || '未知错误'}`,
                      isToolCall: true,
                      toolName: call.name,
                      excludeFromAI: true,
                      timestamp: Date.now(),
                      latencyMs: responseDurationMs
                  };
                  if (effectiveSessionId) {
                      setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
                  }
              }
              
              // Log tool execution result for debugging
              console.log(`✅ Tool executed successfully: ${call.name}`, {
                  result: toolResult,
                  chapterNumber: (call.name === 'update_storyboard' || call.name === 'update_chapter_content') ? call.args?.chapterNumber : undefined
              });

              // Collect result for adapter
              toolResults.push({ id: call.id, name: call.name, response: toolResult });
          }

          // Check if we need to continue the conversation
          // If tools were successfully executed and there are no more tool calls needed,
          // we can skip waiting for AI's text response to save time
          const hasMoreToolCalls = toolResults.some(tr => {
              // Check if any tool might trigger follow-up actions
              // For most tools, once executed successfully, we don't need AI's confirmation
              return false; // Most tools don't need follow-up
          });
          
          // Only send tool response back to AI if:
          // 1. There might be more tool calls needed (unlikely but possible)
          // 2. Or if we want to allow AI to provide additional context (we don't)
          // For efficiency, we skip the AI response after successful tool execution
          // The "故事板已更新" message is sufficient feedback
          
          // Skip waiting for AI response after tool calls to save time
          // The tool execution message ("故事板已更新") is already shown to the user
          functionCalls = undefined; // No more tool calls needed
          modelText = undefined; // Don't wait for AI text response
          
          console.log("✅ Tool execution completed, skipping AI response to save time");
      }

    } catch (error: any) {
      // Check if error is from abort
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        console.log("Request aborted by user");
        // Mark the last AI message as stopped (if it exists and has partial content)
             if (effectiveSessionId) {
          setSessions(prev => prev.map(s => {
            if (s.id === effectiveSessionId) {
              const messages = [...s.messages];
              // Find the last model message that was being generated
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'model' && !messages[i].isToolCall && !messages[i].isStopped) {
                  // Mark it as stopped
                  messages[i] = { ...messages[i], isStopped: true };
                  break;
                }
              }
              return { ...s, messages, lastUpdated: Date.now() };
            }
            return s;
          }));
        }
        return;
      }
      
      console.error("LLM API Error:", error);
      responseDurationMs = responseDurationMs ?? (Date.now() - requestStartedAt);
      let errorText = "抱歉，发生了错误。请稍后再试。";
      
      const isQuotaError = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('Quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuotaError) {
          errorText = `⚠️ **配额/资源耗尽 (429 Error)**\n\n供应商: ${apiConfig?.provider}\n\n建议：\n1. 如果是 Google，切换到 Flash 模型。\n2. 如果是 SiliconFlow/DeepSeek，请检查账户余额。\n3. 稍后重试。`;
      } else {
          errorText = `LLM API Error: ${error.message || "Unknown error"}`;
      }

      const errorMsg: Message = { 
        id: uuidv4(), 
        role: 'model', 
        text: errorText,
        timestamp: Date.now(),
        latencyMs: responseDurationMs
      };
      if (effectiveSessionId) {
          setSessions(prev => prev.map(s => s.id === effectiveSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
      }
      
      // 如果提炼章纲过程中出错，清除标志以避免死锁
      if (extractingOutlineRef.current && options?.mode === 'general' && options?.skipAddingToMessages) {
          console.log('⚠️ 提炼章纲过程中出错，清除标志');
          extractingOutlineRef.current = null;
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [activeSession, apiConfig, targetWordCount, maxHistoryForAI, temperature, getWritingSamplesBlock]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Helper function to build chapter manuscript prompt (similar to StoryBoard)
  const buildChapterManuscriptPrompt = useCallback((chapter: Chapter, useJsonSchema: boolean = false): string => {
    const writingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
    const storyGenre = (localStorage.getItem('storyforge_story_genre') as StoryGenre) || 'none';
    const genreNames: Record<StoryGenre, string> = {
      'none': '',
      'wuxia': '武侠',
      'xianxia': '修真',
      'apocalypse': '末日',
      'urban': '都市',
      'historical': '历史',
      'sci-fi': '科幻',
      'supernatural': '异能'
    };
    const genreNote = storyGenre !== 'none' ? `\n\n**注意**：当前故事题材为${genreNames[storyGenre]}，请根据${genreNames[storyGenre]}题材的特点和惯例来创作。` : '';
    
    const summary = chapter.summary || '暂无';
    
    // 根据写作方法生成不同的提示词
    if (writingMethod === 'fanwen_style_imitation') {
      // 直写正文模式：先写正文，再写章纲，一次请求返回所有内容
      return `请为第${chapter.number}章《${chapter.title}》生成正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}

**要求（直写正文模式）：**
1. **先写正文，再写章纲**：直接生成完整的正文内容，然后根据正文总结详细章纲
2. **在一次工具调用中返回所有内容**：生成正文和章纲后，必须调用 update_storyboard 工具保存
3. **🚨 如果正文中涉及到新角色、世界观设定、故事圣经更新**：
   - 如果正文中出现了新角色 → **可以在 update_storyboard 工具的 characters 参数中一起保存**，或单独调用 add_character 工具
   - 如果正文中出现了新的世界观设定 → **可以在 update_storyboard 工具的 worldEntries 参数中一起保存**，或单独调用 add_world_entry 工具
   - 如果正文中涉及到故事圣经更新（角色状态变化、物品位置、伏笔等）→ **必须在 update_storyboard 工具的 updated_story_bible 参数中提供**（这是必需参数！）
   - **⚠️ 绝对禁止**：只在正文文本中描述这些信息而不通过工具参数保存！文本中的描述不会保存到故事板！

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchema ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchema ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

【🚨 工具调用指令 - 必须执行】
**生成正文和章纲后，必须立即调用 update_storyboard 工具保存，否则内容不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。

**🚨 update_storyboard 工具参数格式要求：**

1. **chapterTitle（章节标题）**：
   - ✅ 正确示例："初入江湖"、"命运的转折"、"最后的决战"、"背叛的代价"
   - ❌ 错误示例："第1章"、"第2章"、"Chapter 1"
   - 要求：必须是有意义的描述性标题，从正文内容中提取主要主题或关键事件
   - 长度：2-8个中文字符

2. **chapter_outline（详细章纲）**：
   - 字数要求：500-1500字（最少500字，建议800-1500字）
   - 必须包含以下要素：
     * 剧情任务（本章要完成什么）
     * 情节细节（发生了什么）
     * 角色关系变化（角色间关系如何发展）
     * 伏笔悬念（埋下了什么伏笔）
     * 情绪曲线（情绪如何起伏）
     * 关键信息点（揭示了什么重要信息）

3. **updated_story_bible（故事圣经，生成章节时强烈推荐提供）**：
   - character_status 格式：[角色名]：[状态/位置/关键变化]
   - 示例："陆志星：重伤，在青云门养伤。赵四：第10章已死亡。"
   - 必须明确标记"已死"的角色（格式：角色名：第X章已死亡）

工具参数列表（API会自动处理，你不需要在文本中写）：
- chapterNumber: ${chapter.number}
- chapterTitle: [从正文中提取的描述性标题]
- chapter_content: [生成的正文内容]
- chapter_outline: [根据正文总结的详细章纲，500-1500字，包含所有必需要素]
- updated_story_bible: [根据本章剧情更新故事圣经]
- createNewVersion: true`;
    } else if (writingMethod === 'design_outline') {
      // 设计章纲模式：只生成章纲，禁止生成正文
      return `请为第${chapter.number}章《${chapter.title}》设计详细章纲。${summary ? `\n\n现有章纲概要：${summary}\n\n**注意**：你可以参考现有章纲，但需要创作更详细、更完整的章纲。` : ''}

${genreNote}

**要求（设计章纲模式）：**
1. **只生成章纲，禁止生成正文**：
   - 根据故事的整体发展和前面章节的逻辑，创作第${chapter.number}章的详细章纲（500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
   - **绝对禁止**生成正文内容
   - **绝对禁止**调用 update_storyboard 工具（该工具会生成正文）
2. **必须调用 add_chapter 工具保存章纲**：生成章纲后，必须调用 add_chapter 工具保存
3. **🚨 如果章纲中涉及到新角色、世界观设定、故事圣经更新**：
   - 如果章纲中提到了新角色 → **必须单独调用 add_character 工具保存**（name, role, description）
   - 如果章纲中提到了新的世界观设定 → **必须单独调用 add_world_entry 工具保存**（category, name, description）
   - 如果章纲中涉及到故事圣经更新（角色状态变化、物品位置、伏笔等）→ **建议单独调用 add_writing_guideline 工具保存**（category: "故事圣经", content: 详细内容），或者在 add_chapter 的 summary 中详细描述
   - **⚠️ 绝对禁止**：只在章纲文本中描述这些信息而不调用工具保存！文本中的描述不会保存到故事板！

**章纲要求**：
- 字数要求：500-1500字（最少500字，建议800-1500字）
- 必须包含以下要素：
  * 剧情任务（本章要完成什么）
  * 情节细节（发生了什么）
  * 角色关系变化（角色间关系如何发展）
  * 伏笔悬念（埋下了什么伏笔）
  * 情绪曲线（情绪如何起伏）
  * 关键信息点（揭示了什么重要信息）

【🚨 工具调用指令 - 必须执行】
**生成章纲后，必须立即调用 add_chapter 工具保存，否则章纲不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。

**🚨 add_chapter 工具参数格式要求：**

1. **title（章节标题）**：
   - ✅ 正确示例："初入江湖"、"命运的转折"、"最后的决战"、"背叛的代价"
   - ❌ 错误示例："第1章"、"第2章"、"Chapter 1"
   - 要求：必须是有意义的描述性标题，从章纲中提取主要主题或关键事件
   - 长度：2-8个中文字符

2. **summary（章纲概要）**：
   - 字数要求：500-1500字（最少500字，建议800-1500字）
   - 必须包含所有必需要素（见上述要求）

3. **summaryDetailed（详细章纲，可选）**：
   - 如果提供，应该是更详细的章纲版本

工具参数列表（API会自动处理，你不需要在文本中写）：
- number: ${chapter.number}
- title: [从章纲中提取的描述性标题]
- summary: [详细章纲，500-1500字，包含所有必需要素]
- summaryDetailed: [可选，更详细的章纲版本]`;
    } else {
      // 默认写法：完整的提示词
      return `请为第${chapter.number}章《${chapter.title}》生成正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchema ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchema ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

【🚨 工具调用指令 - 必须执行】
**生成正文后，必须立即调用 update_storyboard 工具保存，否则内容不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。工具参数如下（这些是工具调用时需要提供的参数，不是你需要在文本中写的）：
- chapterNumber: ${chapter.number}
- chapterTitle: [从正文中提炼的章节标题，必须是有意义的标题，不能只是"第X章"]
- chapter_content: [生成的正文内容]
- chapter_outline: [根据正文总结的详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点]
- **updated_story_bible: [根据本章剧情更新故事圣经（必需！）]**，包含：
  - character_status: 人物状态表（格式：[角色名]：[状态/位置/关键变化]，必须明确标记"已死"的角色）
  - key_items_and_locations: 物品与地点（关键道具的持有者变更、当前所在位置）
  - active_plot_threads: 当前未解决的伏笔（列出悬而未决的冲突或任务，已解决的请删除）
  - important_rules: 临时规则/备注（本章新增的、对后续剧情有长期影响的设定）
- createNewVersion: true

**🚨🚨🚨 绝对必需**：
1. **必须调用工具**：Function Calling是API自动处理的，你不需要在文本中写任何代码或描述。只需要让API自动调用 update_storyboard 工具即可。
2. **必须更新故事圣经（updated_story_bible 参数）**：根据本章发生的事件，更新人物状态、物品位置、未解决的伏笔等，确保后续章节的逻辑一致性！**这是强制要求，不是可选项！如果不提供 updated_story_bible 参数，章节内容将无法正确保存！**`;
    }
  }, [targetWordCount]);

  // Helper function to build chapter outline prompt (for creating new chapters)
  const buildChapterOutlinePrompt = useCallback((chapterNumber: number): string => {
    const storyGenre = (localStorage.getItem('storyforge_story_genre') as StoryGenre) || 'none';
    const genreNames: Record<StoryGenre, string> = {
      'none': '',
      'wuxia': '武侠',
      'xianxia': '修真',
      'apocalypse': '末日',
      'urban': '都市',
      'historical': '历史',
      'sci-fi': '科幻',
      'supernatural': '异能'
    };
    const genreNote = storyGenre !== 'none' ? `\n\n**注意**：当前故事题材为${genreNames[storyGenre]}，请根据${genreNames[storyGenre]}题材的特点和惯例来创作。` : '';
    
    // 获取故事上下文
    const storyTitle = activeSession?.story.title || '未命名故事';
    const storySynopsis = activeSession?.story.synopsis || '暂无简介';
    const existingChapters = activeSession?.story.outline || [];
    const recentChapters = existingChapters.slice(-3).map(ch => `第${ch.number}章《${ch.title}》：${ch.summary || '暂无概要'}`).join('\n');
    
    return `请创建第${chapterNumber}章的章纲。

**故事信息：**
- 标题：${storyTitle}
- 简介：${storySynopsis}
${recentChapters ? `\n**最近章节：**\n${recentChapters}` : ''}

${genreNote}

**要求：**
1. 章节标题和概要需要符合故事的整体发展和风格
2. 与前面章节保持逻辑连贯性
3. 推进故事主线或支线剧情
4. 概要应包含：主要情节、关键事件、角色关系变化等

**完成后，请调用 add_chapter 工具保存章纲。**`;
  }, [activeSession]);

  // Auto Write Handlers
  const autoWriteEnabledRef = useRef(false);
  const handleStartAutoWrite = useCallback(async (startChapter: number) => {
    if (!activeSession || !apiConfig?.apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }
    
    console.log('🚀 开始自动写流程', { startChapter, totalChapters: autoWriteChapters, sessionId: activeSession.id });
    
    setAutoWriteEnabled(true);
    autoWriteEnabledRef.current = true;
    setAutoWriteCurrentChapter(0);
    
    // 如果起始章节不存在，找到最后一个存在的章节，从下一章开始
    const initialSession = sessions.find(s => s.id === activeSession.id);
    if (!initialSession) {
      console.error('❌ Session 不存在');
      setAutoWriteEnabled(false);
      autoWriteEnabledRef.current = false;
      return;
    }
    
    let actualStartChapter = startChapter;
    const existingChapters = initialSession.story.outline;
    if (existingChapters.length > 0) {
      const maxChapterNumber = Math.max(...existingChapters.map(ch => ch.number));
      if (startChapter > maxChapterNumber + 1) {
        console.log(`⚠️ 起始章节 ${startChapter} 不存在，调整为从第 ${maxChapterNumber + 1} 章开始`);
        actualStartChapter = maxChapterNumber + 1;
      } else if (startChapter <= maxChapterNumber) {
        // 如果起始章节小于等于最大章节号，检查是否存在
        const startChapterExists = existingChapters.some(ch => ch.number === startChapter);
        if (!startChapterExists) {
          // 找到第一个大于起始章节的章节，或者从最大章节+1开始
          const nextChapter = existingChapters.find(ch => ch.number > startChapter);
          if (nextChapter) {
            actualStartChapter = nextChapter.number;
            console.log(`⚠️ 起始章节 ${startChapter} 不存在，调整为从第 ${actualStartChapter} 章开始`);
          } else {
            actualStartChapter = maxChapterNumber + 1;
            console.log(`⚠️ 起始章节 ${startChapter} 不存在，调整为从第 ${actualStartChapter} 章开始`);
          }
        }
      }
    } else {
      // 如果没有章节，从第1章开始
      actualStartChapter = 1;
      console.log(`⚠️ 没有章节，从第 1 章开始`);
    }
    
    const writeNextChapter = async (chapterNum: number, totalChapters: number, originalStartChapter: number) => {
      // 检查是否应该停止（使用 ref 获取最新值）
      if (!autoWriteEnabledRef.current) {
        console.log('⏹️ 自动写已停止');
        return;
      }
      
      // 计算已完成的章节数（基于原始起始章节）
      const completedChapters = chapterNum - originalStartChapter;
      if (completedChapters >= totalChapters) {
        // 完成所有章节
        console.log('✅ 自动写完成，已写完所有章节');
        setAutoWriteEnabled(false);
        autoWriteEnabledRef.current = false;
        setAutoWriteCurrentChapter(0);
        return;
      }
      
      setAutoWriteCurrentChapter(completedChapters + 1);
      console.log(`📝 开始写第 ${chapterNum} 章 (${completedChapters + 1}/${totalChapters})`);
      
      // 获取最新的 session（避免闭包问题）
      const latestSession = sessions.find(s => s.id === activeSession.id);
      if (!latestSession) {
        console.error('❌ Session 不存在，停止自动写');
        setAutoWriteEnabled(false);
        autoWriteEnabledRef.current = false;
        setAutoWriteCurrentChapter(0);
        return;
      }
      
      // 检查章节是否存在
      const chapter = latestSession.story.outline.find(ch => ch.number === chapterNum);
      
      // 获取写作方法，判断使用哪种模式
      const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
      const isDirectWriteMode = currentWritingMethod === 'fanwen_style_imitation'; // 直写正文模式
      const isDesignOutlineMode = currentWritingMethod === 'design_outline'; // 设计章纲模式
      const isGoogleDirect = apiConfig?.provider === 'google' && !apiConfig?.useProxy;
      const useJsonSchemaFlag = apiConfig?.toolCallMode === 'json_schema' || (!isGoogleDirect && apiConfig?.toolCallMode !== 'function_calling');
      
      let finalChapter = chapter;
      let prompt = '';
      
      if (!chapter) {
        // 章节不存在，需要根据写作方法生成不同的提示词
        const storyTitle = latestSession.story.title || '未命名故事';
        const storySynopsis = latestSession.story.synopsis || '暂无简介';
        const existingChapters = latestSession.story.outline || [];
        const recentChapters = existingChapters.slice(-3).map(ch => `第${ch.number}章《${ch.title}》：${ch.summary || '暂无概要'}`).join('\n');
        
        const storyGenre = (localStorage.getItem('storyforge_story_genre') as StoryGenre) || 'none';
        const genreNames: Record<StoryGenre, string> = {
          'none': '',
          'wuxia': '武侠',
          'xianxia': '修真',
          'apocalypse': '末日',
          'urban': '都市',
          'historical': '历史',
          'sci-fi': '科幻',
          'supernatural': '异能'
        };
        const genreNote = storyGenre !== 'none' ? `\n\n**注意**：当前故事题材为${genreNames[storyGenre]}，请根据${genreNames[storyGenre]}题材的特点和惯例来创作。` : '';
        
        if (isDirectWriteMode) {
          // 直写正文模式：AI先写正文，再写章纲，一次请求返回所有内容
          console.log(`⚠️ 章节 ${chapterNum} 不存在，使用直写正文模式（一次请求：先写正文，再写章纲，返回全部内容）...`);
          
          prompt = `请为第${chapterNum}章生成正文。

**故事信息：**
- 标题：${storyTitle}
- 简介：${storySynopsis}
${recentChapters ? `\n**最近章节：**\n${recentChapters}` : ''}

${genreNote}

**要求：**
1. **先写正文，再写章纲**：直接生成完整的正文内容，然后根据正文总结详细章纲
2. 根据故事的整体发展和前面章节的逻辑，创作第${chapterNum}章

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchemaFlag ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchemaFlag ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

${getAutoWriteToolCallInstructions(chapterNum, useJsonSchemaFlag, targetWordCount)}`;
        } else if (isDesignOutlineMode) {
          // 设计章纲模式：只生成章纲，禁止生成正文
          console.log(`⚠️ 章节 ${chapterNum} 不存在，使用设计章纲模式（只生成章纲，禁止生成正文）...`);
          
          prompt = `请为第${chapterNum}章设计详细章纲。

**故事信息：**
- 标题：${storyTitle}
- 简介：${storySynopsis}
${recentChapters ? `\n**最近章节：**\n${recentChapters}` : ''}

${genreNote}

**要求（设计章纲模式）：**
1. **只生成章纲，禁止生成正文**：
   - 根据故事的整体发展和前面章节的逻辑，创作第${chapterNum}章的详细章纲（500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点）
   - **绝对禁止**生成正文内容
   - **绝对禁止**调用 update_storyboard 工具（该工具会生成正文）
2. **必须调用 add_chapter 工具保存章纲**：生成章纲后，必须调用 add_chapter 工具保存

**章纲要求**：
- 字数要求：500-1500字（最少500字，建议800-1500字）
- 必须包含以下要素：
  * 剧情任务（本章要完成什么）
  * 情节细节（发生了什么）
  * 角色关系变化（角色间关系如何发展）
  * 伏笔悬念（埋下了什么伏笔）
  * 情绪曲线（情绪如何起伏）
  * 关键信息点（揭示了什么重要信息）

${getDesignOutlineToolCallInstructions(chapterNum, useJsonSchemaFlag)}`;
        } else {
          // 默认模式：也使用一次请求返回所有内容
          console.log(`⚠️ 章节 ${chapterNum} 不存在，使用默认模式（一次请求返回全部内容）...`);
          
          prompt = `请为第${chapterNum}章生成正文。

**故事信息：**
- 标题：${storyTitle}
- 简介：${storySynopsis}
${recentChapters ? `\n**最近章节：**\n${recentChapters}` : ''}

${genreNote}

**要求：**
1. 根据故事的整体发展和前面章节的逻辑，创作第${chapterNum}章

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${useJsonSchemaFlag ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${useJsonSchemaFlag ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

${getAutoWriteToolCallInstructions(chapterNum, useJsonSchemaFlag, targetWordCount)}`;
        }
      } else {
        // 章节存在
        if (isDesignOutlineMode) {
          // 设计章纲模式：只生成章纲，使用 buildChapterOutlinePrompt 的逻辑
          console.log(`📖 找到章节: 第${chapterNum}章《${chapter.title}》，使用设计章纲模式...`);
          prompt = buildChapterOutlinePrompt(chapterNum);
        } else {
          // 其他模式：使用标准的提示词生成函数
          console.log(`📖 找到章节: 第${chapterNum}章《${chapter.title}》`);
          prompt = buildChapterManuscriptPrompt(chapter, useJsonSchemaFlag);
        }
      }
      
      if (!prompt) {
        console.error(`❌ 无法生成提示词，章节: ${chapterNum}`);
        setAutoWriteEnabled(false);
        autoWriteEnabledRef.current = false;
        setAutoWriteCurrentChapter(0);
        return;
      }
      
      try {
        console.log(`📤 发送消息到 AI，章节: ${chapterNum}`);
        console.log(`📝 提示词: ${prompt.substring(0, 100)}...`);
        
        // 记录发送前的章节状态
        const latestSessionBefore = sessions.find(s => s.id === activeSession.id);
        const chapterBefore = latestSessionBefore?.story.outline.find(ch => ch.number === chapterNum);
        const hasChapterBefore = !!chapterBefore;
        
        await sendMessage(prompt, {
          mode: isDesignOutlineMode ? 'general' : 'manuscript', // 设计章纲模式使用 general，其他使用 manuscript
          isSilentOperation: false, // 改为 false，让用户能看到消息
          silentOperationInfo: {
            chapterNumber: chapterNum,
            operationType: 'write'
          },
          skipAddingToMessages: false // 显示在聊天窗口，让用户能看到进度
        });
        console.log(`✅ 第 ${chapterNum} 章已发送，等待 AI 响应和状态更新...`);
        
        // 等待 AI 完成生成和状态更新（React 状态更新是异步的）
        // 首先检查工具调用成功标记，然后验证状态
        let verificationPassed = false;
        const maxWaitTime = 10000; // 10 秒
        const checkInterval = 500; // 每 500ms 检查一次
        const maxChecks = maxWaitTime / checkInterval;
        let checkCount = 0;
        
        // 获取工具调用成功标记
        const toolCallSuccessMarkers = (window as any).__toolCallSuccessMarkers as Map<string, { chapterNumber?: number; success: boolean; timestamp: number }> | undefined;
        const markerKey = `chapter_${chapterNum}`;
        
        // 记录标记的初始状态（用于检测标记是否被删除）
        const hadMarkerInitially = toolCallSuccessMarkers?.has(markerKey) || false;
        
        while (checkCount < maxChecks && !verificationPassed) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          checkCount++;
          
          // 检查是否应该继续（可能在等待期间被停止了）
          if (!autoWriteEnabledRef.current) {
            console.log('⏹️ 自动写在等待期间被停止');
            return;
          }
          
          // 方法1：检查工具调用成功标记（最可靠）
          if (toolCallSuccessMarkers) {
            const marker = toolCallSuccessMarkers.get(markerKey);
            
            // 如果标记被删除了（说明工具调用失败），立即停止
            if (hadMarkerInitially && !marker) {
              console.error(`❌ 章节 ${chapterNum} 工具调用失败：标记已被删除（工具调用失败）`);
              setAutoWriteEnabled(false);
              autoWriteEnabledRef.current = false;
              setAutoWriteCurrentChapter(0);
              return; // 停止自动写流程
            }
            
            if (marker && marker.success) {
              console.log(`✅ 章节 ${chapterNum} 工具调用成功标记已确认`);
              verificationPassed = true;
              // 清理标记
              toolCallSuccessMarkers.delete(markerKey);
              break;
            }
          }
          
          // 方法2：检查状态更新（作为备选验证）
          const latestSessionAfter = sessions.find(s => s.id === activeSession.id);
          if (!latestSessionAfter) {
            continue; // 会话不存在，继续等待
          }
          
          const chapterAfter = latestSessionAfter.story.outline.find(ch => ch.number === chapterNum);
          const hasChapterAfter = !!chapterAfter;
          
          // 对于不存在的章节，应该被创建
          if (!hasChapterBefore && hasChapterAfter) {
            // 章节已创建，检查是否有内容（对于非设计章纲模式）
            if (!isDesignOutlineMode) {
              const hasNewContent = chapterAfter.contentVersions && 
                chapterAfter.contentVersions.some(v => v.text && v.text.trim().length > 0);
              if (hasNewContent) {
                verificationPassed = true;
                console.log(`✅ 章节 ${chapterNum} 验证成功：已创建并包含内容`);
                // 清理标记（如果存在）
                if (toolCallSuccessMarkers) {
                  toolCallSuccessMarkers.delete(markerKey);
                }
                break;
              }
            } else {
              // 设计章纲模式，只要有章节即可
              verificationPassed = true;
              console.log(`✅ 章节 ${chapterNum} 验证成功：已创建`);
              if (toolCallSuccessMarkers) {
                toolCallSuccessMarkers.delete(markerKey);
              }
              break;
            }
          } else if (hasChapterBefore && hasChapterAfter) {
            // 章节已存在，检查是否有新的内容版本（对于直写正文模式）
            if (!isDesignOutlineMode) {
              const hasNewContent = chapterAfter.contentVersions && 
                chapterAfter.contentVersions.some(v => v.text && v.text.trim().length > 0);
              if (hasNewContent) {
                verificationPassed = true;
                console.log(`✅ 章节 ${chapterNum} 验证成功：已更新并包含内容`);
                if (toolCallSuccessMarkers) {
                  toolCallSuccessMarkers.delete(markerKey);
                }
                break;
              }
            } else {
              // 设计章纲模式，只要有章节即可
              verificationPassed = true;
              console.log(`✅ 章节 ${chapterNum} 验证成功：已更新`);
              if (toolCallSuccessMarkers) {
                toolCallSuccessMarkers.delete(markerKey);
              }
              break;
            }
          }
        }
        
        // 如果验证失败，检查是否真的失败
        if (!verificationPassed) {
          // 检查工具调用标记
          const marker = toolCallSuccessMarkers?.get(markerKey);
          
          if (marker && marker.success) {
            // 标记显示成功，但状态还没更新，这是正常的（状态更新延迟）
            console.log(`ℹ️ 章节 ${chapterNum} 工具调用已成功，但状态更新可能延迟（这是正常的）`);
            toolCallSuccessMarkers.delete(markerKey);
            verificationPassed = true; // 标记为成功，因为工具调用确实成功了
          } else {
            // 检查标记状态
            let toolCallFailed = false;
            let failureReason = '';
            
            if (hadMarkerInitially && !marker) {
              // 标记被删除了，说明工具调用失败（参数验证失败或执行异常）
              failureReason = `标记已被删除（工具调用失败）`;
              toolCallFailed = true;
            } else if (!hadMarkerInitially) {
              // 标记从未创建，可能是 JSON 解析失败，根本没有调用工具
              failureReason = `标记从未创建（可能 JSON 解析失败，工具未被调用）`;
              toolCallFailed = true;
            } else {
              // 标记存在但 success 为 false，检查状态更新
              const latestSessionAfter = sessions.find(s => s.id === activeSession.id);
              const chapterAfter = latestSessionAfter?.story.outline.find(ch => ch.number === chapterNum);
              
              if (!chapterAfter) {
                // 章节未创建，工具调用失败
                failureReason = `在 ${maxWaitTime/1000} 秒内未检测到章节创建`;
                toolCallFailed = true;
              } else if (!isDesignOutlineMode) {
                // 检查是否有内容
                const hasNewContent = chapterAfter.contentVersions && 
                  chapterAfter.contentVersions.some(v => v.text && v.text.trim().length > 0);
                if (!hasNewContent) {
                  failureReason = `在 ${maxWaitTime/1000} 秒内未检测到内容更新`;
                  toolCallFailed = true;
                }
              }
            }
            
            // 清理标记
            if (toolCallSuccessMarkers) {
              toolCallSuccessMarkers.delete(markerKey);
            }
            
            // 如果工具调用失败，停止自动写
            if (toolCallFailed) {
              console.error(`❌ 章节 ${chapterNum} 工具调用失败：${failureReason}`);
              console.error(`🛑 自动写已停止：章节 ${chapterNum} 工具调用失败`);
              setAutoWriteEnabled(false);
              autoWriteEnabledRef.current = false;
              setAutoWriteCurrentChapter(0);
              return; // 停止自动写流程
            }
          }
        }
        
        // 等待冷却时间
        if (autoWriteCooldownDuration > 0) {
          console.log(`⏱️ 等待冷却时间 ${autoWriteCooldownDuration} 秒...`);
          setAutoWriteCooldown(autoWriteCooldownDuration);
          const cooldownInterval = setInterval(() => {
            // 检查是否应该停止
            if (!autoWriteEnabledRef.current) {
              clearInterval(cooldownInterval);
              setAutoWriteCooldown(0);
              return;
            }
            setAutoWriteCooldown(prev => {
              if (prev <= 1) {
                clearInterval(cooldownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          await new Promise(resolve => setTimeout(resolve, autoWriteCooldownDuration * 1000));
          clearInterval(cooldownInterval);
          setAutoWriteCooldown(0);
        }
        
        // 检查是否应该继续（可能在冷却期间被停止了）
        if (!autoWriteEnabledRef.current) {
          console.log('⏹️ 自动写在冷却期间被停止');
          return;
        }
        
        // 继续下一章
        await writeNextChapter(chapterNum + 1, totalChapters, originalStartChapter);
      } catch (error) {
        console.error('❌ 自动写错误:', error);
        // 遇到错误，停止自动写
        setAutoWriteEnabled(false);
        autoWriteEnabledRef.current = false;
        setAutoWriteCurrentChapter(0);
        setAutoWriteCooldown(0);
        // 不继续下一章，直接返回
        return;
      }
    };
    
    await writeNextChapter(actualStartChapter, autoWriteChapters, actualStartChapter);
  }, [activeSession, apiConfig, autoWriteChapters, autoWriteCooldownDuration, sendMessage, sessions]);

  const handleStopAutoWrite = useCallback(() => {
    console.log('⏹️ 停止自动写');
    setAutoWriteEnabled(false);
    autoWriteEnabledRef.current = false;
    setAutoWriteCurrentChapter(0);
    setAutoWriteCooldown(0);
    if (autoWriteTimerRef.current) {
      clearTimeout(autoWriteTimerRef.current);
      autoWriteTimerRef.current = null;
    }
    if (autoWriteCooldownTimerRef.current) {
      clearInterval(autoWriteCooldownTimerRef.current);
      autoWriteCooldownTimerRef.current = null;
    }
  }, []);

  // Save auto write settings to localStorage
  useEffect(() => {
    localStorage.setItem('storyforge_auto_write_chapters', autoWriteChapters.toString());
  }, [autoWriteChapters]);

  useEffect(() => {
    localStorage.setItem('storyforge_auto_write_cooldown', autoWriteCooldownDuration.toString());
  }, [autoWriteCooldownDuration]);

  // Manual save content to chapter
  const handleManualSaveToChapter = useCallback((content: string, chapterNumber: number, volumeNumber?: number, createNewVersion: boolean = false) => {
    if (!activeSession) return;
    
    const effectiveSessionId = activeSession.id;
    
    // Use the same logic as update_chapter_content tool
    setSessions(prev => prev.map(s => {
      if (s.id === effectiveSessionId) {
        const story = s.story;
        
        // Find chapter
        let chIdx = -1;
        if (volumeNumber !== undefined) {
          const vol = story.volumes.find(v => v.number === Number(volumeNumber));
          if (vol) {
            chIdx = story.outline.findIndex(c => c.number === Number(chapterNumber) && c.volumeId === vol.id);
          }
        }
        
        if (chIdx === -1) {
          chIdx = story.outline.findIndex(c => c.number === Number(chapterNumber));
        }
        
        if (chIdx === -1) {
          console.error("❌ Chapter not found:", chapterNumber, volumeNumber);
          return s;
        }
        
        const chapter = { 
          ...story.outline[chIdx],
          contentVersions: story.outline[chIdx].contentVersions ? [...story.outline[chIdx].contentVersions] : []
        };
        
        // Ensure contentVersions exists
        if (!chapter.contentVersions || chapter.contentVersions.length === 0) {
          const initialVerId = uuidv4();
          chapter.contentVersions = [{
            id: initialVerId,
            versionName: "初始草稿",
            timestamp: Date.now(),
            text: "",
            isContext: true
          }];
          chapter.activeVersionId = initialVerId;
        }
        
        if (createNewVersion) {
          // Create new version
          const newVerId = uuidv4();
          const now = new Date();
          const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const newVer: ContentVersion = {
            id: newVerId,
            versionName: `手动保存 ${timeStr}`,
            timestamp: Date.now(),
            text: content,
            isContext: true,
            modelId: apiConfig?.modelId // 保存生成此版本时使用的模型ID（手动保存可能没有模型）
          };
          
          // Set previous active version's isContext to false
          const updatedVersions = chapter.contentVersions.map(v => ({
            ...v,
            isContext: v.id === chapter.activeVersionId ? false : v.isContext
          }));
          
          chapter.contentVersions = [...updatedVersions, newVer];
          chapter.activeVersionId = newVerId;
        } else {
          // Update current active version
          const currentActiveVersion = chapter.contentVersions.find(v => v.id === chapter.activeVersionId);
          if (currentActiveVersion) {
            const verIdx = chapter.contentVersions.findIndex(v => v.id === chapter.activeVersionId);
            if (verIdx >= 0) {
              const updatedVersions = [...chapter.contentVersions];
              updatedVersions[verIdx] = { 
                ...updatedVersions[verIdx], 
                text: content, 
                timestamp: Date.now() 
              };
              chapter.contentVersions = updatedVersions;
            }
          } else {
            // Create new version if none exists
            const newVerId = uuidv4();
            const newVer: ContentVersion = {
              id: newVerId,
              versionName: "手动保存",
              timestamp: Date.now(),
              text: content,
              isContext: true
            };
            chapter.contentVersions = [...chapter.contentVersions, newVer];
            chapter.activeVersionId = newVerId;
          }
        }
        
        // Create new outline array
        const newOutline = story.outline.map((ch, idx) => {
          if (idx === chIdx) {
            return { 
              ...chapter,
              contentVersions: [...chapter.contentVersions]
            };
          }
          return ch;
        });
        
        console.log("✅ Manual save completed:", {
          chapterNumber,
          volumeNumber,
          contentLength: content.length,
          versionsCount: chapter.contentVersions.length,
          createNewVersion
        });
        
        return { ...s, story: { ...story, outline: newOutline }, lastUpdated: Date.now() };
      }
      return s;
    }));
  }, [activeSession]);

  const handleContinue = useCallback((messageId: string) => {
    if (!activeSession) return;
    
    // Find the stopped message
    const stoppedMessage = activeSession.messages.find(m => m.id === messageId);
    if (!stoppedMessage || !stoppedMessage.isStopped) return;
    
    // Find the user message that triggered this response
    const messageIndex = activeSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Find the previous user message
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (activeSession.messages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }
    
    if (userMessageIndex === -1) return;
    
    const originalUserMessage = activeSession.messages[userMessageIndex].text;
    const partialContent = stoppedMessage.text;
    
    // Create continuation prompt
    const continuationPrompt = `请继续完成之前的回答。已生成的内容如下：\n\n${partialContent}\n\n请继续生成剩余内容。`;
    
    // Remove the stopped message and send continuation
    const historyBeforeStopped = activeSession.messages.slice(0, messageIndex);
    sendMessage(continuationPrompt, undefined, historyBeforeStopped);
  }, [activeSession, sendMessage]);

  // Show loading only during initial restoration (with timeout)
  const [isInitializing, setIsInitializing] = useState(true);
  
  useEffect(() => {
    // Set initialization complete after a short delay
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  if ((isInitializing && isRestoring.current) || !activeSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <span className="animate-pulse">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    // Use fixed inset-0 to prevent viewport issues on mobile, flex row for desktop
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 text-slate-200 font-sans flex">
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
        onSave={(config) => { 
            setApiConfig(config); 
            // Also reload saved list to get updated configs with availableModels
            const savedConfigsStr = localStorage.getItem('storyforge_saved_api_configs');
            let finalConfig = config;
            if (savedConfigsStr) {
                const updatedConfigs = JSON.parse(savedConfigsStr);
                setSavedConfigs(updatedConfigs);
                // Update current config if it matches the saved one
                const matchingConfig = updatedConfigs.find((c: ApiConfig) => 
                    c.name === config.name || 
                    (c.apiKey === config.apiKey && c.provider === config.provider && c.baseUrl === config.baseUrl)
                );
                if (matchingConfig) {
                    finalConfig = matchingConfig;
                    setApiConfig(matchingConfig);
                    localStorage.setItem('storyforge_api_config', JSON.stringify(matchingConfig));
                }
            }
            
            // Also update the current session's apiConfig so it persists after refresh
            if (currentSessionId) {
                setSessions(prev => prev.map(s => 
                    s.id === currentSessionId 
                        ? { ...s, apiConfig: finalConfig, lastUpdated: Date.now() }
                        : s
                ));
            }
            
            setIsApiKeyModalOpen(false); 
        }} 
        forced={!apiConfig?.apiKey}
        savedConfigs={savedConfigs}
        currentConfig={apiConfig}
        onExportApiConfigs={handleExportApiConfigs}
        onImportApiConfigs={handleImportApiConfigs}
        onDeleteConfig={(index) => {
            const newConfigs = [...savedConfigs];
            newConfigs.splice(index, 1);
            setSavedConfigs(newConfigs);
            localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(newConfigs));
            // If deleted config was the current one, clear it
            if (apiConfig && savedConfigs[index]?.name === apiConfig.name) {
                setApiConfig(null);
                localStorage.removeItem('storyforge_api_config');
            }
        }}
      />

      <SessionSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        sessions={sessions}
        currentSessionId={activeSession.id}
        onSelectSession={(id) => { 
            const selectedSession = sessions.find(s => s.id === id);
            if (selectedSession) {
                setCurrentSessionId(id);
                // Load API config from session if available
                if (selectedSession.apiConfig) {
                    setApiConfig(selectedSession.apiConfig);
                    localStorage.setItem('storyforge_api_config', JSON.stringify(selectedSession.apiConfig));
                }
            }
            if (window.innerWidth < 1280) setSidebarOpen(false);
        }}
        onCreateSession={createNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onExportSessions={handleExportSessions}
        onExportSingleSession={handleExportSingleSession}
        onImportSessions={handleImportSessions}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Mobile Tab Navigation - 移动端标签页导航（固定在顶部） */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[50] flex border-b-2 border-slate-700 bg-slate-900 shadow-lg">
        <button
          onClick={() => setMobileActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all ${
            mobileActiveTab === 'chat'
              ? 'text-purple-400 bg-slate-800/80 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-200 active:bg-slate-800/50'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>聊天</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('storyboard')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all ${
            mobileActiveTab === 'storyboard'
              ? 'text-purple-400 bg-slate-800/80 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-200 active:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>故事板</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row h-full relative z-0 min-w-0 pt-[52px] md:pt-0">

        {/* Chat Interface - 移动端根据标签页显示/隐藏 */}
        <div className={`w-full md:w-[320px] lg:w-[420px] ${mobileActiveTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col border-r border-slate-800 relative z-10 shadow-2xl flex-1 md:flex-none md:h-full h-full min-h-0`}>
            <ChatInterface 
              messages={activeSession.messages} 
              onSendMessage={sendMessage}
              isLoading={isLoading}
              
              currentConfig={apiConfig}
              savedConfigs={savedConfigs}
              onConfigSelect={handleConfigSelect}
              onModelIdChange={handleModelIdChange}

              onToggleSidebar={() => setSidebarOpen(true)}
              targetWordCount={targetWordCount}
              onSetTargetWordCount={setTargetWordCount}
              maxHistoryForAI={maxHistoryForAI}
              onSetMaxHistoryForAI={setMaxHistoryForAI}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onRegenerate={handleRegenerate}
              onReAnswerUser={handleReAnswerUser}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              getPromptContext={getPromptContext}
              onStop={handleStop}
              onContinue={handleContinue}
              story={activeSession.story}
              onManualSaveToChapter={handleManualSaveToChapter}
              temperature={temperature}
              onSetTemperature={setTemperature}
              enableStreaming={enableStreaming}
              onSetEnableStreaming={setEnableStreaming}
              autoWriteEnabled={autoWriteEnabled}
              onSetAutoWriteEnabled={setAutoWriteEnabled}
              autoWriteChapters={autoWriteChapters}
              onSetAutoWriteChapters={setAutoWriteChapters}
              autoWriteCooldownDuration={autoWriteCooldownDuration}
              onSetAutoWriteCooldownDuration={setAutoWriteCooldownDuration}
              autoWriteCurrentChapter={autoWriteCurrentChapter}
              onSetAutoWriteCurrentChapter={setAutoWriteCurrentChapter}
              autoWriteCooldown={autoWriteCooldown}
              onStartAutoWrite={handleStartAutoWrite}
              onStopAutoWrite={handleStopAutoWrite}
            />
         </div>

         {/* Story Board - 移动端根据标签页显示/隐藏 */}
         <div className={`flex-1 ${mobileActiveTab === 'storyboard' ? 'flex' : 'hidden'} md:flex overflow-hidden bg-slate-950 relative z-0`}>
            <StoryBoard 
              story={activeSession.story} 
              onUpdateStory={handleUpdateStory} 
              onSendMessage={sendMessage}
              onExportWritingGuidelines={handleExportWritingGuidelines}
              targetWordCount={targetWordCount}
              onSetTargetWordCount={setTargetWordCount}
              getPromptContext={(msg?: string) => getPromptContext(msg)}
              enableStreaming={enableStreaming}
              apiConfig={apiConfig}
            />
         </div>
      </div>
      
      {/* 重新生成确认弹窗 */}
      {showRegenerateConfirmModal && pendingRegenerateInfo && (() => {
        const promptContext = getPromptContext(pendingRegenerateInfo.userMessage.text);
        const contextData = (promptContext.context || {}) as {
          title?: string;
          synopsis?: string;
          blueprint?: any;
          volumes?: any[];
          chapters?: string;
          characters?: string;
          worldSettings?: string;
          writingGuidelines?: string;
        };
        return (
          <PromptConfirmModal
            isOpen={showRegenerateConfirmModal}
            onClose={handleRegenerateCancelSend}
            onConfirm={handleRegenerateConfirmSend}
            userMessage={pendingRegenerateInfo.userMessage.text}
            systemInstruction={promptContext.systemInstruction || ''}
            context={{
              title: contextData.title || '',
              synopsis: contextData.synopsis || '',
              blueprint: contextData.blueprint,
              volumes: contextData.volumes,
              chapters: contextData.chapters,
              characters: contextData.characters,
              worldSettings: contextData.worldSettings,
              writingGuidelines: contextData.writingGuidelines
            }}
            history={pendingRegenerateInfo.historyOverride || promptContext.history || []}
          />
        );
      })()}
    </div>
  );
};

export default App;
