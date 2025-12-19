
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StoryState, Character, Chapter, WorldEntry, Volume, ContentVersion, WritingGuideline, SendMessageOptions, MessageMode, StructureBeat, Blueprint, BeatVersionState, WritingMethod, StoryGenre, StoryBible, ApiConfig } from '../types';
import { BookOpen, Users, GitMerge, List, Tag, Copy, Check, PenLine, Plus, Trash2, Globe, Info, History, Layers, Quote, FileText, ChevronRight, AlignLeft, Feather, Sparkles, RefreshCw, MoreVertical, X, Download, Upload, Play, Power, Eye, Save, ZoomIn, ZoomOut, RotateCcw, Type, Search, Loader2, Wand2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import PromptConfirmModal from './PromptConfirmModal';

interface StoryBoardProps {
  story: StoryState;
  onUpdateStory: (story: StoryState) => void;
  onSendMessage?: (text: string, options?: SendMessageOptions) => void; // For triggering AI actions
  onExportWritingGuidelines?: () => void; // For exporting writing guidelines
  targetWordCount?: number;
  onSetTargetWordCount?: (count: number) => void;
  getPromptContext?: (userMessage?: string) => any; // For prompt confirmation modal
  onSilentRewrite?: (prompt: string, chapterNumber: number, volumeNumber?: number, systemContent?: string) => Promise<void>; // Silent rewrite without showing in chat
  rewriteContextBefore?: number; // Number of previous chapters to include in rewrite context
  rewriteContextAfter?: number; // Number of next chapters to include in rewrite context
  
  // 临时对话窗口需要的 props
  apiConfig?: ApiConfig | null;
  toolsList?: any[];
  temperature?: number;
  enableStreaming?: boolean;
  removeContextLimit?: boolean;
  contextLength?: number;
  maxResponseLength?: number;
  useModelDefaults?: boolean;
  onManualSaveToChapter?: (content: string, chapterNumber: number, volumeNumber?: number, createNewVersion?: boolean) => void;
}

type Tab = 'overview' | 'characters' | 'structure' | 'outline' | 'manuscript' | 'settings' | 'guide' | 'tools';

const STRUCTURE_BEAT_META: { key: StructureBeat; title: string; step: string; color: string }[] = [
  { key: 'hook', title: '1. 开篇 / 悬念', step: '1', color: 'bg-emerald-500' },
  { key: 'incitingIncident', title: '2. 激励事件', step: '2', color: 'bg-blue-500' },
  { key: 'risingAction', title: '3. 上升动作', step: '3', color: 'bg-indigo-500' },
  { key: 'climax', title: '4. 高潮', step: '4', color: 'bg-purple-500' },
  { key: 'fallingAction', title: '5. 下降动作', step: '5', color: 'bg-pink-500' },
  { key: 'resolution', title: '6. 结局', step: '6', color: 'bg-rose-500' }
];

const StoryBoard: React.FC<StoryBoardProps> = ({ 
  story, 
  onUpdateStory, 
  onSendMessage, 
  onExportWritingGuidelines, 
  targetWordCount = 2000, 
  onSetTargetWordCount, 
  getPromptContext, 
  onSilentRewrite, 
  rewriteContextBefore = 3, 
  rewriteContextAfter = 3,
  apiConfig = null,
  toolsList = [],
  temperature = 0.7,
  enableStreaming = false,
  removeContextLimit = false,
  contextLength,
  maxResponseLength,
  useModelDefaults = false,
  onManualSaveToChapter
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterMenuOpen, setChapterMenuOpen] = useState<string | null>(null); // Track which chapter menu is open
  const [outlineChapterMenuOpen, setOutlineChapterMenuOpen] = useState<string | null>(null); // Track outline chapter menu
  const [editingChapterTitleId, setEditingChapterTitleId] = useState<string | null>(null); // Track which chapter title is being edited
  const [editingChapterTitle, setEditingChapterTitle] = useState<string>(''); // Temporary title value during editing
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set()); // Track selected chapters for batch deletion
  const [selectedOutlineChapterIds, setSelectedOutlineChapterIds] = useState<Set<string>>(new Set()); // Track selected chapters for batch export in outline tab
  const [selectedManuscriptChapterIds, setSelectedManuscriptChapterIds] = useState<Set<string>>(new Set()); // Track selected chapters for batch export in manuscript tab
  const [exportManuscriptAsSingleFile, setExportManuscriptAsSingleFile] = useState<boolean>(true); // Whether to export manuscript as single file or multiple files
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const outlineMenuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initializedVersionsRef = useRef<Set<string>>(new Set()); // Track which versions have been initialized with context flags
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('storyforge_manuscript_font_size');
    return saved ? parseInt(saved, 10) : 18; // Default 18px (text-lg)
  });
  const [outlineFontSize, setOutlineFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('storyforge_outline_font_size');
    return saved ? parseInt(saved, 10) : 14; // Default 14px for outline
  });
  const [manuscriptFontFamily, setManuscriptFontFamily] = useState<'serif' | 'sans-serif'>(() => {
    const saved = localStorage.getItem('storyforge_manuscript_font_family');
    return (saved === 'serif' || saved === 'sans-serif') ? saved : 'serif'; // Default serif
  });
  const [useDetailedOutlineExtraction, setUseDetailedOutlineExtraction] = useState<boolean>(() => {
    const saved = localStorage.getItem('storyforge_detailed_outline_extraction');
    return saved === 'true'; // Default false (简洁版)
  });
  
  // 静默操作状态（用于跟踪正在进行的静默操作）
  const [silentOperationInfo, setSilentOperationInfo] = useState<{
    chapterNumber: number;
    volumeNumber?: number;
    operationType: 'write' | 'rewrite' | 'extract';
  } | null>(null);
  
  const [isEditingManuscript, setIsEditingManuscript] = useState(false);
  const [manuscriptDraft, setManuscriptDraft] = useState('');
  const manuscriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const manuscriptDisplayRef = useRef<HTMLDivElement | null>(null);
  const manuscriptScrollPositionRef = useRef<number>(0);
  const [writingMethod, setWritingMethod] = useState<WritingMethod>(() => {
    const saved = localStorage.getItem('storyforge_writing_method');
    if (saved === 'fanwen_resonance_4step' || saved === 'fanwen_style_imitation' || saved === 'reverse_outline' || saved === 'chat_only') return saved as WritingMethod;
    return 'default';
  });
  
  // 逆推章节细纲相关状态
  const [reverseOutlineMode, setReverseOutlineMode] = useState(false);
  const [endingDescription, setEndingDescription] = useState('');
  const [reverseOutliningChapter, setReverseOutliningChapter] = useState<Chapter | null>(null);
  
  // 文风选择（从 localStorage 读取，与 ChatInterface 同步）
  // 作家信息已在 App.tsx 的系统提示词中处理，此处不再需要
  
  // Prompt confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [pendingOptions, setPendingOptions] = useState<SendMessageOptions | undefined>(undefined);
  const [pendingRewriteInfo, setPendingRewriteInfo] = useState<{ chapterNumber: number; volumeNumber?: number; systemContent?: string } | null>(null);
  
  // 故事圣经版本查看状态
  const [viewingBibleVersionIndex, setViewingBibleVersionIndex] = useState<number>(-1); // -1 表示查看最新版本
  
  // 叙事逆向拆解功能状态
  const [narrativeDeconstructionText, setNarrativeDeconstructionText] = useState<string>('');
  const [narrativeDeconstructionChapterNumber, setNarrativeDeconstructionChapterNumber] = useState<number | ''>('');
  const [narrativeDeconstructionLoading, setNarrativeDeconstructionLoading] = useState(false);
  const [narrativeDeconstructionResult, setNarrativeDeconstructionResult] = useState<string>('');
  const [narrativeDeconstructionFileLoading, setNarrativeDeconstructionFileLoading] = useState(false);
  const [narrativeDeconstructionFileProgress, setNarrativeDeconstructionFileProgress] = useState(0);
  const narrativeFileInputRef = useRef<HTMLInputElement>(null);
  
  // TXT 文档拆分工具状态
  const [splitDocumentText, setSplitDocumentText] = useState<string>('');
  const [splitDocumentLoading, setSplitDocumentLoading] = useState(false);
  const [splitDocumentResult, setSplitDocumentResult] = useState<string>('');
  const [splitDocumentFontSize, setSplitDocumentFontSize] = useState<number>(14);
  const [splitDocumentFileLoading, setSplitDocumentFileLoading] = useState(false);
  const [splitDocumentFileProgress, setSplitDocumentFileProgress] = useState(0);
  const splitDocumentFileInputRef = useRef<HTMLInputElement>(null);
  const splitDocumentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 调整拆分工具字体大小
  const handleSplitDocumentFontSizeChange = (delta: number) => {
      setSplitDocumentFontSize(prev => Math.max(10, Math.min(24, prev + delta)));
  };

  // 通用的TXT文件读取函数，支持多编码和大文件优化
  const readTextFileWithEncoding = async (
    file: File,
    onProgress?: (progress: number) => void,
    onComplete: (text: string) => void,
    onError: (error: string) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 检测文件大小，大文件使用分块处理
      const fileSize = file.size;
      const isLargeFile = fileSize > 2 * 1024 * 1024; // 2MB以上视为大文件
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      // 尝试的编码列表（按常见程度排序）
      const encodings: string[] = ['UTF-8', 'GBK', 'GB2312', 'Big5', 'Shift_JIS'];
      
      if (isLargeFile) {
        // 大文件：使用分块读取和进度显示
        let allChunks: Uint8Array[] = [];
        let loaded = 0;
        const totalChunks = Math.ceil(fileSize / chunkSize);
        
        const readChunk = (start: number, chunkIndex: number): Promise<void> => {
          return new Promise((chunkResolve, chunkReject) => {
            const blob = file.slice(start, start + chunkSize);
            const reader = new FileReader();
            
            reader.onload = (e) => {
              const result = e.target?.result;
              if (result instanceof ArrayBuffer) {
                allChunks.push(new Uint8Array(result));
                loaded += result.byteLength;
                const progress = Math.min(100, Math.round((loaded / fileSize) * 100));
                onProgress?.(progress);
                
                if (chunkIndex < totalChunks - 1) {
                  // 继续读取下一块
                  setTimeout(() => {
                    readChunk(start + chunkSize, chunkIndex + 1).then(chunkResolve).catch(chunkReject);
                  }, 10); // 给UI一个喘息的机会
                } else {
                  // 所有块读取完成，合并并解码
                  const combined = new Uint8Array(fileSize);
                  let offset = 0;
                  for (const chunk of allChunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                  }
                  
                  // 尝试不同编码
                  let decoded = false;
                  for (const encoding of encodings) {
                    try {
                      const decoder = new TextDecoder(encoding, { fatal: true });
                      const text = decoder.decode(combined);
                      onComplete(text);
                      decoded = true;
                      resolve();
                      break;
                    } catch (e) {
                      // 尝试下一个编码
                      continue;
                    }
                  }
                  
                  if (!decoded) {
                    // 如果所有编码都失败，使用UTF-8（宽松模式）
                    try {
                      const decoder = new TextDecoder('UTF-8', { fatal: false });
                      const text = decoder.decode(combined);
                      onComplete(text);
                      resolve();
                    } catch (e) {
                      onError('无法解码文件，请确保文件是有效的文本文件');
                      reject(new Error('解码失败'));
                    }
                  }
                }
              }
            };
            
            reader.onerror = () => {
              onError('文件读取失败');
              chunkReject(new Error('读取失败'));
            };
            
            reader.readAsArrayBuffer(blob);
          });
        };
        
        // 开始读取第一块
        readChunk(0, 0).catch(reject);
      } else {
        // 小文件：读取为ArrayBuffer，然后尝试不同编码
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const result = e.target?.result;
          if (result instanceof ArrayBuffer) {
            const uint8Array = new Uint8Array(result);
            let decoded = false;
            
            // 尝试不同编码
            for (const encoding of encodings) {
              try {
                const decoder = new TextDecoder(encoding, { fatal: true });
                const text = decoder.decode(uint8Array);
                // 检查是否包含大量替换字符（乱码标记）
                const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
                const replacementRatio = replacementCharCount / text.length;
                
                // 如果替换字符比例小于1%，认为解码成功
                if (replacementRatio < 0.01) {
                  onComplete(text);
                  decoded = true;
                  resolve();
                  break;
                }
              } catch (e) {
                // 解码失败，尝试下一个编码
                continue;
              }
            }
            
            if (!decoded) {
              // 如果所有编码都失败，使用UTF-8（宽松模式）
              try {
                const decoder = new TextDecoder('UTF-8', { fatal: false });
                const text = decoder.decode(uint8Array);
                onComplete(text);
                resolve();
              } catch (e) {
                onError('无法解码文件，请确保文件是有效的文本文件');
                reject(new Error('解码失败'));
              }
            }
          } else {
            onError('文件读取失败');
            reject(new Error('读取失败'));
          }
        };
        
        reader.onerror = () => {
          onError('文件读取失败');
          reject(new Error('读取失败'));
        };
        
        // 读取为ArrayBuffer
        reader.readAsArrayBuffer(file);
      }
    });
  };
  
  // 模板编辑状态（章节逆向拆解）
  const [activeBlueprintChapterNumber, setActiveBlueprintChapterNumber] = useState<number | null>(null);
  
  // 当切换到模板标签页时，默认选中第一个章节
  useEffect(() => {
    if (activeTab === 'structure' && !activeBlueprintChapterNumber && story.outline.length > 0) {
      setActiveBlueprintChapterNumber(story.outline[0].number);
    }
  }, [activeTab, activeBlueprintChapterNumber, story.outline.length]);
  
  // 跟踪当前 story 的标识，用于检测会话切换
  // 使用多个关键属性组合来唯一标识一个故事
  const currentStoryIdRef = useRef<string | null>(null);
  
  // 当 story 变化时（切换会话），重置 StoryBoard 的内部状态
  useEffect(() => {
    // 创建一个唯一标识符：使用 title + outline 长度 + 第一个和最后一个章节的 ID
    // 这样可以可靠地检测到会话切换
    const firstChapterId = story.outline.length > 0 ? story.outline[0].id : '';
    const lastChapterId = story.outline.length > 0 ? story.outline[story.outline.length - 1].id : '';
    const storyIdentifier = `${story.title}|${story.outline.length}|${firstChapterId}|${lastChapterId}`;
    
    // 如果 story 发生了变化（切换了会话），重置内部状态
    if (currentStoryIdRef.current !== null && currentStoryIdRef.current !== storyIdentifier) {
      console.log('📖 检测到会话切换，重置 StoryBoard 状态', {
        oldId: currentStoryIdRef.current,
        newId: storyIdentifier,
        storyTitle: story.title
      });
      // 重置选中的章节
      setActiveChapterId(null);
      // 重置菜单状态
      setChapterMenuOpen(null);
      setOutlineChapterMenuOpen(null);
      // 重置编辑状态
      setEditingChapterTitleId(null);
      setEditingChapterTitle('');
      setIsEditingManuscript(false);
      setManuscriptDraft('');
      // 重置版本初始化标记（新会话需要重新初始化）
      initializedVersionsRef.current.clear();
    }
    
    // 更新当前 story 标识
    currentStoryIdRef.current = storyIdentifier;
  }, [story.title, story.outline.length, story.outline]);

  const areWritingSamplesEnabled = () => {
    const enabled = localStorage.getItem('storyforge_writing_samples_enabled');
    return enabled !== 'false';
  };

  // Helper function to get selected writing samples content
  const getSelectedSamplesContent = (): string => {
    if (!areWritingSamplesEnabled()) return '';
    try {
      const saved = localStorage.getItem('storyforge_writing_samples');
      if (!saved) return '';
      const samples = JSON.parse(saved);
      const selected = samples.filter((s: any) => s.selected);
      if (selected.length === 0) return '';
      return selected.map((s: any) => `【${s.name}】\n${s.content}`).join('\n\n---\n\n');
    } catch (e) {
      return '';
    }
  };

  // 判断是否使用 JSON Schema 模式（根据 API 配置）
  const isUsingJsonSchema = (): boolean => {
    // 如果明确设置了 toolCallMode，使用设置的值
    if (apiConfig?.toolCallMode === 'json_schema') return true;
    if (apiConfig?.toolCallMode === 'function_calling') return false;
    
    // 默认策略：Google 直连使用 Function Calling，其他使用 JSON Schema
    const isGoogleDirect = apiConfig?.provider === 'google' && !apiConfig?.useProxy;
    return !isGoogleDirect;
  };

  // 根据工具调用模式生成工具调用说明
  const getToolCallInstructions = (chapterNumber: number, volumeNumber?: number): string => {
    const useJsonSchema = isUsingJsonSchema();
    const volParam = volumeNumber ? `\n- volumeNumber: ${volumeNumber}` : '';
    
    if (useJsonSchema) {
      // JSON Schema 模式：需要在文本中输出 JSON 代码块
      return `【🚨 工具调用指令 - JSON Schema 模式】
**生成正文后，必须在回复的最后输出一个 \`\`\`json 代码块来调用工具保存内容！**

**⚠️ 重要**：当前使用 JSON Schema 模式，你必须在回复最后添加以下格式的 JSON 代码块：

\`\`\`json
{"tool_calls": [{"name": "update_storyboard", "args": {
  "chapterNumber": ${chapterNumber},${volParam ? `\n  "volumeNumber": ${volumeNumber},` : ''}
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
| 参数名 | 说明 |
|--------|------|
| chapterNumber | 章节编号：${chapterNumber} |
| chapterTitle | 章节标题（必须是描述性标题，如"风起云涌"，不能只是"第X章"） |
| chapter_content | **完整的正文内容**（所有正文都必须放这里，不要放在 JSON 外面！） |
| chapter_outline | 章纲（500-1500字，包含剧情任务、情节细节、角色关系、伏笔悬念、情绪曲线） |
| updated_story_bible | 故事圣经更新（人物状态、物品地点、未解决伏笔） |
| createNewVersion | 设为 true |

**🚨🚨🚨 再次强调：没有 \`\`\`json 代码块 = 内容不会被保存！**`;
    } else {
      // Function Calling 模式：API 自动处理
      return `【🚨 工具调用指令 - 必须执行】
**生成正文后，必须立即调用 update_storyboard 工具保存，否则内容不会保存到故事板！**

**⚠️ 重要**：Function Calling是API自动处理的机制，你不需要在文本中写任何代码或JSON，API会自动调用工具。工具参数如下（这些是工具调用时需要提供的参数，不是你需要在文本中写的）：
- chapterNumber: ${chapterNumber}${volParam}
- chapterTitle: [从正文中提炼的章节标题，必须是有意义的标题，不能只是"第X章"]
- chapter_content: [生成的正文内容]
- chapter_outline: [根据正文总结的详细章纲，500-1500字，包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点]
- **updated_story_bible: [根据本章剧情更新故事圣经（🚨🚨🚨 绝对必需！）]**，包含：
  - character_status: 人物状态表（格式：[角色名]：[状态/位置/关键变化]，必须明确标记"已死"的角色）
  - key_items_and_locations: 物品与地点（关键道具的持有者变更、当前所在位置）
  - active_plot_threads: 当前未解决的伏笔（列出悬而未决的冲突或任务，已解决的请删除）
  - important_rules: 临时规则/备注（本章新增的、对后续剧情有长期影响的设定）
- createNewVersion: true

**🚨🚨🚨 绝对必需**：
1. **必须调用工具**：Function Calling是API自动处理的，你不需要在文本中写任何代码或描述。只需要让API自动调用 update_storyboard 工具即可。
2. **必须更新故事圣经（updated_story_bible 参数）**：根据本章发生的事件，更新人物状态、物品位置、未解决的伏笔等，确保后续章节的逻辑一致性！**这是强制要求，不是可选项！如果不提供 updated_story_bible 参数，章节内容将无法正确保存！**`;
    }
  };

  useEffect(() => {
    // 如果 activeChapterId 指向的章节在当前 story 中不存在，清除它
    if (activeChapterId && !story.outline.find(ch => ch.id === activeChapterId)) {
      console.log('📖 当前选中的章节不存在于新会话中，清除选中状态');
      setActiveChapterId(null);
      setManuscriptDraft('');
      setIsEditingManuscript(false);
      return;
    }
    
    const chapter = story.outline.find(ch => ch.id === activeChapterId);
    const version = chapter?.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter?.contentVersions?.[0];
    setManuscriptDraft(version?.text || '');
    setIsEditingManuscript(false);
  }, [activeChapterId, story.outline, story.volumes]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chapterMenuOpen) {
        const menuElement = menuRefs.current.get(chapterMenuOpen);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setChapterMenuOpen(null);
        }
      }
      if (outlineChapterMenuOpen) {
        const menuElement = outlineMenuRefs.current.get(outlineChapterMenuOpen);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOutlineChapterMenuOpen(null);
        }
      }
    };

    if (chapterMenuOpen || outlineChapterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [chapterMenuOpen, outlineChapterMenuOpen]);

  // Handle chapter title editing
  const handleStartEditTitle = (chapterId: string, currentTitle: string) => {
    setEditingChapterTitleId(chapterId);
    setEditingChapterTitle(currentTitle);
  };

  const handleSaveTitle = (chapterId: string) => {
    const chapter = story.outline.find(ch => ch.id === chapterId);
    if (!chapter) return;
    if (editingChapterTitle.trim()) {
      updateChapter({ ...chapter, title: editingChapterTitle.trim() });
    }
    setEditingChapterTitleId(null);
    setEditingChapterTitle('');
  };

  const handleCancelEditTitle = () => {
    setEditingChapterTitleId(null);
    setEditingChapterTitle('');
  };

  useEffect(() => {
    if (isEditingManuscript && manuscriptTextareaRef.current) {
      const el = manuscriptTextareaRef.current;
      el.focus();
      
      // 恢复之前保存的滚动位置，而不是滚动到末尾
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = manuscriptScrollPositionRef.current;
          // 不设置光标位置，保持用户当前查看的位置
        }
      });
    } else if (!isEditingManuscript && manuscriptDisplayRef.current) {
      // 保存当前滚动位置（从 textarea 切换到 div 时）
      if (manuscriptTextareaRef.current) {
        manuscriptScrollPositionRef.current = manuscriptTextareaRef.current.scrollTop;
      }
    }
  }, [isEditingManuscript]);

  useEffect(() => {
    const handleMethodChange = (event: Event) => {
      const detail = (event as CustomEvent<{ method?: WritingMethod }>).detail;
      if (detail?.method) {
        setWritingMethod(detail.method);
      }
    };
    const syncFromStorage = () => {
      const saved = localStorage.getItem('storyforge_writing_method');
      if (saved === 'fanwen_resonance_4step' || saved === 'fanwen_style_imitation' || saved === 'reverse_outline' || saved === 'default') {
        setWritingMethod(saved as WritingMethod);
      }
    };
    window.addEventListener('storyforge-writing-method-changed', handleMethodChange as EventListener);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('storyforge-writing-method-changed', handleMethodChange as EventListener);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  // 点击外部关闭章纲菜单
  useEffect(() => {
    if (!outlineChapterMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.outline-chapter-menu')) {
        setOutlineChapterMenuOpen(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [outlineChapterMenuOpen]);


  // Helper function to get samples prefix (before tool call instruction)
  const getSamplesPrefix = (): string => {
    const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) return '';
    return `\n\n【范文参考】\n${samplesContent}\n\n`;
  };

  // Helper function to get samples suffix (after tool call instruction)
  const getSamplesSuffix = (): string => {
    const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) return '';
    return `\n\n【范文参考】\n${samplesContent}\n\n`;
  };

  // Helper function to ensure samples exist in the prompt for any mode
  const injectSamplesIntoPrompt = (prompt: string, mode?: MessageMode): string => {
    // NOTE: For fanwen_style_imitation and fanwen_resonance_4step writing methods,
    // samples are now added to system instruction instead of user message to save tokens
    // So we skip insertion here to avoid duplication
    if (writingMethod === 'fanwen_style_imitation' || writingMethod === 'fanwen_resonance_4step') {
      return prompt;
    }
    
      const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) return prompt;
    if (prompt.includes('【范文参考】')) return prompt;

    if (mode === 'manuscript') {
      // Preserve existing behavior for manuscript prompts to avoid breaking tool instructions
        const toolCallPattern = /(\*\*重要.*?工具.*?\*\*|工具调用参数|update_storyboard|update_chapter_content|add_chapter)/;
        const match = prompt.search(toolCallPattern);
        
        if (match !== -1) {
          const beforeToolCall = prompt.substring(0, match);
          const afterToolCall = prompt.substring(match);
          const prefix = getSamplesPrefix();
          const suffix = getSamplesSuffix();
          const toolCallEndPattern = /(请确保.*?保存到故事板|否则内容不会保存|否则内容不会保存到故事板|请确保在生成.*?后立即调用工具)/;
          const endMatch = afterToolCall.search(toolCallEndPattern);
          
          if (endMatch !== -1) {
            const endIndex = endMatch + (afterToolCall.substring(endMatch).match(/[。\n]/)?.index || 0) + 1;
            const toolCallSection = afterToolCall.substring(0, endIndex);
            const afterToolCallSection = afterToolCall.substring(endIndex);
            return beforeToolCall + prefix + toolCallSection + suffix + afterToolCallSection;
        }
            return beforeToolCall + prefix + afterToolCall + suffix;
          }
          return getSamplesPrefix() + prompt + getSamplesSuffix();
        }

    // For non-manuscript prompts, simply prepend the samples block
    return `${getSamplesPrefix()}${prompt}`;
  };

  // 作家信息已在 App.tsx 的系统提示词中处理，此处不再需要生成文风提示词块

  const getFanwenSamplesBlock = () => {
    const samples = getSelectedSamplesContent();
    if (!samples) {
      return '【范文参考】\n（当前未勾选范文，可依照本方法自行发挥。）\n';
    }
    return `【范文参考】\n${samples}`;
  };

  const buildFanwenVolumeOutlinePrompt = (vol: Volume, existingChaptersText: string) => {
    const samplesBlock = getFanwenSamplesBlock();
    // 作家信息已在 App.tsx 的系统提示词中处理
    const existingSection = existingChaptersText 
      ? `已有章节：\n${existingChaptersText}\n`
      : '';
    return `请为第${vol.number}卷《${vol.title}》生成或扩写章纲。${existingSection ? `\n\n${existingSection}` : ''}

${samplesBlock}

【工具指令】
生成后请逐章调用 add_chapter 工具，确保 volumeNumber = ${vol.number}。`;
  };

  const buildDefaultVolumeOutlinePrompt = (vol: Volume, existingChaptersText: string) => {
    const samplesBlock = getFanwenSamplesBlock();
    // 作家信息已在 App.tsx 的系统提示词中处理
    return `请为第${vol.number}卷《${vol.title}》生成或扩写章纲。${existingChaptersText ? `\n\n已有章节：\n${existingChaptersText}\n\n请在此基础上继续添加新章节，或扩展现有章节的概要。` : '\n\n请为本卷创建完整的章纲。'}

${samplesBlock}

【工具指令】
请调用 add_chapter 工具保存每个章节，确保 volumeNumber 参数为 ${vol.number}。`;
  };

  // Helper function to get the chapter summary (no split between simple/detailed)
  const getChapterSummary = (chapter: Chapter): string => {
    return chapter.summary || '';
  };

  const buildFanwenChapterOutlinePrompt = (chapter: Chapter) => {
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    const samplesBlock = getFanwenSamplesBlock();
    // 作家信息已在 App.tsx 的系统提示词中处理
    const currentSummary = getChapterSummary(chapter);
    return `请精雕${volumeInfo}第${chapter.number}章《${chapter.title}》的章纲。${currentSummary ? `\n\n当前章纲概要：${currentSummary}` : ''}

${samplesBlock}

【工具指令】
完成后调用 add_chapter 工具更新 summary 字段，number=${chapter.number}，${vol ? `volumeNumber=${vol.number}，` : ''}保持 title 不变。`;
  };

  const buildDefaultChapterOutlinePrompt = (chapter: Chapter) => {
    const vol = story.volumes.find(v => v.id === chapter.volumeId);
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    const samplesBlock = getFanwenSamplesBlock();
    // 作家信息已在 App.tsx 的系统提示词中处理
    const currentSummary = getChapterSummary(chapter);
    return `请精雕${volumeInfo}第${chapter.number}章《${chapter.title}》的章纲。${currentSummary ? `\n\n当前章纲概要：${currentSummary}` : ''}

${samplesBlock}

【工具指令】
细化完成后，调用 add_chapter 工具更新章纲的 summary 字段：
- number: ${chapter.number}
${vol ? `- volumeNumber: ${vol.number}\n` : ''}- title: "${chapter.title}"（保持不变）
- summary: [细化后的详细章纲概要]`;
  };

  // 构建故事板信息块（用于生成正文时提供上下文）
  const buildStoryboardInfoBlock = (): string => {
    const blocks: string[] = [];
    
    // 故事基本信息
    if (story.title) {
      blocks.push(`**故事标题**：${story.title}`);
    }
    if (story.synopsis) {
      blocks.push(`**故事简介**：${story.synopsis}`);
    }
    if (story.alternativeTitles && story.alternativeTitles.length > 0) {
      blocks.push(`**其他标题**：${story.alternativeTitles.join('、')}`);
    }
    
    // 角色信息
    if (story.characters && story.characters.length > 0) {
      blocks.push(`\n**角色信息**：`);
      story.characters.forEach(char => {
        let charInfo = `- **${char.name}**（${char.role}）`;
        if (char.tags && char.tags.length > 0) {
          charInfo += ` [${char.tags.join('、')}]`;
        }
        if (char.description) {
          charInfo += `：${char.description}`;
        }
        blocks.push(charInfo);
      });
    }
    
    // 世界观设定
    if (story.worldGuide && story.worldGuide.length > 0) {
      blocks.push(`\n**世界观设定**：`);
      const groupedByCategory = story.worldGuide.reduce((acc, entry) => {
        if (!acc[entry.category]) acc[entry.category] = [];
        acc[entry.category].push(entry);
        return acc;
      }, {} as Record<string, typeof story.worldGuide>);
      
      Object.entries(groupedByCategory).forEach(([category, entries]) => {
        blocks.push(`- **${category}**：`);
        entries.forEach(entry => {
          blocks.push(`  - ${entry.name}：${entry.description}`);
        });
      });
    }
    
    // 写作指导
    if (story.writingGuidelines && story.writingGuidelines.length > 0) {
      const activeGuidelines = story.writingGuidelines.filter(g => g.isActive !== false);
      if (activeGuidelines.length > 0) {
        blocks.push(`\n**写作指导**：`);
        const groupedByCategory = activeGuidelines.reduce((acc, guideline) => {
          if (!acc[guideline.category]) acc[guideline.category] = [];
          acc[guideline.category].push(guideline);
          return acc;
        }, {} as Record<string, typeof activeGuidelines>);
        
        Object.entries(groupedByCategory).forEach(([category, guidelines]) => {
          blocks.push(`- **${category}**：`);
          guidelines.forEach(guideline => {
            blocks.push(`  - ${guideline.content}`);
          });
        });
      }
    }
    
    // 故事圣经（使用当前激活章节的版本）
    if (story.storyBible && story.storyBible.versions && story.storyBible.versions.length > 0) {
      const currentBibleVersion = story.storyBible.versions[story.storyBible.versions.length - 1];
      blocks.push(`\n**故事圣经（第${currentBibleVersion.chapterNumber}章状态）**：`);
      if (currentBibleVersion.character_status) {
        blocks.push(`- **人物状态**：\n${currentBibleVersion.character_status}`);
      }
      if (currentBibleVersion.key_items_and_locations) {
        blocks.push(`- **物品与地点**：\n${currentBibleVersion.key_items_and_locations}`);
      }
      if (currentBibleVersion.active_plot_threads) {
        blocks.push(`- **当前未解决的伏笔**：\n${currentBibleVersion.active_plot_threads}`);
      }
      if (currentBibleVersion.important_rules) {
        blocks.push(`- **临时规则/备注**：\n${currentBibleVersion.important_rules}`);
      }
    }
    
    return blocks.length > 0 ? `\n\n【故事板信息】\n${blocks.join('\n')}\n` : '';
  };

  const buildFanwenManuscriptPrompt = (chapter: Chapter) => {
    // 范文和作家信息已在 App.tsx 的系统提示词中处理（所有模式都包含）
    const summary = getChapterSummary(chapter);
    
    // Get story genre
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
    
    const storyboardInfo = buildStoryboardInfoBlock();
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    
    return `请为第${chapter.number}章《${chapter.title}》生成正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}${storyboardInfo}

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${isUsingJsonSchema() ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${isUsingJsonSchema() ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

${getToolCallInstructions(chapter.number, vol?.number)}
`;
  };

  const buildDefaultManuscriptPrompt = (chapter: Chapter) => {
    // 范文和作家信息已在 App.tsx 的系统提示词中处理（所有模式都包含）
    const summary = getChapterSummary(chapter);
    
    // Get story genre
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
    
    const storyboardInfo = buildStoryboardInfoBlock();
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    
    return `请为第${chapter.number}章《${chapter.title}》生成正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}${storyboardInfo}

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${isUsingJsonSchema() ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${isUsingJsonSchema() ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

${getToolCallInstructions(chapter.number, vol?.number)}`;
  };

  // 范文腔调模仿法：分析范文的提示词（简化版，只提供范文内容，不添加额外要求）
  const buildFanwenStyleAnalysisPrompt = (userIdea: string): string | null => {
    const samplesBlock = getFanwenSamplesBlock();
    if (!samplesBlock || samplesBlock.includes('（当前未勾选范文')) {
      return null; // 如果没有选择范文，不需要分析
    }
    return `用户提出的脑洞/题材：${userIdea}

${samplesBlock}

【工具指令】
如果需要保存分析结果，可以调用 add_writing_guideline 工具：
- category: "范文腔调分析"
- content: [分析结果]`;

  };

  // 范文腔调模仿法：按范文腔调写正文的提示词（简化版，只提供范文内容，不添加额外要求）
  const buildFanwenStyleManuscriptPrompt = (chapter: Chapter, analysisResult?: string) => {
    // 范文和作家信息已在 App.tsx 的系统提示词中处理（所有模式都包含）
    const summary = getChapterSummary(chapter);
    
    // Get story genre
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
    
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    
    // 与范文四阶写法保持一致：直接要求生成正文，并包含章纲概要
    let prompt = `请为第${chapter.number}章《${chapter.title}》生成正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}`;

    // 如果有分析结果，可以添加，但不应该替代章纲概要
    if (analysisResult) {
      prompt += `\n\n【范文腔调分析结果】\n${analysisResult}\n`;
    }

    prompt += `\n**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 重要说明**：
- 这个字数限制**只针对正文内容（chapter_content）**，不限制你的回答总字数
- **你的回答总字数不做限制**，可以完整输出所有内容，包括：
  - 正文内容（chapter_content）
  - 章纲（chapter_outline）
  - 故事圣经（updated_story_bible）${isUsingJsonSchema() ? '\n  - JSON代码块（JSON Schema模式需要在回复末尾输出JSON代码块）' : ''}
  - 其他所有内容
- **不要因为字数限制而截断${isUsingJsonSchema() ? 'JSON代码块或' : ''}其他内容**，所有内容都可以完整输出

${getToolCallInstructions(chapter.number, vol?.number)}`;

    return prompt;
  };

  // ========== 逆推章节细纲方法相关函数 ==========
  
  // 逆推方法：从结局倒推最后一章的详细章纲
  const buildReverseFinalChapterOutlinePrompt = (endingDescription: string): string => {
    return `# Role: 结局章节逆向构建师

# Task
基于以下【小说结局片段】或【最终画面】，使用"结局倒推法"为这一章（大结局章）推演出一份详细的剧情大纲。

# Logic: "逃离闭环"推演公式

依据《鹿鼎记》大结局的结构，请按以下四个步骤倒推情节：

1. **Step 1: 确定"物理脱钩"机制 (The Exit Mechanism)**
   - *结局是：* ${endingDescription}
   - *倒推：* 主角是通过什么手段从原有的社会关系网中彻底切断的？（是假死、失踪、飞升、还是被驱逐？）
   - *设计冲突：* 必须有一场剧烈的外部冲突（如误会、追杀、天灾）来促成这个脱钩。

2. **Step 2: 确定"准入许可" (The Golden Ticket)**
   - *倒推：* 在脱钩发生前，主角必须先到达"脱钩地点"。是谁允许他去的？
   - *设计交易：* 主角为了获得这次行动自由，向最高权力者（反派或君主）支付了什么代价？（金钱、秘密、还是最后的忠诚？）

3. **Step 3: 解决"遗留炸弹" (The Loose End)**
   - *倒推：* 在获得许可前，主角必须处理掉之前剧情留下的最大隐患。
   - *设计智斗：* 主角如何用一种荒诞或巧妙的方法，将一个严重的罪行/问题"抹平"，从而获得暂时的安全？

4. **Step 4: 确立"主题回响" (Thematic Echo)**
   - *倒推：* 在本章开头，主角与核心配角（通常是宿敌或挚友）必须有一场对话。
   - *设计对话：* 这场对话必须揭示全书的核心矛盾（如忠义难两全），并暗示主角"不干了"的心理动机。

# Output Format (输出格式)
请根据上述推演，生成本章的【逆向章纲】。然后调用 add_chapter 工具保存章纲：
1. **【开篇·遗留炸弹】：** [描述如何处理之前的烂摊子]
2. **【中段·最后的交易】：** [描述主角如何换取行动自由]
3. **【高潮·物理脱钩】：** [描述导致主角消失的突发事件]
4. **【尾声·结局画面】：** [连接用户提供的结局]

**重要提示**：生成的章纲必须详细完整，包含所有必要的细节，以便后续生成正文。`;
  };

  // 逆推方法：从第 N 章倒推第 N-1 章
  const buildReversePreviousChapterOutlinePrompt = (currentChapter: Chapter, previousChapter?: Chapter): string => {
    // 直接使用 summary 作为章纲，不再区分简洁/详细
    const currentChapterSummary = currentChapter.summary || '暂无章纲';
    
    const previousChapterInfo = previousChapter 
      ? `\n**注意**：已经存在第${previousChapter.number}章《${previousChapter.title}》，请确保倒推生成的章纲与其逻辑连贯。`
      : '';
    
    return `# Role: 逆向剧情推理专家

# Task
基于以下【第 ${currentChapter.number} 章大纲】，利用"因果倒推法"推导出【第 ${currentChapter.number - 1} 章大纲】。

# Logic: "伪胜利"推演模型

上一章（${currentChapter.number - 1}）是导致下一章（${currentChapter.number}）所有状态发生的直接原因。请按以下步骤倒推：

1. **确定"直接导火索" (The Trigger Event):**
   - *第 ${currentChapter.number} 章状态：* ${currentChapterSummary}
   - *倒推 ${currentChapter.number - 1}：* 是什么特定的大事件导致了${currentChapter.number}章的开局状态？（通常是一场大战的结束、一个阴谋的爆发、或一次关键的逃脱）。

2. **植入"关键线索" (The Key Item/Clue):**
   - *第 ${currentChapter.number} 章解谜：* 主角在第${currentChapter.number}章可能揭开了真相或使用了某道具。
   - *倒推 ${currentChapter.number - 1}：* 这个道具或线索必须在第${currentChapter.number - 1}章的混乱中被"不经意"地获取。请设计这个获取环节（战利品/遗言/偷听）。

3. **构建"情感反差" (Emotional Contrast):**
   - *第 ${currentChapter.number} 章情绪：* [分析第${currentChapter.number}章的情绪基调]
   - *倒推 ${currentChapter.number - 1}：* 第${currentChapter.number - 1}章必须提供相反的情绪体验，以制造戏剧张力。（如果第${currentChapter.number}章是幻灭，第${currentChapter.number - 1}章就是狂热；如果第${currentChapter.number}章是冷静，第${currentChapter.number - 1}章就是疯狂）。

4. **强化"信任陷阱" (The Trust Trap):**
   - *第 ${currentChapter.number} 章反转：* 如果第${currentChapter.number}章有背叛。
   - *倒推 ${currentChapter.number - 1}：* 在第${currentChapter.number - 1}章，这个叛徒必须做出看似最忠诚、最牺牲自我的举动，从而让主角对他完全不设防。

# Output Format (输出格式)
请生成【第 ${currentChapter.number - 1} 章逆向章纲】。然后调用 add_chapter 工具保存章纲：
1. **【高潮·决战/事件】：** [导致第${currentChapter.number}章局面的核心大事件]
2. **【伏笔·线索获取】：** [主角获得了什么不起眼但致命的关键物]
3. **【角色·信任巅峰】：** [反派如何通过苦肉计建立绝对信任]
4. **【尾声·伪胜利】：** [以看似完美的结局收尾，形成对第${currentChapter.number}章的讽刺]${previousChapterInfo}

**重要提示**：
- 生成的章纲必须详细完整，包含所有必要的细节
- 确保与第${currentChapter.number}章的因果关系清晰
- 如果已存在第${currentChapter.number - 1}章，请确保逻辑连贯`;
  };

  // 范文腔调模仿法：从正文提炼章纲的提示词
  const buildFanwenStyleOutlineExtractionPrompt = (chapter: Chapter, manuscriptContent: string) => {
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    return `【写作方法：范文腔调｜阶段：提炼章纲】

【章节信息】
- 所属卷：${volumeInfo || '（未分卷）'}
- 章节：第${chapter.number}章《${chapter.title}》

【已生成的正文内容】
${manuscriptContent}

【任务目标】
请从以上正文中提炼出**极其详细**的章纲概要。章纲的作用是帮助AI记忆，保证后续创作不出现逻辑矛盾。

【核心要求】
**⚠️ 重要：章纲必须详细完整，不能过于简洁！**

【输出要求（必须全部包含）】
1. **剧情任务总结**：
   - 明确说明本章完成了什么核心剧情任务（例如：揭露某个秘密、完成某个重要转折、推进某条线索等）
   - 说明本章在整个故事中的作用和意义

2. **完整情节细节**：
   - 按时间顺序或逻辑顺序，详细梳理本章发生的**所有**情节节点
   - 包括但不限于：场景转换、人物行动、对话要点、心理活动、环境描写的作用等
   - 不要遗漏任何重要细节，确保章纲能够完整还原正文内容

3. **角色关系变化**：
   - 详细说明本章中角色之间的关系发生了哪些变化
   - 包括新出现的角色、角色之间的互动、冲突或合作等

4. **伏笔与悬念**：
   - 标注本章埋下的所有伏笔和悬念
   - 说明这些伏笔/悬念的作用和可能的后续发展

5. **情绪曲线与节奏**：
   - 详细描述本章的情绪起伏变化（从平静到紧张、从绝望到希望等）
   - 说明节奏的快慢变化和转折点

6. **关键信息点**：
   - 列出本章揭示的重要信息、线索或设定
   - 说明这些信息对后续剧情的影响

【格式要求】
- 章纲应该是一个完整的、连贯的叙述，而不是简单的列表
- 字数建议：500-1500字（根据正文长度调整，正文越长，章纲越详细）
- 确保章纲详细到足以让AI在后续创作时准确回忆起所有重要细节

【工具指令】
提炼完成后，必须调用 add_chapter 工具更新章纲：
- number: ${chapter.number}
${vol ? `- volumeNumber: ${vol.number}\n` : ''}- title: "${chapter.title}"（保持不变）
- summary: [提炼出的详细章纲概要]

**重要：必须调用工具保存章纲！**`;
  };

  const getVolumeOutlinePrompt = (vol: Volume, existingChaptersText: string) => {
    if (writingMethod === 'fanwen_resonance_4step') {
      return buildFanwenVolumeOutlinePrompt(vol, existingChaptersText);
    }
    return buildDefaultVolumeOutlinePrompt(vol, existingChaptersText);
  };

  const getChapterOutlinePrompt = (chapter: Chapter) => {
    if (writingMethod === 'fanwen_resonance_4step') {
      return buildFanwenChapterOutlinePrompt(chapter);
    }
    return buildDefaultChapterOutlinePrompt(chapter);
  };

  const getChapterManuscriptPrompt = (chapter: Chapter) => {
    if (writingMethod === 'fanwen_resonance_4step') {
      return buildFanwenManuscriptPrompt(chapter);
    } else if (writingMethod === 'fanwen_style_imitation') {
      return buildFanwenStyleManuscriptPrompt(chapter);
    }
    return buildDefaultManuscriptPrompt(chapter);
  };

  // 按叙事功能模板写正文：使用模板中的逆向拆解结果作为写作模板
  const buildBlueprintToManuscriptPrompt = (chapterNumber: number, templateContent: string, outputChapterNumber?: number): string => {
    // Get story genre
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
    const genreNote = storyGenre !== 'none' ? `\n\n**当前故事题材**：${genreNames[storyGenre]}，请根据${genreNames[storyGenre]}题材的特点和惯例来创作。` : '';
    
    // 检查当前写作方法，如果是纯聊天模式，不添加工具调用指令
    const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
    const isChatOnlyMode = currentWritingMethod === 'chat_only';
    
    // 注意：storyboardInfo 不包含范文，范文应该通过幽灵注入在 App.tsx 中处理
    // 这里只提供故事板信息（角色、世界观、写作指导等），不包含范文
    const storyboardInfo = buildStoryboardInfoBlock();
    const targetChapterNum = outputChapterNumber || chapterNumber;
    
    // Find the target chapter for title and volume info
    const targetChapter = story.outline.find(ch => ch.number === targetChapterNum);
    const vol = targetChapter?.volumeId ? story.volumes.find(v => v.id === targetChapter.volumeId) : undefined;
    const chapterTitle = targetChapter?.title || `第${targetChapterNum}章`;
    
    // Get chapter summary if exists
    const summary = targetChapter ? getChapterSummary(targetChapter) : '';
    
    // 纯聊天模式下，不添加工具调用指令，并添加说明
    const toolCallInstructions = isChatOnlyMode 
      ? `\n\n**⚠️ 当前为纯聊天模式**：请直接输出正文内容，不要调用任何工具，不要输出 JSON 代码块。只需在对话中输出完整的正文内容即可。`
      : getToolCallInstructions(targetChapterNum, vol?.number);
    
    return `## 📝 按叙事功能模板写正文

**任务说明**：请严格按照下方的【叙事功能模板】逐条展开写作，生成第${targetChapterNum}章《${chapterTitle}》的正文。${summary ? `\n\n**章纲概要**：${summary}` : ''}

### 【叙事功能模板】
以下是从范文中抽象提取的"叙事功能序列"，描述的是每个情节单元应该完成的**叙事功能**和**写作效果**，而非具体情节内容。
请**逐条按顺序**将这些功能转化为你自己的原创情节：

\`\`\`
${templateContent}
\`\`\`

### 🚨 核心创作原则

**1. 功能复刻，情节原创**
- 模板中的每一条描述的是"叙事功能"（如：制造悬念、情绪铺垫、反转揭示等）
- 你需要**用全新的情节桥段**来实现这些功能
- 具体的人物、场景、对话、动作都必须是原创的

**2. 严禁与范文雷同**
- 🚫 禁止照搬范文的具体情节、场景设置、人物行为
- 🚫 禁止使用范文中的台词、描写语句
- ✅ 只借鉴范文的**叙事节奏**和**功能结构**
- ✅ 必须使用本故事自己的角色、世界观、情节线

**3. 逐条对应展开**
- 模板的每一条功能描述，都应该在正文中有对应的情节段落
- 保持功能的**顺序**，实现流畅的叙事节奏
- 每条功能可以用1-3段文字来实现

**4. 逻辑连贯性**
- 必须结合前后章节的内容，确保情节、人物、设定等逻辑连贯
- 参考系统提示词中的前后章节内容，保持故事的连续性

${genreNote}${storyboardInfo}

**字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。

**⚠️ 如果模板内容较多无法在单章完成**：
- 可以先完成模板的前半部分
- 在章纲中标注"（待续）"，说明后续内容
- 用户可以继续请求生成后续章节

${toolCallInstructions}`;
  };

  // 构建按模板写正文的系统内容（前后章节上下文）
  const buildBlueprintToManuscriptSystemContent = (chapterNumber: number): string => {
    const chapter = story.outline.find(ch => ch.number === chapterNumber);
    if (!chapter) return '';
    
    // Get previous chapters (configurable number of chapters before)
    const beforeCount = rewriteContextBefore || 3;
    const afterCount = rewriteContextAfter || 3;
    
    const previousChapters = story.outline
      .filter(ch => ch.number < chapterNumber)
      .sort((a, b) => b.number - a.number)
      .slice(0, beforeCount)
      .reverse();
    
    // Get next chapters (configurable number of chapters after)
    const nextChapters = story.outline
      .filter(ch => ch.number > chapterNumber)
      .sort((a, b) => a.number - b.number)
      .slice(0, afterCount);
    
    // Build content text for system instruction
    let systemContent = '';
    
    if (previousChapters.length > 0) {
      systemContent += '\n\n## 📖 前文章节内容（供参考，确保逻辑连贯）\n';
      previousChapters.forEach(ch => {
        const content = getChapterContentText(ch);
        const summary = getChapterSummary(ch);
        if (content) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n${content}\n`;
        } else if (summary) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n[章纲] ${summary}\n`;
        }
      });
    }
    
    if (nextChapters.length > 0) {
      systemContent += '\n\n## 📖 后文章节内容（供参考，确保逻辑连贯）\n';
      nextChapters.forEach(ch => {
        const content = getChapterContentText(ch);
        const summary = getChapterSummary(ch);
        if (content) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n${content}\n`;
        } else if (summary) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n[章纲] ${summary}\n`;
        }
      });
    }
    
    return systemContent;
  };

  // Helper function to get chapter content text
  const getChapterContentText = (chapter: Chapter): string => {
    const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
    return activeVersion?.text || '';
  };

  // Build rewrite prompt - returns user prompt only (content will be added to system instruction)
  const buildRewriteManuscriptPrompt = (chapter: Chapter): string => {
    const summary = getChapterSummary(chapter);
    
    // Get story genre
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
    const genreNote = storyGenre !== 'none' ? `\n\n**注意**：当前故事题材为${genreNames[storyGenre]}，重写时请保持${genreNames[storyGenre]}题材的特色和风格。` : '';
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    
    return `请重写第${chapter.number}章《${chapter.title}》的正文。${summary ? `\n\n章纲概要：${summary}` : ''}

${genreNote}

**重要要求**：
1. **逻辑连贯性**：重写时必须结合前后章节的内容，确保情节、人物、设定等逻辑连贯，不要出现矛盾。
2. **字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。**注意：这个字数限制只针对正文内容，不限制你的回答总字数。你可以完整输出所有内容，包括JSON代码块、章纲、故事圣经等，不会被截断。**
3. **保持核心情节**：在保持章纲核心情节不变的前提下，优化表达、增强连贯性、修复逻辑问题。

${getToolCallInstructions(chapter.number, vol?.number)}`;
  };
  
  // Helper function to build system content for rewrite (chapter content and context)
  const buildRewriteSystemContent = (chapter: Chapter): string => {
    const currentContent = getChapterContentText(chapter);
    
    // Get previous chapters (configurable number of chapters before)
    const beforeCount = rewriteContextBefore || 3;
    const afterCount = rewriteContextAfter || 3;
    
    const previousChapters = story.outline
      .filter(ch => ch.number < chapter.number)
      .sort((a, b) => b.number - a.number)
      .slice(0, beforeCount)
      .reverse();
    
    // Get next chapters (configurable number of chapters after)
    const nextChapters = story.outline
      .filter(ch => ch.number > chapter.number)
      .sort((a, b) => a.number - b.number)
      .slice(0, afterCount);
    
    // Build content text for system instruction (not user message)
    let systemContent = '';
    
    if (currentContent) {
      systemContent += `\n\n## 📝 当前章节正文（需要重写）\n\n**第${chapter.number}章《${chapter.title}》的当前正文内容：**\n\n${currentContent}\n`;
    }
    
    if (previousChapters.length > 0) {
      systemContent += '\n\n## 📖 前文章节内容（供参考，确保逻辑连贯）\n';
      previousChapters.forEach(ch => {
        const content = getChapterContentText(ch);
        if (content) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n${content}\n`;
        }
      });
    }
    
    if (nextChapters.length > 0) {
      systemContent += '\n\n## 📖 后文章节内容（供参考，确保逻辑连贯）\n';
      nextChapters.forEach(ch => {
        const content = getChapterContentText(ch);
        if (content) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n${content}\n`;
        }
      });
    }
    
    return systemContent;
  };

  // 构建续写下一章的提示词
  const buildContinueNextChapterPrompt = (chapter: Chapter): string => {
    const currentContent = getChapterContentText(chapter);
    const summary = getChapterSummary(chapter);
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    
    // 获取下一章编号
    const nextChapterNumber = chapter.number + 1;
    
    // 检查下一章是否已存在
    const nextChapter = story.outline.find(ch => ch.number === nextChapterNumber && 
      (!vol || (ch.volumeId && story.volumes.find(v => v.id === ch.volumeId)?.number === vol.number)));
    const nextChapterTitle = nextChapter?.title || `第${nextChapterNumber}章`;
    const nextChapterSummary = nextChapter ? getChapterSummary(nextChapter) : null;
    
    // Get story genre
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
    
    let prompt = `请续写${volumeInfo}第${nextChapterNumber}章《${nextChapterTitle}》的正文。${nextChapterSummary ? `\n\n章纲概要：${nextChapterSummary}` : ''}

**重要要求**：
1. **以前文为起点**：必须以第${chapter.number}章《${chapter.title}》的正文内容为前文，在此基础上自然延续，确保情节、人物、设定等逻辑连贯。
2. **字数要求**：必须严格控制**正文内容（chapter_content 参数）**的字数在 **${targetWordCount}字** 左右（允许±10%的误差，即 ${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)} 字）。**注意：这个字数限制只针对正文内容，不限制你的回答总字数。你可以完整输出所有内容，包括JSON代码块、章纲、故事圣经等，不会被截断。**
3. **情节连贯性**：确保与前一章的情节、人物状态、物品位置等完全衔接，不要出现矛盾或断层。

${genreNote}

${getToolCallInstructions(nextChapterNumber, vol?.number)}`;

    return prompt;
  };

  // 构建续写下一章的系统内容（包含当前章节正文作为前文）
  const buildContinueNextChapterSystemContent = (chapter: Chapter): string => {
    const currentContent = getChapterContentText(chapter);
    
    let systemContent = '';
    
    if (currentContent) {
      systemContent += `\n\n## 📝 前文章节正文（续写的起点）\n\n**第${chapter.number}章《${chapter.title}》的正文内容：**\n\n${currentContent}\n`;
    }
    
    // 获取前几章内容作为参考（可选）
    const beforeCount = rewriteContextBefore || 2;
    const previousChapters = story.outline
      .filter(ch => ch.number < chapter.number)
      .sort((a, b) => b.number - a.number)
      .slice(0, beforeCount)
      .reverse();
    
    if (previousChapters.length > 0) {
      systemContent += '\n\n## 📖 更早章节内容（供参考，确保逻辑连贯）\n';
      previousChapters.forEach(ch => {
        const content = getChapterContentText(ch);
        if (content) {
          systemContent += `\n### 第${ch.number}章《${ch.title}》\n${content}\n`;
        }
      });
    }
    
    return systemContent;
  };

  // 从正文提炼章纲、角色、世界书、指导等信息的提示词（简洁版）
  const getExtractInfoFromManuscriptPromptSimple = (chapter: Chapter) => {
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
    const manuscriptContent = activeVersion?.text || '';
    
    if (!manuscriptContent || manuscriptContent.trim().length === 0) {
      return null;
    }
    
    return `【任务：从正文提炼故事板信息（简洁版）】

【章节信息】
- 所属卷：${volumeInfo || '（未分卷）'}
- 章节：第${chapter.number}章《${chapter.title}》

【正文内容】
${manuscriptContent}

【任务目标】
请分析以上正文内容，提炼并保存以下信息到故事板：

1. **章节标题**：从正文中提炼一个准确、简洁、吸引人的章节标题，标题应该：
   - 概括本章的核心内容或主题
   - 体现本章的关键情节或转折
   - 长度适中（通常4-12个字）
   - 如果正文中已有明确的章节标题，请使用正文中的标题

2. **章纲概要（简洁版）**：从正文中提炼简洁的章纲概要，包括：
   - 核心剧情任务（一句话概括）
   - 主要情节节点（按时间顺序，每个节点1-2句话）
   - 关键角色互动
   - 重要伏笔或悬念
   - 字数建议：200-500字

3. **角色信息**：提取正文中出现的角色
4. **世界观设定**：提取正文中涉及的世界观设定
5. **写作指导**：提取正文中值得学习的写作技巧

【工具调用要求】
**重要：必须调用以下工具保存信息！**

1. **更新章纲（简洁版）**：调用 add_chapter 工具
   - number: ${chapter.number}
   ${vol ? `- volumeNumber: ${vol.number}\n` : ''}- title: [从正文中提炼出的章节标题，覆盖现有标题]
   - summary: [提炼出的简洁章纲概要]
   - summaryDetailed: [如果已有详细版，保持不变；如果没有，可以留空]

2. **添加/更新角色**：调用 add_character 工具
3. **添加世界观设定**：调用 add_world_entry 工具
4. **添加写作指导**：调用 add_writing_guideline 工具

【注意事项】
- 章纲要简洁明了，突出核心情节和关键信息
- 只提取正文中明确出现的信息
- 确保所有信息都通过工具调用保存

**请开始分析并调用相应的工具保存信息！**`;
  };

  // 从正文提炼章纲、角色、世界书、指导等信息的提示词（详细版）
  const getExtractInfoFromManuscriptPromptDetailed = (chapter: Chapter) => {
    const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
    const volumeInfo = vol ? `第${vol.number}卷 ` : '';
    const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
    const manuscriptContent = activeVersion?.text || '';
    
    if (!manuscriptContent || manuscriptContent.trim().length === 0) {
      return null;
    }
    
    return `【任务：从正文提炼故事板信息（详细版）】

【章节信息】
- 所属卷：${volumeInfo || '（未分卷）'}
- 章节：第${chapter.number}章《${chapter.title}》

【正文内容】
${manuscriptContent}

【任务目标】
请仔细分析以上正文内容，提炼并保存以下信息到故事板：

1. **章节标题**：从正文中提炼一个准确、简洁、吸引人的章节标题，标题应该：
   - 概括本章的核心内容或主题
   - 体现本章的关键情节或转折
   - 长度适中（通常4-12个字）
   - 如果正文中已有明确的章节标题，请使用正文中的标题

2. **章纲概要（详细版）**：从正文中提炼详细的章纲概要，包括：
   - 核心剧情任务（详细说明本章完成了什么任务，在整个故事中的作用和意义）
   - 完整情节细节（按时间顺序，详细梳理所有情节节点，包括场景转换、人物行动、对话要点、心理活动、环境描写的作用等）
   - 角色关系变化（详细说明角色之间的关系发生了哪些变化，包括新出现的角色、角色之间的互动、冲突或合作等）
   - 伏笔与悬念（标注本章埋下的所有伏笔和悬念，说明这些伏笔/悬念的作用和可能的后续发展）
   - 情绪曲线与节奏（详细描述本章的情绪起伏变化，说明节奏的快慢变化和转折点）
   - 关键信息点（列出本章揭示的重要信息、线索或设定，说明这些信息对后续剧情的影响）
   - 字数建议：500-1500字（根据正文长度调整，正文越长，章纲越详细）

3. **角色信息**：提取正文中出现的角色，包括：
   - 角色姓名
   - 角色身份/角色定位（主角/配角/反派等）
   - 角色描述（外貌、性格、行为特征等）
   - 如果角色已存在，请检查是否需要更新描述

4. **世界观设定**：提取正文中涉及的世界观设定，包括：
   - 设定类别（如：地理、历史、社会制度、魔法体系、科技水平等）
   - 设定名称
   - 设定描述（详细说明）

5. **写作指导**：提取正文中值得学习的写作技巧或风格特点，包括：
   - 指导类别（如：文笔风格、叙事技巧、人物塑造、情节设计等）
   - 指导内容（具体说明）

【工具调用要求】
**重要：必须调用以下工具保存信息！**

1. **更新章纲（详细版）**：调用 add_chapter 工具
   - number: ${chapter.number}
   ${vol ? `- volumeNumber: ${vol.number}\n` : ''}- title: [从正文中提炼出的章节标题，覆盖现有标题]
   - summary: [如果已有简洁版，保持不变；如果没有，可以留空]
   - summaryDetailed: [提炼出的详细章纲概要]

2. **添加/更新角色**：对于每个提取到的角色，调用 add_character 工具
   - name: [角色姓名]
   - role: [角色身份/定位]
   - description: [角色描述]

3. **添加世界观设定**：对于每个提取到的世界观设定，调用 add_world_entry 工具
   - category: [设定类别]
   - name: [设定名称]
   - description: [设定描述]

4. **添加写作指导**：对于每个提取到的写作指导，调用 add_writing_guideline 工具
   - category: [指导类别]
   - content: [指导内容]

【注意事项】
- 如果信息已存在（如角色已存在），请检查是否需要更新或补充
- 只提取正文中明确出现的信息，不要添加正文中没有的内容
- 确保所有信息都通过工具调用保存，不要只在文本中描述
- 章纲必须详细完整，确保能够完整还原正文内容

**请开始分析并调用相应的工具保存信息！**`;
  };

  // 从正文提炼章纲、角色、世界书、指导等信息的提示词（根据用户选择返回简洁版或详细版）
  const getExtractInfoFromManuscriptPrompt = (chapter: Chapter) => {
    return useDetailedOutlineExtraction 
      ? getExtractInfoFromManuscriptPromptDetailed(chapter)
      : getExtractInfoFromManuscriptPromptSimple(chapter);
  };

  // 获取提炼信息功能专用的系统提示词（根据工具调用模式生成）
  const getExtractInfoSystemInstruction = () => {
    // 判断是否使用 JSON Schema 模式（按提供商默认策略：Google 直连=FC，其他=JSON Schema）
    const isGoogleDirect = apiConfig?.provider === 'google' && !apiConfig?.useProxy;
    const useJsonSchema = apiConfig?.toolCallMode === 'json_schema'
      || (!isGoogleDirect && apiConfig?.toolCallMode !== 'function_calling');
    
    const baseInstruction = `你是 "StoryForge" 的信息提炼助手。你的任务是分析正文内容，提取关键信息并保存到故事板。

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

记住：**不调用工具 = 信息未保存 = 用户看不到信息！**`;

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

  // 导出提炼章纲的提示词函数，供App.tsx使用
  const getOutlineExtractionPrompt = (chapter: Chapter, manuscriptContent: string) => {
    if (writingMethod === 'fanwen_style_imitation') {
      return buildFanwenStyleOutlineExtractionPrompt(chapter, manuscriptContent);
    }
    return null;
  };

  const enhancePromptForWritingMethod = (prompt: string, mode?: MessageMode) => {
    // 🚨 在纯聊天模式下，不添加范文到用户消息（范文应该只在系统提示词中）
    const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as WritingMethod) || 'default';
    if (currentWritingMethod === 'chat_only') {
      // 纯聊天模式下，直接返回原始提示词，不添加范文
      return prompt;
    }
    return injectSamplesIntoPrompt(prompt, mode);
  };


  // Update handlers
  const updateTitle = (newTitle: string) => onUpdateStory({ ...story, title: newTitle });
  const updateSynopsis = (newSynopsis: string) => onUpdateStory({ ...story, synopsis: newSynopsis });
  
  const addAltTitle = () => onUpdateStory({ ...story, alternativeTitles: [...(story.alternativeTitles || []), "新备选标题"] });
  const updateAltTitle = (index: number, val: string) => {
    const newAlts = [...(story.alternativeTitles || [])];
    newAlts[index] = val;
    onUpdateStory({ ...story, alternativeTitles: newAlts });
  };
  const removeAltTitle = (index: number) => {
    const newAlts = [...(story.alternativeTitles || [])];
    newAlts.splice(index, 1);
    onUpdateStory({ ...story, alternativeTitles: newAlts });
  };

  const removeWorldEntry = (id: string) => {
    const newGuide = (story.worldGuide || []).filter(e => e.id !== id);
    onUpdateStory({ ...story, worldGuide: newGuide });
  };

  const handleImportWorldBook = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const fileName = file.name.toLowerCase();
        let importedEntries: WorldEntry[] = [];
        
        if (fileName.endsWith('.json')) {
          // JSON格式：期望是 WorldEntry[] 数组
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            importedEntries = parsed.map((item: any) => {
              // 验证必需字段
              if (item.category && item.name && item.description) {
                return {
                  id: uuidv4(),
                  category: item.category,
                  name: item.name,
                  description: item.description
                } as WorldEntry;
              }
              return null;
            }).filter((e: WorldEntry | null): e is WorldEntry => e !== null);
          } else if (parsed.worldGuide && Array.isArray(parsed.worldGuide)) {
            // 如果是包含 worldGuide 字段的对象
            importedEntries = parsed.worldGuide.map((item: any) => ({
              id: uuidv4(),
              category: item.category || '其他',
              name: item.name || '未命名',
              description: item.description || ''
            })).filter((e: WorldEntry) => e.name !== '未命名' && e.description);
          } else {
            alert('JSON格式错误：期望是 WorldEntry[] 数组或包含 worldGuide 字段的对象');
            return;
          }
        } else if (fileName.endsWith('.txt')) {
          // TXT格式：简单解析，按段落或行分割
          const lines = content.split(/\n\s*\n/).filter(line => line.trim());
          let currentCategory = '其他';
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 检测分类标题（以#、##、或【】开头的行）
            const categoryMatch = trimmed.match(/^(?:#+\s*|【|\[)?(.+?)(?:】|\])?$/);
            if (categoryMatch && trimmed.length < 50) {
              // 可能是分类标题
              currentCategory = categoryMatch[1].trim();
              continue;
            }
            
            // 尝试解析为"名称：描述"格式
            const nameDescMatch = trimmed.match(/^(.+?)[:：]\s*(.+)$/s);
            if (nameDescMatch) {
              const [, name, description] = nameDescMatch;
              importedEntries.push({
                id: uuidv4(),
                category: currentCategory,
                name: name.trim(),
                description: description.trim()
              });
            } else {
              // 如果没有冒号，将整行作为名称，描述为空（用户后续可以编辑）
              const firstLine = trimmed.split('\n')[0];
              if (firstLine.length > 0 && firstLine.length < 100) {
                importedEntries.push({
                  id: uuidv4(),
                  category: currentCategory,
                  name: firstLine.trim(),
                  description: trimmed.split('\n').slice(1).join('\n').trim() || '（待补充描述）'
                });
              }
            }
          }
        } else {
          alert('不支持的文件格式，请使用 .txt 或 .json 文件');
          return;
        }
        
        if (importedEntries.length === 0) {
          alert('未能从文件中提取到有效的世界观条目');
          return;
        }
        
        // 添加到现有的世界观设定中
        const existingEntries = story.worldGuide || [];
        const newEntries = [...existingEntries, ...importedEntries];
        onUpdateStory({ ...story, worldGuide: newEntries });
        
        alert(`成功导入 ${importedEntries.length} 个世界观条目`);
      } catch (err) {
        console.error('导入失败:', err);
        alert('导入失败：' + (err instanceof Error ? err.message : '未知错误'));
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // 重置input，允许重复选择同一文件
  };
  
  const removeWritingGuideline = (id: string) => {
      const newGuide = (story.writingGuidelines || []).filter(e => e.id !== id);
      onUpdateStory({ ...story, writingGuidelines: newGuide });
  };
  const updateWritingGuideline = (id: string, newContent: string) => {
      const newGuide = (story.writingGuidelines || []).map(e => e.id === id ? { ...e, content: newContent } : e);
      onUpdateStory({ ...story, writingGuidelines: newGuide });
  };
  const toggleWritingGuideline = (id: string) => {
      const newGuide = (story.writingGuidelines || []).map(e => e.id === id ? { ...e, isActive: !e.isActive } : e);
      onUpdateStory({ ...story, writingGuidelines: newGuide });
  };
  const addWritingGuideline = (category: string, content: string) => {
      if (!content.trim()) return;
      const newGuideline: WritingGuideline = {
          id: uuidv4(),
          category: category || '通用',
          content: content.trim(),
          isActive: true
      };
      onUpdateStory({ ...story, writingGuidelines: [...(story.writingGuidelines || []), newGuideline] });
  };

  // Blueprint Logic
  const updateActiveBlueprint = (updater: (blueprint: Blueprint) => Blueprint | undefined) => {
      const idx = story.blueprints.findIndex(b => b.id === story.activeBlueprintId);
      const safeIdx = idx === -1 ? 0 : idx;
      if (!story.blueprints[safeIdx]) return;
      const newBlueprints = [...story.blueprints];
      const updatedBlueprint = updater(newBlueprints[safeIdx]);
      if (!updatedBlueprint) return;
      newBlueprints[safeIdx] = updatedBlueprint;
      onUpdateStory({ ...story, blueprints: newBlueprints });
  };

  const activeBlueprint = story.blueprints.find(b => b.id === story.activeBlueprintId) || story.blueprints[0];

  const ensureBeatState = (blueprint: Blueprint, beat: StructureBeat) => {
      const emptyBeatVersions: Record<string, any> = {};
      const beatVersions = { ...(blueprint.beatVersions || emptyBeatVersions) };
      if (!beatVersions[beat]) {
          const seedId = uuidv4();
          beatVersions[beat] = {
              activeVersionId: seedId,
              versions: [{
                  id: seedId,
                  versionName: '初始构思',
                  timestamp: Date.now(),
                  text: blueprint.data?.[beat] || '',
                  isContext: true
              }]
          };
      }
      return { beatVersions, state: beatVersions[beat]! };
  };

  const handleSwitchBeatVersion = (beat: StructureBeat, versionId: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { beatVersions, state } = ensureBeatState(blueprint, beat);
          if (!state.versions.some(v => v.id === versionId)) return blueprint;
          const newState: BeatVersionState = { ...state, activeVersionId: versionId };
          beatVersions[beat] = newState;
          const activeVersion = newState.versions.find(v => v.id === versionId);
          return {
              ...blueprint,
              beatVersions,
              data: { ...blueprint.data, [beat]: activeVersion?.text || '' }
          };
      });
  };

  const handleAddBeatVersion = (beat: StructureBeat) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { beatVersions, state } = ensureBeatState(blueprint, beat);
          const activeVersion = state.versions.find(v => v.id === state.activeVersionId);
          const newId = uuidv4();
          const newVersion: ContentVersion = {
              id: newId,
              versionName: `手动版本 ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
              timestamp: Date.now(),
              text: activeVersion?.text || '',
              isContext: true
          };
          const newState: BeatVersionState = {
              activeVersionId: newId,
              versions: [...state.versions, newVersion]
          };
          beatVersions[beat] = newState;
          return {
              ...blueprint,
              beatVersions,
              data: { ...blueprint.data, [beat]: newVersion.text }
          };
      });
  };

  const handleDeleteBeatVersion = (beat: StructureBeat, versionId: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { beatVersions, state } = ensureBeatState(blueprint, beat);
          if (state.versions.length <= 1) return blueprint;
          const filtered = state.versions.filter(v => v.id !== versionId);
          if (filtered.length === state.versions.length) return blueprint;
          const newActiveId = versionId === state.activeVersionId ? filtered[filtered.length - 1].id : state.activeVersionId;
          const newState: BeatVersionState = {
              activeVersionId: newActiveId,
              versions: filtered
          };
          beatVersions[beat] = newState;
          const activeVersion = filtered.find(v => v.id === newActiveId);
          return {
              ...blueprint,
              beatVersions,
              data: { ...blueprint.data, [beat]: activeVersion?.text || '' }
          };
      });
  };

  const handleRenameBeatVersion = (beat: StructureBeat, versionId: string, newName: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { beatVersions, state } = ensureBeatState(blueprint, beat);
          const updatedVersions = state.versions.map(v => v.id === versionId ? { ...v, versionName: newName } : v);
          beatVersions[beat] = { ...state, versions: updatedVersions };
          return { ...blueprint, beatVersions };
      });
  };

  const handleUpdateBeatContent = (beat: StructureBeat, newText: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { beatVersions, state } = ensureBeatState(blueprint, beat);
          const updatedVersions = state.versions.map(v => 
              v.id === state.activeVersionId ? { ...v, text: newText, timestamp: Date.now() } : v
          );
          beatVersions[beat] = { ...state, versions: updatedVersions };
          return {
              ...blueprint,
              beatVersions,
              data: { ...blueprint.data, [beat]: newText }
          };
      });
  };

  // 确保模板章节逆向拆解的版本状态
  const ensureDeconstructionVersionState = (blueprint: Blueprint, chapterNumber: number): { versions: ContentVersion[], activeVersionId: string } => {
      if (!blueprint.chapterDeconstructionVersions || !blueprint.chapterDeconstructionVersions[chapterNumber]) {
          // 初始化：从旧的chapterDeconstructions字段迁移
          const initialId = uuidv4();
          const oldContent = blueprint.chapterDeconstructions?.[chapterNumber] || '';
          const initialVersion: ContentVersion = {
              id: initialId,
              versionName: '初始构思',
              timestamp: Date.now(),
              text: oldContent,
              isContext: true
          };
          return {
              versions: [initialVersion],
              activeVersionId: initialId
          };
      }
      const state = blueprint.chapterDeconstructionVersions[chapterNumber];
      return {
          versions: state.versions,
          activeVersionId: state.activeVersionId
      };
  };

  // 更新章节逆向拆解内容
  const handleUpdateChapterDeconstruction = (chapterNumber: number, content: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions, activeVersionId } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const activeIdx = versions.findIndex(v => v.id === activeVersionId);
          
          if (activeIdx === -1) {
              // 如果没有版本，创建一个
              const newId = uuidv4();
              const newVersion: ContentVersion = {
                  id: newId,
                  versionName: '初始构思',
                  timestamp: Date.now(),
                  text: content,
                  isContext: true
              };
              const newState: BeatVersionState = {
                  activeVersionId: newId,
                  versions: [newVersion]
              };
              return {
                  ...blueprint,
                  chapterDeconstructionVersions: {
                      ...(blueprint.chapterDeconstructionVersions || {}),
                      [chapterNumber]: newState
                  },
                  chapterDeconstructions: {
                      ...(blueprint.chapterDeconstructions || {}),
                      [chapterNumber]: content
                  }
              };
          } else {
              const newVersions = [...versions];
              newVersions[activeIdx] = { ...newVersions[activeIdx], text: content, timestamp: Date.now() };
              const newState: BeatVersionState = {
                  activeVersionId,
                  versions: newVersions
              };
              return {
                  ...blueprint,
                  chapterDeconstructionVersions: {
                      ...(blueprint.chapterDeconstructionVersions || {}),
                      [chapterNumber]: newState
                  },
                  chapterDeconstructions: {
                      ...(blueprint.chapterDeconstructions || {}),
                      [chapterNumber]: content
                  }
              };
          }
      });
  };

  const handleAddDeconstructionVersion = (chapterNumber: number) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions, activeVersionId } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const activeVersion = versions.find(v => v.id === activeVersionId);
          
          const newId = uuidv4();
          const newVersion: ContentVersion = {
              id: newId,
              versionName: `手动版本 ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
              timestamp: Date.now(),
              text: activeVersion?.text || '',
              isContext: true
          };
          
          const updatedVersions = versions.map(v => 
              v.id === activeVersionId ? { ...v, isContext: false } : v
          );
          
          const newState: BeatVersionState = {
              activeVersionId: newId,
              versions: [...updatedVersions, newVersion]
          };
          
          return {
              ...blueprint,
              chapterDeconstructionVersions: {
                  ...(blueprint.chapterDeconstructionVersions || {}),
                  [chapterNumber]: newState
              },
              chapterDeconstructions: {
                  ...(blueprint.chapterDeconstructions || {}),
                  [chapterNumber]: newVersion.text
              }
          };
      });
  };

  const handleSwitchDeconstructionVersion = (chapterNumber: number, versionId: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          
          const updatedVersions = versions.map(v => {
              if (v.id === (blueprint.chapterDeconstructionVersions?.[chapterNumber]?.activeVersionId || versions[0].id)) {
                  return { ...v, isContext: false };
              } else if (v.id === versionId) {
                  return { ...v, isContext: true };
              }
              return v;
          });
          
          const activeVersion = updatedVersions.find(v => v.id === versionId);
          const newState: BeatVersionState = {
              activeVersionId: versionId,
              versions: updatedVersions
          };
          
          return {
              ...blueprint,
              chapterDeconstructionVersions: {
                  ...(blueprint.chapterDeconstructionVersions || {}),
                  [chapterNumber]: newState
              },
              chapterDeconstructions: {
                  ...(blueprint.chapterDeconstructions || {}),
                  [chapterNumber]: activeVersion?.text || ''
              }
          };
      });
  };

  const handleToggleDeconstructionVersionContext = (chapterNumber: number, versionId: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const targetVersion = versions.find(v => v.id === versionId);
          if (!targetVersion) return blueprint;
          
          const updatedVersions = versions.map(v => {
              if (v.id === versionId) {
                  return { ...v, isContext: !v.isContext };
              } else {
                  return { ...v, isContext: false };
              }
          });
          
          const newState: BeatVersionState = {
              activeVersionId: blueprint.chapterDeconstructionVersions?.[chapterNumber]?.activeVersionId || versions[0].id,
              versions: updatedVersions
          };
          
          return {
              ...blueprint,
              chapterDeconstructionVersions: {
                  ...(blueprint.chapterDeconstructionVersions || {}),
                  [chapterNumber]: newState
              }
          };
      });
  };

  const handleDeleteDeconstructionVersion = (chapterNumber: number, versionId: string) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions, activeVersionId } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const version = versions.find(v => v.id === versionId);
          if (!version) return blueprint;
          
          if (versions.length <= 1) {
              alert("无法删除最后一个版本。");
              return blueprint;
          }
          
          let newActiveVersionId = activeVersionId;
          if (versionId === activeVersionId) {
              const otherVersion = versions.find(v => v.id !== versionId);
              if (!otherVersion) {
                  alert("无法删除最后一个版本。");
                  return blueprint;
              }
              newActiveVersionId = otherVersion.id;
          }
          
          if (confirm(`确定要删除版本"${version.versionName}"吗？`)) {
              const updatedVersions = versions.filter(v => v.id !== versionId);
              const newActiveVersion = updatedVersions.find(v => v.id === newActiveVersionId);
              const newState: BeatVersionState = {
                  activeVersionId: newActiveVersionId,
                  versions: updatedVersions
              };
              
              return {
                  ...blueprint,
                  chapterDeconstructionVersions: {
                      ...(blueprint.chapterDeconstructionVersions || {}),
                      [chapterNumber]: newState
                  },
                  chapterDeconstructions: {
                      ...(blueprint.chapterDeconstructions || {}),
                      [chapterNumber]: newActiveVersion?.text || ''
                  }
              };
          }
          return blueprint;
      });
  };

  const handleDeleteCurrentDeconstructionVersion = (chapterNumber: number) => {
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions, activeVersionId } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const activeVersion = versions.find(v => v.id === activeVersionId);
          if (!activeVersion) return blueprint;
          
          if (versions.length <= 1) {
              alert("无法删除最后一个版本。");
              return blueprint;
          }
          
          if (!confirm(`确定要删除当前版本"${activeVersion.versionName}"吗？删除后将自动切换到其他版本。`)) {
              return blueprint;
          }
          
          const otherVersions = versions.filter(v => v.id !== activeVersionId);
          const newActiveVersionId = otherVersions.length > 0 ? otherVersions[0].id : '';
          const newActiveVersion = versions.find(v => v.id === newActiveVersionId);
          
          const updatedVersions = versions.filter(v => v.id !== activeVersionId);
          const newState: BeatVersionState = {
              activeVersionId: newActiveVersionId,
              versions: updatedVersions
          };
          
          return {
              ...blueprint,
              chapterDeconstructionVersions: {
                  ...(blueprint.chapterDeconstructionVersions || {}),
                  [chapterNumber]: newState
              },
              chapterDeconstructions: {
                  ...(blueprint.chapterDeconstructions || {}),
                  [chapterNumber]: newActiveVersion?.text || ''
              }
          };
      });
  };

  const handleCopyDeconstruction = (chapterNumber: number) => {
      if (!activeBlueprint) return;
      const { versions, activeVersionId } = ensureDeconstructionVersionState(activeBlueprint, chapterNumber);
      const activeVersion = versions.find(v => v.id === activeVersionId);
      const content = activeVersion?.text || activeBlueprint.chapterDeconstructions?.[chapterNumber] || '';
      
      navigator.clipboard.writeText(content).then(() => {
          // 可以添加一个提示
      }).catch(err => {
          console.error('复制失败:', err);
      });
  };

  const handleExportDeconstructionToTxt = async (chapterNumber: number) => {
      if (!activeBlueprint) return;
      const chapter = story.outline.find(ch => ch.number === chapterNumber);
      if (!chapter) return;
      
      const { versions, activeVersionId } = ensureDeconstructionVersionState(activeBlueprint, chapterNumber);
      const activeVersion = versions.find(v => v.id === activeVersionId);
      const content = activeVersion?.text || activeBlueprint.chapterDeconstructions?.[chapterNumber] || '';
      
      if (!content.trim()) {
          alert('当前逆向拆解为空，无法导出。');
          return;
      }
      
      const titleText = `第${chapter.number}章 ${chapter.title} - 逆向拆解`;
      const fileContent = `${titleText}\n\n${content}`;
      const safeTitle = titleText.replace(/[\\/:*?"<>|]/g, '_');
      const filename = `${safeTitle}.txt`;
      
      try {
          const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (err) {
          console.error('导出失败:', err);
          alert('导出失败，请重试。');
      }
  };

  const handleDeleteDeconstructionContent = (chapterNumber: number) => {
      if (!confirm('确定要清空当前章节的逆向拆解内容吗？此操作不可撤销。')) {
          return;
      }
      
      updateActiveBlueprint((blueprint) => {
          if (!blueprint) return undefined;
          const { versions, activeVersionId } = ensureDeconstructionVersionState(blueprint, chapterNumber);
          const activeIdx = versions.findIndex(v => v.id === activeVersionId);
          if (activeIdx === -1) return blueprint;

          const newVersions = [...versions];
          newVersions[activeIdx] = { ...newVersions[activeIdx], text: '', timestamp: Date.now() };
          const newState: BeatVersionState = {
              activeVersionId,
              versions: newVersions
          };
          
          return {
              ...blueprint,
              chapterDeconstructionVersions: {
                  ...(blueprint.chapterDeconstructionVersions || {}),
                  [chapterNumber]: newState
              },
              chapterDeconstructions: {
                  ...(blueprint.chapterDeconstructions || {}),
                  [chapterNumber]: ''
              }
          };
      });
  };

  // 重排序指定章节范围内的小节序号
  const reorderSectionMarkers = (lines: string[], chapterStartIndex: number, chapterEndIndex: number): string[] => {
      const newLines = [...lines];
      const sectionPattern = /^(第\d+小节|第[一二三四五六七八九十百千万\d]+小节)$/;
      let sectionNumber = 1;
      
      // 在章节范围内查找并重排序所有小节标记
      for (let i = chapterStartIndex; i < chapterEndIndex; i++) {
          const trimmedLine = newLines[i].trim();
          if (sectionPattern.test(trimmedLine)) {
              // 替换为新的序号
              newLines[i] = newLines[i].replace(/第\d+小节|第[一二三四五六七八九十百千万\d]+小节/, `第${sectionNumber}小节`);
              sectionNumber++;
          }
      }
      
      return newLines;
  };

  // 查找章节范围（从章节标题到下一个章节标题或文档结尾）
  const findChapterRange = (lines: string[], lineIndex: number): { start: number; end: number } => {
      const chapterPattern = /^(第[一二三四五六七八九十百千万\d]+[章节回]|第\d+[章节回]|Chapter\s+\d+|第\d+节|第[一二三四五六七八九十百千万\d]+回)/;
      
      // 向上查找章节开始
      let chapterStart = 0;
      for (let i = lineIndex; i >= 0; i--) {
          const trimmedLine = lines[i].trim();
          if (trimmedLine && chapterPattern.test(trimmedLine)) {
              chapterStart = i;
              break;
          }
      }
      
      // 向下查找章节结束（下一个章节标题或文档结尾）
      let chapterEnd = lines.length;
      for (let i = lineIndex + 1; i < lines.length; i++) {
          const trimmedLine = lines[i].trim();
          if (trimmedLine && chapterPattern.test(trimmedLine)) {
              chapterEnd = i;
              break;
          }
      }
      
      return { start: chapterStart, end: chapterEnd };
  };

  // 插入小节拆分标记
  const handleInsertSectionMarker = () => {
      const textarea = splitDocumentTextareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = splitDocumentText;
      const lines = text.split(/\r?\n/);
      
      // 找到光标所在的行
      let lineStart = 0;
      let currentLineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
          if (lineStart + lines[i].length >= start) {
              currentLineIndex = i;
              break;
          }
          lineStart += lines[i].length + 1; // +1 for newline
      }
      
      // 查找当前章节范围
      const chapterRange = findChapterRange(lines, currentLineIndex);
      
      // 计算当前章节内已有多少小节
      const sectionPattern = /^(第\d+小节|第[一二三四五六七八九十百千万\d]+小节)$/;
      let sectionCount = 0;
      for (let i = chapterRange.start; i < currentLineIndex; i++) {
          if (sectionPattern.test(lines[i].trim())) {
              sectionCount++;
          }
      }
      
      // 生成新的小节标记（序号会在重排序时自动调整）
      const sectionNumber = sectionCount + 1;
      const sectionMarker = `第${sectionNumber}小节`;
      
      // 插入标记行
      const newLines = [...lines];
      newLines.splice(currentLineIndex, 0, sectionMarker);
      
      // 重排序当前章节内所有小节序号
      const reorderedLines = reorderSectionMarkers(newLines, chapterRange.start, chapterRange.end + 1);
      const newText = reorderedLines.join('\n');
      setSplitDocumentText(newText);
      
      // 设置光标位置到标记后
      setTimeout(() => {
          if (textarea) {
              let newPos = 0;
              for (let i = 0; i <= currentLineIndex && i < reorderedLines.length; i++) {
                  newPos += reorderedLines[i].length + 1;
              }
              textarea.setSelectionRange(newPos, newPos);
              textarea.focus();
          }
      }, 0);
  };

  // 删除当前行的小节标记
  const handleDeleteSectionMarker = () => {
      const textarea = splitDocumentTextareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const text = splitDocumentText;
      const lines = text.split(/\r?\n/);
      
      // 找到光标所在的行
      let lineStart = 0;
      let currentLineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
          if (lineStart + lines[i].length >= start) {
              currentLineIndex = i;
              break;
          }
          lineStart += lines[i].length + 1; // +1 for newline
      }
      
      const currentLine = lines[currentLineIndex].trim();
      const sectionPattern = /^(第\d+小节|第[一二三四五六七八九十百千万\d]+小节)$/;
      
      if (sectionPattern.test(currentLine)) {
          // 查找当前章节范围（在删除前查找）
          const chapterRange = findChapterRange(lines, currentLineIndex);
          
          // 删除这一行
          const newLines = [...lines];
          newLines.splice(currentLineIndex, 1);
          
          // 删除后，章节结束位置需要减1（因为删除了一行）
          const adjustedChapterEnd = chapterRange.end > currentLineIndex ? chapterRange.end - 1 : chapterRange.end;
          
          // 重排序当前章节内所有小节序号
          const reorderedLines = reorderSectionMarkers(newLines, chapterRange.start, adjustedChapterEnd);
          const newText = reorderedLines.join('\n');
          setSplitDocumentText(newText);
          
          // 设置光标位置（删除后，光标应该在上一个位置）
          setTimeout(() => {
              if (textarea) {
                  let newPos = 0;
                  // 计算删除后光标应该所在的位置
                  const targetLineIndex = Math.max(0, currentLineIndex - 1);
                  for (let i = 0; i < targetLineIndex && i < reorderedLines.length; i++) {
                      newPos += reorderedLines[i].length + 1;
                  }
                  // 如果目标行存在，将光标放在行尾
                  if (targetLineIndex < reorderedLines.length) {
                      newPos += reorderedLines[targetLineIndex].length;
                  }
                  textarea.setSelectionRange(newPos, newPos);
                  textarea.focus();
              }
          }, 0);
      } else {
          // 提示用户
          setSplitDocumentResult('⚠️ 当前行不是小节标记，无法删除。请将光标放在小节标记行上。');
          setTimeout(() => setSplitDocumentResult(''), 3000);
      }
  };

  // TXT 文档拆分功能
  const handleSplitDocument = async () => {
      if (!splitDocumentText.trim()) {
          setSplitDocumentResult('❌ 请先导入或粘贴 TXT 文档内容');
          return;
      }

      setSplitDocumentLoading(true);
      setSplitDocumentResult('');

      try {
          // 识别章节标题的正则表达式（更严格，避免误判）
          // 要求：1. 行首匹配 2. 章节标题较短（不超过60字符）3. 通常是独立行（前后有空行或文档边界）
          const chapterPattern = /^(第[一二三四五六七八九十百千万\d]+[章节回]|第\d+[章节回]|Chapter\s+\d+|第\d+节|第[一二三四五六七八九十百千万\d]+回)/;
          
          // 按行分割文本
          const lines = splitDocumentText.split(/\r?\n/);
          const chapters: Array<{ title: string; content: string; number: number }> = [];
          let currentChapter: { title: string; content: string; number: number } | null = null;
          let chapterNumber = 0;

          for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const trimmedLine = line.trim();
              
              // 检查是否是章节标题（更严格的验证）
              if (trimmedLine && chapterPattern.test(trimmedLine)) {
                  // 额外验证：章节标题应该较短（不超过60字符），避免误判正文
                  // 章节标题通常不包含太多标点符号或长句子
                  // 特别避免误判包含"回合"、"上"、"下"等词的正文内容
                  const isLikelyChapterTitle = 
                      trimmedLine.length <= 60 && // 章节标题通常较短
                      !trimmedLine.includes('，') && // 避免包含逗号的长句
                      !trimmedLine.includes('。') && // 避免包含句号的长句
                      !trimmedLine.includes('回合上') && // 避免误判"第四回合上"这样的正文
                      !trimmedLine.includes('回合下') && // 避免误判"第四回合下"这样的正文
                      !trimmedLine.match(/第[一二三四五六七八九十百千万\d]+回合[上下]/) && // 避免"第X回合上/下"
                      (i === 0 || lines[i - 1].trim() === '' || // 前面是空行或文档开头
                       lines[i - 1].trim().match(chapterPattern)); // 或者前面也是章节标题
                  
                  if (isLikelyChapterTitle) {
                      // 保存上一章（如果有）
                      if (currentChapter && currentChapter.content.trim()) {
                          chapters.push(currentChapter);
                      }
                      
                      // 开始新章节
                      chapterNumber++;
                      currentChapter = {
                          title: trimmedLine,
                          content: line + '\n',
                          number: chapterNumber
                      };
                      continue;
                  }
              }
              
              // 如果不是章节标题，添加到当前章节内容
              if (currentChapter) {
                  currentChapter.content += (currentChapter.content.endsWith('\n') ? '' : '\n') + line;
              }
              // 在第一个章节标题之前的内容忽略
          }

          // 保存最后一章
          if (currentChapter && currentChapter.content.trim()) {
              chapters.push(currentChapter);
          }

          if (chapters.length === 0) {
              setSplitDocumentResult('❌ 未找到章节标题。请确保文档中包含"第x章"、"第x回"等格式的章节标题。');
              setSplitDocumentLoading(false);
              return;
          }

          // 检查是否有小节标记，如果有则按小节拆分
          const sectionPattern = /^(第\d+小节|第[一二三四五六七八九十百千万\d]+小节)$/;
          const allSections: Array<{ title: string; content: string; number: number; chapterTitle: string; chapterNumber: number }> = [];
          
          for (const chapter of chapters) {
              const chapterLines = chapter.content.split(/\r?\n/);
              const sections: Array<{ title: string; content: string; number: number }> = [];
              let currentSection: { title: string; content: string; number: number } | null = null;
              let sectionNumber = 0;
              
              // 查找章节标题行
              let chapterTitleLine = '';
              for (const line of chapterLines) {
                  if (chapterPattern.test(line.trim())) {
                      chapterTitleLine = line.trim();
                      break;
                  }
              }
              
              for (let i = 0; i < chapterLines.length; i++) {
                  const line = chapterLines[i];
                  const trimmedLine = line.trim();
                  
                  // 检查是否是小节标记
                  if (sectionPattern.test(trimmedLine)) {
                      // 保存上一小节（如果有）
                      if (currentSection && currentSection.content.trim()) {
                          sections.push(currentSection);
                      }
                      
                      // 开始新小节
                      sectionNumber++;
                      currentSection = {
                          title: trimmedLine,
                          content: line + '\n',
                          number: sectionNumber
                      };
                  } else if (currentSection) {
                      // 添加到当前小节内容
                      currentSection.content += (currentSection.content.endsWith('\n') ? '' : '\n') + line;
                  } else {
                      // 小节标记之前的内容（章节标题等），添加到第一个小节
                      if (sectionNumber === 0) {
                          // 如果还没有小节，创建第一个小节
                          sectionNumber++;
                          currentSection = {
                              title: '第1小节',
                              content: line + '\n',
                              number: 1
                          };
                      } else {
                          currentSection!.content += (currentSection!.content.endsWith('\n') ? '' : '\n') + line;
                      }
                  }
              }
              
              // 保存最后一个小节
              if (currentSection && currentSection.content.trim()) {
                  sections.push(currentSection);
              }
              
              // 如果有小节，按小节拆分；否则按章节拆分
              if (sections.length > 0) {
                  // 按小节拆分
                  for (const section of sections) {
                      allSections.push({
                          title: `${chapterTitleLine}${section.title}`,
                          content: section.content,
                          number: section.number,
                          chapterTitle: chapterTitleLine,
                          chapterNumber: chapter.number
                      });
                  }
              } else {
                  // 没有小节，按章节拆分
                  allSections.push({
                      title: chapter.title,
                      content: chapter.content,
                      number: 0,
                      chapterTitle: chapter.title,
                      chapterNumber: chapter.number
                  });
              }
          }
          
          // 使用 allSections 替代 chapters 进行保存
          const itemsToSave = allSections.length > 0 ? allSections : chapters.map(ch => ({
              title: ch.title,
              content: ch.content,
              number: 0,
              chapterTitle: ch.title,
              chapterNumber: ch.number
          }));

          // 使用 File System Access API（如果支持）或降级到下载
          const supportsFileSystemAccess = 'showDirectoryPicker' in window;

          if (supportsFileSystemAccess) {
              try {
                  // 使用 File System Access API
                  const directoryHandle = await (window as any).showDirectoryPicker();
                  
                  const savedFiles: string[] = [];
                  let saveError: Error | null = null;
                  
                  // 逐个保存文件，如果出错则停止并降级到下载
                  for (let i = 0; i < itemsToSave.length; i++) {
                      try {
                          const item = itemsToSave[i];
                          // 清理文件名，移除非法字符
                          let cleanTitle = item.title.replace(/[<>:"/\\|?*]/g, '').trim();
                          // 确保文件名以 .txt 结尾
                          if (!cleanTitle.endsWith('.txt')) {
                              cleanTitle = cleanTitle || (item.number > 0 ? `${item.chapterTitle}第${item.number}小节` : `第${item.chapterNumber}章`);
                              cleanTitle = cleanTitle + '.txt';
                          }
                          const fileName = cleanTitle;
                          
                          const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                          const writable = await fileHandle.createWritable();
                          await writable.write(item.content);
                          await writable.close();
                          savedFiles.push(fileName);
                      } catch (error: any) {
                          console.error(`保存第 ${i + 1} 个文件失败:`, error);
                          saveError = error;
                          // 如果保存失败，停止并降级到下载
                          break;
                      }
                  }
                  
                  if (saveError) {
                      // 部分文件已保存，但后续失败，降级到下载剩余文件
                      const remainingItems = itemsToSave.slice(savedFiles.length);
                      if (remainingItems.length > 0) {
                          setSplitDocumentResult(`⚠️ 部分文件保存失败，已保存 ${savedFiles.length} 个文件到指定文件夹。\n剩余 ${remainingItems.length} 个文件将通过浏览器下载。\n\n已保存：\n${savedFiles.map(f => `- ${f}`).join('\n')}`);
                          // 延迟后下载剩余文件
                          setTimeout(() => downloadItems(remainingItems, savedFiles.length), 500);
                      } else {
                          setSplitDocumentResult(`✅ 成功拆分 ${itemsToSave.length} 个文件并保存到指定文件夹！\n\n已保存的文件：\n${savedFiles.map(f => `- ${f}`).join('\n')}`);
                      }
                  } else {
                      // 全部成功
                      const totalCount = allSections.length > 0 ? `${chapters.length} 个章节，${itemsToSave.length} 个小节` : `${itemsToSave.length} 个章节`;
                      setSplitDocumentResult(`✅ 成功拆分 ${totalCount}并保存到指定文件夹！\n\n已保存的文件：\n${savedFiles.map(f => `- ${f}`).join('\n')}`);
                  }
              } catch (error: any) {
                  if (error.name === 'AbortError') {
                      setSplitDocumentResult('❌ 用户取消了文件夹选择');
                      setSplitDocumentLoading(false);
                  } else {
                      console.error('File System Access API 错误:', error);
                      // 降级到下载方式
                      downloadItems(itemsToSave);
                  }
              }
          } else {
              // 降级到下载方式
              downloadItems(itemsToSave);
          }
      } catch (error) {
          console.error('拆分文档失败:', error);
          setSplitDocumentResult(`❌ 拆分失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
          setSplitDocumentLoading(false);
      }
  };

  // 下载文件（降级方案，支持章节和小节）
  const downloadItems = (items: Array<{ title: string; content: string; number: number; chapterTitle?: string; chapterNumber?: number }>, startIndex: number = 0) => {
      // 由于浏览器限制，我们逐个下载文件
      // 用户需要手动选择保存位置
      
      let downloadCount = 0;
      const downloadNext = () => {
          if (downloadCount >= items.length) {
              const totalCount = startIndex + items.length;
              setSplitDocumentResult(`✅ 成功拆分 ${totalCount} 个文件！\n\n已下载的文件：\n${items.map(item => {
                  let cleanTitle = item.title.replace(/[<>:"/\\|?*]/g, '').trim();
                  // 确保文件名以 .txt 结尾
                  if (!cleanTitle.endsWith('.txt')) {
                      cleanTitle = cleanTitle || (item.number > 0 ? `${item.chapterTitle || ''}第${item.number}小节` : `第${item.chapterNumber || 0}章`);
                      cleanTitle = cleanTitle + '.txt';
                  }
                  return `- ${cleanTitle}`;
              }).join('\n')}\n\n请选择保存位置。`);
              setSplitDocumentLoading(false);
              return;
          }

          const item = items[downloadCount];
          // 清理文件名，移除非法字符
          let cleanTitle = item.title.replace(/[<>:"/\\|?*]/g, '').trim();
          // 确保文件名以 .txt 结尾
          if (!cleanTitle.endsWith('.txt')) {
              cleanTitle = cleanTitle || (item.number > 0 ? `${item.chapterTitle || ''}第${item.number}小节` : `第${item.chapterNumber || 0}章`);
              cleanTitle = cleanTitle + '.txt';
          }
          const fileName = cleanTitle;
          
          const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          downloadCount++;
          // 延迟下一个下载，避免浏览器阻止多个下载
          setTimeout(downloadNext, 300);
      };

      downloadNext();
  };

  // 下载章节文件（降级方案，保留以兼容旧代码）
  const downloadChapters = (chapters: Array<{ title: string; content: string; number: number }>, startIndex: number = 0) => {
      // 由于浏览器限制，我们逐个下载文件
      // 用户需要手动选择保存位置
      
      let downloadCount = 0;
      const downloadNext = () => {
          if (downloadCount >= chapters.length) {
              const totalCount = startIndex + chapters.length;
              setSplitDocumentResult(`✅ 成功拆分 ${totalCount} 个章节！\n\n已下载的文件：\n${chapters.map(ch => {
                  let cleanTitle = ch.title.replace(/[<>:"/\\|?*]/g, '').trim();
                  // 确保文件名以 .txt 结尾
                  if (!cleanTitle.endsWith('.txt')) {
                      cleanTitle = cleanTitle || `第${ch.number}章`;
                      cleanTitle = cleanTitle + '.txt';
                  }
                  return `- ${cleanTitle}`;
              }).join('\n')}\n\n请选择保存位置。`);
              setSplitDocumentLoading(false);
              return;
          }

          const chapter = chapters[downloadCount];
          // 清理文件名，移除非法字符
          let cleanTitle = chapter.title.replace(/[<>:"/\\|?*]/g, '').trim();
          // 确保文件名以 .txt 结尾
          if (!cleanTitle.endsWith('.txt')) {
              cleanTitle = cleanTitle || `第${chapter.number}章`;
              cleanTitle = cleanTitle + '.txt';
          }
          const fileName = cleanTitle;
          
          const blob = new Blob([chapter.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          downloadCount++;
          // 延迟下一个下载，避免浏览器阻止多个下载
          setTimeout(downloadNext, 300);
      };

      downloadNext();
  };

  const handleCopyBeatContent = (content: string) => {
      if (!content) return;
      navigator.clipboard?.writeText(content).catch(() => {});
  };
  const handleSwitchBlueprint = (id: string) => {
      onUpdateStory({ ...story, activeBlueprintId: id });
  };

  // Outline helpers
  const updateChapter = (updatedChapter: Chapter) => {
      const newOutline = story.outline.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch);
      onUpdateStory({ ...story, outline: newOutline });
  };
  const updateVolume = (updatedVolume: Volume) => {
      const newVolumes = story.volumes.map(v => v.id === updatedVolume.id ? updatedVolume : v);
      onUpdateStory({ ...story, volumes: newVolumes });
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('确定要删除这个角色吗？')) {
      const newCharacters = story.characters.filter(c => c.id !== characterId);
      onUpdateStory({ ...story, characters: newCharacters });
    }
  };

  const handleDeleteChapter = (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      if (!window.confirm(`确定要删除第${chapter.number}章《${chapter.title}》的章纲和正文吗？此操作不可撤销。`)) {
          return;
      }
      const updatedOutline = story.outline.filter(ch => ch.id !== chapterId);
      
      // 删除对应的故事圣经版本
      let updatedStoryBible = story.storyBible;
      if (updatedStoryBible && updatedStoryBible.versions) {
          const chapterVolumeId = chapter.volumeId;
          const chapterVolume = chapterVolumeId ? story.volumes.find(v => v.id === chapterVolumeId) : undefined;
          const chapterVolumeNumber = chapterVolume?.number;
          
          // 删除该章节对应的故事圣经版本
          const updatedVersions = updatedStoryBible.versions.filter(v => 
              !(v.chapterNumber === chapter.number && 
                (chapterVolumeNumber === undefined ? v.volumeNumber === undefined : v.volumeNumber === chapterVolumeNumber))
          );
          
          // 确定新的激活章节号（上一章或最新章）
          let newActiveChapterNumber: number | undefined = undefined;
          let newActiveVolumeNumber: number | undefined = undefined;
          
          if (updatedVersions.length > 0) {
              // 找到删除章节之前的最后一个版本
              const versionsBeforeDeleted = updatedVersions.filter(v => {
                  if (chapterVolumeNumber !== undefined) {
                      return v.volumeNumber === chapterVolumeNumber && v.chapterNumber < chapter.number;
                  } else {
                      return v.volumeNumber === undefined && v.chapterNumber < chapter.number;
                  }
              });
              
              if (versionsBeforeDeleted.length > 0) {
                  // 使用删除章节之前的最后一个版本
                  const lastVersion = versionsBeforeDeleted[versionsBeforeDeleted.length - 1];
                  newActiveChapterNumber = lastVersion.chapterNumber;
                  newActiveVolumeNumber = lastVersion.volumeNumber;
              } else {
                  // 如果没有之前的版本，使用最新的版本
                  const sortedVersions = [...updatedVersions].sort((a, b) => {
                      if (a.volumeNumber !== b.volumeNumber) {
                          return (a.volumeNumber || 0) - (b.volumeNumber || 0);
                      }
                      return a.chapterNumber - b.chapterNumber;
                  });
                  const latestVersion = sortedVersions[sortedVersions.length - 1];
                  newActiveChapterNumber = latestVersion.chapterNumber;
                  newActiveVolumeNumber = latestVersion.volumeNumber;
              }
          }
          
          updatedStoryBible = {
              versions: updatedVersions,
              activeChapterNumber: newActiveChapterNumber,
              activeVolumeNumber: newActiveVolumeNumber
          };
      }
      
      onUpdateStory({ ...story, outline: updatedOutline, storyBible: updatedStoryBible });
      if (activeChapterId === chapterId) {
          setActiveChapterId(updatedOutline.length > 0 ? updatedOutline[0].id : null);
      }
  };

  const handleBatchDeleteChapters = (chapterIds: string[]) => {
      if (chapterIds.length === 0) return;
      
      const chaptersToDelete = chapterIds.map(id => story.outline.find(ch => ch.id === id)).filter(Boolean) as Chapter[];
      if (chaptersToDelete.length === 0) return;
      
      // 删除选中的章节
      const updatedOutline = story.outline.filter(ch => !chapterIds.includes(ch.id));
      
      // 删除对应的故事圣经版本
      let updatedStoryBible = story.storyBible;
      if (updatedStoryBible && updatedStoryBible.versions) {
          const updatedVersions = updatedStoryBible.versions.filter(v => {
              // 检查该版本是否属于被删除的章节
              return !chaptersToDelete.some(ch => {
                  const chapterVolume = ch.volumeId ? story.volumes.find(vol => vol.id === ch.volumeId) : undefined;
                  const chapterVolumeNumber = chapterVolume?.number;
                  return v.chapterNumber === ch.number && 
                         (chapterVolumeNumber === undefined ? v.volumeNumber === undefined : v.volumeNumber === chapterVolumeNumber);
              });
          });
          
          // 确定新的激活章节号（删除后剩余章节中的最新章）
          let newActiveChapterNumber: number | undefined = undefined;
          let newActiveVolumeNumber: number | undefined = undefined;
          
          if (updatedVersions.length > 0) {
              // 使用最新的版本
              const sortedVersions = [...updatedVersions].sort((a, b) => {
                  if (a.volumeNumber !== b.volumeNumber) {
                      return (a.volumeNumber || 0) - (b.volumeNumber || 0);
                  }
                  return a.chapterNumber - b.chapterNumber;
              });
              const latestVersion = sortedVersions[sortedVersions.length - 1];
              newActiveChapterNumber = latestVersion.chapterNumber;
              newActiveVolumeNumber = latestVersion.volumeNumber;
          }
          
          updatedStoryBible = {
              versions: updatedVersions,
              activeChapterNumber: newActiveChapterNumber,
              activeVolumeNumber: newActiveVolumeNumber
          };
      }
      
      onUpdateStory({ ...story, outline: updatedOutline, storyBible: updatedStoryBible });
      
      // 如果当前激活的章节被删除，切换到剩余的第一个章节
      if (activeChapterId && chapterIds.includes(activeChapterId)) {
          setActiveChapterId(updatedOutline.length > 0 ? updatedOutline[0].id : null);
      }
  };

  const handleCreateChapter = () => {
      // 计算下一个章节号
      const existingNumbers = story.outline.map(ch => ch.number);
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const nextNumber = maxNumber + 1;
      
      // 创建新章节
      const initialVersionId = uuidv4();
      const newChapter: Chapter = {
          id: uuidv4(),
          number: nextNumber,
          title: `第${nextNumber}章`,
          summary: "",
          volumeId: undefined,
          activeVersionId: initialVersionId,
          contentVersions: [{
              id: initialVersionId,
              versionName: "初始草稿",
              timestamp: Date.now(),
              text: "",
              isContext: true
          }]
      };
      
      const newOutline = [...story.outline, newChapter].sort((a, b) => a.number - b.number);
      onUpdateStory({ ...story, outline: newOutline });
      setActiveChapterId(newChapter.id);
  };

  const handleCreateChapterWithNumber = () => {
      const chapterNumberStr = window.prompt('请输入章节号：', '');
      if (!chapterNumberStr) return;
      
      const chapterNumber = parseInt(chapterNumberStr, 10);
      if (isNaN(chapterNumber) || chapterNumber < 1) {
          window.alert('请输入有效的章节号（大于0的整数）');
          return;
      }
      
      // 检查章节号是否已存在
      const existingChapter = story.outline.find(ch => ch.number === chapterNumber);
      if (existingChapter) {
          window.alert(`第${chapterNumber}章已存在！`);
          return;
      }
      
      // 创建新章节
      const initialVersionId = uuidv4();
      const newChapter: Chapter = {
          id: uuidv4(),
          number: chapterNumber,
          title: `第${chapterNumber}章`,
          summary: "",
          volumeId: undefined,
          activeVersionId: initialVersionId,
          contentVersions: [{
              id: initialVersionId,
              versionName: "初始草稿",
              timestamp: Date.now(),
              text: "",
              isContext: true
          }]
      };
      
      const newOutline = [...story.outline, newChapter].sort((a, b) => a.number - b.number);
      onUpdateStory({ ...story, outline: newOutline });
      setActiveChapterId(newChapter.id);
  };

  // Manuscript Version Logic
  const getCurrentChapter = () => story.outline.find(ch => ch.id === activeChapterId);
  
  const handleUpdateChapterContent = (newText: string) => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const activeIdx = chapter.contentVersions.findIndex(v => v.id === chapter.activeVersionId);
      if (activeIdx === -1) return;

      const newVersions = [...chapter.contentVersions];
      newVersions[activeIdx] = { ...newVersions[activeIdx], text: newText, timestamp: Date.now() };
      
      updateChapter({ ...chapter, contentVersions: newVersions });
  };

  const handleAddVersion = () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;

      const newId = uuidv4();
      const newVersion: ContentVersion = {
          id: newId,
          versionName: `手动版本 ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          timestamp: Date.now(),
          text: "", // Start with empty text for manual drafts
          isContext: true // 新版本默认作为上下文（会关闭其他版本的上下文）
      };
      
      // 关闭之前活跃版本的上下文开关
      const updatedVersions = chapter.contentVersions.map(v => 
          v.id === chapter.activeVersionId ? { ...v, isContext: false } : v
      );
      
      updateChapter({
          ...chapter,
          contentVersions: [...updatedVersions, newVersion],
          activeVersionId: newId
      });
  };

  const handleSwitchVersion = (versionId: string) => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      // 关闭之前活跃版本的上下文开关，开启新版本的上下文开关
      const updatedVersions = chapter.contentVersions.map(v => {
          if (v.id === chapter.activeVersionId) {
              return { ...v, isContext: false };
          } else if (v.id === versionId) {
              return { ...v, isContext: true };
          }
          return v;
      });
      
      updateChapter({ 
          ...chapter, 
          activeVersionId: versionId,
          contentVersions: updatedVersions
      });
  };


  const handleToggleVersionContext = (versionId: string) => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const targetVersion = chapter.contentVersions.find(v => v.id === versionId);
      if (!targetVersion) return;
      
      // 如果开启，先关闭其他所有版本的上下文开关（单选行为）
      const updatedVersions = chapter.contentVersions.map(v => {
          if (v.id === versionId) {
              return { ...v, isContext: !v.isContext };
          } else {
              // 关闭其他版本的上下文开关
              return { ...v, isContext: false };
          }
      });
      
      updateChapter({ ...chapter, contentVersions: updatedVersions });
  };

  const handleDeleteVersion = (versionId: string) => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const version = chapter.contentVersions.find(v => v.id === versionId);
      if (!version) return;
      
      // 如果删除的是当前显示的版本，需要切换到其他版本
      let newActiveVersionId = chapter.activeVersionId;
      if (versionId === chapter.activeVersionId) {
          // 找到另一个版本作为新的活跃版本
          const otherVersion = chapter.contentVersions.find(v => v.id !== versionId);
          if (!otherVersion) {
              alert("无法删除最后一个版本。");
              return;
          }
          newActiveVersionId = otherVersion.id;
      }
      
      // 不能删除最后一个版本
      if (chapter.contentVersions.length <= 1) {
          alert("无法删除最后一个版本。");
          return;
      }
      
      if (confirm(`确定要删除版本"${version.versionName}"吗？`)) {
          const updatedVersions = chapter.contentVersions.filter(v => v.id !== versionId);
          updateChapter({ 
              ...chapter, 
              contentVersions: updatedVersions,
              activeVersionId: newActiveVersionId
          });
      }
  };

  const handleDeleteChapterContent = () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      if (!confirm('确定要清空当前章节的正文内容吗？此操作不可撤销。')) {
          return;
      }
      
      const activeIdx = chapter.contentVersions.findIndex(v => v.id === chapter.activeVersionId);
      if (activeIdx === -1) return;

      const newVersions = [...chapter.contentVersions];
      newVersions[activeIdx] = { ...newVersions[activeIdx], text: '', timestamp: Date.now() };
      
      updateChapter({ ...chapter, contentVersions: newVersions });
  };

  const handleDeleteCurrentVersion = () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const activeVersion = chapter.contentVersions.find(v => v.id === chapter.activeVersionId);
      if (!activeVersion) return;
      
      // 不能删除最后一个版本
      if (chapter.contentVersions.length <= 1) {
          alert("无法删除最后一个版本。");
          return;
      }
      
      if (!confirm(`确定要删除当前版本"${activeVersion.versionName}"吗？删除后将自动切换到其他版本。`)) {
          return;
      }
      
      // 找到要切换到的版本（优先选择其他版本，如果没有则选择第一个）
      const otherVersions = chapter.contentVersions.filter(v => v.id !== chapter.activeVersionId);
      const newActiveVersionId = otherVersions.length > 0 ? otherVersions[0].id : '';
      
      const updatedVersions = chapter.contentVersions.filter(v => v.id !== chapter.activeVersionId);
      updateChapter({ 
          ...chapter, 
          contentVersions: updatedVersions,
          activeVersionId: newActiveVersionId
      });
  };
  
  // 章纲版本管理函数
  const ensureSummaryVersionState = (chapter: Chapter): { summaryVersions: ContentVersion[], activeSummaryVersionId: string } => {
      if (!chapter.summaryVersions || chapter.summaryVersions.length === 0) {
          // 初始化：从旧的summary字段迁移
          const initialId = uuidv4();
          const initialVersion: ContentVersion = {
              id: initialId,
              versionName: '初始构思',
              timestamp: Date.now(),
              text: chapter.summary || '',
              isContext: true
          };
          return {
              summaryVersions: [initialVersion],
              activeSummaryVersionId: initialId
          };
      }
      return {
          summaryVersions: chapter.summaryVersions,
          activeSummaryVersionId: chapter.activeSummaryVersionId || chapter.summaryVersions[0].id
      };
  };

  const handleAddSummaryVersion = (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const activeVersion = summaryVersions.find(v => v.id === activeSummaryVersionId);
      
      const newId = uuidv4();
      const newVersion: ContentVersion = {
          id: newId,
          versionName: `手动版本 ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          timestamp: Date.now(),
          text: activeVersion?.text || '',
          isContext: true
      };
      
      // 关闭之前活跃版本的上下文开关
      const updatedVersions = summaryVersions.map(v => 
          v.id === activeSummaryVersionId ? { ...v, isContext: false } : v
      );
      
      updateChapter({
          ...chapter,
          summaryVersions: [...updatedVersions, newVersion],
          activeSummaryVersionId: newId,
          summary: newVersion.text // 保持向后兼容
      });
  };

  const handleSwitchSummaryVersion = (chapterId: string, versionId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions } = ensureSummaryVersionState(chapter);
      
      // 关闭之前活跃版本的上下文开关，开启新版本的上下文开关
      const updatedVersions = summaryVersions.map(v => {
          if (v.id === (chapter.activeSummaryVersionId || summaryVersions[0].id)) {
              return { ...v, isContext: false };
          } else if (v.id === versionId) {
              return { ...v, isContext: true };
          }
          return v;
      });
      
      const activeVersion = updatedVersions.find(v => v.id === versionId);
      
      updateChapter({ 
          ...chapter, 
          activeSummaryVersionId: versionId,
          summaryVersions: updatedVersions,
          summary: activeVersion?.text || '' // 保持向后兼容
      });
  };

  const handleToggleSummaryVersionContext = (chapterId: string, versionId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions } = ensureSummaryVersionState(chapter);
      const targetVersion = summaryVersions.find(v => v.id === versionId);
      if (!targetVersion) return;
      
      // 如果开启，先关闭其他所有版本的上下文开关（单选行为）
      const updatedVersions = summaryVersions.map(v => {
          if (v.id === versionId) {
              return { ...v, isContext: !v.isContext };
          } else {
              return { ...v, isContext: false };
          }
      });
      
      updateChapter({ ...chapter, summaryVersions: updatedVersions });
  };

  const handleDeleteSummaryVersion = (chapterId: string, versionId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const version = summaryVersions.find(v => v.id === versionId);
      if (!version) return;
      
      if (summaryVersions.length <= 1) {
          alert("无法删除最后一个版本。");
          return;
      }
      
      let newActiveVersionId = activeSummaryVersionId;
      if (versionId === activeSummaryVersionId) {
          const otherVersion = summaryVersions.find(v => v.id !== versionId);
          if (!otherVersion) {
              alert("无法删除最后一个版本。");
              return;
          }
          newActiveVersionId = otherVersion.id;
      }
      
      if (confirm(`确定要删除版本"${version.versionName}"吗？`)) {
          const updatedVersions = summaryVersions.filter(v => v.id !== versionId);
          const newActiveVersion = updatedVersions.find(v => v.id === newActiveVersionId);
          updateChapter({ 
              ...chapter, 
              summaryVersions: updatedVersions,
              activeSummaryVersionId: newActiveVersionId,
              summary: newActiveVersion?.text || '' // 保持向后兼容
          });
      }
  };

  const handleDeleteCurrentSummaryVersion = (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const activeVersion = summaryVersions.find(v => v.id === activeSummaryVersionId);
      if (!activeVersion) return;
      
      if (summaryVersions.length <= 1) {
          alert("无法删除最后一个版本。");
          return;
      }
      
      if (!confirm(`确定要删除当前版本"${activeVersion.versionName}"吗？删除后将自动切换到其他版本。`)) {
          return;
      }
      
      const otherVersions = summaryVersions.filter(v => v.id !== activeSummaryVersionId);
      const newActiveVersionId = otherVersions.length > 0 ? otherVersions[0].id : '';
      const newActiveVersion = summaryVersions.find(v => v.id === newActiveVersionId);
      
      const updatedVersions = summaryVersions.filter(v => v.id !== activeSummaryVersionId);
      updateChapter({ 
          ...chapter, 
          summaryVersions: updatedVersions,
          activeSummaryVersionId: newActiveVersionId,
          summary: newActiveVersion?.text || '' // 保持向后兼容
      });
  };

  const handleCopySummary = (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const activeVersion = summaryVersions.find(v => v.id === activeSummaryVersionId);
      const summaryText = activeVersion?.text || chapter.summary || '';
      
      navigator.clipboard.writeText(summaryText).then(() => {
          // 可以添加一个提示
      }).catch(err => {
          console.error('复制失败:', err);
      });
  };

  const handleExportSummaryToTxt = async (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const activeVersion = summaryVersions.find(v => v.id === activeSummaryVersionId);
      const summaryText = activeVersion?.text || chapter.summary || '';
      
      if (!summaryText.trim()) {
          alert('当前章纲为空，无法导出。');
          return;
      }
      
      const titleText = `第${chapter.number}章 ${chapter.title}`;
      const fileContent = `${titleText}\n\n${summaryText}`;
      const safeTitle = titleText.replace(/[\\/:*?"<>|]/g, '_');
      const filename = `${safeTitle}_章纲.txt`;
      
      try {
          const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (err) {
          console.error('导出失败:', err);
          alert('导出失败，请重试。');
      }
  };

  const handleDeleteSummaryContent = (chapterId: string) => {
      const chapter = story.outline.find(ch => ch.id === chapterId);
      if (!chapter) return;
      
      if (!confirm('确定要清空当前章节的章纲内容吗？此操作不可撤销。')) {
          return;
      }
      
      const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(chapter);
      const activeIdx = summaryVersions.findIndex(v => v.id === activeSummaryVersionId);
      if (activeIdx === -1) return;

      const newVersions = [...summaryVersions];
      newVersions[activeIdx] = { ...newVersions[activeIdx], text: '', timestamp: Date.now() };
      
      updateChapter({ 
          ...chapter, 
          summaryVersions: newVersions,
          summary: '' // 保持向后兼容
      });
  };

  const handleCopyTitle = () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const titleText = `第${chapter.number}章 ${chapter.title}`;
      navigator.clipboard.writeText(titleText).then(() => {
          // 可以添加一个提示，但为了简洁，这里不添加
      }).catch(err => {
          console.error('复制失败:', err);
      });
  };

  const handleCopyContent = () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
      if (!activeVersion) return;
      
      navigator.clipboard.writeText(activeVersion.text).then(() => {
          // 可以添加一个提示，但为了简洁，这里不添加
      }).catch(err => {
          console.error('复制失败:', err);
      });
  };

  const handleFontSizeChange = (delta: number) => {
      const newSize = Math.max(12, Math.min(32, fontSize + delta));
      setFontSize(newSize);
      localStorage.setItem('storyforge_manuscript_font_size', newSize.toString());
  };

  const handleOutlineFontSizeChange = (delta: number) => {
      const newSize = Math.max(10, Math.min(24, outlineFontSize + delta));
      setOutlineFontSize(newSize);
      localStorage.setItem('storyforge_outline_font_size', newSize.toString());
  };

  const handleExportToTxt = async () => {
      const chapter = getCurrentChapter();
      if (!chapter) return;
      
      const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
      if (!activeVersion) return;

      const rawTitle = `第${chapter.number}章 ${chapter.title}`;
      const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
      const filename = `storyforge_${safeTitle}.txt`;
      const content = `${rawTitle}\n\n${activeVersion.text}`;

      // Feature detection
      if (!('showSaveFilePicker' in window)) {
          // Fallback: use download link
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
      }

      // Security Check: Iframe
      if (window.self !== window.top) {
          alert("安全限制：为了保护您的文件安全，浏览器禁止在预览窗口(iframe)中直接访问本地硬盘。\n\n请在独立窗口(New Tab)中打开此应用以使用导出功能。");
          return;
      }

      try {
          // Use showSaveFilePicker to let user choose save location
          // @ts-ignore
          const fileHandle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{
                  description: 'Text files',
                  accept: { 'text/plain': ['.txt'] }
              }]
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
      } catch (err: any) {
          if (err.name === 'AbortError') {
              return; // User cancelled
          }
          console.error("Export error:", err);
          alert(`导出失败: ${err.message || '未知错误'}`);
      }
  };

  const handleBatchExportOutlines = async (chapterIds: string[]) => {
      if (chapterIds.length === 0) return;
      
      const chaptersToExport = chapterIds.map(id => story.outline.find(ch => ch.id === id)).filter(Boolean) as Chapter[];
      if (chaptersToExport.length === 0) return;
      
      // 按章节号排序
      chaptersToExport.sort((a, b) => a.number - b.number);
      
      // 将所有章纲合并到一个文件
      let combinedContent = '';
      for (const chapter of chaptersToExport) {
          const rawTitle = `第${chapter.number}章 ${chapter.title}`;
          const outlineText = chapter.summary || '（暂无章纲）';
          combinedContent += `${rawTitle}\n\n${outlineText}\n\n${'='.repeat(50)}\n\n`;
      }
      
      // 生成文件名（包含章节范围）
      const storyTitle = story.title || '未命名故事';
      const safeStoryTitle = storyTitle.replace(/[\\/:*?"<>|]/g, '_');
      const firstChapter = chaptersToExport[0].number;
      const lastChapter = chaptersToExport[chaptersToExport.length - 1].number;
      const chapterRange = chaptersToExport.length === 1 
        ? `ch${firstChapter}` 
        : `ch${firstChapter}-ch${lastChapter}`;
      const filename = `${safeStoryTitle}_章纲_${chapterRange}.txt`;
      
      // Feature detection
      if (!('showSaveFilePicker' in window)) {
          // Fallback: use download link
          const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert(`已导出 ${chaptersToExport.length} 个章节的章纲（浏览器不支持选择目录，已下载到默认下载文件夹）`);
          setSelectedOutlineChapterIds(new Set());
          return;
      }
      
      // Security Check: Iframe
      if (window.self !== window.top) {
          alert("安全限制：为了保护您的文件安全，浏览器禁止在预览窗口(iframe)中直接访问本地硬盘。\n\n请在独立窗口(New Tab)中打开此应用以使用导出功能。");
          return;
      }
      
      try {
          // Use showSaveFilePicker to let user choose save location
          // @ts-ignore
          const fileHandle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{
                  description: 'Text files',
                  accept: { 'text/plain': ['.txt'] }
              }]
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(combinedContent);
          await writable.close();
          
          alert(`成功导出 ${chaptersToExport.length} 个章节的章纲到一个文件`);
          setSelectedOutlineChapterIds(new Set());
      } catch (err: any) {
          if (err.name === 'AbortError') {
              return; // User cancelled
          }
          console.error("Export error:", err);
          alert(`导出失败: ${err.message || '未知错误'}`);
      }
  };

  const handleBatchExportManuscript = async (chapterIds: string[], mergeIntoOne: boolean) => {
      if (chapterIds.length === 0) return;
      
      const chaptersToExport = chapterIds.map(id => story.outline.find(ch => ch.id === id)).filter(Boolean) as Chapter[];
      if (chaptersToExport.length === 0) return;
      
      // 按章节号排序
      chaptersToExport.sort((a, b) => a.number - b.number);
      
      // 收集所有章节的正文内容（只导出可见版本）
      const chaptersWithContent: Array<{ chapter: Chapter; content: string }> = [];
      for (const chapter of chaptersToExport) {
          const activeVersion = chapter.contentVersions?.find(v => v.id === chapter.activeVersionId) || chapter.contentVersions?.[0];
          if (activeVersion && activeVersion.text && activeVersion.text.trim().length > 0) {
              chaptersWithContent.push({
                  chapter,
                  content: activeVersion.text
              });
          }
      }
      
      if (chaptersWithContent.length === 0) {
          alert('选中的章节中没有可导出的正文内容（只有可见版本会被导出）');
          return;
      }
      
      // 生成文件名
      const storyTitle = story.title || '未命名故事';
      const safeStoryTitle = storyTitle.replace(/[\\/:*?"<>|]/g, '_');
      
      // Feature detection
      if (!('showSaveFilePicker' in window) && !('showDirectoryPicker' in window)) {
          // Fallback: use download link
          if (mergeIntoOne) {
              // 合并到一个文件
              let combinedContent = '';
              for (const { chapter, content } of chaptersWithContent) {
                  const rawTitle = `第${chapter.number}章 ${chapter.title}`;
                  combinedContent += `${rawTitle}\n\n${content}\n\n${'='.repeat(50)}\n\n`;
              }
              const filename = `${safeStoryTitle}_正文.txt`;
              const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              alert(`已导出 ${chaptersWithContent.length} 个章节的正文到一个文件（浏览器不支持选择目录，已下载到默认下载文件夹）`);
          } else {
              // 每个章节一个文件
              for (const { chapter, content } of chaptersWithContent) {
                  const rawTitle = `第${chapter.number}章 ${chapter.title}`;
                  const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
                  const filename = `${safeStoryTitle}_${safeTitle}.txt`;
                  const fileContent = `${rawTitle}\n\n${content}`;
                  
                  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  
                  // 添加小延迟避免浏览器阻止多个下载
                  await new Promise(resolve => setTimeout(resolve, 100));
              }
              alert(`已导出 ${chaptersWithContent.length} 个章节的正文（浏览器不支持选择目录，已下载到默认下载文件夹）`);
          }
          setSelectedChapterIds(new Set());
          return;
      }
      
      // Security Check: Iframe
      if (window.self !== window.top) {
          alert("安全限制：为了保护您的文件安全，浏览器禁止在预览窗口(iframe)中直接访问本地硬盘。\n\n请在独立窗口(New Tab)中打开此应用以使用导出功能。");
          return;
      }
      
      try {
          if (mergeIntoOne) {
              // 合并到一个文件
              let combinedContent = '';
              for (const { chapter, content } of chaptersWithContent) {
                  const rawTitle = `第${chapter.number}章 ${chapter.title}`;
                  combinedContent += `${rawTitle}\n\n${content}\n\n${'='.repeat(50)}\n\n`;
              }
              // 生成文件名（包含章节范围）
              const firstChapter = chaptersWithContent[0].chapter.number;
              const lastChapter = chaptersWithContent[chaptersWithContent.length - 1].chapter.number;
              const chapterRange = chaptersWithContent.length === 1 
                ? `ch${firstChapter}` 
                : `ch${firstChapter}-ch${lastChapter}`;
              const filename = `${safeStoryTitle}_正文_${chapterRange}.txt`;
              
              // @ts-ignore
              const fileHandle = await window.showSaveFilePicker({
                  suggestedName: filename,
                  types: [{
                      description: 'Text files',
                      accept: { 'text/plain': ['.txt'] }
                  }]
              });
              
              const writable = await fileHandle.createWritable();
              await writable.write(combinedContent);
              await writable.close();
              
              alert(`成功导出 ${chaptersWithContent.length} 个章节的正文到一个文件`);
          } else {
              // 每个章节一个文件，使用目录选择器
              // 必须在用户手势期间直接调用，不能有延迟
              // @ts-ignore
              let directoryHandle;
              try {
                  directoryHandle = await window.showDirectoryPicker({
                      mode: 'readwrite'
                  });
              } catch (dirErr: any) {
                  if (dirErr.name === 'AbortError') {
                      return; // User cancelled
                  }
                  // 如果目录选择失败，降级为文件选择器
                  console.warn('目录选择失败，降级为文件选择器:', dirErr);
                  // 为每个文件单独选择保存位置
                  for (const { chapter, content } of chaptersWithContent) {
                      try {
                          const rawTitle = `第${chapter.number}章 ${chapter.title}`;
                          const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
                          const filename = `${safeStoryTitle}_${safeTitle}.txt`;
                          const fileContent = `${rawTitle}\n\n${content}`;
                          
                          // @ts-ignore
                          const fileHandle = await window.showSaveFilePicker({
                              suggestedName: filename,
                              types: [{
                                  description: 'Text files',
                                  accept: { 'text/plain': ['.txt'] }
                              }]
                          });
                          
                          const writable = await fileHandle.createWritable();
                          await writable.write(fileContent);
                          await writable.close();
                      } catch (fileErr: any) {
                          if (fileErr.name === 'AbortError') {
                              break; // User cancelled
                          }
                          console.error(`导出章节 ${chapter.number} 失败:`, fileErr);
                      }
                  }
                  alert(`已导出部分章节的正文（使用文件选择器）`);
                  setSelectedChapterIds(new Set());
                  return;
              }
              
              let successCount = 0;
              let errorCount = 0;
              
              for (const { chapter, content } of chaptersWithContent) {
                  try {
                      const rawTitle = `第${chapter.number}章 ${chapter.title}`;
                      const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
                      const filename = `${safeTitle}.txt`;
                      const fileContent = `${rawTitle}\n\n${content}`;
                      
                      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
                      const writable = await fileHandle.createWritable();
                      await writable.write(fileContent);
                      await writable.close();
                      
                      successCount++;
                  } catch (err: any) {
                      console.error(`导出章节 ${chapter.number} 失败:`, err);
                      errorCount++;
                  }
              }
              
              if (successCount > 0) {
                  alert(`成功导出 ${successCount} 个章节的正文${errorCount > 0 ? `，${errorCount} 个失败` : ''}`);
              } else {
                  alert(`导出失败：所有 ${chaptersWithContent.length} 个章节都导出失败`);
              }
          }
          
          setSelectedChapterIds(new Set());
      } catch (err: any) {
          if (err.name === 'AbortError') {
              return; // User cancelled
          }
          console.error("Batch export error:", err);
          alert(`批量导出失败: ${err.message || '未知错误'}`);
      }
  };

  // Group world entries - memoized with useMemo
  const groupedWorldGuide = React.useMemo(() => {
    return (story.worldGuide || []).reduce((acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<string, WorldEntry[]>);
  }, [story.worldGuide]);

  // Group guidelines - memoized with useMemo
  const groupedGuidelines = React.useMemo(() => {
    return (story.writingGuidelines || []).reduce((acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<string, WritingGuideline[]>);
  }, [story.writingGuidelines]);

  // Group chapters - sorted by chapter number only
  const sortedChapters = React.useMemo(() => {
    return [...story.outline].sort((a, b) => a.number - b.number);
  }, [story.outline]);

  // Count Chinese characters (more accurate word count)
  const countChineseChars = (text: string): number => {
    if (!text) return 0;
    // Count Chinese characters (CJK unified ideographs)
    // This includes Chinese, Japanese, and Korean characters
    const chineseRegex = /[\u4e00-\u9fff]/g;
    const matches = text.match(chineseRegex);
    return matches ? matches.length : 0;
  };

  // Count total characters (including spaces, punctuation, etc.)
  const countTotalChars = (text: string): number => {
    if (!text) return 0;
    // Remove all whitespace for a more accurate count
    return text.replace(/\s+/g, '').length;
  };

  // Handler for sending message with confirmation
  const handleSendWithConfirmation = (prompt: string, options?: SendMessageOptions, rewriteInfo?: { chapterNumber: number; volumeNumber?: number; systemContent?: string }) => {
    const finalPrompt = enhancePromptForWritingMethod(prompt, options?.mode);
    
    if (getPromptContext) {
      // Show confirmation modal
      setPendingPrompt(finalPrompt);
      setPendingOptions(options);
      setPendingRewriteInfo(rewriteInfo || null);
      setShowConfirmModal(true);
    } else {
      // Fallback: direct send
      if (rewriteInfo && onSilentRewrite) {
        onSilentRewrite(finalPrompt, rewriteInfo.chapterNumber, rewriteInfo.volumeNumber, rewriteInfo.systemContent);
      } else if (onSendMessage) {
        onSendMessage(finalPrompt, options);
      }
    }
  };

  const handleConfirmSend = (editedUserMessage?: string, editedSystemInstruction?: string) => {
    if (!pendingPrompt) return;
    
    const finalMessage = editedUserMessage !== undefined ? editedUserMessage : pendingPrompt;
    const wasEdited = editedUserMessage !== undefined && editedUserMessage !== pendingPrompt;
    
    // 检查是否是静默操作（按章纲写正文、写新版正文、提炼信息）
    const isSilentOperation = pendingOptions?.isSilentOperation || false;
    
    // 如果有 systemContent，将其追加到 editedSystemInstruction 中
    // 注意：editedSystemInstruction 如果存在，应该已经包含了完整的系统提示词（包括范文）
    // systemContent 只是额外的上下文内容（前后章节），应该追加到末尾
    let finalSystemInstruction = editedSystemInstruction;
    if (pendingRewriteInfo?.systemContent) {
      if (finalSystemInstruction) {
        // 用户编辑了系统提示词，将 systemContent 追加到末尾
        finalSystemInstruction = finalSystemInstruction + pendingRewriteInfo.systemContent;
      } else {
        // 用户没有编辑系统提示词，但我们需要传递 systemContent
        // 在这种情况下，App.tsx 会构建系统提示词，然后我们需要将 systemContent 追加
        // 由于 App.tsx 不支持直接传递 systemContent，我们通过 editedSystemInstruction 传递一个占位符
        // 但实际上，更好的方法是让 App.tsx 在构建系统提示词后追加 systemContent
        // 暂时先不处理，因为 App.tsx 的 sendMessage 会构建完整的系统提示词
        // systemContent 应该通过其他方式传递（比如通过 onSilentRewrite）
      }
    }
    
    if (isSilentOperation && onSendMessage) {
      // 静默发送：不显示提示词，只显示通知
      // 如果 editedSystemInstruction 存在，将 systemContent 追加到它后面
      // 如果不存在，通过 systemContent 选项传递，让 App.tsx 在构建系统提示词后追加
      onSendMessage(finalMessage, {
        ...pendingOptions,
        editedSystemInstruction: finalSystemInstruction,
        systemContent: finalSystemInstruction ? undefined : pendingRewriteInfo?.systemContent
      });
    } else if (pendingRewriteInfo && !wasEdited && onSilentRewrite) {
    // If this is a rewrite and user didn't edit the prompt, use silent rewrite
      onSilentRewrite(finalMessage, pendingRewriteInfo.chapterNumber, pendingRewriteInfo.volumeNumber, pendingRewriteInfo.systemContent);
    } else if (onSendMessage) {
      // Otherwise, use normal send (will show in chat)
      onSendMessage(finalMessage, {
        ...pendingOptions,
        editedSystemInstruction: finalSystemInstruction
      });
    }
    
    setPendingPrompt('');
    setPendingOptions(undefined);
    setPendingRewriteInfo(null);
    setShowConfirmModal(false);
  };

  const handleCancelSend = () => {
    setPendingPrompt('');
    setPendingOptions(undefined);
    setPendingRewriteInfo(null);
    setShowConfirmModal(false);
  };

  // Get prompt context for modal using useMemo
  const emptyContext = {};
  const promptModalContent = useMemo<{ promptContext: any; limitedHistory: any[] } | null>(() => {
    if (!showConfirmModal) {
      return null;
    }
    
    // 对于提炼信息操作，使用专用的系统提示词，不使用对话历史
    const isExtractOperation = pendingOptions?.silentOperationInfo?.operationType === 'extract';
    
    if (isExtractOperation) {
      // 使用提炼信息专用的系统提示词
      const extractSystemInstruction = getExtractInfoSystemInstruction();
      return {
        promptContext: {
          systemInstruction: extractSystemInstruction,
          context: {},
          history: []
        },
        limitedHistory: [] // 不使用对话历史
      };
    }
    
    // 对于其他操作，使用通用的 getPromptContext
    if (!getPromptContext) {
      return null;
    }
    
    try {
      const promptContext = getPromptContext(pendingPrompt);
      // For rewrite operations, don't show conversation history (matches actual API call)
      // For manuscript mode, also don't show conversation history
      const isRewrite = pendingRewriteInfo !== null;
      const isManuscript = pendingOptions?.mode === 'manuscript';
      const limitedHistory = (isRewrite || isManuscript) ? [] : (promptContext?.history || []);
      
      // Add system content to system instruction for rewrite operations
      const systemInstruction = isRewrite && pendingRewriteInfo?.systemContent
        ? `${promptContext.systemInstruction}${pendingRewriteInfo.systemContent}`
        : promptContext.systemInstruction;
      
      return {
        promptContext: {
          ...promptContext,
          systemInstruction
        },
        limitedHistory
      };
    } catch (e) {
      return null;
    }
  }, [showConfirmModal, getPromptContext, pendingPrompt, pendingRewriteInfo, pendingOptions]);

  return (
    <>
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Tabs Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10 px-1.5 md:px-4 py-0.5 md:py-1">
        <div className="grid grid-cols-8 gap-1 md:flex md:flex-wrap md:items-center md:gap-1.5">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BookOpen className="w-4 h-4" />} label="简介" />
        <TabButton active={activeTab === 'structure'} onClick={() => setActiveTab('structure')} icon={<GitMerge className="w-4 h-4" />} label="模板" />
        <TabButton active={activeTab === 'outline'} onClick={() => setActiveTab('outline')} icon={<Layers className="w-4 h-4" />} label="章纲" />
        <TabButton active={activeTab === 'manuscript'} onClick={() => setActiveTab('manuscript')} icon={<FileText className="w-4 h-4" />} label="正文" />
        <TabButton active={activeTab === 'characters'} onClick={() => setActiveTab('characters')} icon={<Users className="w-4 h-4" />} label="角色" />
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Globe className="w-4 h-4" />} label="世界书" />
        <TabButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={<Feather className="w-4 h-4" />} label="指导" />
        <TabButton active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} icon={<Wand2 className="w-4 h-4" />} label="工具" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-1 md:p-4 lg:p-8 w-full">
        
        {activeTab === 'overview' && (
          <div className="space-y-4 md:space-y-8 animate-in fade-in duration-300 w-full">
            <section className="space-y-2 w-full">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">主标题</label>
              <EditableField 
                value={story.title} 
                placeholder="无标题故事" 
                onSave={updateTitle}
                className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 hover:opacity-80 w-full"
              />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 w-full">
               <section className="md:col-span-2 space-y-4 w-full min-w-0">
                  <div className="bg-slate-900 rounded-xl p-3 md:p-6 border border-slate-800 shadow-lg relative group w-full min-w-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold">故事简介</h3>
                      <PenLine className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <EditableField 
                      value={story.synopsis} 
                      placeholder="暂无简介。与 Gemini 聊天来构思吧！" 
                      onSave={updateSynopsis}
                      multiline
                      className="text-lg leading-relaxed text-slate-300"
                    />
                  </div>
               </section>

               <section className="space-y-4">
                  <div className="bg-slate-900/50 rounded-xl p-3 md:p-4 border border-slate-800">
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold">备选标题</h3>
                       <button onClick={addAltTitle} className="text-slate-400 hover:text-purple-400 transition-colors">
                         <Plus className="w-4 h-4" />
                       </button>
                    </div>
                    <div className="space-y-2">
                      {((story.alternativeTitles as string[]) || []).map((alt, idx) => (
                        <div key={idx} className="group flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                             <EditableField 
                               value={alt} 
                               onSave={(v) => updateAltTitle(idx, v)} 
                               className="text-slate-300 text-sm block truncate hover:text-purple-300"
                             />
                          </div>
                          <button onClick={() => removeAltTitle(idx)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex items-center justify-between sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm pb-2 mb-4 border-b border-slate-800">
              <h2 className="text-2xl font-semibold">故事模板（逆向拆解）</h2>
            </div>
            
            {activeBlueprint ? (
              <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 overflow-hidden">
                {/* Left: Chapter List */}
                <div className="w-full md:w-[200px] lg:w-[280px] border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0 md:pr-4 overflow-y-auto flex-shrink-0 md:flex-shrink-0 max-h-[200px] md:max-h-none">
                  <div className="space-y-2">
                    {/* 新建章节按钮 */}
                    <div className="mb-3 pb-3 border-b border-slate-800">
                      <button
                        onClick={handleCreateChapter}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition-colors"
                        title="创建新章节（自动编号）"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新建章节
                      </button>
                      <button
                        onClick={handleCreateChapterWithNumber}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                        title="创建指定章节号"
                      >
                        指定章节号
                      </button>
                    </div>
                    {sortedChapters.map(ch => {
                      const deconstruction = activeBlueprint.chapterDeconstructions?.[ch.number] || '';
                      const hasContent = deconstruction && deconstruction.trim().length > 0;
                      
                    return (
                        <div
                          key={ch.id}
                          onClick={() => setActiveBlueprintChapterNumber(ch.number)}
                          className={`relative px-2 py-1.5 rounded transition-colors cursor-pointer ${
                            activeBlueprintChapterNumber === ch.number
                              ? 'bg-purple-900/30 text-white'
                              : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-slate-500">Ch{ch.number}</div>
                              <div className="text-xs font-medium truncate">{ch.title}</div>
                              {hasContent && (
                                <div className="text-[10px] text-emerald-600 mt-0.5">[有模板]</div>
                              )}
                            </div>
                          </div>
                        </div>
                    );
                })}
                    {sortedChapters.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-4">
                        暂无章节
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Editor */}
                <div className="flex-1 min-w-0 w-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-2 md:mt-0">
                  {activeBlueprintChapterNumber ? (() => {
                    const chapter = story.outline.find(ch => ch.number === activeBlueprintChapterNumber);
                    if (!chapter) return null;
                    
                    const { versions, activeVersionId } = ensureDeconstructionVersionState(activeBlueprint, activeBlueprintChapterNumber);
                    const activeVersion = versions.find(v => v.id === activeVersionId);
                    const content = activeVersion?.text || activeBlueprint.chapterDeconstructions?.[activeBlueprintChapterNumber] || '';
                    
                    return (
                      <>
                        {/* Editor Header & Version Control */}
                        <div className="p-2 md:p-4 border-b border-slate-800 bg-slate-950/30 flex flex-col gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <h2 className="font-bold text-slate-200 text-sm md:text-lg">
                                  第{chapter.number}章 {chapter.title}
                                </h2>
                                <button
                                  onClick={() => {
                                    const titleText = `第${chapter.number}章 ${chapter.title}`;
                                    navigator.clipboard.writeText(titleText);
                                  }}
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors flex-shrink-0"
                                  title="复制标题"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {activeVersion && (
                              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
                                <span>总字符: <span className="text-slate-400">{countTotalChars(content)}</span></span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-row items-center gap-1 md:gap-1.5">
                            <div className="flex items-center gap-1 md:gap-2 bg-slate-950 rounded-lg p-0.5 md:p-1 border border-slate-800 flex-[2] md:flex-1 min-w-0 max-w-[calc(100%-90px)] md:max-w-none">
                              <History className="w-3 h-3 md:w-4 md:h-4 text-slate-500 flex-shrink-0" />
                              <select 
                                className="bg-transparent text-slate-300 text-xs outline-none border-none py-0.5 md:py-1 pr-2 md:pr-6 flex-1 min-w-0 truncate"
                                value={activeVersionId}
                                onChange={(e) => handleSwitchDeconstructionVersion(activeBlueprintChapterNumber, e.target.value)}
                              >
                                {versions.map(v => {
                                  const date = new Date(v.timestamp);
                                  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                                  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                                  return (
                                    <option key={v.id} value={v.id}>
                                      {v.versionName} {dateStr} {timeStr}{v.isContext !== false ? ' 👁️' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="flex items-center gap-0.5 md:gap-1 border border-slate-800 rounded-lg p-0.5 md:p-1 bg-slate-950 flex-shrink-0 h-[28px] md:h-auto">
                              {activeVersion && (
                                <button 
                                  onClick={() => handleToggleDeconstructionVersionContext(activeBlueprintChapterNumber, activeVersion.id)}
                                  className={`p-1 md:p-1.5 rounded transition-colors ${
                                    activeVersion.isContext !== false
                                      ? 'text-purple-400 hover:text-purple-300 bg-purple-900/20' 
                                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                                  }`}
                                  title={activeVersion.isContext !== false ? '关闭上下文（不作为上下文发送给AI）' : '开启上下文（作为上下文发送给AI）'}
                                >
                                  <Eye className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeVersion.isContext !== false ? '[&>circle]:fill-purple-400' : ''}`} />
                                </button>
                              )}
                              {activeVersion && versions.length > 1 && activeVersion.id !== activeVersionId && (
                                <button 
                                  onClick={() => handleDeleteDeconstructionVersion(activeBlueprintChapterNumber, activeVersion.id)}
                                  className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors" 
                                  title="删除此版本"
                                >
                                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleAddDeconstructionVersion(activeBlueprintChapterNumber)}
                                className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors" 
                                title="新建版本 (Clone Current)"
                              >
                                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons Bar */}
                        <div className="px-1.5 md:px-3 py-1 md:py-1.5 border-b border-slate-800 bg-slate-950/20 flex items-center gap-1 md:gap-1.5 flex-wrap flex-shrink-0">
                          <button
                            onClick={() => handleCopyDeconstruction(activeBlueprintChapterNumber)}
                            className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="复制逆向拆解"
                          >
                            <Copy className="w-3 h-3" />
                            <span className="hidden sm:inline">复制</span>
                          </button>
                          <button
                            onClick={() => handleExportDeconstructionToTxt(activeBlueprintChapterNumber)}
                            className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                            title="导出逆向拆解到txt文件"
                          >
                            <Upload className="w-3 h-3" />
                            <span className="hidden sm:inline">导出</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDeconstructionContent(activeBlueprintChapterNumber)}
                            className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-orange-400 hover:bg-slate-800 rounded transition-colors"
                            title="清空逆向拆解（保留版本）"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">清空</span>
                          </button>
                          {activeVersion && versions.length > 1 && (
                            <button
                              onClick={() => handleDeleteCurrentDeconstructionVersion(activeBlueprintChapterNumber)}
                              className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                              title="删除当前版本"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden sm:inline">删除版本</span>
                            </button>
                          )}
                          {/* 按模板写正文按钮 */}
                          {content.trim() && (
                            <button
                              onClick={() => {
                                if (!onSendMessage) return;
                                const prompt = buildBlueprintToManuscriptPrompt(
                                  activeBlueprintChapterNumber,
                                  content,
                                  activeBlueprintChapterNumber
                                );
                                const systemContent = buildBlueprintToManuscriptSystemContent(activeBlueprintChapterNumber);
                                const vol = chapter.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
                                handleSendWithConfirmation(prompt, { 
                                  mode: 'manuscript',
                                  isSilentOperation: true,
                                  silentOperationInfo: {
                                    chapterNumber: activeBlueprintChapterNumber,
                                    volumeNumber: vol?.number,
                                    operationType: 'write'
                                  }
                                }, {
                                  chapterNumber: activeBlueprintChapterNumber,
                                  volumeNumber: vol?.number,
                                  systemContent
                                });
                              }}
                              disabled={!onSendMessage}
                              className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 border border-emerald-600/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="按叙事功能模板写正文（使用范文注入，生成原创情节）"
                            >
                              <Play className="w-3 h-3" />
                              <span className="hidden sm:inline">按模板写正文</span>
                              <span className="sm:hidden">写正文</span>
                            </button>
                          )}
                          <div className="flex items-center gap-0.5 border-l border-slate-700 pl-1 ml-0.5">
                            <button
                              onClick={() => handleOutlineFontSizeChange(-1)}
                              className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                              title="减小字体"
                            >
                              <ZoomOut className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] md:text-xs text-slate-500 px-1 min-w-[28px] text-center">{outlineFontSize}px</span>
                            <button
                              onClick={() => handleOutlineFontSizeChange(1)}
                              className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                              title="增大字体"
                            >
                              <ZoomIn className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto p-2 md:p-4">
                          <EditableOutlineField 
                            value={content} 
                            onSave={(v) => handleUpdateChapterDeconstruction(activeBlueprintChapterNumber, v)} 
                            fontSize={outlineFontSize}
                            placeholder="暂无叙事功能模板，请在工具箱中使用「叙事功能逆向拆解」生成"
                          />
                        </div>
                      </>
                    );
                  })() : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <GitMerge className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">请从左侧选择一个章节</p>
                      </div>
                    </div>
                  )}
                </div>
                </div>
            ) : (
                <EmptyState icon={<GitMerge className="w-10 h-10"/>} text="无模板数据" />
            )}
          </div>
        )}

        {activeTab === 'outline' && (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex items-center justify-between sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm pb-2 mb-4 border-b border-slate-800">
              <h2 className="text-2xl font-semibold">章纲</h2>
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                            <button
                  onClick={() => handleOutlineFontSizeChange(-1)}
                  className="p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors"
                  title="减小字体"
                >
                  <ZoomOut className="w-4 h-4" />
                            </button>
                <span className="text-xs text-slate-300 px-2 min-w-[40px] text-center">{outlineFontSize}px</span>
                            <button
                  onClick={() => handleOutlineFontSizeChange(1)}
                  className="p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors"
                  title="增大字体"
                >
                  <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
            <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 overflow-hidden">
              {/* Left: Chapter List */}
              <div className="w-full md:w-[200px] lg:w-[280px] border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0 md:pr-4 overflow-y-auto flex-shrink-0 md:flex-shrink-0 max-h-[200px] md:max-h-none" style={{ overflowX: 'visible' }}>
                <div className="space-y-2">
                  {/* 逆推章节细纲功能 */}
                  {writingMethod === 'reverse_outline' && (
                    <div className="mb-3 pb-3 border-b border-slate-800">
                      <div className="text-xs text-slate-400 mb-2 font-semibold">逆推章节细纲</div>
                      {!reverseOutlineMode ? (
                        <button
                          onClick={() => setReverseOutlineMode(true)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-xs rounded-lg border border-orange-500/30 transition-colors"
                          title="从结局开始逆推章节细纲"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          从结局逆推
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={endingDescription}
                            onChange={(e) => setEndingDescription(e.target.value)}
                            placeholder="请输入结局描述或最终画面..."
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!endingDescription.trim() || !onSendMessage) return;
                                const maxChapterNumber = story.outline.length > 0 
                                  ? Math.max(...story.outline.map(ch => ch.number))
                                  : 0;
                                const finalChapterNumber = maxChapterNumber + 1;
                                const prompt = buildReverseFinalChapterOutlinePrompt(endingDescription);
                                handleSendWithConfirmation(prompt, { mode: 'general' });
                                setReverseOutlineMode(false);
                                setEndingDescription('');
                              }}
                              disabled={!endingDescription.trim()}
                              className="flex-1 px-2 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-orange-300 text-xs rounded border border-orange-500/30 transition-colors"
                            >
                              生成最终章
                            </button>
                            <button
                              onClick={() => {
                                setReverseOutlineMode(false);
                                setEndingDescription('');
                              }}
                              className="px-2 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-400 text-xs rounded border border-slate-700 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                      {sortedChapters.length > 0 && (
                        <button
                          onClick={() => {
                            const sorted = [...sortedChapters].sort((a, b) => b.number - a.number);
                            const lastChapter = sorted[0];
                            if (!lastChapter || !onSendMessage) return;
                            setReverseOutliningChapter(lastChapter);
                            const previousChapter = sorted.find(ch => ch.number === lastChapter.number - 1);
                            const prompt = buildReversePreviousChapterOutlinePrompt(lastChapter, previousChapter);
                            handleSendWithConfirmation(prompt, { mode: 'general' });
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 text-xs rounded-lg border border-orange-500/20 transition-colors"
                          title="从最后一章逆推前一章"
                        >
                          <RotateCcw className="w-3 h-3" />
                          逆推前一章
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* 新建章节按钮 */}
                  <div className="mb-3 pb-3 border-b border-slate-800">
                                    <button
                      onClick={handleCreateChapter}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition-colors"
                      title="创建新章节（自动编号）"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新建章节
                                    </button>
                                            <button
                      onClick={handleCreateChapterWithNumber}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                      title="创建指定章节号"
                    >
                      指定章节号
                                            </button>
                  </div>
                  {/* 批量操作工具栏 */}
                  {sortedChapters.length > 0 && (
                    <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm mb-3 pb-3 border-b border-slate-800 flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedOutlineChapterIds.size === sortedChapters.length && sortedChapters.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOutlineChapterIds(new Set(sortedChapters.map(ch => ch.id)));
                            } else {
                              setSelectedOutlineChapterIds(new Set());
                            }
                          }}
                          className="w-3.5 h-3.5 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-[10px]">全选</span>
                      </label>
                      {selectedOutlineChapterIds.size > 0 && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            await handleBatchExportOutlines(Array.from(selectedOutlineChapterIds));
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/30 transition-colors cursor-pointer"
                          title={`导出选中的 ${selectedOutlineChapterIds.size} 个章节章纲到一个TXT文件`}
                          type="button"
                        >
                          <Download className="w-3 h-3" />
                          <span>导出({selectedOutlineChapterIds.size})</span>
                        </button>
                      )}
                    </div>
                  )}
                  {sortedChapters.map(ch => (
                    <div
                      key={ch.id}
                      className={`relative px-2 py-1.5 rounded transition-colors ${
                        activeChapterId === ch.id
                          ? 'bg-purple-900/30 text-white'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                      style={{ overflow: 'visible' }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedOutlineChapterIds.has(ch.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedOutlineChapterIds);
                            if (e.target.checked) {
                              newSelected.add(ch.id);
                            } else {
                              newSelected.delete(ch.id);
                            }
                            setSelectedOutlineChapterIds(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer flex-shrink-0"
                          title="选择章节"
                        />
                      <div 
                        onClick={() => setActiveChapterId(ch.id)}
                        className="cursor-pointer flex-1 min-w-0 pr-6"
                      >
                        <div className="text-xs font-mono text-slate-500">Ch{ch.number}</div>
                        {editingChapterTitleId === ch.id ? (
                          <input
                            type="text"
                            value={editingChapterTitle}
                            onChange={(e) => setEditingChapterTitle(e.target.value)}
                            onBlur={() => handleSaveTitle(ch.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveTitle(ch.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditTitle();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs md:text-sm bg-slate-800 border border-purple-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-xs md:text-sm truncate"
                            title={ch.title}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleStartEditTitle(ch.id, ch.title);
                            }}
                          >
                            {ch.title}
                          </div>
                        )}
                        </div>
                      </div>
                      {/* 左侧章纲列表菜单 */}
                      <div className="relative" style={{ overflow: 'visible' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOutlineChapterMenuOpen(outlineChapterMenuOpen === ch.id ? null : ch.id);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors bg-slate-900/80 backdrop-blur-sm"
                          title="章节操作"
                          type="button"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {outlineChapterMenuOpen === ch.id && (
                          <div 
                            ref={(el) => {
                            if (el) outlineMenuRefs.current.set(ch.id, el);
                            else outlineMenuRefs.current.delete(ch.id);
                            }} 
                            className="outline-chapter-menu absolute right-1 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[99999] min-w-[150px] whitespace-nowrap"
                          >
                            {/* 逆推上一章选项（仅在逆推写作方法下且章节号大于1时显示） */}
                            {writingMethod === 'reverse_outline' && ch.number > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOutlineChapterMenuOpen(null);
                                  if (!onSendMessage) return;
                                  const previousChapter = story.outline.find(c => c.number === ch.number - 1);
                                  const prompt = buildReversePreviousChapterOutlinePrompt(ch, previousChapter);
                                  handleSendWithConfirmation(prompt, { mode: 'general' });
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-orange-300 hover:bg-slate-700 flex items-center gap-2 border-b border-slate-700/50"
                              >
                                <RotateCcw className="w-4 h-4 text-orange-400" />
                                逆推上一章
                              </button>
                            )}
                            {/* 精雕章纲选项 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOutlineChapterMenuOpen(null);
                                if (onSendMessage) {
                                  const prompt = getChapterOutlinePrompt(ch);
                                  handleSendWithConfirmation(prompt, { mode: 'general' });
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Sparkles className="w-4 h-4 text-purple-400" />
                              精雕章纲
                            </button>
                            {/* 生成正文选项 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOutlineChapterMenuOpen(null);
                                if (onSendMessage) {
                                  const prompt = getChapterManuscriptPrompt(ch);
                                  const vol = ch.volumeId ? story.volumes.find(v => v.id === ch.volumeId) : undefined;
                                  handleSendWithConfirmation(prompt, { 
                                    mode: 'manuscript',
                                    isSilentOperation: true,
                                    silentOperationInfo: {
                                      chapterNumber: ch.number,
                                      volumeNumber: vol?.number,
                                      operationType: 'write'
                                    }
                                  });
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4 text-blue-400" />
                              按章纲写正文
                            </button>
                            {/* 删除章纲选项 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOutlineChapterMenuOpen(null);
                                handleDeleteChapter(ch.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-slate-900 flex items-center gap-2 border-t border-slate-700/50"
                            >
                              <Trash2 className="w-4 h-4" />
                              删除章纲
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                    </div>
                </div>
              
              {/* Right: Chapter Detail */}
              <div className="flex-1 min-w-0 w-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-2 md:mt-0">
                {activeChapterId ? (() => {
                  const activeChapter = story.outline.find(ch => ch.id === activeChapterId);
                  if (!activeChapter) return <div className="text-slate-500 p-4">章节不存在</div>;
                  
                  const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(activeChapter);
                  const activeSummaryVersion = summaryVersions.find(v => v.id === activeSummaryVersionId);
                  const summaryText = activeSummaryVersion?.text || activeChapter.summary || '';
                  
                  return (
                    <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                      {/* Editor Header & Version Control */}
                      <div className="p-2 md:p-4 border-b border-slate-800 bg-slate-950/30 flex flex-col gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <h2 className="font-bold text-slate-200 text-sm md:text-lg">
                                第{activeChapter.number}章 {activeChapter.title}
                              </h2>
                              <button
                                onClick={() => {
                                  const titleText = `第${activeChapter.number}章 ${activeChapter.title}`;
                                  navigator.clipboard.writeText(titleText);
                                }}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors flex-shrink-0"
                                title="复制标题"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {activeSummaryVersion && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
                              <span>总字符: <span className="text-slate-400">{countTotalChars(summaryText)}</span></span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row items-center gap-1 md:gap-1.5">
                          <div className="flex items-center gap-1 md:gap-2 bg-slate-950 rounded-lg p-0.5 md:p-1 border border-slate-800 flex-[2] md:flex-1 min-w-0 max-w-[calc(100%-90px)] md:max-w-none">
                            <History className="w-3 h-3 md:w-4 md:h-4 text-slate-500 flex-shrink-0" />
                            <select 
                              className="bg-transparent text-slate-300 text-xs outline-none border-none py-0.5 md:py-1 pr-2 md:pr-6 flex-1 min-w-0 truncate"
                              value={activeSummaryVersionId}
                              onChange={(e) => handleSwitchSummaryVersion(activeChapter.id, e.target.value)}
                            >
                              {summaryVersions.map(v => {
                                const date = new Date(v.timestamp);
                                const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                                const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <option key={v.id} value={v.id}>
                                    {v.versionName} {dateStr} {timeStr}{v.isContext !== false ? ' 👁️' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="flex items-center gap-0.5 md:gap-1 border border-slate-800 rounded-lg p-0.5 md:p-1 bg-slate-950 flex-shrink-0 h-[28px] md:h-auto">
                            {activeSummaryVersion && (
                              <button 
                                onClick={() => handleToggleSummaryVersionContext(activeChapter.id, activeSummaryVersion.id)}
                                className={`p-1 md:p-1.5 rounded transition-colors ${
                                  activeSummaryVersion.isContext !== false
                                    ? 'text-purple-400 hover:text-purple-300 bg-purple-900/20' 
                                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                                title={activeSummaryVersion.isContext !== false ? '关闭上下文（不作为上下文发送给AI）' : '开启上下文（作为上下文发送给AI）'}
                              >
                                <Eye className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeSummaryVersion.isContext !== false ? '[&>circle]:fill-purple-400' : ''}`} />
                              </button>
                            )}
                            {activeSummaryVersion && summaryVersions.length > 1 && activeSummaryVersion.id !== activeSummaryVersionId && (
                              <button 
                                onClick={() => handleDeleteSummaryVersion(activeChapter.id, activeSummaryVersion.id)}
                                className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors" 
                                title="删除此版本"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleAddSummaryVersion(activeChapter.id)}
                              className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors" 
                              title="新建版本 (Clone Current)"
                            >
                              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons Bar */}
                      <div className="px-1.5 md:px-3 py-1 md:py-1.5 border-b border-slate-800 bg-slate-950/20 flex items-center gap-1 md:gap-1.5 flex-wrap flex-shrink-0">
                        <div className="flex items-center gap-1 border-r border-slate-700 pr-1 mr-0.5">
                          <button
                            onClick={() => {
                              if (onSendMessage) {
                                const prompt = getChapterOutlinePrompt(activeChapter);
                                handleSendWithConfirmation(prompt, { mode: 'general' });
                              }
                            }}
                            className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-900/30 rounded transition-colors border border-purple-500/30"
                            title="让AI精雕章纲"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span className="hidden sm:inline">提炼信息</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleCopySummary(activeChapter.id)}
                          className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          title="复制章纲"
                        >
                          <Copy className="w-3 h-3" />
                          <span className="hidden sm:inline">复制</span>
                        </button>
                        <button
                          onClick={() => handleExportSummaryToTxt(activeChapter.id)}
                          className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                          title="导出章纲到txt文件"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="hidden sm:inline">导出</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSummaryContent(activeChapter.id)}
                          className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-orange-400 hover:bg-slate-800 rounded transition-colors"
                          title="清空章纲（保留版本）"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">清空</span>
                        </button>
                        {activeSummaryVersion && summaryVersions.length > 1 && (
                          <button
                            onClick={() => handleDeleteCurrentSummaryVersion(activeChapter.id)}
                            className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                            title="删除当前版本"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">删除版本</span>
                          </button>
                        )}
                        <div className="flex items-center gap-0.5 border-l border-slate-700 pl-1 ml-0.5">
                          <button
                            onClick={() => handleOutlineFontSizeChange(-1)}
                            className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                            title="减小字体"
                          >
                            <ZoomOut className="w-3 h-3" />
                          </button>
                          <span className="text-[9px] md:text-xs text-slate-500 px-1 min-w-[28px] text-center">{outlineFontSize}px</span>
                          <button
                            onClick={() => handleOutlineFontSizeChange(1)}
                            className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                            title="增大字体"
                          >
                            <ZoomIn className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Text Area */}
                      <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-slate-900 min-h-0">
                        <EditableOutlineField 
                          value={summaryText} 
                          placeholder="暂无章纲内容，点击此处编辑"
                          onSave={(v) => {
                            const { summaryVersions, activeSummaryVersionId } = ensureSummaryVersionState(activeChapter);
                            const activeIdx = summaryVersions.findIndex(v => v.id === activeSummaryVersionId);
                            if (activeIdx === -1) {
                              // 如果没有版本，创建一个
                              const newId = uuidv4();
                              const newVersion: ContentVersion = {
                                id: newId,
                                versionName: '初始构思',
                                timestamp: Date.now(),
                                text: v,
                                isContext: true
                              };
                              updateChapter({
                                ...activeChapter,
                                summaryVersions: [newVersion],
                                activeSummaryVersionId: newId,
                                summary: v
                              });
                            } else {
                              const newVersions = [...summaryVersions];
                              newVersions[activeIdx] = { ...newVersions[activeIdx], text: v, timestamp: Date.now() };
                              updateChapter({
                                ...activeChapter,
                                summaryVersions: newVersions,
                                summary: v
                              });
                            }
                          }} 
                          fontSize={outlineFontSize}
                        />
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-slate-500 p-4 text-center">请从左侧选择章节查看详情</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manuscript' && (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 overflow-hidden">
             {/* Left: Chapter Nav */}
             <div className="w-full md:w-[200px] lg:w-[280px] border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0 md:pr-4 overflow-y-auto flex-shrink-0 md:flex-shrink-0 max-h-[200px] md:max-h-none">
                <div className="space-y-2">
                    {/* 新建章节按钮 */}
                    <div className="mb-3 pb-3 border-b border-slate-800">
                      <button
                        onClick={handleCreateChapter}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition-colors"
                        title="创建新章节（自动编号）"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新建章节
                      </button>
                      <button
                        onClick={handleCreateChapterWithNumber}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                        title="创建指定章节号"
                      >
                        指定章节号
                      </button>
                    </div>
                    {/* 批量操作工具栏 */}
                    {sortedChapters.length > 0 && (
                      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm mb-3 pb-3 border-b border-slate-800 flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedChapterIds.size === sortedChapters.length && sortedChapters.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChapterIds(new Set(sortedChapters.map(ch => ch.id)));
                              } else {
                                setSelectedChapterIds(new Set());
                              }
                            }}
                            className="w-3.5 h-3.5 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[10px]">全选</span>
                        </label>
                        {selectedChapterIds.size > 0 && (
                          <>
                            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exportManuscriptAsSingleFile}
                                onChange={(e) => {
                                  setExportManuscriptAsSingleFile(e.target.checked);
                                }}
                                className="w-3.5 h-3.5 accent-emerald-500 bg-slate-800 border border-slate-600 rounded focus:ring-emerald-500 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-[10px]">合并导出</span>
                            </label>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                await handleBatchExportManuscript(Array.from(selectedChapterIds), exportManuscriptAsSingleFile);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/30 transition-colors cursor-pointer"
                              title={`导出选中的 ${selectedChapterIds.size} 个章节正文${exportManuscriptAsSingleFile ? '（合并到一个文件）' : '（每个章节一个文件）'}`}
                              type="button"
                            >
                              <Download className="w-3 h-3" />
                              <span>导出({selectedChapterIds.size})</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const selectedChapters = sortedChapters.filter(ch => selectedChapterIds.has(ch.id));
                                const chapterNumbers = selectedChapters.map(ch => ch.number).sort((a, b) => a - b);
                                if (window.confirm(`确定要删除选中的 ${selectedChapterIds.size} 个章节（第${chapterNumbers.join('、')}章）吗？此操作不可撤销。`)) {
                                  handleBatchDeleteChapters(Array.from(selectedChapterIds));
                                  setSelectedChapterIds(new Set());
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded border border-red-500/30 transition-colors"
                              title={`删除选中的 ${selectedChapterIds.size} 个章节`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>删除({selectedChapterIds.size})</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {sortedChapters.map(ch => (
                        <div key={ch.id} className="relative mb-1">
                            <div 
                                onClick={() => setActiveChapterId(ch.id)}
                                className={`w-full text-left px-1 md:px-3 py-1 md:py-2 rounded text-xs md:text-sm flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer ${activeChapterId === ch.id ? 'bg-purple-900/30 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedChapterIds.has(ch.id)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            const newSelected = new Set(selectedChapterIds);
                                            if (e.target.checked) {
                                                newSelected.add(ch.id);
                                            } else {
                                                newSelected.delete(ch.id);
                                            }
                                            setSelectedChapterIds(newSelected);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-3.5 h-3.5 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                        title="选择章节"
                                    />
                                <span className="truncate md:mr-2 w-full md:w-auto" title={ch.title}>
                                    <span className="font-mono">Ch{ch.number}</span>
                                    {editingChapterTitleId === ch.id ? (
                                      <input
                                        type="text"
                                        value={editingChapterTitle}
                                        onChange={(e) => setEditingChapterTitle(e.target.value)}
                                        onBlur={() => handleSaveTitle(ch.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveTitle(ch.id);
                                          } else if (e.key === 'Escape') {
                                            handleCancelEditTitle();
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hidden md:inline ml-1 text-xs md:text-sm bg-slate-800 border border-purple-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        autoFocus
                                      />
                                    ) : (
                                      <span 
                                        className="hidden md:inline"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEditTitle(ch.id, ch.title);
                                        }}
                                      >
                                        {' '}{ch.title}
                                      </span>
                                    )}
                                </span>
                                </div>
                                <div className="flex items-center gap-1 md:flex">
                                    {activeChapterId === ch.id && <ChevronRight className="w-3 h-3 hidden md:block" />}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setChapterMenuOpen(chapterMenuOpen === ch.id ? null : ch.id);
                                        }}
                                        className="p-1 hover:bg-slate-700 rounded hidden md:block"
                                        title="章节操作"
                                        type="button"
                                    >
                                        <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {/* Chapter Action Menu */}
                            {chapterMenuOpen === ch.id && (
                                        <div ref={(el) => {
                                          if (el) menuRefs.current.set(ch.id, el);
                                          else menuRefs.current.delete(ch.id);
                                        }} className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[150px]">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChapterMenuOpen(null);
                                                    // Trigger AI to refine chapter outline
                                                    if (onSendMessage) {
                                                    const prompt = getChapterOutlinePrompt(ch);
                                                        handleSendWithConfirmation(prompt, { mode: 'general' });
                                                    }
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 border-b border-slate-700/50"
                                            >
                                                <Sparkles className="w-4 h-4 text-purple-400" />
                                                精雕章纲
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChapterMenuOpen(null);
                                                    try {
                                                      if (!onSendMessage) {
                                                        console.error('❌ onSendMessage is not available');
                                                        return;
                                                      }
                                                    const prompt = getChapterManuscriptPrompt(ch);
                                                      const vol = ch.volumeId ? story.volumes.find(v => v.id === ch.volumeId) : undefined;
                                                      handleSendWithConfirmation(prompt, { 
                                                        mode: 'manuscript',
                                                        isSilentOperation: true,
                                                        silentOperationInfo: {
                                                          chapterNumber: ch.number,
                                                          volumeNumber: vol?.number,
                                                          operationType: 'write'
                                                        }
                                                      });
                                                    } catch (error) {
                                                      console.error('❌ Error in 按章纲写正文 button:', error);
                                                    }
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                                disabled={!onSendMessage}
                                            >
                                                <Play className="w-4 h-4 text-emerald-400" />
                                                按章纲写正文
                                            </button>
                                            {(() => {
                                              const chapter = story.outline.find(c => c.id === ch.id);
                                              const hasContent = chapter && getChapterContentText(chapter).trim().length > 0;
                                              const vol = chapter?.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
                                              return hasContent ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChapterMenuOpen(null);
                                                    if (chapter) {
                                                      if (onSendMessage) {
                                                      const prompt = buildRewriteManuscriptPrompt(chapter);
                                                      const systemContent = buildRewriteSystemContent(chapter);
                                                        handleSendWithConfirmation(prompt, { 
                                                          mode: 'manuscript',
                                                          isSilentOperation: true,
                                                          silentOperationInfo: {
                                                            chapterNumber: chapter.number,
                                                            volumeNumber: vol?.number,
                                                            operationType: 'rewrite'
                                                          }
                                                        }, {
                                                          chapterNumber: chapter.number,
                                                          volumeNumber: vol?.number,
                                                          systemContent
                                                        });
                                                      }
                                                    }
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                >
                                                  <RefreshCw className="w-4 h-4 text-orange-400" />
                                                  写新版正文
                                                </button>
                                              ) : null;
                                            })()}
                                            {(() => {
                                              const chapter = story.outline.find(c => c.id === ch.id);
                                              const hasContent = chapter && getChapterContentText(chapter).trim().length > 0;
                                              const vol = chapter?.volumeId ? story.volumes.find(v => v.id === chapter.volumeId) : undefined;
                                              return hasContent ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChapterMenuOpen(null);
                                                    if (chapter) {
                                                      if (onSendMessage) {
                                                        const prompt = buildContinueNextChapterPrompt(chapter);
                                                        const systemContent = buildContinueNextChapterSystemContent(chapter);
                                                        const nextChapterNumber = chapter.number + 1;
                                                        handleSendWithConfirmation(prompt, { 
                                                          mode: 'manuscript',
                                                          isSilentOperation: true,
                                                          silentOperationInfo: {
                                                            chapterNumber: nextChapterNumber,
                                                            volumeNumber: vol?.number,
                                                            operationType: 'continue'
                                                          }
                                                        }, {
                                                          chapterNumber: nextChapterNumber,
                                                          volumeNumber: vol?.number,
                                                          systemContent
                                                        });
                                                      }
                                                    }
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                >
                                                  <ChevronRight className="w-4 h-4 text-blue-400" />
                                                  续写下一章
                                                </button>
                                              ) : null;
                                            })()}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChapterMenuOpen(null);
                                                    handleDeleteChapter(ch.id);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-slate-900 flex items-center gap-2 border-t border-slate-700/50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                删除章纲
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                </div>
             </div>

             {/* Right: Editor */}
             <div className="flex-1 min-w-0 w-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-2 md:mt-0">
                {activeChapterId ? (() => {
                    const activeChapter = getCurrentChapter();
                    if (!activeChapter) return null;
                    let activeVersion = activeChapter.contentVersions?.find(v => v.id === activeChapter.activeVersionId) || activeChapter.contentVersions?.[0];
                    
                    // Ensure active version is locked and set as context by default (one-time initialization)
                    if (activeVersion && activeVersion.isContext === undefined && !initializedVersionsRef.current.has(activeVersion.id)) {
                        initializedVersionsRef.current.add(activeVersion.id);
                        const updatedVersions = activeChapter.contentVersions.map(v => {
                            if (v.id === activeVersion.id) {
                                return {
                                    ...v,
                                    isContext: v.isContext !== undefined ? v.isContext : true
                                };
                            } else {
                                // 确保其他版本的上下文开关关闭
                                return { ...v, isContext: false };
                            }
                        });
                        updateChapter({ ...activeChapter, contentVersions: updatedVersions });
                        activeVersion = { 
                            ...activeVersion, 
                            isContext: true
                        };
                    }

                    return (
                        <>
                            {/* Editor Header & Version Control */}
                            <div className="p-2 md:p-4 border-b border-slate-800 bg-slate-950/30 flex flex-col gap-2 overflow-x-hidden w-full max-w-full">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex items-start justify-between gap-2 w-full">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {editingChapterTitleId === activeChapter.id ? (
                                              <input
                                                type="text"
                                                value={editingChapterTitle}
                                                onChange={(e) => setEditingChapterTitle(e.target.value)}
                                                onBlur={() => handleSaveTitle(activeChapter.id)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveTitle(activeChapter.id);
                                                  } else if (e.key === 'Escape') {
                                                    handleCancelEditTitle();
                                                  }
                                                }}
                                                className="flex-1 font-bold text-slate-200 text-sm md:text-lg bg-slate-800 border border-purple-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                autoFocus
                                              />
                                            ) : (
                                              <h2 
                                                className="font-bold text-slate-200 text-sm md:text-lg truncate cursor-pointer hover:text-purple-300 transition-colors"
                                                onDoubleClick={() => handleStartEditTitle(activeChapter.id, activeChapter.title)}
                                                title="双击编辑标题"
                                              >
                                                第{activeChapter.number}章 {activeChapter.title}
                                              </h2>
                                            )}
                                            <button
                                                onClick={handleCopyTitle}
                                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors flex-shrink-0"
                                                title="复制标题"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                </div>
                                    </div>
                                    {activeVersion ? (
                                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
                                            <span>总字符: <span className="text-slate-400">{countTotalChars(activeVersion.text)}</span></span>
                                            {activeVersion.modelId && (
                                                <span className="truncate max-w-[120px] md:max-w-[200px]" title={activeVersion.modelId}>
                                                    模型: <span className="text-blue-400 font-mono text-[10px] md:text-xs">{activeVersion.modelId.split('/').pop() || activeVersion.modelId}</span>
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 mt-1">总字符: 0</p>
                                    )}
                                </div>

                                <div className="flex flex-row items-center gap-1 md:gap-1.5 w-full overflow-x-auto">
                                    <div className="flex items-center gap-1 md:gap-2 bg-slate-950 rounded-lg p-0.5 md:p-1 border border-slate-800 flex-1 min-w-0">
                                        <History className="w-3 h-3 md:w-4 md:h-4 text-slate-500 flex-shrink-0" />
                                    <select 
                                            className="bg-transparent text-slate-300 text-xs outline-none border-none py-0.5 md:py-1 pr-2 md:pr-6 flex-1 min-w-0 truncate"
                                        value={activeChapter.activeVersionId}
                                        onChange={(e) => handleSwitchVersion(e.target.value)}
                                    >
                                        {activeChapter.contentVersions?.map(v => {
                                            const date = new Date(v.timestamp);
                                            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                                            const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                                            return (
                                            <option key={v.id} value={v.id}>
                                                    {v.versionName} {dateStr} {timeStr}{v.isContext !== false ? ' 👁️' : ''}
                                            </option>
                                            );
                                        })}
                                    </select>
                                    </div>

                                    <div className="flex items-center gap-0.5 md:gap-1 border border-slate-800 rounded-lg p-0.5 md:p-1 bg-slate-950 flex-shrink-0 h-[28px] md:h-auto">
                                        {activeVersion && (
                                            <button 
                                                onClick={() => handleToggleVersionContext(activeVersion.id)}
                                                className={`p-1 md:p-1.5 rounded transition-colors ${
                                                    activeVersion.isContext !== false
                                                        ? 'text-purple-400 hover:text-purple-300 bg-purple-900/20' 
                                                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                                                }`}
                                                title={activeVersion.isContext !== false ? '关闭上下文（不作为上下文发送给AI）' : '开启上下文（作为上下文发送给AI）'}
                                            >
                                                <Eye className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeVersion.isContext !== false ? '[&>circle]:fill-purple-400' : ''}`} />
                                            </button>
                                        )}
                                        {activeVersion && activeChapter.contentVersions.length > 1 && activeVersion.id !== activeChapter.activeVersionId && (
                                            <button 
                                                onClick={() => handleDeleteVersion(activeVersion.id)}
                                                className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors" 
                                                title="删除此版本"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                            </button>
                                        )}
                                    <button 
                                        onClick={handleAddVersion}
                                            className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors" 
                                        title="新建版本 (Clone Current)"
                                    >
                                        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                    {(() => {
                                      const hasContent = getChapterContentText(activeChapter).trim().length > 0;
                                      const vol = activeChapter.volumeId ? story.volumes.find(v => v.id === activeChapter.volumeId) : undefined;
                                      return hasContent ? (
                                        <>
                                        <button
                                          onClick={() => {
                                            if (onSendMessage) {
                                            const prompt = buildRewriteManuscriptPrompt(activeChapter);
                                            const systemContent = buildRewriteSystemContent(activeChapter);
                                              handleSendWithConfirmation(prompt, { 
                                                mode: 'manuscript',
                                                isSilentOperation: true,
                                                silentOperationInfo: {
                                                  chapterNumber: activeChapter.number,
                                                  volumeNumber: vol?.number,
                                                  operationType: 'rewrite'
                                                }
                                              }, {
                                                chapterNumber: activeChapter.number,
                                                volumeNumber: vol?.number,
                                                systemContent
                                              });
                                            }
                                          }}
                                          className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-orange-400 hover:text-orange-300 transition-colors"
                                          title="写新版正文（结合前后章节内容）"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </button>
                                          <button
                                            onClick={() => {
                                              if (onSendMessage) {
                                                const prompt = buildContinueNextChapterPrompt(activeChapter);
                                                const systemContent = buildContinueNextChapterSystemContent(activeChapter);
                                                const nextChapterNumber = activeChapter.number + 1;
                                                handleSendWithConfirmation(prompt, { 
                                                  mode: 'manuscript',
                                                  isSilentOperation: true,
                                                  silentOperationInfo: {
                                                    chapterNumber: nextChapterNumber,
                                                    volumeNumber: vol?.number,
                                                    operationType: 'continue'
                                                  }
                                                }, {
                                                  chapterNumber: nextChapterNumber,
                                                  volumeNumber: vol?.number,
                                                  systemContent
                                                });
                                              }
                                            }}
                                            className="p-1 md:p-1.5 hover:bg-slate-800 rounded text-blue-400 hover:text-blue-300 transition-colors"
                                            title="续写下一章（以当前章节正文为前文）"
                                          >
                                            <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                          </button>
                                        </>
                                      ) : null;
                                    })()}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons Bar */}
                            <div className="px-1.5 md:px-3 py-1 md:py-1.5 border-b border-slate-800 bg-slate-950/20 flex items-center gap-1 md:gap-1.5 flex-wrap flex-shrink-0 overflow-x-hidden w-full max-w-full">
                                <div className="flex items-center gap-1 border-r border-slate-700 pr-1 mr-0.5">
                                    <button
                                        onClick={() => {
                                            if (onSendMessage) {
                                                const prompt = getExtractInfoFromManuscriptPrompt(activeChapter);
                                                if (prompt) {
                                                    const vol = activeChapter.volumeId ? story.volumes.find(v => v.id === activeChapter.volumeId) : undefined;
                                                    const extractSystemInstruction = getExtractInfoSystemInstruction();
                                                    handleSendWithConfirmation(prompt, { 
                                                      mode: 'general',
                                                      isSilentOperation: true,
                                                      editedSystemInstruction: extractSystemInstruction, // 传递专用系统提示词
                                                      silentOperationInfo: {
                                                        chapterNumber: activeChapter.number,
                                                        volumeNumber: vol?.number,
                                                        operationType: 'extract'
                                                      }
                                                    });
                                                } else {
                                                    window.alert('当前章节没有正文内容，无法提炼信息。');
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-900/30 rounded transition-colors border border-purple-500/30"
                                        title={`让AI从正文中提炼章纲、角色、世界书、指导等信息并保存（${useDetailedOutlineExtraction ? '详细版' : '简洁版'}）`}
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        <span className="hidden sm:inline">提炼信息</span>
                                    </button>
                                    <label className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-xs text-slate-400 hover:text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useDetailedOutlineExtraction}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setUseDetailedOutlineExtraction(checked);
                                                localStorage.setItem('storyforge_detailed_outline_extraction', checked.toString());
                                            }}
                                            className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 cursor-pointer"
                                            title="勾选使用详细版章纲提炼（默认简洁版）"
                                        />
                                        <span className="hidden sm:inline">详细版</span>
                                    </label>
                                </div>
                                <button
                                    onClick={handleCopyContent}
                                    className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                    title="复制正文"
                                >
                                    <Copy className="w-3 h-3" />
                                    <span className="hidden sm:inline">复制</span>
                                </button>
                                <button
                                    onClick={handleExportToTxt}
                                    className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                                    title="导出标题和正文到txt文件"
                                >
                                    <Upload className="w-3 h-3" />
                                    <span className="hidden sm:inline">导出</span>
                                </button>
                                <button
                                    onClick={handleDeleteChapterContent}
                                    className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-orange-400 hover:bg-slate-800 rounded transition-colors"
                                    title="清空正文（保留版本）"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span className="hidden sm:inline">清空</span>
                                </button>
                                {activeVersion && activeChapter.contentVersions.length > 1 && (
                                    <button
                                        onClick={handleDeleteCurrentVersion}
                                        className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                        title="删除当前版本"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span className="hidden sm:inline">删除版本</span>
                                    </button>
                                )}
                                <div className="flex items-center gap-0.5 border-l border-slate-700 pl-1 ml-0.5">
                                    <button
                                        onClick={() => {
                                            const newFont = manuscriptFontFamily === 'serif' ? 'sans-serif' : 'serif';
                                            setManuscriptFontFamily(newFont);
                                            localStorage.setItem('storyforge_manuscript_font_family', newFont);
                                        }}
                                        className={`p-0.5 md:p-1 rounded transition-colors ${
                                            manuscriptFontFamily === 'serif'
                                                ? 'text-purple-400 hover:text-purple-300 bg-purple-900/20'
                                                : 'text-slate-400 hover:text-purple-400 hover:bg-slate-800'
                                        }`}
                                        title={`切换字体 (当前: ${manuscriptFontFamily === 'serif' ? '衬线' : '无衬线'})`}
                                    >
                                        <Type className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleFontSizeChange(-2)}
                                        className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                                        title="减小字体"
                                    >
                                        <ZoomOut className="w-3 h-3" />
                                    </button>
                                    <span className="text-[9px] md:text-xs text-slate-500 px-1 min-w-[28px] text-center">{fontSize}px</span>
                                    <button
                                        onClick={() => handleFontSizeChange(2)}
                                        className="p-0.5 md:p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                                        title="增大字体"
                                    >
                                        <ZoomIn className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Text Area */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 bg-slate-900 min-h-0 w-full">
                                {activeVersion ? (
                                    <EditableOutlineField 
                                        value={activeVersion.text || ''} 
                                        onSave={(v) => {
                                            handleUpdateChapterContent(v);
                                        }} 
                                        fontSize={fontSize}
                                        placeholder="暂无正文内容，点击此处编辑"
                                    />
                                ) : (
                                    <div className="text-slate-600 italic p-4">版本数据错误，请尝试新建版本。</div>
                                )}
                            </div>
                        </>
                    );
                })() : null}
             </div>
            </div>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300 w-full">
            <div className="flex justify-between items-center w-full">
              <h2 className="text-xl md:text-2xl font-semibold">角色推演</h2>
              <span className="bg-slate-800 text-xs px-3 py-1 rounded-full text-slate-400">{story.characters.length} 人</span>
            </div>
            
            {story.characters.length === 0 ? (
              <EmptyState icon={<Users className="w-12 h-12" />} text="暂无角色。" />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-6 w-full">
                {story.characters.map((char) => (
                  <CharacterCard 
                    key={char.id} 
                    character={char} 
                    onDelete={() => handleDeleteCharacter(char.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-4 md:space-y-8 animate-in fade-in duration-300 w-full">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">世界书 & 设定</h2>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-sm rounded-lg border border-purple-500/30 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    导入世界书
                    <input
                      type="file"
                      accept=".txt,.json"
                      className="hidden"
                      onChange={handleImportWorldBook}
                    />
                  </label>
                </div>
              </div>
              {(story.worldGuide || []).length === 0 ? (
                 <EmptyState icon={<Globe className="w-12 h-12" />} text="暂无设定。" />
              ) : (
                 Object.entries(groupedWorldGuide).map(([category, entries]: [string, WorldEntry[]]) => (
                    <div key={category} className="space-y-3">
                       <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm border-b border-slate-800 pb-2">{category}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {entries.map(entry => (
                             <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 relative group">
                                <div className="flex justify-between items-start mb-1">
                                   <h4 className="font-bold text-slate-200">{entry.name}</h4>
                                   <button onClick={() => removeWorldEntry(entry.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                </div>
                                <p className="text-slate-400 text-sm whitespace-pre-wrap">{entry.description}</p>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))
              )}

              {/* 故事圣经部分 */}
              <div className="mt-12 pt-8 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">📜 故事圣经</h2>
           </div>
                
                <div className="bg-purple-900/10 border border-purple-500/30 p-4 rounded-xl text-sm text-purple-200 mb-6 flex items-start gap-3">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">什么是故事圣经？</p>
                    <p className="opacity-80">故事圣经用于跟踪故事的动态状态，防止AI在长篇写作中出现失忆问题（如角色已死但后面又出现）。AI在生成章节时会自动更新故事圣经，你也可以手动编辑。故事圣经会包含在系统提示词中，确保AI严格遵循其中的状态。每一章都有对应的故事圣经版本，只有最新章节的版本可以编辑，其他版本只能查看。</p>
                  </div>
                </div>

                {!story.storyBible || !story.storyBible.versions || story.storyBible.versions.length === 0 ? (
                  <EmptyState icon={<BookOpen className="w-12 h-12" />} text="暂无故事圣经。当AI生成章节时，会自动创建并更新故事圣经。" />
                ) : (() => {
                  // 获取所有版本，按章节号排序
                  const sortedVersions = [...story.storyBible.versions].sort((a, b) => {
                    if (a.volumeNumber !== b.volumeNumber) {
                      return (a.volumeNumber || 0) - (b.volumeNumber || 0);
                    }
                    return a.chapterNumber - b.chapterNumber;
                  });
                  
                  // 确定当前查看的版本索引
                  const currentVersionIndex = viewingBibleVersionIndex === -1 
                    ? sortedVersions.length - 1  // 查看最新版本
                    : Math.max(0, Math.min(viewingBibleVersionIndex, sortedVersions.length - 1)); // 确保索引在有效范围内
                  
                  const currentVersion = sortedVersions[currentVersionIndex];
                  if (!currentVersion) {
                    // 如果当前版本不存在，重置到最新版本
                    return <EmptyState icon={<BookOpen className="w-12 h-12" />} text="版本数据异常，请刷新页面。" />;
                  }
                  
                  const activeChapterNumber = story.storyBible.activeChapterNumber;
                  const isActiveVersion = currentVersion.chapterNumber === activeChapterNumber;
                  
                  return (
                    <div className="space-y-6">
                      {/* 版本选择器 */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-400">版本历史</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewingBibleVersionIndex(Math.max(0, currentVersionIndex - 1))}
                              disabled={currentVersionIndex === 0}
                              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-slate-700"
                            >
                              上一章
                            </button>
                            <span className="text-xs text-slate-400">
                              {currentVersionIndex + 1} / {sortedVersions.length}
                            </span>
                            <button
                              onClick={() => setViewingBibleVersionIndex(Math.min(sortedVersions.length - 1, currentVersionIndex + 1))}
                              disabled={currentVersionIndex === sortedVersions.length - 1}
                              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-slate-700"
                            >
                              下一章
                            </button>
                            <button
                              onClick={() => setViewingBibleVersionIndex(-1)}
                              disabled={currentVersionIndex === sortedVersions.length - 1}
                              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                            >
                              最新
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>当前查看：第{currentVersion.chapterNumber}章{currentVersion.volumeNumber ? `（第${currentVersion.volumeNumber}卷）` : ''}</div>
                          <div>更新时间：{new Date(currentVersion.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          {isActiveVersion && (
                            <div className="text-purple-400 font-semibold">✓ 当前激活版本（可编辑）</div>
                          )}
                          {!isActiveVersion && (
                            <div className="text-slate-500">只读模式（仅最新版本可编辑）</div>
                          )}
                        </div>
                      </div>

                      {/* 故事圣经内容 */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                        <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3">人物状态表</h3>
                        {isActiveVersion ? (
                          <EditableField
                            value={(() => {
                              const status = currentVersion.character_status;
                              if (!status) return '';
                              if (typeof status === 'string') return status;
                              if (typeof status === 'object' && status !== null) {
                                return Object.entries(status).map(([name, statusVal]) => `${name}: ${statusVal}`).join('\n');
                              }
                              return '';
                            })()}
                            onSave={(val) => {
                              // 更新当前版本
                              const updatedVersions = [...sortedVersions];
                              updatedVersions[currentVersionIndex] = {
                                ...currentVersion,
                                character_status: val
                              };
                              onUpdateStory({
                                ...story,
                                storyBible: {
                                  ...story.storyBible!,
                                  versions: updatedVersions
                                }
                              });
                            }}
                            placeholder="格式：[角色名]：[状态/位置/关键变化]。例如：陆志星：重伤，在青云门养伤。赵四：第10章已死亡。"
                            multiline
                            className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px]"
                          />
                        ) : (
                          <div className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px] p-2 bg-slate-800/50 rounded border border-slate-700">
                            {(() => {
                              const status = currentVersion.character_status;
                              if (!status) return <span className="text-slate-600 italic">暂无内容</span>;
                              if (typeof status === 'string') return status;
                              if (typeof status === 'object' && status !== null) {
                                return Object.entries(status).map(([name, statusVal]) => `${name}: ${statusVal}`).join('\n');
                              }
                              return <span className="text-slate-600 italic">暂无内容</span>;
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                        <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3">物品与地点</h3>
                        {isActiveVersion ? (
                          <EditableField
                            value={(() => {
                              const items = currentVersion.key_items_and_locations;
                              if (!items) return '';
                              if (typeof items === 'string') return items;
                              if (typeof items === 'object' && items !== null) {
                                return Object.entries(items).map(([name, value]) => `${name}: ${value}`).join('\n');
                              }
                              return '';
                            })()}
                            onSave={(val) => {
                              const updatedVersions = [...sortedVersions];
                              updatedVersions[currentVersionIndex] = {
                                ...currentVersion,
                                key_items_and_locations: val
                              };
                              onUpdateStory({
                                ...story,
                                storyBible: {
                                  ...story.storyBible!,
                                  versions: updatedVersions
                                }
                              });
                            }}
                            placeholder="记录关键道具的持有者变更、当前所在位置的环境特征。例如：当前位置：万魔窟（禁飞区）。屠龙刀：目前在赵敏手中。"
                            multiline
                            className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px]"
                          />
                        ) : (
                          <div className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px] p-2 bg-slate-800/50 rounded border border-slate-700">
                            {(() => {
                              const items = currentVersion.key_items_and_locations;
                              if (!items) return <span className="text-slate-600 italic">暂无内容</span>;
                              if (typeof items === 'string') return items;
                              if (typeof items === 'object' && items !== null) {
                                return Object.entries(items).map(([name, value]) => `${name}: ${value}`).join('\n');
                              }
                              return <span className="text-slate-600 italic">暂无内容</span>;
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                        <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3">当前未解决的伏笔</h3>
                        {isActiveVersion ? (
                          <EditableField
                            value={(() => {
                              const threads = currentVersion.active_plot_threads;
                              if (!threads) return '';
                              if (typeof threads === 'string') return threads;
                              if (typeof threads === 'object' && threads !== null) {
                                return Array.isArray(threads) ? threads.join('\n') : Object.entries(threads).map(([key, value]) => `${key}: ${value}`).join('\n');
                              }
                              return '';
                            })()}
                            onSave={(val) => {
                              const updatedVersions = [...sortedVersions];
                              updatedVersions[currentVersionIndex] = {
                                ...currentVersion,
                                active_plot_threads: val
                              };
                              onUpdateStory({
                                ...story,
                                storyBible: {
                                  ...story.storyBible!,
                                  versions: updatedVersions
                                }
                              });
                            }}
                            placeholder="列出当前悬而未决的冲突或任务。例如：1. 寻找解药（进行中）。2. 门派大比（三天后开始）。"
                            multiline
                            className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px]"
                          />
                        ) : (
                          <div className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px] p-2 bg-slate-800/50 rounded border border-slate-700">
                            {(() => {
                              const threads = currentVersion.active_plot_threads;
                              if (!threads) return <span className="text-slate-600 italic">暂无内容</span>;
                              if (typeof threads === 'string') return threads;
                              if (typeof threads === 'object' && threads !== null) {
                                return Array.isArray(threads) ? threads.join('\n') : Object.entries(threads).map(([key, value]) => `${key}: ${value}`).join('\n');
                              }
                              return <span className="text-slate-600 italic">暂无内容</span>;
                            })()}
                          </div>
                        )}
                      </div>

                      {(currentVersion.important_rules || isActiveVersion) && (
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                          <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-3">临时规则/备注</h3>
                          {isActiveVersion ? (
                            <EditableField
                              value={(() => {
                                const rules = currentVersion.important_rules;
                                if (!rules) return '';
                                if (typeof rules === 'string') return rules;
                                if (typeof rules === 'object' && rules !== null) {
                                  return Array.isArray(rules) ? rules.join('\n') : Object.entries(rules).map(([key, value]) => `${key}: ${value}`).join('\n');
                                }
                                return '';
                              })()}
                              onSave={(val) => {
                                const updatedVersions = [...sortedVersions];
                                updatedVersions[currentVersionIndex] = {
                                  ...currentVersion,
                                  important_rules: val
                                };
                                onUpdateStory({
                                  ...story,
                                  storyBible: {
                                    ...story.storyBible!,
                                    versions: updatedVersions
                                  }
                                });
                              }}
                              placeholder="本章新增的、对后续剧情有长期影响的设定。例如：设定补充：主角使用了禁术，三天内无法使用内力。"
                              multiline
                              className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px]"
                            />
                          ) : (
                            <div className="text-slate-300 text-sm whitespace-pre-wrap min-h-[120px] p-2 bg-slate-800/50 rounded border border-slate-700">
                              {(() => {
                                const rules = currentVersion.important_rules;
                                if (!rules) return <span className="text-slate-600 italic">暂无内容</span>;
                                if (typeof rules === 'string') return rules;
                                if (typeof rules === 'object' && rules !== null) {
                                  return Array.isArray(rules) ? rules.join('\n') : Object.entries(rules).map(([key, value]) => `${key}: ${value}`).join('\n');
                                }
                                return <span className="text-slate-600 italic">暂无内容</span>;
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
           </div>
        )}
        
        {activeTab === 'guide' && (
            <div className="space-y-4 md:space-y-8 animate-in fade-in duration-300 w-full">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-semibold">写作指导 & 风格规范</h2>
                 {onExportWritingGuidelines && (story.writingGuidelines || []).length > 0 && (
                   <button
                     onClick={onExportWritingGuidelines}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                   >
                     <Upload className="w-4 h-4" />
                     导出写作指导
                   </button>
                 )}
              </div>
              
              <div className="bg-purple-900/10 border border-purple-500/30 p-4 rounded-xl text-sm text-purple-200 mb-6 flex items-start gap-3">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                      <p className="font-bold mb-1">如何使用此板块？</p>
                      <p className="opacity-80">在这里添加的任何指导原则（例如"少用形容词"、"对话风格"、"禁忌词"），AI 在生成正文时都会**隐式应用**，而不会在文中直接复述规则。你可以通过聊天告诉 AI "记住这个写作技巧"，它会自动添加到这里；也可以手动添加新的指导原则。</p>
                  </div>
              </div>

              {/* Manual Input Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  手动添加写作指导
                </h3>
                <ManualGuidelineInput onAdd={addWritingGuideline} />
              </div>
              
              {(story.writingGuidelines || []).length === 0 ? (
                 <EmptyState icon={<Feather className="w-12 h-12" />} text="暂无写作指导。试着对 AI 说：'请模仿海明威的风格'或'不要使用陈词滥调'，也可以在上方手动添加。" />
              ) : (
                 Object.entries(groupedGuidelines).map(([category, entries]: [string, WritingGuideline[]]) => (
                    <div key={category} className="space-y-3">
                       <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-sm border-b border-slate-800 pb-2">{category}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {entries.map(entry => (
                             <div key={entry.id} className={`bg-slate-900 border rounded-lg p-4 relative group shadow-sm hover:border-emerald-500/30 transition-colors ${entry.isActive ? 'border-slate-800' : 'border-slate-700 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-2">
                                   <div className="flex items-center gap-2">
                                     <button
                                       onClick={() => toggleWritingGuideline(entry.id)}
                                       className={`p-1 rounded transition-colors ${
                                         entry.isActive 
                                           ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-900/20' 
                                           : 'text-slate-500 hover:text-slate-400 bg-slate-800/50'
                                       }`}
                                       title={entry.isActive ? '点击关闭（不发送给AI）' : '点击开启（发送给AI）'}
                                     >
                                       <Power className={`w-3.5 h-3.5 ${entry.isActive ? 'fill-current' : ''}`} />
                                     </button>
                                     <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                                       entry.isActive 
                                         ? 'bg-slate-800 text-slate-400' 
                                         : 'bg-slate-800/50 text-slate-600'
                                     }`}>{entry.category}</span>
                                   </div>
                                   <button onClick={() => removeWritingGuideline(entry.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                </div>
                                <EditableField 
                                   value={entry.content} 
                                   onSave={(val) => updateWritingGuideline(entry.id, val)}
                                   multiline
                                   className={`text-sm whitespace-pre-wrap leading-relaxed ${
                                     entry.isActive 
                                       ? 'text-slate-300 hover:text-emerald-100' 
                                       : 'text-slate-500'
                                   }`}
                                />
                             </div>
                          ))}
                       </div>
                    </div>
                 ))
              )}
           </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-4 md:space-y-8 animate-in fade-in duration-300 w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">写作工具箱</h2>
            </div>
            
            {/* 叙事功能逆向拆解工具 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">叙事功能逆向拆解</h3>
                  <p className="text-xs text-slate-500">Narrative Functional Reverse-Engineering</p>
                </div>
              </div>
              
              <div className="bg-purple-900/10 border border-purple-500/30 p-4 rounded-xl text-sm text-purple-200 flex items-start gap-3">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">功能说明</p>
                  <p className="opacity-80">导入一章小说原文（2500字以上），AI 将进行超精细化分析（2000字至少20段以上），提取抽象的"情节功能"而非具体剧情，并为每个条目说明其在写作上的功能、作用或完成的任务，生成可复用的<strong>「叙事功能模板」</strong>，保存到故事模板中。</p>
                  <p className="opacity-60 mt-2 text-xs">💡 保存后可在模板板块使用「按模板写正文」功能，让AI按照模板逐条展开，生成原创情节的正文（严禁与范文雷同）。</p>
                </div>
              </div>
              
              {/* 选择目标章节 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">保存到章节</label>
                <select
                  value={narrativeDeconstructionChapterNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNarrativeDeconstructionChapterNumber(val ? Number(val) : '');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- 选择目标章节 --</option>
                  {story.outline.map(ch => (
                    <option key={ch.id} value={ch.number}>
                      第{ch.number}章 {ch.title}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 导入文本 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">原文内容</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {narrativeDeconstructionText.length} 字
                    </span>
                    <input
                      type="file"
                      ref={narrativeFileInputRef}
                      accept=".txt"
                      className="hidden"
                      capture={false}
                      onChange={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const file = e.target.files?.[0];
                        if (file) {
                          setNarrativeDeconstructionFileLoading(true);
                          setNarrativeDeconstructionFileProgress(0);
                          
                          try {
                            await readTextFileWithEncoding(
                              file,
                              (progress) => {
                                setNarrativeDeconstructionFileProgress(progress);
                              },
                              (text) => {
                                setNarrativeDeconstructionText(text);
                                setNarrativeDeconstructionFileLoading(false);
                                setNarrativeDeconstructionFileProgress(0);
                              },
                              (error) => {
                                alert(`文件读取失败: ${error}`);
                                setNarrativeDeconstructionFileLoading(false);
                                setNarrativeDeconstructionFileProgress(0);
                              }
                            );
                          } catch (err) {
                            console.error('文件读取失败:', err);
                            alert('文件读取失败，请重试');
                            setNarrativeDeconstructionFileLoading(false);
                            setNarrativeDeconstructionFileProgress(0);
                          }
                        }
                        // 重置文件输入，允许重复选择同一文件
                        // 延迟重置，避免在手机端触发问题
                        setTimeout(() => {
                          if (e.target) {
                            (e.target as HTMLInputElement).value = '';
                          }
                        }, 100);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (narrativeFileInputRef.current) {
                            narrativeFileInputRef.current.click();
                          }
                        }}
                        disabled={narrativeDeconstructionFileLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                      >
                        <Upload className="w-3 h-3" />
                        导入TXT
                      </button>
                      {narrativeDeconstructionFileLoading && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all duration-300"
                              style={{ width: `${narrativeDeconstructionFileProgress}%` }}
                            />
                          </div>
                          <span>{narrativeDeconstructionFileProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <textarea
                  value={narrativeDeconstructionText}
                  onChange={(e) => setNarrativeDeconstructionText(e.target.value)}
                  placeholder="粘贴或导入小说章节原文（建议2500字以上）..."
                  className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              {/* 分析按钮 */}
              <button
                onClick={async () => {
                  if (!narrativeDeconstructionText.trim()) {
                    alert('请先导入或粘贴原文内容');
                    return;
                  }
                  if (narrativeDeconstructionText.length < 500) {
                    alert('原文内容太短，建议至少2500字以上以获得更好的分析效果');
                    return;
                  }
                  if (!narrativeDeconstructionChapterNumber) {
                    alert('请选择保存到哪个章节');
                    return;
                  }
                  
                  setNarrativeDeconstructionLoading(true);
                  setNarrativeDeconstructionResult('');
                  
                  try {
                    // 获取章节信息
                    const targetChapter = story.outline.find(ch => ch.number === narrativeDeconstructionChapterNumber);
                    const chapterTitle = targetChapter?.title || `第${narrativeDeconstructionChapterNumber}章`;
                    
                    // 构建分析提示词
                    const analysisPrompt = `# 任务：叙事功能逆向拆解

你是一位专业的文学分析师和写作教练。请对以下小说章节进行**叙事功能逆向拆解**分析。

## 分析要求

1. **超精细化语义分段**：
   - **必须进行极其细致的分段**，不要像粗纲那样概括，要识别每一个微小的情节转折点
   - 识别点包括：场景切换、情绪突变、冲突升级、视角转换、时间跳跃、对话转折、心理变化、动作转换、环境变化、信息揭示、悬念设置等
   - **分段标准：通常每100-150字会交代一个情节或任务，因此2000字的章节至少应该有20段以上的分析，2500字以上的章节应该有25-30段或更多**
   - 不要合并相邻的小转折点，每个微小的情节变化都应该单独成段
   - **关键是要极其细致，确保不遗漏任何情节节点**

2. **功能抽象化**：对每个板块进行"功能定义"而非"剧情总结"
   - ❌ 错误示例：张三在拍卖会买到了一件宝物
   - ❌ 错误示例：利用信息差完成关键资源获取（主角通过伪装身份）
   - ✅ 正确示例：利用信息差完成关键资源获取
   - **严格去除具体的人名、地名、道具名和具体动作**，提取抽象的叙事功能
   - **输出中绝对不能包含任何括号说明**，不能有任何角色名、地名、道具名等具体信息
   - 如果需要在描述中说明角色关系，使用"主角"、"对手"、"第三方"、"强者"、"弱者"等抽象称谓

3. **写作手法建议**：每个条目必须提供"可替换的写作手法建议"，而不是总结原文的具体做法
   - **不要总结原文的做法**（如："通过恶劣天气和受刑者的惨状，奠定全篇压抑沉重的基调"）
   - **要提供可替换的写作手法建议**（如："可以运用环境对比、细节特写、感官描写等手法来营造压抑氛围，或通过侧面烘托、他人反应、象征意象等方式来暗示敌对势力的残暴"）
   - 说明这一情节要达到的叙事目标（如：奠定基调、建立冲突、塑造人物、设置悬念等）
   - 提供多种可替换的写作手法和创作思路，帮助写作者灵活运用，避免直接模仿原文
   - 建议应该具有通用性和可操作性，能够指导不同场景下的创作

4. **关键词提取**：识别每段的爽点逻辑（压抑、爆发、反转、装逼打脸、扮猪吃虎、绝地反击、信息不对称、身份伪装、情绪铺垫、冲突升级、悬念设置、信息揭示、关系建立、节奏调节等）
   - **每个条目都必须包含关键词**，用于标识这一情节的爽点逻辑和叙事特征
   - 关键词可以是单个或多个，用逗号分隔（如：压抑、反转、信息不对称）
   - 如果某个情节没有明显的爽点逻辑，可以用"铺垫"、"过渡"、"信息传递"等基础叙事功能作为关键词

5. **完整性要求**：所有段落加起来必须覆盖原文的 100% 内容，不能遗漏任何部分

## 输出格式

请严格按照以下格式输出（纯文本列表，不需要字符位置范围）：

\`\`\`
1. [抽象功能描述] | [写作手法建议：可替换的写作手法和创作思路] | [关键词：爽点逻辑]
2. [抽象功能描述] | [写作手法建议：可替换的写作手法和创作思路] | [关键词：爽点逻辑]
3. [抽象功能描述] | [写作手法建议：可替换的写作手法和创作思路] | [关键词：爽点逻辑]
...
\`\`\`

**格式说明**：
- 每个条目分为三部分，用"|"分隔
- 第一部分：抽象功能描述（去除具体信息）
- 第二部分：写作手法建议（提供可替换的写作手法和创作思路，说明要达到的叙事目标，避免直接总结原文做法）
- 第三部分：关键词（爽点逻辑，如：压抑、爆发、反转、装逼打脸、扮猪吃虎、绝地反击、信息不对称、身份伪装等）

**写作手法建议的要求**：
- ❌ **错误示例**：通过恶劣天气和受刑者的惨状，奠定全篇压抑沉重的基调（这是总结原文做法，不要这样写）
- ✅ **正确示例**：可以运用环境对比、细节特写、感官描写等手法来营造压抑氛围，或通过侧面烘托、他人反应、象征意象等方式来暗示敌对势力的残暴，目标是奠定全篇压抑沉重的基调
- 要提供多种可替换的写作手法，具有通用性和可操作性
- 说明要达到的叙事目标，但不要描述原文的具体实现方式

**重要提示**：
- **分段要极其精细**，2000字的章节至少应该有20段以上，2500字以上的章节应该有25-30段或更多
- 每个功能描述要简洁但完整，能清晰表达该段落的叙事作用
- **每个条目必须包含写作手法建议和关键词**，写作手法建议要提供可替换的方案，避免直接模仿原文
- **绝对不能包含任何括号说明**，不能有任何角色名、地名、道具名等具体信息
- 不要输出字符位置范围，只输出功能描述列表

## 原文内容（${narrativeDeconstructionText.length}字）

${narrativeDeconstructionText}

---

请开始分析，直接输出结果，不需要额外解释。

---

**💡 提示：分析完成后，请将结果复制到故事模板的第${narrativeDeconstructionChapterNumber}章"${chapterTitle}"的逆向拆解位置。**`;

                    if (onSendMessage) {
                      // 使用对话方式发送分析请求
                      onSendMessage(analysisPrompt, { mode: 'general' });
                      
                      // 提示用户
                      setNarrativeDeconstructionResult(`分析请求已发送到对话窗口，请在对话中查看 AI 的分析结果。\n\n分析完成后，请将结果复制到故事模板的第${narrativeDeconstructionChapterNumber}章"${chapterTitle}"的逆向拆解位置。`);
                    } else {
                      setNarrativeDeconstructionResult('错误：无法发送消息，请确保已配置 API');
                    }
                  } catch (error) {
                    console.error('分析失败:', error);
                    setNarrativeDeconstructionResult(`分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
                  } finally {
                    setNarrativeDeconstructionLoading(false);
                  }
                }}
                disabled={narrativeDeconstructionLoading || !narrativeDeconstructionText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                {narrativeDeconstructionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    开始逆向拆解分析
                  </>
                )}
              </button>
              
              {/* 分析结果 */}
              {narrativeDeconstructionResult && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">分析状态</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap">
                    {narrativeDeconstructionResult}
                  </div>
                </div>
              )}
            </div>
            
            {/* TXT 文档拆分工具 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-teal-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">TXT 文档拆分工具</h3>
                  <p className="text-xs text-slate-500">Chapter Splitter</p>
                </div>
              </div>
              
              <div className="bg-green-900/10 border border-green-500/30 p-4 rounded-xl text-sm text-green-200 flex items-start gap-3">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">功能说明</p>
                  <p className="opacity-80">导入包含多章节的 TXT 文档，工具会自动识别"第x章"、"第x回"等章节标题，将每一章拆分到单独的 TXT 文件中。支持保存到指定文件夹（Chrome/Edge）或逐个下载。</p>
                </div>
              </div>
              
              {/* 导入文本 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">文档内容</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {splitDocumentText.length} 字
                    </span>
                    {/* 字体大小调整 */}
                    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5">
                      <button
                        onClick={() => handleSplitDocumentFontSizeChange(-1)}
                        className="p-0.5 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded transition-colors"
                        title="减小字体"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-slate-300 px-1.5 min-w-[35px] text-center">{splitDocumentFontSize}px</span>
                      <button
                        onClick={() => handleSplitDocumentFontSizeChange(1)}
                        className="p-0.5 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded transition-colors"
                        title="增大字体"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={splitDocumentFileInputRef}
                      accept=".txt"
                      className="hidden"
                      capture={false}
                      onChange={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const file = e.target.files?.[0];
                        if (file) {
                          setSplitDocumentFileLoading(true);
                          setSplitDocumentFileProgress(0);
                          
                          try {
                            await readTextFileWithEncoding(
                              file,
                              (progress) => {
                                setSplitDocumentFileProgress(progress);
                              },
                              (text) => {
                                setSplitDocumentText(text);
                                setSplitDocumentFileLoading(false);
                                setSplitDocumentFileProgress(0);
                              },
                              (error) => {
                                alert(`文件读取失败: ${error}`);
                                setSplitDocumentFileLoading(false);
                                setSplitDocumentFileProgress(0);
                              }
                            );
                          } catch (err) {
                            console.error('文件读取失败:', err);
                            alert('文件读取失败，请重试');
                            setSplitDocumentFileLoading(false);
                            setSplitDocumentFileProgress(0);
                          }
                        }
                        // 重置文件输入，允许重复选择同一文件
                        // 延迟重置，避免在手机端触发问题
                        setTimeout(() => {
                          if (e.target) {
                            (e.target as HTMLInputElement).value = '';
                          }
                        }, 100);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (splitDocumentFileInputRef.current) {
                            splitDocumentFileInputRef.current.click();
                          }
                        }}
                        disabled={splitDocumentFileLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                      >
                        <Upload className="w-3 h-3" />
                        导入TXT
                      </button>
                      {splitDocumentFileLoading && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all duration-300"
                              style={{ width: `${splitDocumentFileProgress}%` }}
                            />
                          </div>
                          <span>{splitDocumentFileProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    ref={splitDocumentTextareaRef}
                    value={splitDocumentText}
                    onChange={(e) => setSplitDocumentText(e.target.value)}
                    placeholder="粘贴或导入包含多章节的 TXT 文档（支持「第x章」、「第x回」等格式）..."
                    className="w-full h-[500px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ fontSize: `${splitDocumentFontSize}px` }}
                  />
                  {/* 小节标记操作按钮 */}
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <button
                      onClick={handleInsertSectionMarker}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/80 hover:bg-green-600 text-white rounded border border-green-500/50 transition-colors shadow-lg"
                      title="在光标位置增加小节标记（序号自动重排序）"
                    >
                      <Plus className="w-3 h-3" />
                      增加小节标记
                    </button>
                    <button
                      onClick={handleDeleteSectionMarker}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded border border-red-500/50 transition-colors shadow-lg"
                      title="删除当前行的小节标记（序号自动重排序）"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除小节标记
                    </button>
                  </div>
                </div>
              </div>
              
              {/* 拆分按钮 */}
              <button
                onClick={handleSplitDocument}
                disabled={splitDocumentLoading || !splitDocumentText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                {splitDocumentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    拆分中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    开始拆分文档
                  </>
                )}
              </button>
              
              {/* 拆分结果 */}
              {splitDocumentResult && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">拆分状态</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap">
                    {splitDocumentResult}
                  </div>
                </div>
              )}
            </div>
            
            {/* 更多工具占位 */}
            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-8 text-center">
              <div className="text-slate-500">
                <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">更多写作工具即将推出...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    
    {/* Prompt Confirmation Modal */}
    {promptModalContent && promptModalContent.promptContext && (
      <PromptConfirmModal
        isOpen={showConfirmModal}
        onClose={handleCancelSend}
        onConfirm={handleConfirmSend}
        userMessage={pendingPrompt}
        systemInstruction={promptModalContent.promptContext?.systemInstruction || ''}
        context={promptModalContent.promptContext?.context || emptyContext}
        history={promptModalContent.limitedHistory}
      />
    )}
    </>
  );
};

// --- Sub Components ---

const TEXTAREA_MAX_HEIGHT = 480;
const adjustTextareaHeight = (el: HTMLTextAreaElement | null, maxHeight = TEXTAREA_MAX_HEIGHT) => {
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${newHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

const EditableField: React.FC<{ value: string; onSave: (val: string) => void; placeholder?: string; multiline?: boolean; className?: string; style?: React.CSSProperties }> = ({ value, onSave, placeholder, multiline, className, style }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<any>(null);

  useEffect(() => { setTempValue(value); }, [value]);
  useEffect(() => { 
    if (isEditing && inputRef.current) {
      const el = inputRef.current as HTMLTextAreaElement | HTMLInputElement;
      el.focus();
      requestAnimationFrame(() => {
        const length = el.value.length;
        if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
          el.selectionStart = length;
          el.selectionEnd = length;
        }
        if (multiline) {
          adjustTextareaHeight(inputRef.current);
        }
      });
    }
  }, [isEditing, multiline]);
  useEffect(() => {
    if (multiline && isEditing) {
      adjustTextareaHeight(inputRef.current);
    }
  }, [tempValue, multiline, isEditing]);

  const handleSave = () => { setIsEditing(false); if (tempValue !== value) onSave(tempValue); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) handleSave();
    if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
  };

  if (isEditing) {
    const cls = "w-full bg-slate-800 text-slate-200 border border-purple-500 rounded px-2 py-1 focus:outline-none";
    return multiline ? 
      <textarea 
        ref={inputRef} 
        value={tempValue} 
        onChange={e => setTempValue(e.target.value)} 
        onBlur={handleSave} 
        onKeyDown={handleKeyDown} 
        onInput={() => adjustTextareaHeight(inputRef.current)}
        className={`${cls} min-h-[120px] resize-none max-h-[480px] overflow-y-auto whitespace-pre-wrap ${className || ''}`}
        style={style}
      /> :
      <input ref={inputRef} value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} className={`${cls} ${className}`} style={style} />;
  }
  const displayClass = value ? className : "text-slate-600 italic";
  const textClasses = `${multiline ? 'whitespace-pre-wrap break-words' : ''} ${displayClass || ''}`.trim();
  return (
    <div onDoubleClick={() => setIsEditing(true)} className="relative group cursor-pointer hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors">
      <div className={textClasses || 'text-slate-600 italic'} style={style}>{value || placeholder}</div>
    </div>
  );
};

// 专门用于提纲内容的可编辑字段（样式类似正文框）
const EditableOutlineField: React.FC<{ value: string; onSave: (val: string) => void; fontSize: number; placeholder?: string }> = ({ value, onSave, fontSize, placeholder = '暂无内容' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const displayRef = useRef<HTMLDivElement | null>(null);
  const clickPositionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => { setTempValue(value); }, [value]);
  
  // 计算点击位置在文本中的字符位置
  const getTextPositionFromPoint = (element: HTMLElement, x: number, y: number): number => {
    // 方法1: 使用 caretRangeFromPoint（最准确）
    if (document.caretRangeFromPoint) {
      try {
        const range = document.caretRangeFromPoint(x, y);
        if (range) {
          // 检查点击位置是否在元素内
          const clickNode = range.commonAncestorContainer;
          if (element.contains(clickNode) || element === clickNode || element === clickNode.parentElement) {
            // 创建一个从元素开始到点击位置的 Range
            const preRange = document.createRange();
            preRange.selectNodeContents(element);
            
            // 尝试设置结束位置
            try {
              preRange.setEnd(range.endContainer, range.endOffset);
              const position = preRange.toString().length;
              // 验证位置是否合理
              const textLength = element.textContent?.length || 0;
              if (position >= 0 && position <= textLength) {
                return position;
              }
            } catch (e) {
              // 如果设置失败，尝试其他方法
            }
          }
        }
      } catch (e) {
        // 忽略错误，使用降级方案
      }
    }
    
    // 方法2: 使用文本节点遍历和坐标计算
    const text = element.textContent || '';
    if (!text) return 0;
    
    const elementRect = element.getBoundingClientRect();
    const relativeX = x - elementRect.left;
    const relativeY = y - elementRect.top;
    
    // 收集所有文本节点及其位置
    const textNodes: { node: Text; start: number; end: number }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let currentPos = 0;
    let node: Node | null;
    
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const nodeText = textNode.textContent || '';
      const start = currentPos;
      const end = currentPos + nodeText.length;
      
      textNodes.push({ node: textNode, start, end });
      currentPos = end;
    }
    
    // 找到最接近点击位置的文本节点
    let bestPosition = 0;
    let minDistance = Infinity;
    
    for (const { node: textNode, start, end } of textNodes) {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      const nodeRelativeX = rect.left - elementRect.left;
      const nodeRelativeY = rect.top - elementRect.top;
      
      // 检查垂直位置
      if (relativeY >= nodeRelativeY - 5 && relativeY <= nodeRelativeY + rect.height + 5) {
        // 计算水平位置
        const nodeText = textNode.textContent || '';
        if (nodeText.length > 0) {
          const charWidth = rect.width / nodeText.length;
          const charIndex = Math.round((relativeX - nodeRelativeX) / charWidth);
          const position = start + Math.max(0, Math.min(charIndex, nodeText.length));
          
          const distance = Math.abs(relativeX - (nodeRelativeX + charIndex * charWidth));
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = position;
          }
        }
      }
    }
    
    // 如果没找到合适的节点，使用文本末尾
    return bestPosition > 0 ? bestPosition : text.length;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!displayRef.current) return;
    
    const selection = window.getSelection();
    let start = 0;
    let end = 0;
    
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // 如果有选中的文本，保持选中
      const range = selection.getRangeAt(0);
      
      // 检查选中范围是否在 displayRef 内
      if (displayRef.current.contains(range.commonAncestorContainer) || displayRef.current === range.commonAncestorContainer) {
        // 计算选中文本在元素中的位置
        const preRange = document.createRange();
        preRange.selectNodeContents(displayRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        start = preRange.toString().length;
        
        const postRange = document.createRange();
        postRange.selectNodeContents(displayRef.current);
        postRange.setEnd(range.endContainer, range.endOffset);
        end = postRange.toString().length;
      } else {
        // 选中范围不在当前元素内，使用点击位置
        const position = getTextPositionFromPoint(displayRef.current, e.clientX, e.clientY);
        start = position;
        end = position;
      }
    } else {
      // 如果没有选中，使用点击位置
      const position = getTextPositionFromPoint(displayRef.current, e.clientX, e.clientY);
      start = position;
      end = position;
    }
    
    clickPositionRef.current = { start, end };
    setIsEditing(true);
  };

  useEffect(() => { 
    if (isEditing && textareaRef.current) {
      // 保存当前的滚动位置（从 displayRef 获取，如果有的话）
      // 由于是 div 到 textarea 的切换，我们需要保持显示区域不变
      
      textareaRef.current.focus();
      
      // 使用双重 requestAnimationFrame 确保 DOM 完全更新
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textareaRef.current && clickPositionRef.current) {
            const { start, end } = clickPositionRef.current;
            const textLength = textareaRef.current.value.length;
            
            // 确保位置在有效范围内
            const safeStart = Math.max(0, Math.min(start, textLength));
            const safeEnd = Math.max(0, Math.min(end, textLength));
            
            // 设置光标位置或选中范围（不改变滚动位置）
            try {
              textareaRef.current.setSelectionRange(safeStart, safeEnd);
              
              // 不自动滚动，保持当前显示的内容位置
              // 如果光标不在当前视口内，才进行最小调整
              setTimeout(() => {
                if (textareaRef.current) {
                  const selection = textareaRef.current.selectionStart;
                  const textBefore = textareaRef.current.value.substring(0, selection);
                  const linesBefore = textBefore.split('\n');
                  const currentLineNumber = linesBefore.length - 1;
                  
                  const lineHeight = parseFloat(getComputedStyle(textareaRef.current).lineHeight) || fontSize * 1.5;
                  const currentLineTop = currentLineNumber * lineHeight;
                  const currentScrollTop = textareaRef.current.scrollTop;
                  const currentViewportHeight = textareaRef.current.clientHeight;
                  
                  // 只有当光标完全不在视口内时，才进行最小调整
                  if (currentLineTop < currentScrollTop - lineHeight) {
                    // 光标在视口上方很远，向上滚动一点
                    textareaRef.current.scrollTop = Math.max(0, currentLineTop - 20);
                  } else if (currentLineTop + lineHeight > currentScrollTop + currentViewportHeight + lineHeight) {
                    // 光标在视口下方很远，向下滚动一点
                    textareaRef.current.scrollTop = currentLineTop + lineHeight - currentViewportHeight + 20;
                  }
                  // 如果光标在视口内或接近视口，不改变滚动位置
                }
              }, 10);
              
            } catch (e) {
              // 如果设置失败，至少定位到末尾
              const length = textareaRef.current.value.length;
              textareaRef.current.setSelectionRange(length, length);
            }
            
            adjustTextareaHeight(textareaRef.current);
            
            // 清除位置引用，避免下次编辑时重复使用
            clickPositionRef.current = null;
          } else if (textareaRef.current) {
            // 如果没有位置信息，默认定位到末尾
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
            adjustTextareaHeight(textareaRef.current);
          }
        });
      });
    }
  }, [isEditing, fontSize]);
  
  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight(textareaRef.current);
    }
  }, [tempValue, isEditing]);

  const handleSave = () => { 
    setIsEditing(false); 
    // 始终调用 onSave，让父组件决定是否需要更新
    onSave(tempValue); 
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { 
      setTempValue(value); 
      setIsEditing(false); 
    }
  };

  if (isEditing) {
    return (
      <textarea 
        ref={textareaRef} 
        value={tempValue} 
        onChange={e => setTempValue(e.target.value)} 
        onBlur={handleSave} 
        onKeyDown={handleKeyDown} 
        onInput={() => adjustTextareaHeight(textareaRef.current)}
        className="w-full h-full min-h-[200px] md:min-h-[400px] text-slate-200 bg-slate-950/50 border border-purple-600/40 rounded-xl p-3 md:p-4 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y whitespace-pre-wrap leading-loose"
        style={{ fontSize: `${fontSize}px` }}
      />
    );
  }

  return (
    <div
      ref={displayRef}
      onClick={handleClick}
      onMouseDown={(e) => {
        // 允许文本选择
        e.stopPropagation();
      }}
      className="w-full h-full min-h-[150px] md:min-h-[400px] text-slate-300 leading-loose whitespace-pre-wrap break-words overflow-wrap-anywhere border border-transparent rounded-xl cursor-text select-text p-1 md:p-2"
      style={{ fontSize: `${fontSize}px` }}
    >
      {value || <span className="text-slate-500 italic">{placeholder}</span>}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col md:flex-row items-center justify-center md:space-x-2 px-1 py-0.5 md:px-4 md:py-2 border-b-2 transition-colors whitespace-nowrap w-full md:w-auto text-[10px] md:text-sm ${active ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
    {icon}<span className="font-medium mt-0.5 md:mt-0">{label}</span>
  </button>
);

interface StructureCardProps {
  title: string;
  content: string;
  step: string;
  color: string;
  versions: ContentVersion[];
  activeVersionId?: string;
  onChangeVersion: (id: string) => void;
  onAddVersion: () => void;
  onDeleteVersion: (id: string) => void;
  onRenameVersion: (id: string) => void;
  onUpdateContent: (val: string) => void;
  onCopyContent: () => void;
  canDelete: boolean;
}

const StructureCard: React.FC<StructureCardProps> = ({
  title,
  content,
  step,
  color,
  versions,
  activeVersionId,
  onChangeVersion,
  onAddVersion,
  onDeleteVersion,
  onRenameVersion,
  onUpdateContent,
  onCopyContent,
  canDelete
}) => {
  const hasVersions = versions.length > 0;
  const resolvedActiveId = hasVersions ? (activeVersionId || versions[0].id) : '';
  return (
  <div className="relative pl-16">
    <div className={`absolute left-0 top-0 w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-bold text-lg shadow-lg z-10`}>{step}</div>
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <h3 className="font-bold text-slate-300 text-lg">{title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg px-2 py-1 border border-slate-800">
              <History className="w-3.5 h-3.5" />
              <select
                value={resolvedActiveId}
                onChange={(e) => onChangeVersion(e.target.value)}
                disabled={!hasVersions}
                className="bg-transparent text-slate-200 text-xs outline-none border-none"
              >
                {hasVersions ? (
                  versions.map(v => {
                    const date = new Date(v.timestamp);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    return (
                    <option key={v.id} value={v.id}>
                        {v.versionName} ({dateStr} {timeStr})
                    </option>
                    );
                  })
                ) : (
                  <option value="">暂无版本</option>
                )}
              </select>
            </div>
            <button
              onClick={onAddVersion}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 text-slate-300 hover:text-white hover:border-purple-500 transition-colors"
              title="复制当前内容为新版本"
            >
              <Plus className="w-3 h-3" /> 新版
            </button>
            <button
              onClick={() => hasVersions && resolvedActiveId && onRenameVersion(resolvedActiveId)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500 transition-colors disabled:opacity-40"
              disabled={!hasVersions}
              title="重命名版本"
            >
              <PenLine className="w-3 h-3" /> 重命名
            </button>
            <button
              onClick={() => hasVersions && resolvedActiveId && canDelete && onDeleteVersion(resolvedActiveId)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 text-slate-300 hover:text-red-300 hover:border-red-500 transition-colors disabled:opacity-40"
              disabled={!canDelete || !hasVersions}
              title="删除当前版本"
            >
              <Trash2 className="w-3 h-3" /> 删除
            </button>
            <button
              onClick={onCopyContent}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
              title="复制内容"
            >
              <Copy className="w-3 h-3" /> 复制
            </button>
          </div>
        </div>
        <EditableField
          value={content}
          onSave={onUpdateContent}
          multiline
          className="text-slate-300 leading-relaxed min-h-[120px]"
          placeholder="暂无内容"
        />
    </div>
  </div>
);
};

const CharacterCard: React.FC<{ character: Character; onDelete: () => void }> = ({ character, onDelete }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-5 hover:border-slate-600 transition-all w-full">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="text-xl font-bold text-white">{character.name}</h3>
        <span className="text-xs font-semibold uppercase text-purple-500">{character.role}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        title="删除角色"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
    <p className="text-sm text-slate-400 mb-4">{character.description}</p>
    
    <div className="flex flex-wrap gap-2 mb-4">
      {character.tags.map((tag, idx) => (
        <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">{tag}</span>
      ))}
    </div>

    {/* Behavior Examples Section */}
    {character.behaviorExamples && character.behaviorExamples.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Quote className="w-3 h-3" /> 言行示例
            </h4>
            <div className="space-y-3">
                {character.behaviorExamples.map((be, idx) => (
                    <div key={idx} className="text-sm bg-slate-950/50 p-3 rounded border border-slate-800/50">
                        <div className="text-slate-500 text-xs mb-1 font-medium">情境: {be.context}</div>
                        <div className="text-slate-300 italic">"{be.response}"</div>
                    </div>
                ))}
            </div>
        </div>
    )}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode, text: string }> = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-12 md:py-16 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-500 w-full">
    <div className="mb-4 opacity-50">{icon}</div>
    <p className="text-center px-4">{text}</p>
  </div>
);

const ManualGuidelineInput: React.FC<{ onAdd: (category: string, content: string) => void }> = ({ onAdd }) => {
  const [category, setCategory] = useState('通用');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commonCategories = ['通用', '风格', '对话', '描写', '节奏', '禁忌词', '其他'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onAdd(category, content);
      setContent('');
      setCategory('通用');
      setIsExpanded(false);
    }
  };

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);
  useEffect(() => {
    if (isExpanded) {
      adjustTextareaHeight(textareaRef.current, 360);
    }
  }, [content, isExpanded]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full py-3 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        点击添加新的写作指导
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">分类</label>
        <div className="flex flex-wrap gap-2">
          {commonCategories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="或输入自定义分类"
          className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">指导内容</label>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onInput={() => adjustTextareaHeight(textareaRef.current, 360)}
          placeholder="例如：少用形容词，多用动词和名词来展现画面感..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[120px] resize-none max-h-[360px] overflow-y-auto whitespace-pre-wrap"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!content.trim()}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          添加指导
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setContent('');
            setCategory('通用');
          }}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
};

export default StoryBoard;
