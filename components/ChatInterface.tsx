
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message, ApiConfig, StoryState, MessageMode, SendMessageOptions, WritingMethod, Author, SelectedAuthorId, StoryGenre } from '../types';
import { DEFAULT_AUTHORS } from '../defaultContent';
import { Send, Bot, User, Loader2, Sparkles, ChevronDown, Menu, Settings, Copy, Trash2, Edit2, RefreshCw, Check, X, Box, Server, Zap, Key, FolderOpen, Brain, ChevronDown as ChevronDownIcon, ChevronUp, Square, Play, Eye, EyeOff, FileText, Save, MessageSquare, Thermometer, BookOpen, Plus, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, RotateCcw, Download, FileCode, Hash, Type, Folder, RotateCcw as RotateCcwIcon, Unlock, Maximize2, Search, GitBranch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PromptConfirmModal from './PromptConfirmModal';
import { DEFAULT_WRITING_SAMPLES, DEFAULTS_INITIALIZED_KEY } from '../defaultContent';
import * as dataService from '../services/dataService';

// 获取当前主机地址（支持手机访问）
const getProxyHost = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }
  return 'localhost';
};

const autoGrowTextarea = (el: HTMLTextAreaElement | null, maxHeight = 280) => {
  if (!el) return;
  el.style.height = 'auto';
  const nextHeight = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, options?: SendMessageOptions) => void;
  isLoading: boolean;
  
  currentConfig: ApiConfig | null;
  savedConfigs: ApiConfig[];
  onConfigSelect: (config: ApiConfig) => void;
  onModelIdChange: (newId: string) => void;

  onToggleSidebar: () => void;
  targetWordCount: number;
  onSetTargetWordCount: (count: number) => void;
  maxHistoryForAI?: number;
  onSetMaxHistoryForAI?: (count: number) => void;
  rewriteContextBefore?: number;
  rewriteContextAfter?: number;
  onSetRewriteContextBefore?: (count: number) => void;
  onSetRewriteContextAfter?: (count: number) => void;
  temperature: number;
  onSetTemperature: (value: number) => void;
  enableStreaming?: boolean;
  onSetEnableStreaming?: (value: boolean) => void;
  removeContextLimit?: boolean;
  onSetRemoveContextLimit?: (value: boolean) => void;
  contextLength?: number;
  onSetContextLength?: (value: number) => void;
  maxResponseLength?: number;
  onSetMaxResponseLength?: (value: number) => void;
  useModelDefaults?: boolean;
  onSetUseModelDefaults?: (value: boolean) => void;
  onDeleteMessage: (id: string | string[]) => void;
  onEditMessage: (id: string, newText: string) => void;
  onToggleExcludeFromAI?: (id: string) => void;
  onRegenerate: (id: string) => void;
  onReAnswerUser?: (messageId: string) => void;
  onOpenApiKeyModal: () => void; // New Prop
  onStop?: () => void; // Stop AI generation
  onContinue?: (messageId: string) => void; // Continue stopped generation
  
  
  // Prompt Confirmation Props
  getPromptContext?: (userMessage?: string) => any;
  
  // Manual Save Props
  story?: StoryState;
  onManualSaveToChapter?: (content: string, chapterNumber: number, volumeNumber?: number, createNewVersion?: boolean) => void;
  
  // Auto Write Props
  autoWriteEnabled?: boolean;
  onSetAutoWriteEnabled?: (enabled: boolean) => void;
  autoWriteChapters?: number;
  onSetAutoWriteChapters?: (chapters: number) => void;
  autoWriteCooldownDuration?: number;
  onSetAutoWriteCooldownDuration?: (duration: number) => void;
  autoWriteCurrentChapter?: number;
  onSetAutoWriteCurrentChapter?: (current: number) => void;
  autoWriteCooldown?: number;
  onStartAutoWrite?: (startChapter: number) => void;
  onStopAutoWrite?: () => void;
  
  // Branch message props
  onBranchMessage?: (messageId: string) => void;
  
  // Rate limit props
  enableRateLimit?: boolean;
  onSetEnableRateLimit?: (enabled: boolean) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  currentConfig,
  savedConfigs,
  onConfigSelect,
  onModelIdChange,
  onToggleSidebar,
  targetWordCount,
  onSetTargetWordCount,
  maxHistoryForAI: maxHistoryForAIProp,
  onSetMaxHistoryForAI: onSetMaxHistoryForAIProp,
  rewriteContextBefore: rewriteContextBeforeProp,
  rewriteContextAfter: rewriteContextAfterProp,
  onSetRewriteContextBefore: onSetRewriteContextBeforeProp,
  onSetRewriteContextAfter: onSetRewriteContextAfterProp,
  temperature,
  onSetTemperature,
  enableStreaming,
  onSetEnableStreaming,
  removeContextLimit,
  onSetRemoveContextLimit,
  contextLength,
  onSetContextLength,
  maxResponseLength,
  onSetMaxResponseLength,
  useModelDefaults,
  onSetUseModelDefaults,
  onDeleteMessage, 
  onEditMessage, 
  onToggleExcludeFromAI,
  onRegenerate,
  onReAnswerUser,
  onOpenApiKeyModal,
  getPromptContext,
  onStop,
  onContinue,
  story,
  onManualSaveToChapter,
  autoWriteEnabled = false,
  onSetAutoWriteEnabled,
  autoWriteChapters = 1,
  onSetAutoWriteChapters,
  autoWriteCooldownDuration = 30,
  onSetAutoWriteCooldownDuration,
  autoWriteCurrentChapter = 0,
  onSetAutoWriteCurrentChapter,
  autoWriteCooldown = 0,
  onStartAutoWrite,
  onStopAutoWrite,
  onBranchMessage,
  
  // Rate limit props
  enableRateLimit = false,
  onSetEnableRateLimit = undefined
}) => {
  const [input, setInput] = React.useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [useTraditionalQuotes, setUseTraditionalQuotes] = useState(() => {
    const saved = localStorage.getItem('storyforge_use_traditional_quotes');
    return saved === 'true';
  });
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [selectedMessageForReasoning, setSelectedMessageForReasoning] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingMessageMode, setPendingMessageMode] = useState<MessageMode>('general');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPromptViewModal, setShowPromptViewModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMessageContent, setSaveMessageContent] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<{ number: number; volumeNumber?: number } | null>(null);
  const [showCreateVersionConfirm, setShowCreateVersionConfirm] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<{ content: string; chapterNumber: number; volumeNumber?: number } | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null); // 跟踪哪个消息的复制成功了
  
  // Quick prompts state
  interface QuickPrompt {
    id: string;
    label: string;
    text: string;
  }
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(() => {
    const saved = localStorage.getItem('storyforge_quick_prompts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    // Default quick prompts
    return [
      { id: '1', label: '继续', text: '继续' },
      { id: '2', label: '优化', text: '优化这段内容' },
      { id: '3', label: '扩展', text: '扩展这段内容' },
      { id: '4', label: '重写', text: '重写这段内容' },
      { id: '5', label: '精简', text: '精简这段内容' },
      { id: '6', label: '润色', text: '润色这段内容' },
      { id: '7', label: '补充', text: '补充更多细节' },
      { id: '8', label: '修改', text: '修改这段内容' },
    ];
  });
  const [editingQuickPrompt, setEditingQuickPrompt] = useState<QuickPrompt | null>(null);
  const [showQuickPromptEditor, setShowQuickPromptEditor] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressDuration = 500; // 500ms for long press
  const touchHandledRef = useRef<boolean>(false); // 标记是否已通过触摸事件处理
  
  // Model capabilities query state
  const [modelCapabilities, setModelCapabilities] = useState<{
    maxContextTokens?: number;
    maxOutputTokens?: number;
    defaultMaxOutputTokens?: number;
    loading: boolean;
    error?: string;
    queryMethod?: 'api' | 'ai'; // 查询方式：API端点或AI对话
  } | null>(null);

  const [visibleMessageCount, setVisibleMessageCount] = useState(50); // Performance: only show last N messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sampleFileInputRef = useRef<HTMLInputElement>(null);
  const sampleEditFormRef = useRef<HTMLDivElement>(null);
  const sampleManagerContentRef = useRef<HTMLDivElement>(null);
  const savedScrollPositionRef = useRef<number | null>(null);
  const quickPromptsContainerRef = useRef<HTMLDivElement>(null);
  const [quickPromptsHeight, setQuickPromptsHeight] = useState<number>(0);
  
  // 题材选择状态（替代原来的模式选择）
  const [storyGenre, setStoryGenre] = useState<StoryGenre>(() => {
    const saved = localStorage.getItem('storyforge_story_genre');
    return (saved as StoryGenre) || 'none';
  });
  
  // 保存题材选择到 localStorage
  useEffect(() => {
    localStorage.setItem('storyforge_story_genre', storyGenre);
  }, [storyGenre]);
  
  // 保留 messageMode 用于向后兼容，但不再在UI中显示
  const [messageMode] = useState<MessageMode>('general');
  const [showNavButtons, setShowNavButtons] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number | null>(null);
  const navButtonsTimeoutRef = useRef<any>(null);
  const [navButtonsRight, setNavButtonsRight] = useState(16);
  const [isMobile, setIsMobile] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollTimeoutRef = useRef<any>(null);
  const [writingMethod, setWritingMethod] = useState<WritingMethod>(() => {
    const saved = localStorage.getItem('storyforge_writing_method');
    if (saved === 'fanwen_resonance_4step' || saved === 'fanwen_style_imitation' || saved === 'reverse_outline' || saved === 'default' || saved === 'chat_only') return saved as WritingMethod;
    return 'default';
  });
  
  // 作家选择状态
  const [selectedAuthorId, setSelectedAuthorId] = useState<SelectedAuthorId>(() => {
    const saved = localStorage.getItem('storyforge_selected_author_id');
    return (saved as SelectedAuthorId) || 'none';
  });

  const formatTimestamp = useCallback((ts?: number) => {
    if (!ts) return '时间未知';
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
      return '时间未知';
    }
  }, []);

  const formatLatency = useCallback((ms?: number) => {
    if (ms === null || ms === undefined) return '';
    const seconds = ms / 1000;
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  }, []);
  
  // 加载所有作家（默认 + 自定义）
  const getAllAuthors = (): Author[] => {
    const customAuthorsJson = localStorage.getItem('storyforge_custom_authors');
    const customAuthors: Author[] = customAuthorsJson ? JSON.parse(customAuthorsJson) : [];
    
    // 加载默认作家的自定义描述（如果有）
    const defaultAuthorDescriptionsJson = localStorage.getItem('storyforge_default_author_descriptions');
    const defaultAuthorDescriptions: Record<string, string> = defaultAuthorDescriptionsJson ? JSON.parse(defaultAuthorDescriptionsJson) : {};
    
    const defaultAuthorsWithCustomDesc = DEFAULT_AUTHORS.map(author => ({
      ...author,
      description: defaultAuthorDescriptions[author.id] || author.description
    }));
    
    return [...defaultAuthorsWithCustomDesc, ...customAuthors];
  };
  
  const [allAuthors, setAllAuthors] = useState<Author[]>(getAllAuthors());
  
  // 监听自定义作家的变化
  useEffect(() => {
    const handleStorageChange = () => {
      setAllAuthors(getAllAuthors());
    };
    window.addEventListener('storage', handleStorageChange);
    // 也监听自定义事件（同窗口内的更新）
    window.addEventListener('storyforge-custom-authors-updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storyforge-custom-authors-updated', handleStorageChange);
    };
  }, []);
  const [samplesEnabled, setSamplesEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('storyforge_writing_samples_enabled');
    return saved ? saved === 'true' : true;
  });
  
  // Hidden messages state
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('storyforge_hidden_message_ids');
    return saved ? new Set(JSON.parse(saved)) : new Set<string>();
  });
  
  // Save hidden messages to localStorage
  useEffect(() => {
    localStorage.setItem('storyforge_hidden_message_ids', JSON.stringify(Array.from(hiddenMessageIds)));
  }, [hiddenMessageIds]);
  
  
  // Config Selector State
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);
  const configMenuRef = useRef<HTMLDivElement>(null);
  
  // Chat Settings State
  const [maxHistoryForAI, setMaxHistoryForAI] = useState(() => {
    if (maxHistoryForAIProp !== undefined) return maxHistoryForAIProp;
    const saved = localStorage.getItem('storyforge_max_history_for_ai');
    return saved ? Number(saved) : 10;
  });
  const [rewriteContextBefore, setRewriteContextBefore] = useState(() => {
    if (rewriteContextBeforeProp !== undefined) return rewriteContextBeforeProp;
    const saved = localStorage.getItem('storyforge_rewrite_context_before');
    return saved ? Number(saved) : 3;
  });
  const [rewriteContextAfter, setRewriteContextAfter] = useState(() => {
    if (rewriteContextAfterProp !== undefined) return rewriteContextAfterProp;
    const saved = localStorage.getItem('storyforge_rewrite_context_after');
    return saved ? Number(saved) : 3;
  });
  
  // Prompt confirmation toggle
  const [showPromptConfirmation, setShowPromptConfirmation] = useState(() => {
    const saved = localStorage.getItem('storyforge_show_prompt_confirmation');
    return saved ? saved === 'true' : true; // Default to true (show confirmation)
  });

  // Font size state (in pixels, range: 12-20, default: 14)
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('storyforge_font_size');
    return saved ? Number(saved) : 14;
  });

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem('storyforge_font_size', fontSize.toString());
  }, [fontSize]);

  // Writing Sample Management
  interface WritingSample {
    id: string;
    name: string;
    content: string;
    selected: boolean;
    order?: number; // 编号，用于排序
  }
  
  const [writingSamples, setWritingSamples] = useState<WritingSample[]>(() => {
    const saved = localStorage.getItem('storyforge_writing_samples');
    if (saved) {
      return JSON.parse(saved);
    }
    // 首次启动时，初始化默认范文
    const defaultsInitialized = localStorage.getItem(DEFAULTS_INITIALIZED_KEY);
    if (!defaultsInitialized) {
      localStorage.setItem(DEFAULTS_INITIALIZED_KEY, 'true');
      return DEFAULT_WRITING_SAMPLES;
    }
    return [];
  });
  
  const [showSampleManager, setShowSampleManager] = useState(false);
  const [editingSample, setEditingSample] = useState<WritingSample | null>(null);
  const [sampleName, setSampleName] = useState('');
  const [sampleContent, setSampleContent] = useState('');
  
  // Sync with prop if provided
  useEffect(() => {
    if (maxHistoryForAIProp !== undefined && maxHistoryForAIProp !== maxHistoryForAI) {
      setMaxHistoryForAI(maxHistoryForAIProp);
    }
  }, [maxHistoryForAIProp]);
  
  const handleSetMaxHistoryForAI = (count: number) => {
    setMaxHistoryForAI(count);
    if (onSetMaxHistoryForAIProp) {
      onSetMaxHistoryForAIProp(count);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Navigation functions
  const scrollToTop = () => {
    if (displayedMessages.length > 0) {
      scrollToMessage(0);
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToMessage = (index: number) => {
    if (messagesContainerRef.current && displayedMessages[index]) {
      const messageId = displayedMessages[index].id;
      const messageElement = messagesContainerRef.current.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        // Find the message number element
        const messageNumberElement = messageElement.querySelector(`[data-message-number]`);
        const targetElement = messageNumberElement || messageElement;
        
        // Calculate the exact position to scroll to
        const container = messagesContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const scrollTop = container.scrollTop;
        const targetTop = scrollTop + targetRect.top - containerRect.top;
        
        // Scroll to position the message number at the top of the viewport
        container.scrollTo({
          top: targetTop - 20, // Add some padding
          behavior: 'smooth'
        });
        
        setCurrentMessageIndex(index);
      }
    }
  };

  // Find the currently visible message based on message number position
  const findCurrentVisibleMessage = () => {
    if (!messagesContainerRef.current) return null;
    const container = messagesContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const viewportTop = containerTop + 50; // Check near the top of viewport
    
    // Find the message number that is closest to the top of the viewport
    let closestMessage = null;
    let closestDistance = Infinity;
    
    displayedMessages.forEach((msg, index) => {
      const messageElement = container.querySelector(`[data-message-id="${msg.id}"]`);
      if (messageElement) {
        const messageNumberElement = messageElement.querySelector(`[data-message-number]`);
        if (messageNumberElement) {
          const rect = messageNumberElement.getBoundingClientRect();
          const numberTop = rect.top;
          const distance = Math.abs(numberTop - viewportTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMessage = { msg, index };
          }
        }
      }
    });
    
    return closestMessage;
  };

  const scrollToPrev = () => {
    const current = findCurrentVisibleMessage();
    if (current && current.index > 0) {
      scrollToMessage(current.index - 1);
    }
    // 移除循环逻辑，到头就停止
  };

  const scrollToNext = () => {
    const current = findCurrentVisibleMessage();
    if (current) {
      if (current.index < displayedMessages.length - 1) {
        // 不是最后一层，滚动到下一层
        scrollToMessage(current.index + 1);
      } else {
        // 已经是最后一层，滚动到最后一层的开头
        scrollToMessage(displayedMessages.length - 1);
      }
    }
  };
  
  // 检查是否可以向上滚动
  const canScrollUp = () => {
    const current = findCurrentVisibleMessage();
    return current && current.index > 0;
  };
  
  // 检查是否可以向下滚动（在最后一层时也返回true，因为可以回到最后一层开头）
  const canScrollDown = () => {
    // 如果有消息，始终返回true，因为即使在最后一层，也可以滚动到最后一层的开头
    return displayedMessages.length > 0;
  };

  // Handle re-answer for user messages
  const handleReAnswer = (userMessageId: string) => {
    if (onReAnswerUser) {
      onReAnswerUser(userMessageId);
      return;
    }
    const userMsg = messages.find(m => m.id === userMessageId);
    if (userMsg && userMsg.role === 'user') {
      setTimeout(() => {
        onSendMessage(userMsg.text);
      }, 200);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist writing method & lock state
  useEffect(() => {
    localStorage.setItem('storyforge_writing_method', writingMethod);
  }, [writingMethod]);

  // Persist writing style & notify other components
  useEffect(() => {
    localStorage.setItem('storyforge_selected_author_id', selectedAuthorId);
    // 通知其他组件作家已更改
    window.dispatchEvent(new CustomEvent('storyforge-selected-author-changed', {
      detail: { authorId: selectedAuthorId }
    }));
  }, [selectedAuthorId]);

  useEffect(() => {
    const detail = { method: writingMethod };
    window.dispatchEvent(new CustomEvent('storyforge-writing-method-changed', { detail }));
  }, [writingMethod]);

  // 动态监测快捷按钮容器的高度，调整 textarea 的 padding-top
  useEffect(() => {
    if (!quickPromptsContainerRef.current) return;

    const updateHeight = () => {
      if (quickPromptsContainerRef.current) {
        const height = quickPromptsContainerRef.current.offsetHeight;
        setQuickPromptsHeight(height);
      }
    };

    // 初始测量
    updateHeight();

    // 使用 ResizeObserver 监测容器高度变化
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(quickPromptsContainerRef.current);

    // 监听窗口大小变化
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [quickPrompts.length]);

  // 范文启用状态同步到数据服务器
  const isInitializingWritingSamplesEnabled = useRef(false);
  const writingSamplesEnabledSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedWritingSamplesEnabledRef = useRef<boolean | null>(null);
  
  // 初始化时从数据服务器加载范文启用状态
  useEffect(() => {
    const loadWritingSamplesEnabled = async () => {
      try {
        isInitializingWritingSamplesEnabled.current = true;
        const serverData = await dataService.loadWritingSamplesEnabled();
        if (serverData !== null) {
          // 如果服务器有数据，使用服务器的数据
          setSamplesEnabled(serverData);
          localStorage.setItem('storyforge_writing_samples_enabled', serverData ? 'true' : 'false');
          lastSavedWritingSamplesEnabledRef.current = serverData;
        } else {
          // 如果服务器没有数据，使用 localStorage 的数据，并保存到服务器
          const localData = localStorage.getItem('storyforge_writing_samples_enabled');
          const enabled = localData ? localData === 'true' : true;
          // 异步保存到服务器
          dataService.saveWritingSamplesEnabled(enabled).catch(() => {});
        }
      } catch (error) {
        console.error('加载范文启用状态失败:', error);
      } finally {
        isInitializingWritingSamplesEnabled.current = false;
      }
    };
    
    loadWritingSamplesEnabled();
  }, []);
  
  // 保存范文启用状态到 localStorage 和数据服务器
  useEffect(() => {
    // 如果正在初始化（从数据服务器加载），不保存
    if (isInitializingWritingSamplesEnabled.current) {
      isInitializingWritingSamplesEnabled.current = false;
      // 更新引用，避免下次触发保存
      lastSavedWritingSamplesEnabledRef.current = samplesEnabled;
      return;
    }
    
    // 检查是否真的改变了（避免循环保存）
    if (samplesEnabled === lastSavedWritingSamplesEnabledRef.current) {
      return; // 没有变化，不保存
    }
    
    // 1. 立即保存到 localStorage（主要数据源，快速可靠）
    localStorage.setItem('storyforge_writing_samples_enabled', samplesEnabled ? 'true' : 'false');
    lastSavedWritingSamplesEnabledRef.current = samplesEnabled;
    
    // 2. 后台异步保存到数据服务器（作为备份和跨设备同步）
    // 防抖保存到数据服务器（延迟 1 秒，避免频繁保存）
    if (writingSamplesEnabledSaveTimeoutRef.current) {
      clearTimeout(writingSamplesEnabledSaveTimeoutRef.current);
    }
    
    writingSamplesEnabledSaveTimeoutRef.current = setTimeout(() => {
      // 异步保存到数据服务器，失败不影响用户体验（因为 localStorage 已保存）
      dataService.saveWritingSamplesEnabled(samplesEnabled).catch(() => {
        // 静默失败，数据已在 localStorage 中保存
      });
    }, 1000); // 1 秒延迟
    
    return () => {
      if (writingSamplesEnabledSaveTimeoutRef.current) {
        clearTimeout(writingSamplesEnabledSaveTimeoutRef.current);
      }
    };
  }, [samplesEnabled]);

  // Handle scroll events on mobile
  useEffect(() => {
    if (!messagesContainerRef.current || !isMobile) return;

    const container = messagesContainerRef.current;
    
    const handleScroll = () => {
      // Show buttons when scrolling
      setHasScrolled(true);
      setShowNavButtons(true);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Hide buttons after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setShowNavButtons(false);
        setHasScrolled(false);
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isMobile, messages]);

  // Update navigation buttons position when container resizes
  useEffect(() => {
    const updateNavPosition = () => {
      if (messagesContainerRef.current) {
        const rect = messagesContainerRef.current.getBoundingClientRect();
        setNavButtonsRight(window.innerWidth - rect.right + 16);
      }
    };
    
    updateNavPosition();
    window.addEventListener('resize', updateNavPosition);
    return () => window.removeEventListener('resize', updateNavPosition);
  }, [messages]);
  useEffect(() => {
    autoGrowTextarea(inputTextareaRef.current, 260);
  }, [input]);
  useEffect(() => {
    if (editingMessageId) {
      autoGrowTextarea(editingTextareaRef.current, 360);
    }
  }, [editingMessageId, editingText]);
  
  // Close config menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target as Node)) {
        setIsConfigMenuOpen(false);
      }
    };
    
    if (isConfigMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isConfigMenuOpen]);

  // Performance optimization: Show only recent messages
  // Fix: Do NOT exclude hiddenMessageIds here, as they are just "excluded from AI", not hidden from user
  const displayedMessages = messages.length > visibleMessageCount 
    ? messages.slice(-visibleMessageCount)
    : messages;
  
  const hasMoreMessages = messages.length > visibleMessageCount;
  
  // Limit history for prompt context (same as what's sent to AI)
  // Filter out system messages that should be excluded from AI context
  // Also filter out messages in hiddenMessageIds set (manually hidden by user)
  const messagesForAI = messages.filter(msg => !msg.excludeFromAI && !hiddenMessageIds.has(msg.id));
  const limitedHistoryForPrompt = messagesForAI.length > maxHistoryForAI
    ? messagesForAI.slice(-maxHistoryForAI).map(m => ({ role: m.role, text: m.text }))
    : messagesForAI.map(m => ({ role: m.role, text: m.text }));
  
  // Save maxHistoryForAI to localStorage when changed
  useEffect(() => {
    localStorage.setItem('storyforge_max_history_for_ai', maxHistoryForAI.toString());
  }, [maxHistoryForAI]);

  // Save rewrite context settings to localStorage when changed
  useEffect(() => {
    localStorage.setItem('storyforge_rewrite_context_before', rewriteContextBefore.toString());
  }, [rewriteContextBefore]);

  useEffect(() => {
    localStorage.setItem('storyforge_rewrite_context_after', rewriteContextAfter.toString());
  }, [rewriteContextAfter]);

  // Sync props to local state when props change
  useEffect(() => {
    if (rewriteContextBeforeProp !== undefined) {
      setRewriteContextBefore(rewriteContextBeforeProp);
    }
  }, [rewriteContextBeforeProp]);

  useEffect(() => {
    if (rewriteContextAfterProp !== undefined) {
      setRewriteContextAfter(rewriteContextAfterProp);
    }
  }, [rewriteContextAfterProp]);

  // Use prop values if provided, otherwise use local state
  const effectiveRewriteContextBefore = rewriteContextBeforeProp !== undefined ? rewriteContextBeforeProp : rewriteContextBefore;
  const effectiveRewriteContextAfter = rewriteContextAfterProp !== undefined ? rewriteContextAfterProp : rewriteContextAfter;
  const effectiveSetRewriteContextBefore = onSetRewriteContextBeforeProp || setRewriteContextBefore;
  const effectiveSetRewriteContextAfter = onSetRewriteContextAfterProp || setRewriteContextAfter;

  // 范文数据同步到数据服务器
  const isInitializingWritingSamples = useRef(false);
  const writingSamplesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedWritingSamplesRef = useRef<string>('');
  const writingSamplesPendingSaveRef = useRef<WritingSample[] | null>(null);
  
  // 立即保存范文数据（不延迟）
  const saveWritingSamplesImmediately = useCallback(async (samples: WritingSample[]) => {
    try {
      const success = await dataService.saveWritingSamples(samples);
      if (success) {
        writingSamplesPendingSaveRef.current = null;
      }
    } catch (error) {
      console.error('保存范文数据失败:', error);
    }
  }, []);
  
  // 初始化时从数据服务器加载范文数据
  useEffect(() => {
    const loadWritingSamples = async () => {
      try {
        isInitializingWritingSamples.current = true;
        const serverData = await dataService.loadWritingSamples();
        if (serverData && Array.isArray(serverData) && serverData.length > 0) {
          // 如果服务器有数据，使用服务器的数据
          setWritingSamples(serverData);
          localStorage.setItem('storyforge_writing_samples', JSON.stringify(serverData));
          lastSavedWritingSamplesRef.current = JSON.stringify(serverData);
        } else {
          // 如果服务器没有数据，使用 localStorage 的数据，并保存到服务器
          const localData = localStorage.getItem('storyforge_writing_samples');
          if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // 异步保存到服务器
              dataService.saveWritingSamples(parsed).catch(() => {});
            }
          }
        }
      } catch (error) {
        console.error('加载范文数据失败:', error);
      } finally {
        isInitializingWritingSamples.current = false;
      }
    };
    
    loadWritingSamples();
  }, []);
  
  // 保存范文数据到 localStorage 和数据服务器
  useEffect(() => {
    // 如果正在初始化（从数据服务器加载），不保存
    if (isInitializingWritingSamples.current) {
      isInitializingWritingSamples.current = false;
      // 更新引用，避免下次触发保存
      lastSavedWritingSamplesRef.current = JSON.stringify(writingSamples);
      return;
    }
    
    // 检查是否真的改变了（避免循环保存）
    const currentSamplesStr = JSON.stringify(writingSamples);
    if (currentSamplesStr === lastSavedWritingSamplesRef.current) {
      return; // 没有变化，不保存
    }
    
    // 1. 立即保存到 localStorage（主要数据源，快速可靠）
    localStorage.setItem('storyforge_writing_samples', currentSamplesStr);
    lastSavedWritingSamplesRef.current = currentSamplesStr;
    
    // 2. 后台异步保存到数据服务器（作为备份和跨设备同步）
    writingSamplesPendingSaveRef.current = writingSamples;
    
    // 防抖保存到数据服务器（延迟 1 秒，避免频繁保存）
    if (writingSamplesSaveTimeoutRef.current) {
      clearTimeout(writingSamplesSaveTimeoutRef.current);
    }
    
    writingSamplesSaveTimeoutRef.current = setTimeout(() => {
      if (writingSamplesPendingSaveRef.current) {
        // 异步保存到数据服务器，失败不影响用户体验（因为 localStorage 已保存）
        saveWritingSamplesImmediately(writingSamplesPendingSaveRef.current).catch(() => {
          // 静默失败，数据已在 localStorage 中保存
        });
      }
    }, 1000); // 1 秒延迟
    
    return () => {
      if (writingSamplesSaveTimeoutRef.current) {
        clearTimeout(writingSamplesSaveTimeoutRef.current);
      }
    };
  }, [writingSamples, saveWritingSamplesImmediately]);

  // Save quick prompts to localStorage and data server
  // 添加标记，防止在从数据服务器加载时触发保存
  const isInitializingQuickPrompts = useRef(false);
  const quickPromptsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedQuickPromptsRef = useRef<string>('');
  const isComponentMounted = useRef(true);
  const pendingSaveRef = useRef<QuickPrompt[] | null>(null);
  
  // 立即保存快捷提示词（不延迟）
  const saveQuickPromptsImmediately = useCallback(async (prompts: QuickPrompt[]) => {
    try {
      const success = await dataService.saveQuickPrompts(prompts);
      if (success) {
        console.log('✅ 快捷提示词已立即保存到数据服务器');
        pendingSaveRef.current = null;
      } else {
        console.error('❌ 保存快捷提示词失败');
      }
    } catch (error) {
      console.error('保存快捷提示词失败:', error);
    }
  }, []);
  
  // 初始化时设置 lastSavedQuickPromptsRef
  useEffect(() => {
    lastSavedQuickPromptsRef.current = JSON.stringify(quickPrompts);
    
    // 页面关闭前保存
    const handleBeforeUnload = () => {
      // localStorage 已经保存了，这里尝试同步到数据服务器（尽力而为）
      if (pendingSaveRef.current) {
        try {
          // 使用 sendBeacon 或同步方式保存（如果支持）
          // 注意：由于数据已在 localStorage，这里失败也不影响数据安全
          const promptsStr = JSON.stringify(pendingSaveRef.current);
          // 尝试使用 sendBeacon（如果数据服务器支持）
          // 否则静默失败，因为 localStorage 已保存
        } catch (e) {
          // 静默失败，数据已在 localStorage 中
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      isComponentMounted.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 组件卸载时立即保存
      if (pendingSaveRef.current) {
        saveQuickPromptsImmediately(pendingSaveRef.current);
      }
      
      // 组件卸载时立即保存范文数据
      if (writingSamplesPendingSaveRef.current) {
        saveWritingSamplesImmediately(writingSamplesPendingSaveRef.current);
      }
    };
  }, [saveQuickPromptsImmediately, saveWritingSamplesImmediately]); // 添加依赖
  
  useEffect(() => {
    // 如果正在初始化（从数据服务器加载），不保存
    if (isInitializingQuickPrompts.current) {
      isInitializingQuickPrompts.current = false;
      // 更新引用，避免下次触发保存
      lastSavedQuickPromptsRef.current = JSON.stringify(quickPrompts);
      return;
    }
    
    // 检查是否真的改变了（避免循环保存）
    const currentPromptsStr = JSON.stringify(quickPrompts);
    if (currentPromptsStr === lastSavedQuickPromptsRef.current) {
      return; // 没有变化，不保存
    }
    
    // 1. 立即保存到 localStorage（主要数据源，快速可靠）
    localStorage.setItem('storyforge_quick_prompts', currentPromptsStr);
    lastSavedQuickPromptsRef.current = currentPromptsStr;
    
    // 2. 后台异步保存到数据服务器（作为备份和跨设备同步）
    // 保存待保存的引用
    pendingSaveRef.current = quickPrompts;
    
    // 防抖保存到数据服务器（延迟 1 秒，避免频繁保存）
    if (quickPromptsSaveTimeoutRef.current) {
      clearTimeout(quickPromptsSaveTimeoutRef.current);
    }
    
    quickPromptsSaveTimeoutRef.current = setTimeout(() => {
      if (!isComponentMounted.current) return;
      
      if (pendingSaveRef.current) {
        // 异步保存到数据服务器，失败不影响用户体验（因为 localStorage 已保存）
        saveQuickPromptsImmediately(pendingSaveRef.current).catch(() => {
          // 静默失败，数据已在 localStorage 中保存
        });
      }
    }, 1000); // 1 秒延迟
    
    return () => {
      if (quickPromptsSaveTimeoutRef.current) {
        clearTimeout(quickPromptsSaveTimeoutRef.current);
      }
    };
  }, [quickPrompts]);
  
  // 监听自定义事件，同步 quickPrompts（当从数据服务器加载时）
  useEffect(() => {
    const handleQuickPromptsLoaded = (e: Event) => {
      const customEvent = e as CustomEvent;
      try {
        const newPrompts = customEvent.detail;
        const newPromptsStr = JSON.stringify(newPrompts);
        
        // 如果内容相同，不更新（避免循环）
        if (newPromptsStr === lastSavedQuickPromptsRef.current) {
          return;
        }
        
        // 先更新引用，再标记初始化，最后更新状态
        // 这样可以确保 useEffect 检查时能正确识别这是初始化
        lastSavedQuickPromptsRef.current = newPromptsStr;
        isInitializingQuickPrompts.current = true;
        setQuickPrompts(newPrompts);
      } catch (e) {
        console.error('Failed to update quick prompts:', e);
      }
    };
    
    window.addEventListener('storyforge-quick-prompts-loaded', handleQuickPromptsLoaded);
    return () => window.removeEventListener('storyforge-quick-prompts-loaded', handleQuickPromptsLoaded);
  }, []);

  // Handle quick prompt button interactions
  const handleQuickPromptPress = (prompt: QuickPrompt) => {
    // Short press: insert text into input
    setInput(prev => {
      if (prev.trim()) {
        return prev + ' ' + prompt.text;
      }
      return prompt.text;
    });
    // Focus input after insertion
    setTimeout(() => {
      inputTextareaRef.current?.focus();
      autoGrowTextarea(inputTextareaRef.current, 260);
    }, 10);
  };

  const handleQuickPromptLongPress = (prompt: QuickPrompt) => {
    // Long press: open editor
    setEditingQuickPrompt(prompt);
    setShowQuickPromptEditor(true);
  };

  const handleQuickPromptMouseDown = (e: React.MouseEvent, prompt: QuickPrompt) => {
    // 如果是触摸设备且已经通过触摸事件处理过，则忽略鼠标事件
    if (touchHandledRef.current) {
      return;
    }
    e.preventDefault();
    longPressTimerRef.current = setTimeout(() => {
      handleQuickPromptLongPress(prompt);
    }, longPressDuration);
  };

  const handleQuickPromptMouseUp = (e: React.MouseEvent, prompt: QuickPrompt) => {
    // 如果是触摸设备且已经通过触摸事件处理过，则忽略鼠标事件
    if (touchHandledRef.current) {
      // 延迟重置标记，确保后续的鼠标事件也被忽略
      setTimeout(() => {
        touchHandledRef.current = false;
      }, 100);
      return;
    }
    e.preventDefault();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      // Short press
      handleQuickPromptPress(prompt);
    }
  };

  const handleQuickPromptTouchStart = (e: React.TouchEvent, prompt: QuickPrompt) => {
    touchHandledRef.current = false; // 重置标记
    longPressTimerRef.current = setTimeout(() => {
      handleQuickPromptLongPress(prompt);
      touchHandledRef.current = true; // 标记已处理（长按）
    }, longPressDuration);
  };

  const handleQuickPromptTouchEnd = (e: React.TouchEvent, prompt: QuickPrompt) => {
    e.preventDefault(); // 阻止浏览器随后触发的鼠标事件
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      // Short press
      if (!touchHandledRef.current) {
        touchHandledRef.current = true; // 标记已处理（短按）
        handleQuickPromptPress(prompt);
      }
    }
    // 延迟重置标记，确保后续可能触发的鼠标事件被忽略
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 300);
  };

  const handleQuickPromptTouchCancel = (e: React.TouchEvent) => {
    // 触摸被取消时清理状态
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchHandledRef.current = false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Save quick prompt
  const handleSaveQuickPrompt = (label: string, text: string) => {
    if (editingQuickPrompt) {
      // Update existing
      setQuickPrompts(prev => prev.map(p => 
        p.id === editingQuickPrompt.id ? { ...p, label, text } : p
      ));
    } else {
      // Add new
      const newPrompt: QuickPrompt = {
        id: Date.now().toString(),
        label,
        text
      };
      setQuickPrompts(prev => [...prev, newPrompt]);
    }
    setShowQuickPromptEditor(false);
    setEditingQuickPrompt(null);
  };

  // Delete quick prompt
  const handleDeleteQuickPrompt = (id: string) => {
    setQuickPrompts(prev => prev.filter(p => p.id !== id));
  };

  // Scroll to edit form when editing sample (only if not fully visible)
  useEffect(() => {
    if (editingSample && editingSample.id && sampleEditFormRef.current && sampleManagerContentRef.current) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const formRect = sampleEditFormRef.current!.getBoundingClientRect();
        const containerRect = sampleManagerContentRef.current!.getBoundingClientRect();
        
        // Check if form is fully visible in viewport
        const isFullyVisible = 
          formRect.top >= containerRect.top + 20 && 
          formRect.bottom <= containerRect.bottom - 20;
        
        if (!isFullyVisible) {
          const scrollTop = sampleManagerContentRef.current!.scrollTop;
          const formTop = scrollTop + formRect.top - containerRect.top;
          
          // Scroll to show the form with minimal padding
          sampleManagerContentRef.current!.scrollTo({
            top: formTop - 20,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [editingSample]);

  // Handle importing writing sample from txt file
  const handleImportSampleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.name.endsWith('.txt')) {
      alert('请选择 .txt 文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;
      
      // Try different encodings
      const encodings = ['UTF-8', 'GBK', 'GB2312', 'Big5', 'GB18030'];
      let content = '';
      let usedEncoding = 'UTF-8';
      
      // Helper function to check if text has garbled characters
      const hasGarbledChars = (text: string): boolean => {
        // Check for replacement character (U+FFFD) which indicates decoding failure
        if (text.includes('\uFFFD')) return true;
        // Check for unusual patterns that suggest wrong encoding
        // Common garbled patterns in Chinese text decoded with wrong encoding
        const garbledPatterns = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
        return garbledPatterns.test(text);
      };
      
      // Try each encoding until we find one that works
      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding);
          const decoded = decoder.decode(arrayBuffer);
          
          // Check if this encoding produces readable text
          if (!hasGarbledChars(decoded)) {
            content = decoded;
            usedEncoding = encoding;
            break;
          }
          
          // If UTF-8 has issues, try the next encoding
          if (encoding === 'UTF-8' && hasGarbledChars(decoded)) {
            continue;
          }
          
          // For non-UTF-8 encodings, accept if no replacement characters
          if (!decoded.includes('\uFFFD')) {
            content = decoded;
            usedEncoding = encoding;
            break;
          }
        } catch (err) {
          // TextDecoder doesn't support this encoding, try next
          console.warn(`Encoding ${encoding} not supported:`, err);
          continue;
        }
      }
      
      // If all encodings failed, fall back to UTF-8
      if (!content) {
        const decoder = new TextDecoder('UTF-8');
        content = decoder.decode(arrayBuffer);
        usedEncoding = 'UTF-8 (fallback)';
      }
      
      if (content) {
        // Use filename (without extension) as default name
        const defaultName = file.name.replace(/\.txt$/i, '');
        
        // Create new sample
        // 自动分配编号：找到最大编号+1，如果没有编号则从1开始
        const maxOrder = writingSamples.reduce((max, s) => {
          const order = s.order || 0;
          return order > max ? order : max;
        }, 0);
        const newOrder = maxOrder + 1;
        
        const newSample: WritingSample = {
          id: Date.now().toString(),
          name: defaultName,
          content: content,
          selected: false,
          order: newOrder
        };
        setWritingSamples(prev => [...prev, newSample]);
        
        // Show success message
        alert(`成功导入范文：${defaultName}\n编码：${usedEncoding}\n内容长度：${content.length} 字符`);
      }
    };
    reader.onerror = () => {
      alert('读取文件失败，请重试');
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input so the same file can be imported again
    e.target.value = '';
  };

  // Helper function to get selected samples content
  const getSelectedSamplesContent = (): string => {
    if (!samplesEnabled) return '';
    const selected = writingSamples.filter(s => s.selected);
    if (selected.length === 0) return '';
    return selected.map(s => `【${s.name}】\n${s.content}`).join('\n\n---\n\n');
  };

  // Helper function to get samples prefix (before tool call instruction)
  const getSamplesPrefix = (): string => {
    const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) return '';
    return `\n\n【范文学习要求】\n请深入分析以下范文的"写作腔调"，包括但不限于：\n1. **写作任务**：范文完成了什么写作任务（如：塑造人物、推进情节、营造氛围、埋设伏笔等）\n2. **情节设计**：情节的推进方式、转折点的设置、冲突的构建方法\n3. **铺垫手法**：伏笔的埋设方式、悬念的营造技巧、线索的串联方法\n4. **文笔风格**：语言特色、句式特点、修辞手法、叙事节奏\n5. **角色塑造**：人物性格的展现方式、对话风格、行为逻辑\n6. **整体腔调**：综合以上要素形成的独特"写作腔调"\n\n**⚠️ 重要原则（必须严格遵守）**：\n\n1. **禁止抄袭和对标**：\n   - ❌ **绝对禁止**抄袭范文的桥段、套路、情节设计\n   - ❌ **绝对禁止**对标范文的角色（不要创建类似的人物或直接复制角色设定）\n   - ❌ **绝对禁止**复制范文的具体情节、场景、对话或事件\n\n2. **应该学习的内容**：\n   - ✅ **学习笔触文风**：学习范文的语言风格、句式特点、修辞手法、叙事节奏\n   - ✅ **学习写作手法**：\n     * 铺设情节的技巧（如何推进情节、设置转折、构建冲突）\n     * 角色刻画的方法（如何展现人物性格、塑造人物形象、设计行为逻辑）\n     * 叙事腔调的运用（叙事视角、节奏控制、氛围营造）\n     * 世界观建立的方式（如何构建世界观、设定规则、展现设定）\n     * 矛盾势力巧妙引入的手法（如何引入冲突、设置对立、制造张力）\n   - ✅ **学习整体风格**：学习范文的综合写作风格和叙事特色\n\n3. **核心要求**：\n   - 必须用**全新的故事内容**（自己的情节、角色、世界观）\n   - 运用范文的**写作手法和文风**来创作\n   - 创造**原创的故事**，但保持范文的**叙事风格和笔触**\n\n【范文内容】\n${samplesContent}\n\n请按照以上要求，分析范文的写作腔调，然后运用这种腔调创作自己的故事。\n\n`;
  };

  // Helper function to get samples suffix (after tool call instruction)
  const getSamplesSuffix = (): string => {
    const samplesContent = getSelectedSamplesContent();
    if (!samplesContent) return '';
    return `\n\n【范文学习要求】\n请深入分析以上范文的"写作腔调"，包括但不限于：\n1. **写作任务**：范文完成了什么写作任务（如：塑造人物、推进情节、营造氛围、埋设伏笔等）\n2. **情节设计**：情节的推进方式、转折点的设置、冲突的构建方法\n3. **铺垫手法**：伏笔的埋设方式、悬念的营造技巧、线索的串联方法\n4. **文笔风格**：语言特色、句式特点、修辞手法、叙事节奏\n5. **角色塑造**：人物性格的展现方式、对话风格、行为逻辑\n6. **整体腔调**：综合以上要素形成的独特"写作腔调"\n\n**⚠️ 重要原则（必须严格遵守）**：\n\n1. **禁止抄袭和对标**：\n   - ❌ **绝对禁止**抄袭范文的桥段、套路、情节设计\n   - ❌ **绝对禁止**对标范文的角色（不要创建类似的人物或直接复制角色设定）\n   - ❌ **绝对禁止**复制范文的具体情节、场景、对话或事件\n\n2. **应该学习的内容**：\n   - ✅ **学习笔触文风**：学习范文的语言风格、句式特点、修辞手法、叙事节奏\n   - ✅ **学习写作手法**：\n     * 铺设情节的技巧（如何推进情节、设置转折、构建冲突）\n     * 角色刻画的方法（如何展现人物性格、塑造人物形象、设计行为逻辑）\n     * 叙事腔调的运用（叙事视角、节奏控制、氛围营造）\n     * 世界观建立的方式（如何构建世界观、设定规则、展现设定）\n     * 矛盾势力巧妙引入的手法（如何引入冲突、设置对立、制造张力）\n   - ✅ **学习整体风格**：学习范文的综合写作风格和叙事特色\n\n3. **核心要求**：\n   - 必须用**全新的故事内容**（自己的情节、角色、世界观）\n   - 运用范文的**写作手法和文风**来创作\n   - 创造**原创的故事**，但保持范文的**叙事风格和笔触**\n\n请按照以上要求，分析范文的写作腔调，然后运用这种腔调创作自己的故事。`;
  };

  // Helper function to append samples to message if in manuscript mode
  // NOTE: Samples are now always added to system instruction, not user message
  // This ensures user messages are passed through unchanged
  const appendSamplesToMessage = (message: string, mode: MessageMode): string => {
    // Always return message unchanged - samples are added to system instruction instead
    return message;
  };


  // Parse command and range (e.g., "/del 1-100" or "/hide 2-5")
  const parseCommand = (text: string): { command: string; start: number; end: number } | null => {
    const trimmed = text.trim();
    // Support both "1-100" and "1 100" formats
    const commandMatch = trimmed.match(/^\/(del|hide|unhide)(?:\s+(\d+)(?:[- ](\d+))?)?$/i);
    if (!commandMatch) return null;
    
    const command = commandMatch[1].toLowerCase();
    const start = commandMatch[2] ? parseInt(commandMatch[2], 10) : null;
    const end = commandMatch[3] ? parseInt(commandMatch[3], 10) : (start !== null ? start : null);
    
    return { command, start: start || 0, end: end || 0 };
  };

  // Get message IDs by number range
  const getMessageIdsByRange = (start: number, end: number): string[] => {
    const result: string[] = [];
    const actualStart = Math.min(start, end);
    const actualEnd = Math.max(start, end);
    
    for (let i = actualStart; i <= actualEnd; i++) {
      if (i >= 1 && i <= messages.length) {
        result.push(messages[i - 1].id);
      }
    }
    return result;
  };

  // Handle batch delete
  const handleBatchDelete = (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    
    const firstIndex = messages.findIndex(m => m.id === messageIds[0]);
    const lastIndex = messages.findIndex(m => m.id === messageIds[messageIds.length - 1]);
    const confirmMessage = `确定要删除 ${messageIds.length} 条消息吗？\n消息编号: #${firstIndex + 1}${messageIds.length > 1 ? ` - #${lastIndex + 1}` : ''}`;
    
    if (confirm(confirmMessage)) {
      // Remove from hidden list if present
      setHiddenMessageIds(prev => {
        const newSet = new Set(prev);
        messageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      // Delete messages - pass all IDs at once for batch deletion
      onDeleteMessage(messageIds);
    }
  };

  // Handle batch hide (now uses excludeFromAI instead of hiddenMessageIds)
  const handleBatchHide = (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    
    // Toggle excludeFromAI for non-tool-call messages
    if (onToggleExcludeFromAI) {
      messageIds.forEach(id => {
        const msg = messages.find(m => m.id === id);
        // Only toggle if it's not a tool call notification and not already excluded
        if (msg && !msg.isToolCall && !msg.excludeFromAI) {
          onToggleExcludeFromAI(id);
        }
      });
    }
    
    // Show notification
    const count = messageIds.length;
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-[10000] border border-slate-700';
    notification.textContent = `已隐藏 ${count} 条消息（不发送给AI）`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 2000);
  };

  // Handle unhide - also handles excludeFromAI messages
  const handleUnhide = (messageIds?: string[]) => {
    let unhiddenCount = 0;
    
    if (messageIds && messageIds.length > 0) {
      // Remove from hiddenMessageIds
      setHiddenMessageIds(prev => {
        const newSet = new Set(prev);
        messageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      // Also toggle excludeFromAI for non-tool-call messages
      if (onToggleExcludeFromAI) {
        messageIds.forEach(id => {
          const msg = messages.find(m => m.id === id);
          // Only toggle if it's not a tool call notification (isToolCall: true should stay hidden)
          if (msg && msg.excludeFromAI && !msg.isToolCall) {
            onToggleExcludeFromAI(id);
            unhiddenCount++;
          }
        });
      }
    } else {
      // Unhide all - clear hiddenMessageIds
      setHiddenMessageIds(new Set());
      
      // Also unhide all excludeFromAI messages that are not tool calls
      if (onToggleExcludeFromAI) {
        messages.forEach(msg => {
          if (msg.excludeFromAI && !msg.isToolCall) {
            onToggleExcludeFromAI(msg.id);
            unhiddenCount++;
          }
        });
      }
    }
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-[10000] border border-slate-700';
    notification.textContent = unhiddenCount > 0 ? `已显示 ${unhiddenCount} 条消息（将发送给AI）` : '已显示所有消息';
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Check for commands
    const command = parseCommand(input);
    if (command) {
    setInput('');
      
      if (command.command === 'del') {
        if (command.start === 0 && command.end === 0) {
          alert('请指定要删除的消息范围，例如：/del 1-100');
          return;
        }
        const messageIds = getMessageIdsByRange(command.start, command.end);
        if (messageIds.length === 0) {
          alert('没有找到指定范围的消息');
          return;
        }
        handleBatchDelete(messageIds);
        return;
      } else if (command.command === 'hide') {
        if (command.start === 0 && command.end === 0) {
          alert('请指定要隐藏的消息范围，例如：/hide 2-5');
          return;
        }
        const messageIds = getMessageIdsByRange(command.start, command.end);
        if (messageIds.length === 0) {
          alert('没有找到指定范围的消息');
          return;
        }
        handleBatchHide(messageIds);
        return;
      } else if (command.command === 'unhide') {
        if (command.start === 0 && command.end === 0) {
          // Unhide all
          handleUnhide();
        } else {
          // Unhide specific range
          const messageIds = getMessageIdsByRange(command.start, command.end);
          if (messageIds.length === 0) {
            alert('没有找到指定范围的消息');
            return;
          }
          handleUnhide(messageIds);
        }
        return;
      }
    }
    
    // Append writing samples if in manuscript mode
    let finalMessage = appendSamplesToMessage(input, messageMode);
    
    // Append traditional quotes instruction if enabled
    if (useTraditionalQuotes && finalMessage.trim() && !finalMessage.includes('引号使用')) {
      finalMessage = finalMessage + '\n\n**重要**：请使用简体中文回答，引号使用「」和『』，不要使用其他引号符号。';
    }
    
    // If we have context provider and confirmation is enabled, show confirmation modal
    if (getPromptContext && showPromptConfirmation) {
      setPendingMessage(finalMessage);
      setPendingMessageMode(messageMode);
      setShowConfirmModal(true);
    } else {
      // Direct send (either no context provider or confirmation disabled)
      onSendMessage(finalMessage, { mode: 'general' }); // 统一使用 general 模式
    setInput('');
    }
  };

  const handleConfirmSend = (editedUserMessage?: string, editedSystemInstruction?: string) => {
    if (pendingMessage) {
      // Use edited message if provided, otherwise use pending message
      let finalMessage = editedUserMessage !== undefined ? editedUserMessage : pendingMessage;
      // If in manuscript mode and samples are selected, ensure they are appended
      if (pendingMessageMode === 'manuscript' && samplesEnabled) {
        const samplesContent = getSelectedSamplesContent();
        if (samplesContent && !finalMessage.includes('分析、学习')) {
          // Re-apply samples with proper positioning
          finalMessage = appendSamplesToMessage(finalMessage, pendingMessageMode);
        }
      }
      // Append traditional quotes instruction if enabled
      if (useTraditionalQuotes && finalMessage.trim() && !finalMessage.includes('引号使用')) {
        finalMessage = finalMessage + '\n\n**重要**：请使用简体中文回答，引号使用「」和『』，不要使用其他引号符号。';
      }
      // Pass edited system instruction if provided
      onSendMessage(finalMessage, { 
        mode: pendingMessageMode,
        editedSystemInstruction 
      });
    setInput('');
      setPendingMessage(null);
      setShowConfirmModal(false);
    }
  };

  const handleCancelSend = () => {
    setPendingMessage(null);
    setShowConfirmModal(false);
  };

  const startEditing = (id: string, text: string) => {
    setEditingMessageId(id);
    setEditingText(text);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEditing = (id: string) => {
    if (editingText.trim()) {
      onEditMessage(id, editingText);
    }
    setEditingMessageId(null);
  };

  const handleCopy = async (text: string, messageId: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or mobile browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
      }
      
      // 显示成功反馈
      setCopySuccessId(messageId);
      setTimeout(() => {
        setCopySuccessId(null);
      }, 2000); // 2秒后隐藏
    } catch (err) {
      console.error('Copy failed:', err);
      // Last resort: try execCommand
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // 显示成功反馈
        setCopySuccessId(messageId);
        setTimeout(() => {
          setCopySuccessId(null);
        }, 2000);
      } catch (e) {
        console.error('All copy methods failed:', e);
      }
    }
  };


  const getProviderIcon = (provider: string) => {
      switch(provider) {
          case 'deepseek': return <Box className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-400" />;
          case 'siliconflow': return <Server className="w-3 h-3 md:w-3.5 md:h-3.5 text-orange-400" />;
          case 'openai': return <Settings className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />;
          case 'google': return <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-400" />;
          default: return <Settings className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />;
      }
  };

  // Common models for each provider
  const getAvailableModels = (config: ApiConfig | null): string[] => {
      if (!config) return [];
      
      // First, try to use availableModels from the config (fetched from API)
      if (config.availableModels && config.availableModels.length > 0) {
          return config.availableModels;
      }
      
      // Try to get from savedConfigs if current config doesn't have availableModels
      if (savedConfigs && savedConfigs.length > 0) {
          const savedConfig = savedConfigs.find(c => 
              c.name === config.name || 
              (c.apiKey === config.apiKey && c.provider === config.provider && c.baseUrl === config.baseUrl)
          );
          if (savedConfig?.availableModels && savedConfig.availableModels.length > 0) {
              return savedConfig.availableModels;
          }
      }
      
      // Fallback to hardcoded list based on provider
      const provider = config.provider || 'custom';
      switch(provider) {
          case 'google':
              return ['gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'];
          case 'deepseek':
              return ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v3'];
          case 'openai':
              return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
          case 'siliconflow':
              return ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-V2.5', 'Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.1-405B-Instruct'];
          default:
              return [];
      }
  };

  const isInputEmpty = input.trim().length === 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="p-2 md:p-4 border-b border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 gap-1 md:gap-3">
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Mobile: Compact Layout */}
          {isMobile ? (
            <>
              {/* Menu Button */}
              <button 
                onClick={onToggleSidebar}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                title="我的故事库"
              >
                <Menu className="w-4 h-4" />
              </button>
              
              {/* API Config (Short) */}
              {currentConfig ? (
                <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                  {getProviderIcon(currentConfig.provider)}
                  <span className="text-[10px] text-slate-300 truncate max-w-[60px]" title={currentConfig.name}>
                    {currentConfig.name || '未命名'}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 italic flex-shrink-0">无配置</span>
              )}
              
              {/* Model (Short) */}
              {currentConfig && (
                <div className="flex items-center gap-1 min-w-0 flex-shrink-0 max-w-[80px]">
                  <span className="text-[10px] text-purple-300 font-mono truncate" title={currentConfig.modelId}>
                    {currentConfig.modelId.split('/').pop()?.split('-').slice(-2).join('-') || currentConfig.modelId}
                  </span>
                </div>
              )}
              
              {/* API Settings Icon */}
              <button 
                onClick={onOpenApiKeyModal}
                className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                title="API 设置"
              >
                <Key className="w-4 h-4" />
              </button>
              
              {/* 请求频率限制开关 (Mobile) */}
              {onSetEnableRateLimit && (
                <button
                  onClick={() => onSetEnableRateLimit(!enableRateLimit)}
                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    enableRateLimit 
                      ? 'bg-orange-600/80 text-white hover:bg-orange-600' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={enableRateLimit ? '请求频率限制已启用（1分钟内最多2次）' : '请求频率限制已禁用'}
                >
                  <Zap className="w-4 h-4" />
                </button>
              )}
              
              {/* View Prompt Chain Button (Changed Icon) */}
              {getPromptContext && (
                <button 
                  onClick={() => setShowPromptViewModal(true)}
                  className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                  title="查看当前提示词链"
                >
                  <FileCode className="w-4 h-4" />
                </button>
              )}
              
              {/* Settings Button */}
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isSettingsOpen ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="对话设置"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* Desktop: Original Layout */}
              <button 
                onClick={onToggleSidebar}
                className="p-2 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors xl:hidden flex-shrink-0"
                title="菜单"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col flex-1 min-w-0 justify-center">
                <div className="flex items-center gap-2 mb-0.5 md:mb-1 min-w-0">
                  <h2 className="font-bold text-slate-200 text-sm hidden md:block whitespace-nowrap">写作助手</h2>
                  
                  <button 
                    onClick={onOpenApiKeyModal}
                    className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                    title="设置 API Key"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                  
                  {currentConfig ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getProviderIcon(currentConfig.provider)}
                      <span className="text-xs text-slate-300 truncate" title={currentConfig.name}>
                        {currentConfig.name || '未命名配置'}
                      </span>
                      {savedConfigs.length > 1 && (
                        <div className="relative" ref={configMenuRef}>
                          <button
                            onClick={() => setIsConfigMenuOpen(!isConfigMenuOpen)}
                            className="p-1 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors flex-shrink-0"
                            title="切换配置"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {isConfigMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[180px] max-h-[300px] overflow-y-auto">
                              {savedConfigs.map((cfg, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    onConfigSelect(cfg);
                                    setIsConfigMenuOpen(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                                    currentConfig?.name === cfg.name
                                      ? 'bg-purple-600/30 text-purple-300'
                                      : 'text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {getProviderIcon(cfg.provider)}
                                  <span className="truncate">{cfg.name}</span>
                                  {currentConfig?.name === cfg.name && (
                                    <Check className="w-4 h-4 ml-auto flex-shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic whitespace-nowrap">无 API 配置</span>
                  )}
                </div>
                
                {currentConfig && (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1 bg-slate-800/80 rounded px-1.5 py-0.5 border border-slate-700/50 flex-shrink-0">
                      {getProviderIcon(currentConfig.provider)}
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wide hidden xs:block">{currentConfig.provider}</span>
                    </div>
                    
                    <div className="relative flex-1 min-w-0 max-w-[200px]">
                      <select 
                        value={currentConfig.modelId}
                        onChange={(e) => onModelIdChange(e.target.value)}
                        className="w-full appearance-none bg-slate-800/50 hover:bg-slate-800 text-purple-300 text-[10px] md:text-[11px] font-mono border border-slate-700/50 rounded px-2 py-0.5 cursor-pointer hover:text-white focus:outline-none focus:border-purple-500 truncate pr-6"
                        title={currentConfig.modelId}
                      >
                        {getAvailableModels(currentConfig).map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        {!getAvailableModels(currentConfig).includes(currentConfig.modelId) && (
                          <option value={currentConfig.modelId}>{currentConfig.modelId}</option>
                        )}
                      </select>
                      <ChevronDown className="w-2.5 h-2.5 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* 请求频率限制开关 */}
                {onSetEnableRateLimit && (
                  <button
                    onClick={() => onSetEnableRateLimit(!enableRateLimit)}
                    className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                      enableRateLimit 
                        ? 'bg-orange-600/80 text-white hover:bg-orange-600' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title={enableRateLimit ? '请求频率限制已启用（1分钟内最多2次）' : '请求频率限制已禁用'}
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                )}

                {getPromptContext && (
                  <button 
                    onClick={() => setShowPromptViewModal(true)}
                    className="p-2 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                    title="查看当前提示词链"
                  >
                    <FileCode className="w-5 h-5" />
                  </button>
                )}

                <button 
                  onClick={() => {
                    const lastMessageWithReasoning = [...messages].reverse().find(m => m.reasoning);
                    if (lastMessageWithReasoning) {
                      setSelectedMessageForReasoning(lastMessageWithReasoning.id);
                      setShowReasoningModal(true);
                    } else {
                      setSelectedMessageForReasoning(null);
                      setShowReasoningModal(true);
                    }
                  }}
                  className="p-2 rounded-lg transition-colors flex-shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
                  title="查看思维链"
                >
                  <Brain className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isSettingsOpen ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  title="对话设置"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Settings Panel */}
        {isSettingsOpen && (
        <div className="border-t border-slate-800 bg-slate-900/95 p-2 md:p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base md:text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              对话设置
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          
          {/* Data Directory Selection (Electron only) - Moved to top for visibility */}
          <DataDirectorySelectorComponent />

          {/* Max History for AI */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                发送给AI的消息数量
              </label>
              <span className="text-xs md:text-sm font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 md:px-3 md:py-1 rounded">{maxHistoryForAI} 条</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="100" 
              step="1" 
              value={maxHistoryForAI} 
              onChange={(e) => handleSetMaxHistoryForAI(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            />
            <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
              <span>1 (最少)</span>
              <span>100 (最多)</span>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-1">仅发送最近的消息给AI，减少token占用并提高AI专注度</p>
          </div>
          
          {/* Target Word Count */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                单章目标字数
              </label>
              <span className="text-xs md:text-sm font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 md:px-3 md:py-1 rounded">{targetWordCount} 字</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="20000" 
                step="100" 
                value={targetWordCount} 
                onChange={(e) => onSetTargetWordCount(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
              />
            <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
                <span>500 (精简)</span>
                <span>20000 (详尽)</span>
              </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-1">AI生成正文时的目标字数</p>
           </div>

          {/* Rewrite Context Settings */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 md:w-4 md:h-4 text-orange-400" />
                重写正文上下文
              </label>
            </div>
            <div className="space-y-3">
              {/* Before Chapters */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">前文章节数</span>
                  <span className="text-xs md:text-sm font-mono text-orange-300 bg-orange-900/50 px-2 py-0.5 md:px-3 md:py-1 rounded">{effectiveRewriteContextBefore} 章</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="1" 
                  value={effectiveRewriteContextBefore} 
                  onChange={(e) => effectiveSetRewriteContextBefore(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
                />
                <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>
              {/* After Chapters */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">后文章节数</span>
                  <span className="text-xs md:text-sm font-mono text-orange-300 bg-orange-900/50 px-2 py-0.5 md:px-3 md:py-1 rounded">{effectiveRewriteContextAfter} 章</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="1" 
                  value={effectiveRewriteContextAfter} 
                  onChange={(e) => effectiveSetRewriteContextAfter(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
                />
                <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-2">重写正文时参考的前后章节数量（完整内容，无字数限制）</p>
           </div>

          {/* Prompt Confirmation Toggle */}
          {getPromptContext && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                  提示词链确认
                </label>
                <button
                  onClick={() => {
                    const newValue = !showPromptConfirmation;
                    setShowPromptConfirmation(newValue);
                    localStorage.setItem('storyforge_show_prompt_confirmation', newValue.toString());
                  }}
                  className={`relative inline-flex h-5 w-9 md:h-6 md:w-11 items-center rounded-full transition-colors ${
                    showPromptConfirmation ? 'bg-purple-600' : 'bg-slate-600'
                  }`}
                  title={showPromptConfirmation ? '提示词链确认已开启（点击关闭）' : '提示词链确认已关闭（点击开启）'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 md:h-4 md:w-4 transform rounded-full bg-white transition-transform ${
                      showPromptConfirmation ? 'translate-x-4 md:translate-x-6' : 'translate-x-0.5 md:translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">开启后，发送消息前会显示完整的提示词链供确认</p>
            </div>
          )}

          {/* Font Size Control */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <Type className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                对话字体大小
              </label>
              <span className="text-xs md:text-sm font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 md:px-3 md:py-1 rounded">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="20"
              step="1"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            />
            <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
              <span>12px (小)</span>
              <span>20px (大)</span>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-1">调整对话消息的字体大小</p>
          </div>

          {/* Temperature Controls */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3 space-y-4">
            {/* 大纲温度 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Thermometer className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                  温度
                </label>
                <span className="text-xs md:text-sm font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 md:px-3 md:py-1 rounded">{(temperature ?? 0.75).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={temperature ?? 0.75}
                onChange={(e) => onSetTemperature(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
              />
              <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-1">
                <span>0.0 (保守)</span>
                <span>2.0 (发散)</span>
              </div>
            </div>
            <p className="text-[10px] md:text-xs text-slate-400 mt-1">控制AI回复的创造性和随机性，温度越高越具创造力，温度越低越严谨。</p>
          </div>

          {/* Streaming Setting */}
          {onSetEnableStreaming !== undefined && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-400" />
                  流式传输
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableStreaming || false}
                    onChange={(e) => onSetEnableStreaming(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">启用后，AI回复会实时流式显示，体验更流畅。</p>
            </div>
          )}

          {/* Remove Context Limit Setting */}
          {onSetRemoveContextLimit !== undefined && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Unlock className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                  解除上下文限制
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeContextLimit || false}
                    onChange={(e) => onSetRemoveContextLimit(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">请求AI解除上下文长度限制，允许处理更长的对话历史。</p>
            </div>
          )}

          {/* Context Length Setting */}
          {onSetContextLength !== undefined && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3 h-3 md:w-4 md:h-4 text-cyan-400" />
                  上下文长度
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={contextLength || 0}
                  onChange={(e) => onSetContextLength(Number(e.target.value))}
                  className="w-20 md:w-24 px-2 py-1 text-xs md:text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="0=默认"
                />
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">设置上下文窗口大小（token数），0表示使用模型默认值。</p>
            </div>
          )}

          {/* Max Response Length Setting */}
          {onSetMaxResponseLength !== undefined && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Maximize2 className="w-3 h-3 md:w-4 md:h-4 text-pink-400" />
                  最大回复长度
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={maxResponseLength || 0}
                  onChange={(e) => onSetMaxResponseLength(Number(e.target.value))}
                  className="w-20 md:w-24 px-2 py-1 text-xs md:text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="0=默认"
                />
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">设置AI回复的最大长度（token数），0表示使用模型默认值。</p>
            </div>
          )}

          {/* Use Model Defaults Setting */}
          {onSetUseModelDefaults !== undefined && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Settings className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
                  使用模型默认参数
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useModelDefaults || false}
                    onChange={(e) => onSetUseModelDefaults(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">启用后，将使用模型默认参数（温度、上下文长度、最大回复长度等），忽略自定义设置。适用于某些不支持自定义参数的模型或代理服务。</p>
            </div>
          )}

          {/* Model Info Display */}
          {currentConfig && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Brain className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                  当前模型信息
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      if (!currentConfig) return;
                      setModelCapabilities({ loading: true, queryMethod: 'api' });
                      try {
                      const cleanKey = (currentConfig.useProxy && currentConfig.proxyKey?.trim()) 
                        ? currentConfig.proxyKey.trim() 
                        : currentConfig.apiKey.trim();
                      const cleanBaseUrl = currentConfig.provider === 'google' 
                        ? (currentConfig.useProxy && currentConfig.proxyUrl?.trim() ? currentConfig.proxyUrl.trim() : '')
                        : (currentConfig.useProxy && currentConfig.proxyUrl?.trim() ? currentConfig.proxyUrl.trim() : currentConfig.baseUrl.trim());
                      
                      if (!cleanKey) {
                        throw new Error('API Key 未设置');
                      }
                      
                      let url = '';
                      let requestOptions: RequestInit = { method: 'GET' };
                      
                      if (currentConfig.provider === 'google') {
                        let base = 'https://generativelanguage.googleapis.com';
                        if (currentConfig.useProxy && cleanBaseUrl) {
                          base = cleanBaseUrl.trim().replace(/\/$/, '');
                        }
                        let path = `/v1beta/models/${currentConfig.modelId}`;
                        if (base.includes('/v1beta') || base.includes('/v1')) { 
                          path = `/models/${currentConfig.modelId}`; 
                        }
                        url = `${base}${path}?key=${cleanKey}`;
                        requestOptions.headers = undefined;
                      } else {
                        let base = cleanBaseUrl;
                        if (!base) {
                          const providers = [
                            { id: 'deepseek', defaultBaseUrl: 'https://api.deepseek.com' },
                            { id: 'siliconflow', defaultBaseUrl: 'https://api.siliconflow.cn/v1' },
                            { id: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' }
                          ];
                          const p = providers.find(p => p.id === currentConfig.provider);
                          base = p?.defaultBaseUrl || '';
                        }
                        base = base.replace(/\/$/, '').replace(/\/v1$/, '');
                        url = `${base}/v1/models/${currentConfig.modelId}`;
                        requestOptions.headers = { 
                          'Authorization': `Bearer ${cleanKey}`,
                          'Content-Type': 'application/json'
                        };
                      }
                      
                      // 尝试使用本地代理（如果需要）
                      const proxyPorts = [3001, 3002, 3003, 3004, 3005];
                      const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');
                      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
                      
                      let res: Response;
                      try {
                        res = await fetch(url, requestOptions);
                      } catch (fetchError: any) {
                        const errorMsg = fetchError.message || 'Network error';
                        const isCorsError = errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch');
                        
                        if (isCorsError && isExternalUrl && !isLocalhost) {
                          let proxySuccess = false;
                          const proxyHost = getProxyHost(); // 获取当前主机地址（支持手机访问）
                          for (const proxyPort of proxyPorts) {
                            try {
                              const proxyUrl = `http://${proxyHost}:${proxyPort}/proxy?target=${encodeURIComponent(url)}`;
                              res = await fetch(proxyUrl, requestOptions);
                              proxySuccess = true;
                              break;
                            } catch (proxyError: any) {
                              // 继续尝试下一个端口
                            }
                          }
                          if (!proxySuccess) {
                            throw new Error(`CORS错误: ${errorMsg}。请运行 "启动代理服务器.bat" 启动代理服务器。`);
                          }
                        } else {
                          throw fetchError;
                        }
                      }
                      
                      if (!res.ok) {
                        const txt = await res.text();
                        let parsedErr = txt;
                        try {
                          const json = JSON.parse(txt);
                          parsedErr = json.error?.message || json.message || txt;
                        } catch(e) {}
                        throw new Error(`(${res.status}) ${parsedErr.slice(0, 150)}`);
                      }
                      
                      const data = await res.json();
                      
                      // 解析模型能力信息
                      let maxContextTokens: number | undefined;
                      let maxOutputTokens: number | undefined;
                      let defaultMaxOutputTokens: number | undefined;
                      
                      if (currentConfig.provider === 'google') {
                        // Google Gemini 格式
                        maxContextTokens = data.inputTokenLimit || data.contextWindowSize;
                        maxOutputTokens = data.outputTokenLimit;
                        defaultMaxOutputTokens = data.defaultMaxOutputTokens;
                      } else {
                        // OpenAI 兼容格式
                        maxContextTokens = data.context_length || data.max_input_tokens || data.max_context_tokens;
                        maxOutputTokens = data.max_output_tokens || data.max_tokens;
                        defaultMaxOutputTokens = data.default_max_output_tokens;
                      }
                      
                        setModelCapabilities({
                          maxContextTokens,
                          maxOutputTokens,
                          defaultMaxOutputTokens,
                          loading: false,
                          queryMethod: 'api'
                        });
                      } catch (error: any) {
                        console.error('查询模型能力失败:', error);
                        setModelCapabilities({
                          loading: false,
                          error: error.message || '查询失败',
                          queryMethod: 'api'
                        });
                      }
                    }}
                    disabled={modelCapabilities?.loading}
                    className="px-2 py-1 text-[10px] md:text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-1"
                    title="通过API端点查询模型能力"
                  >
                    {modelCapabilities?.loading && modelCapabilities?.queryMethod === 'api' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>查询中...</span>
                      </>
                    ) : (
                      <>
                        <Server className="w-3 h-3" />
                        <span>API</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!currentConfig || !onSendMessage) return;
                      
                      // 通过AI对话查询模型能力
                      const queryPrompt = `请告诉我你的模型能力信息，包括：
1. 最大上下文长度（context length / input tokens）
2. 最大输出长度（max output tokens / max response tokens）
3. 默认的最大输出长度（如果有的话）

请以JSON格式回复，格式如下：
{
  "maxContextTokens": 数字,
  "maxOutputTokens": 数字,
  "defaultMaxOutputTokens": 数字（可选）
}

如果不知道某个值，可以设为null。`;

                      // 发送查询消息到对话窗口
                      onSendMessage(queryPrompt);
                      
                      // 提示用户查看对话窗口
                      setModelCapabilities({
                        loading: false,
                        queryMethod: 'ai',
                        error: '已发送查询到对话窗口，请查看AI的回复。AI会以JSON格式回复模型能力信息。'
                      });
                      
                      // 尝试在5秒后从最新消息中提取信息（如果AI已经回复）
                      setTimeout(() => {
                        const lastMessage = messages[messages.length - 1];
                        if (lastMessage && lastMessage.role === 'model') {
                          try {
                            // 尝试从回复中提取JSON
                            let jsonText = lastMessage.text;
                            
                            // 尝试提取JSON部分（可能在代码块中）
                            const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                                             jsonText.match(/\{[\s\S]*"maxContextTokens"[\s\S]*?\}/);
                            
                            if (jsonMatch) {
                              jsonText = jsonMatch[1] || jsonMatch[0];
                            }
                            
                            const data = JSON.parse(jsonText);
                            
                            setModelCapabilities({
                              maxContextTokens: data.maxContextTokens || undefined,
                              maxOutputTokens: data.maxOutputTokens || undefined,
                              defaultMaxOutputTokens: data.defaultMaxOutputTokens || undefined,
                              loading: false,
                              queryMethod: 'ai'
                            });
                            return;
                          } catch (parseError) {
                            // 如果解析失败，尝试从文本中提取数字
                            const contextMatch = lastMessage.text.match(/(?:上下文|context)[\s\S]*?(\d+(?:,\d+)*)\s*(?:token|tokens)/i);
                            const outputMatch = lastMessage.text.match(/(?:输出|output|回复|response)[\s\S]*?(\d+(?:,\d+)*)\s*(?:token|tokens)/i);
                            
                            const maxContext = contextMatch ? parseInt(contextMatch[1].replace(/,/g, '')) : undefined;
                            const maxOutput = outputMatch ? parseInt(outputMatch[1].replace(/,/g, '')) : undefined;
                            
                            if (maxContext || maxOutput) {
                              setModelCapabilities({
                                maxContextTokens: maxContext,
                                maxOutputTokens: maxOutput,
                                loading: false,
                                queryMethod: 'ai'
                              });
                              return;
                            }
                          }
                        }
                      }, 5000);
                    }}
                    disabled={modelCapabilities?.loading || !onSendMessage}
                    className="px-2 py-1 text-[10px] md:text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded flex items-center gap-1"
                    title="通过AI对话查询模型能力"
                  >
                    {modelCapabilities?.loading && modelCapabilities?.queryMethod === 'ai' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>查询中...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-3 h-3" />
                        <span>AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-[10px] md:text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>模型:</span>
                  <span className="text-slate-300 font-mono">{currentConfig.modelId || '未设置'}</span>
                </div>
                <div className="flex justify-between">
                  <span>供应商:</span>
                  <span className="text-slate-300">{currentConfig.provider || '未设置'}</span>
                </div>
                {currentConfig.baseUrl && (
                  <div className="flex justify-between">
                    <span>Base URL:</span>
                    <span className="text-slate-300 font-mono truncate max-w-[200px]" title={currentConfig.baseUrl}>{currentConfig.baseUrl}</span>
                  </div>
                )}
                {useModelDefaults ? (
                  <div className="text-blue-400 mt-2">使用模型默认参数</div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>温度:</span>
                      <span className="text-slate-300">{(temperature ?? 0.75).toFixed(2)}</span>
                    </div>
                    {contextLength && contextLength > 0 && (
                      <div className="flex justify-between">
                        <span>上下文长度:</span>
                        <span className="text-slate-300">{contextLength.toLocaleString()} tokens</span>
                      </div>
                    )}
                    {maxResponseLength && maxResponseLength > 0 && (
                      <div className="flex justify-between">
                        <span>最大回复长度:</span>
                        <span className="text-slate-300">{maxResponseLength.toLocaleString()} tokens</span>
                      </div>
                    )}
                  </>
                )}
                
                {/* Model Capabilities Query Results */}
                {modelCapabilities && !modelCapabilities.loading && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    {modelCapabilities.error ? (
                      <div className="text-red-400 text-[10px] md:text-xs">{modelCapabilities.error}</div>
                    ) : (
                      <div className="space-y-1 text-[10px] md:text-xs">
                        <div className="text-purple-400 font-semibold mb-1">模型能力:</div>
                        {modelCapabilities.maxContextTokens ? (
                          <div className="flex justify-between">
                            <span className="text-slate-400">最大上下文:</span>
                            <span className="text-slate-300">{modelCapabilities.maxContextTokens.toLocaleString()} tokens</span>
                          </div>
                        ) : (
                          <div className="text-slate-500 italic">最大上下文: 未提供</div>
                        )}
                        {modelCapabilities.maxOutputTokens ? (
                          <div className="flex justify-between">
                            <span className="text-slate-400">最大回复:</span>
                            <span className="text-slate-300">{modelCapabilities.maxOutputTokens.toLocaleString()} tokens</span>
                          </div>
                        ) : (
                          <div className="text-slate-500 italic">最大回复: 未提供</div>
                        )}
                        {modelCapabilities.defaultMaxOutputTokens ? (
                          <div className="flex justify-between">
                            <span className="text-slate-400">默认最大回复:</span>
                            <span className="text-slate-300">{modelCapabilities.defaultMaxOutputTokens.toLocaleString()} tokens</span>
                          </div>
                        ) : null}
                        {!modelCapabilities.maxContextTokens && !modelCapabilities.maxOutputTokens && (
                          <div className="text-slate-500 italic">该模型未提供能力信息</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Author Management */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                作家管理
              </label>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allAuthors.map(author => {
                const isDefault = DEFAULT_AUTHORS.some(da => da.id === author.id);
                return (
                  <div key={author.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs md:text-sm font-semibold text-slate-200">{author.name}</span>
                      {!isDefault && (
                        <button
                          onClick={() => {
                            const updated = allAuthors.filter(a => a.id !== author.id);
                            const customAuthors = updated.filter(a => !DEFAULT_AUTHORS.some(da => da.id === a.id));
                            localStorage.setItem('storyforge_custom_authors', JSON.stringify(customAuthors));
                            setAllAuthors(getAllAuthors());
                            if (selectedAuthorId === author.id) {
                              setSelectedAuthorId('none');
                            }
                            window.dispatchEvent(new CustomEvent('storyforge-custom-authors-updated'));
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                          title="删除作家"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={author.description}
                      onChange={(e) => {
                        if (isDefault) {
                          // 保存默认作家的自定义描述
                          const defaultAuthorDescriptionsJson = localStorage.getItem('storyforge_default_author_descriptions');
                          const defaultAuthorDescriptions: Record<string, string> = defaultAuthorDescriptionsJson ? JSON.parse(defaultAuthorDescriptionsJson) : {};
                          defaultAuthorDescriptions[author.id] = e.target.value;
                          localStorage.setItem('storyforge_default_author_descriptions', JSON.stringify(defaultAuthorDescriptions));
                        } else {
                          // 更新自定义作家
                          const updated = allAuthors.map(a => 
                            a.id === author.id ? { ...a, description: e.target.value } : a
                          );
                          const customAuthors = updated.filter(a => !DEFAULT_AUTHORS.some(da => da.id === a.id));
                          localStorage.setItem('storyforge_custom_authors', JSON.stringify(customAuthors));
                        }
                        setAllAuthors(getAllAuthors());
                        window.dispatchEvent(new CustomEvent('storyforge-custom-authors-updated'));
                      }}
                      className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded px-2 py-1 text-[10px] md:text-xs resize-none"
                      rows={3}
                      placeholder="角色描述（可通过对话让AI完善）"
                      title="编辑角色描述，可以通过对话让AI完善"
                    />
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                const newId = `custom_${Date.now()}`;
                const newAuthor: Author = {
                  id: newId,
                  name: '新作家',
                  description: '请描述这位作家的写作特点和风格...',
                  famousWorks: []
                };
                const customAuthors = [...allAuthors.filter(a => !DEFAULT_AUTHORS.some(da => da.id === a.id)), newAuthor];
                localStorage.setItem('storyforge_custom_authors', JSON.stringify(customAuthors));
                setAllAuthors(getAllAuthors());
                window.dispatchEvent(new CustomEvent('storyforge-custom-authors-updated'));
              }}
              className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加自定义作家
            </button>
            <p className="text-[10px] md:text-xs text-slate-400 mt-1">编辑作家的角色描述，可以通过对话让AI完善描述</p>
          </div>

        </div>
        )}
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2 md:py-4 px-1 md:px-2 space-y-2 md:space-y-6 scroll-smooth relative"
        style={{ position: 'relative' }}
        onMouseMove={(e) => {
          // Only handle mouse events on desktop
          if (isMobile) return;
          
          if (!messagesContainerRef.current) return;
          const rect = messagesContainerRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const containerWidth = rect.width;
          // Show buttons when mouse is near the right edge (within 80px of scrollbar)
          if (mouseX > containerWidth - 80) {
            if (navButtonsTimeoutRef.current) {
              clearTimeout(navButtonsTimeoutRef.current);
              navButtonsTimeoutRef.current = null;
            }
            setShowNavButtons(true);
          } else {
            // Hide after a delay when mouse moves away (but keep it visible if mouse is on buttons)
            if (navButtonsTimeoutRef.current) {
              clearTimeout(navButtonsTimeoutRef.current);
            }
            navButtonsTimeoutRef.current = setTimeout(() => {
              setShowNavButtons(false);
            }, 800);
          }
        }}
        onMouseLeave={() => {
          // Only handle mouse events on desktop
          if (isMobile) return;
          
          if (navButtonsTimeoutRef.current) {
            clearTimeout(navButtonsTimeoutRef.current);
          }
          navButtonsTimeoutRef.current = setTimeout(() => {
            setShowNavButtons(false);
          }, 500);
        }}
      >
        {/* Navigation Buttons - Positioned near scrollbar, fixed to viewport */}
        {/* On desktop: show when scrolled or mouse near */}
        {messages.length > 0 && !isMobile && hasScrolled && (
          <div 
            className="fixed z-[100] flex flex-col gap-1 p-1 bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-lg shadow-xl transition-all duration-300"
            style={{
              right: `${navButtonsRight}px`,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: showNavButtons ? 0.7 : 0,
              pointerEvents: showNavButtons ? 'auto' : 'none',
            }}
            onMouseEnter={() => {
              if (navButtonsTimeoutRef.current) {
                clearTimeout(navButtonsTimeoutRef.current);
                navButtonsTimeoutRef.current = null;
              }
              setShowNavButtons(true);
            }}
            onMouseLeave={() => {
              if (navButtonsTimeoutRef.current) {
                clearTimeout(navButtonsTimeoutRef.current);
              }
              navButtonsTimeoutRef.current = setTimeout(() => {
                setShowNavButtons(false);
              }, 500);
            }}
          >
          <button
            onClick={scrollToTop}
            className="px-1.5 py-4 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors active:text-purple-400"
            title="到顶层"
          >
            <ArrowUpToLine className="w-5 h-5" />
          </button>
          <button
            onClick={scrollToPrev}
            disabled={!canScrollUp()}
            className={`px-1.5 py-4 rounded transition-colors active:text-purple-400 ${
              canScrollUp() 
                ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 cursor-pointer' 
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title="上一层"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <button
            onClick={scrollToNext}
            disabled={!canScrollDown()}
            className={`px-1.5 py-4 rounded transition-colors active:text-purple-400 ${
              canScrollDown() 
                ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 cursor-pointer' 
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title={(() => {
              const current = findCurrentVisibleMessage();
              if (current && current.index === displayedMessages.length - 1) {
                return "回到最后一层开头";
              }
              return "下一层";
            })()}
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            onClick={scrollToBottom}
            className="px-1.5 py-4 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors active:text-purple-400"
            title="到底部"
          >
            <ArrowDownToLine className="w-5 h-5" />
          </button>
        </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
             <Bot className="w-12 h-12 mb-2" />
             <p className="text-sm">开始分享你的故事灵感...</p>
             {currentConfig && (
                <div className="mt-4 text-xs bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 max-w-[90%] truncate">
                    {getProviderIcon(currentConfig.provider)}
                    <span className="font-mono text-slate-400 truncate">{currentConfig.modelId}</span>
                </div>
             )}
          </div>
        )}
        
        {hasMoreMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => setVisibleMessageCount(prev => Math.min(prev + 50, messages.length))}
              className="text-xs text-slate-400 hover:text-slate-300 px-3 py-1 bg-slate-800 rounded-lg transition-colors"
            >
              加载更早的消息 ({messages.length - visibleMessageCount} 条未显示)
            </button>
          </div>
        )}
        
        {displayedMessages.map((msg, index) => {
          // Calculate message number based on original messages array (not filtered)
          const messageNumber = messages.findIndex(m => m.id === msg.id) + 1;
          const isRecentForRegenerate = index >= Math.max(0, displayedMessages.length - 6);
          return (
          <div
            key={msg.id}
            data-message-id={msg.id}
            className={`flex flex-col w-full group ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Avatar and Message Number - Above the message */}
            <div
              className={`flex items-center gap-1.5 mb-1 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-3 h-3 md:w-4 md:h-4 text-white" />
                ) : (
                  <Bot className="w-3 h-3 md:w-4 md:h-4 text-white" />
                )}
              </div>
              {/* Message Number */}
              <div 
                data-message-number={messageNumber}
                className={`text-[10px] text-slate-500 flex items-center gap-1.5 whitespace-nowrap`}
              >
                <span>#{messageNumber}</span>
                {msg.isToolCall ? (
                  // 系统通知消息，不可切换
                  <span className="inline-flex items-center" title="系统通知消息（不发送给AI）">
                    <EyeOff className="w-3 h-3 text-slate-600" />
                  </span>
                ) : hiddenMessageIds.has(msg.id) ? (
                  // 用户手动隐藏的消息（通过/hide命令）
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHiddenMessageIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(msg.id);
                        return newSet;
                      });
                    }}
                    className="inline-flex items-center hover:opacity-80 transition-opacity cursor-pointer"
                    title="点击显示此消息（发送给AI）"
                  >
                    <EyeOff className="w-3 h-3 text-orange-400" />
                  </button>
                ) : msg.excludeFromAI ? (
                  // 非通知类但被排除的消息，可切换
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 保存当前滚动位置
                      if (messagesContainerRef.current) {
                        savedScrollPositionRef.current = messagesContainerRef.current.scrollTop;
                      }
                      if (onToggleExcludeFromAI) {
                        onToggleExcludeFromAI(msg.id);
                      }
                      // 在下一个渲染周期恢复滚动位置
                      setTimeout(() => {
                        if (messagesContainerRef.current && savedScrollPositionRef.current !== null) {
                          messagesContainerRef.current.scrollTop = savedScrollPositionRef.current;
                          savedScrollPositionRef.current = null;
                        }
                      }, 0);
                    }}
                    className="inline-flex items-center hover:opacity-80 transition-opacity cursor-pointer"
                    title="点击显示此消息（发送给AI）"
                  >
                    <EyeOff className="w-3 h-3 text-slate-500" />
                  </button>
                ) : (
                  // 正常显示的消息，可切换为隐藏
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 保存当前滚动位置
                      if (messagesContainerRef.current) {
                        savedScrollPositionRef.current = messagesContainerRef.current.scrollTop;
                      }
                      if (onToggleExcludeFromAI) {
                        onToggleExcludeFromAI(msg.id);
                      }
                      // 在下一个渲染周期恢复滚动位置
                      setTimeout(() => {
                        if (messagesContainerRef.current && savedScrollPositionRef.current !== null) {
                          messagesContainerRef.current.scrollTop = savedScrollPositionRef.current;
                          savedScrollPositionRef.current = null;
                        }
                      }, 0);
                    }}
                    className="inline-flex items-center hover:opacity-80 transition-opacity cursor-pointer"
                    title="点击隐藏此消息（不发送给AI）"
                  >
                    <Eye className="w-3 h-3 text-slate-400" />
                  </button>
                )}
                <span className="ml-1 text-slate-500">{formatTimestamp(msg.timestamp)}</span>
                {msg.role === 'model' && msg.latencyMs !== undefined && (
                  <span className="text-slate-500">· 耗时 {formatLatency(msg.latencyMs)}</span>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div
              className={`flex flex-col w-full ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } min-w-0 max-w-full`}
              style={{ maxWidth: '100%', overflow: 'hidden' }}
            >
                {/* Message Bubble */}
                <div
                  className={`px-2 py-2.5 md:px-2 md:py-3 rounded-2xl leading-relaxed shadow-sm relative break-words overflow-wrap-anywhere max-w-full w-full ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  } ${msg.isToolCall ? 'border-purple-500/50 bg-purple-900/20' : ''}`}
                  style={{ fontSize: `${fontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word' }}
                >
                  {editingMessageId === msg.id ? (
                     <div className="w-full min-w-[200px] max-w-full">
                        <textarea 
                          ref={editingTextareaRef}
                          value={editingText} 
                          onChange={(e) => setEditingText(e.target.value)}
                          onInput={() => autoGrowTextarea(editingTextareaRef.current, 360)}
                          className="w-full bg-slate-900/50 text-white p-2 rounded border border-blue-400/50 focus:outline-none resize-none max-h-80 overflow-y-auto whitespace-pre-wrap"
                          style={{ fontSize: `${fontSize}px` }}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                           <button onClick={cancelEditing} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
                           <button onClick={() => saveEditing(msg.id)} className="p-1 hover:bg-white/10 rounded text-emerald-300"><Check className="w-4 h-4" /></button>
                        </div>
                     </div>
                  ) : (
                     msg.isToolCall ? (
                        <div className="flex items-center space-x-2 text-purple-300 italic">
                          <Sparkles className="w-3 h-3" />
                          <span>故事板已更新: {msg.toolName}</span>
                        </div>
                      ) : (
                         <>
                         <div 
                           className="prose prose-invert max-w-none break-words overflow-wrap-anywhere w-full" 
                           style={{ 
                             fontSize: `${fontSize}px`, 
                             wordBreak: 'break-word', 
                             overflowWrap: 'break-word',
                             fontFamily: 'inherit'
                           }}
                         >
                           <ReactMarkdown
                             components={{
                               p: ({ children }) => <p style={{ fontSize: `${fontSize}px`, margin: '0.5em 0', wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</p>,
                               li: ({ children }) => <li style={{ fontSize: `${fontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</li>,
                               h1: ({ children }) => <h1 style={{ fontSize: `${fontSize * 1.5}px`, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</h1>,
                               h2: ({ children }) => <h2 style={{ fontSize: `${fontSize * 1.3}px`, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</h2>,
                               h3: ({ children }) => <h3 style={{ fontSize: `${fontSize * 1.15}px`, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</h3>,
                               pre: ({ children }) => <pre style={{ fontSize: `${fontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', overflow: 'auto', fontFamily: 'inherit' }}>{children}</pre>,
                               code: ({ children }) => <code style={{ fontSize: `${fontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</code>,
                               div: ({ children }) => <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%', fontFamily: 'inherit' }}>{children}</div>,
                               span: ({ children }) => <span style={{ wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: 'inherit' }}>{children}</span>,
                             }}
                           >
                             {msg.text}
                           </ReactMarkdown>
                         </div>
                           {msg.reasoning && (
                             <div className="mt-2">
                               <button
                                 onClick={() => {
                                   setSelectedMessageForReasoning(msg.id);
                                   setShowReasoningModal(true);
                                 }}
                                 className="flex items-center gap-2 text-xs text-slate-400 hover:text-purple-400 transition-colors"
                                 title="查看思维链"
                               >
                                 <Brain className="w-3 h-3" />
                                 <span>查看思维链</span>
                               </button>
                             </div>
                           )}
                         </>
                      )
                  )}
                </div>

                {/* Message Actions Toolbar */}
                {!editingMessageId && (
                    <div className={`flex items-center gap-2 md:gap-1 mt-1 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <button 
                            onClick={() => handleCopy(msg.text, msg.id)} 
                            className={`p-2 md:p-1 rounded hover:bg-slate-800 active:bg-slate-700 transition-all touch-manipulation relative ${
                                copySuccessId === msg.id 
                                    ? 'text-green-400 bg-green-400/20' 
                                    : 'text-slate-500 hover:text-white'
                            }`} 
                            title={copySuccessId === msg.id ? "已复制！" : "复制"}
                        >
                            {copySuccessId === msg.id ? (
                                <Check className="w-5 h-5 md:w-3 md:h-3" />
                            ) : (
                                <Copy className="w-5 h-5 md:w-3 md:h-3" />
                            )}
                        </button>
                        
                        {!msg.isToolCall && (
                            <button onClick={() => startEditing(msg.id, msg.text)} className="p-2 md:p-1 text-slate-500 hover:text-blue-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" title="编辑">
                                <Edit2 className="w-5 h-5 md:w-3 md:h-3" />
                            </button>
                        )}
                        
                        {msg.role === 'user' && isRecentForRegenerate && (
                            <button 
                                onClick={() => handleReAnswer(msg.id)} 
                                className="p-2 md:p-1 text-slate-500 hover:text-orange-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" 
                                title="重新回答"
                            >
                                <RotateCcw className="w-5 h-5 md:w-3 md:h-3" />
                            </button>
                        )}
                        
                        {onBranchMessage && (
                            <button 
                                onClick={() => onBranchMessage(msg.id)} 
                                className="p-2 md:p-1 text-slate-500 hover:text-emerald-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" 
                                title="从此处分支（创建新故事）"
                            >
                                <GitBranch className="w-5 h-5 md:w-3 md:h-3" />
                            </button>
                        )}
                        
                        <button 
                            onClick={() => {
                                if (window.confirm('确定要删除这条消息吗？此操作不可撤销。')) {
                                    onDeleteMessage(msg.id);
                                }
                            }} 
                            className="p-2 md:p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" 
                            title="删除"
                        >
                            <Trash2 className="w-5 h-5 md:w-3 md:h-3" />
                        </button>

                        {msg.role === 'model' && !msg.isToolCall && (
                          <>
                            {msg.isStopped && onContinue && (
                              <button 
                                onClick={() => onContinue(msg.id)} 
                                className="p-2 md:p-1 text-slate-500 hover:text-emerald-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" 
                                title="继续生成"
                              >
                                <Play className="w-5 h-5 md:w-3 md:h-3" />
                              </button>
                            )}
                            {isRecentForRegenerate && (
                             <button onClick={() => onRegenerate(msg.id)} className="p-2 md:p-1 text-slate-500 hover:text-purple-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" title="重新生成">
                                <RefreshCw className="w-5 h-5 md:w-3 md:h-3" />
                            </button>
                            )}
                            {onManualSaveToChapter && story && (
                              <button 
                                onClick={() => {
                                  setSaveMessageContent(msg.text);
                                  
                                  // Try to auto-detect chapter number from message content
                                  const chapterMatch = msg.text.match(/(?:第\s*(\d+)\s*章|chapterNumber[:\s]*(\d+)|chapter[:\s]*(\d+))/i);
                                  const volumeMatch = msg.text.match(/(?:第\s*(\d+)\s*卷|volumeNumber[:\s]*(\d+)|volume[:\s]*(\d+))/i);
                                  
                                  let detectedChapter: { number: number; volumeNumber?: number } | null = null;
                                  
                                  if (chapterMatch) {
                                    const chapterNum = parseInt(chapterMatch[1] || chapterMatch[2] || chapterMatch[3] || '0');
                                    if (chapterNum > 0) {
                                      let volumeNum: number | undefined;
                                      if (volumeMatch) {
                                        volumeNum = parseInt(volumeMatch[1] || volumeMatch[2] || volumeMatch[3] || '0');
                                        if (volumeNum === 0) volumeNum = undefined;
                                      }
                                      
                                      // Find the chapter in story
                                      const foundChapter = story.outline.find(ch => {
                                        if (ch.number === chapterNum) {
                                          if (volumeNum !== undefined) {
                                            const vol = story.volumes.find(v => v.number === volumeNum);
                                            return vol && ch.volumeId === vol.id;
                                          }
                                          return true;
                                        }
                                        return false;
                                      });
                                      
                                      if (foundChapter) {
                                        const vol = foundChapter.volumeId ? story.volumes.find(v => v.id === foundChapter.volumeId) : null;
                                        detectedChapter = { 
                                          number: chapterNum, 
                                          volumeNumber: vol?.number 
                                        };
                                      }
                                    }
                                  }
                                  
                                  setSelectedChapter(detectedChapter);
                                  setShowSaveModal(true);
                                }} 
                                className="p-2 md:p-1 text-slate-500 hover:text-blue-400 rounded hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation" 
                                title="保存到正文"
                              >
                                <Save className="w-5 h-5 md:w-3 md:h-3" />
                            </button>
                            )}
                          </>
                        )}
                    </div>
                )}
            </div>
          </div>
        );
        })}
        
        {isLoading && (
          <div className="flex items-center space-x-2 text-slate-500 text-sm ml-12 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 正在思考...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-4 border-t border-slate-800 bg-slate-900">
        <form onSubmit={handleSubmit} className="space-y-1 md:space-y-3">
          {/* Mobile Navigation Buttons - Above controls row */}
          {isMobile && messages.length > 0 && (
            <div className="flex flex-row gap-1 justify-center mb-2 pb-2 border-b border-slate-700/50">
              <div className="flex flex-row gap-1 bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-lg px-2 py-1">
                <button
                  onClick={scrollToTop}
                  className="px-3 py-2 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors active:text-purple-400"
                  title="到顶层"
                >
                  <ArrowUpToLine className="w-4 h-4" />
                </button>
                <button
                  onClick={scrollToPrev}
                  disabled={!canScrollUp()}
                  className={`px-3 py-2 rounded transition-colors active:text-purple-400 ${
                    canScrollUp() 
                      ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 cursor-pointer' 
                      : 'text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                  title="上一层"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={scrollToNext}
                  disabled={!canScrollDown()}
                  className={`px-3 py-2 rounded transition-colors active:text-purple-400 ${
                    canScrollDown() 
                      ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 cursor-pointer' 
                      : 'text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                  title={(() => {
                    const current = findCurrentVisibleMessage();
                    if (current && current.index === displayedMessages.length - 1) {
                      return "回到最后一层开头";
                    }
                    return "下一层";
                  })()}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={scrollToBottom}
                  className="px-3 py-2 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition-colors active:text-purple-400"
                  title="到底部"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {/* 单行布局：所有控件在一行 */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {/* 题材 */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">题材</span>
              <select
                value={storyGenre}
                onChange={(e) => setStoryGenre(e.target.value as StoryGenre)}
                className="bg-slate-900/80 border border-slate-700 text-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10px] cursor-pointer h-6 w-12"
              >
                <option value="none">无</option>
                <option value="wuxia">武侠</option>
                <option value="xianxia">修真</option>
                <option value="apocalypse">末日</option>
                <option value="urban">都市</option>
                <option value="historical">历史</option>
                <option value="sci-fi">科幻</option>
                <option value="supernatural">异能</option>
              </select>
            </div>
            
            {/* 写法 */}
              <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">写法</span>
                <select
                  value={writingMethod}
                  onChange={(e) => {
                    const val = e.target.value as WritingMethod;
                    setWritingMethod(val);
                  }}
                className="bg-slate-900/80 border border-slate-700 text-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10px] cursor-pointer h-6 w-14"
                >
                <option value="default">构思讨论</option>
                <option value="design_outline">设计章纲</option>
                <option value="fanwen_style_imitation">直写正文</option>
                <option value="reverse_outline">逆推细纲</option>
                <option value="chat_only">纯聊天</option>
                </select>
              </div>
            
            {/* 作家 */}
              <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">作家</span>
                <select
                  value={selectedAuthorId}
                  onChange={(e) => {
                    const val = e.target.value as SelectedAuthorId;
                    setSelectedAuthorId(val);
                  }}
                className="bg-slate-900/80 border border-slate-700 text-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10px] cursor-pointer h-6 w-12"
                >
                <option value="none">无</option>
                  {allAuthors.map(author => (
                    <option key={author.id} value={author.id}>{author.name}</option>
                  ))}
                </select>
              </div>
            
            {/* 范文 */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">范文</span>
              <label className="flex items-center text-slate-400" title={samplesEnabled ? '取消勾选以关闭范文' : '勾选以启用范文'}>
                <input
                  type="checkbox"
                  checked={samplesEnabled}
                  onChange={() => setSamplesEnabled(prev => !prev)}
                  className="w-3 h-3 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer"
                />
              </label>
                <button
                  type="button"
                  onClick={() => setShowSampleManager(true)}
                className={`relative rounded border border-slate-700 text-slate-400 hover:text-white hover:border-purple-500/50 transition-colors flex items-center justify-center px-1.5 py-0.5 text-[10px] h-6 w-6 ${
                    samplesEnabled ? '' : 'opacity-60'
                  }`}
                  title="管理写作范文"
                >
                <BookOpen className="w-3 h-3" />
                  {samplesEnabled && writingSamples.filter(s => s.selected).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[8px] px-0.5 py-0 rounded-full leading-none min-w-[12px] text-center">
                      {writingSamples.filter(s => s.selected).length}
                    </span>
                  )}
                </button>
            </div>
            
            {/* 繁体引号 */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">繁体引号</span>
              <label className="flex items-center text-slate-400" title='勾选后，发送消息时会自动添加"使用简体中文回答，但引号使用繁体引号"的提示'>
                  <input
                    type="checkbox"
                  checked={useTraditionalQuotes}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseTraditionalQuotes(checked);
                    localStorage.setItem('storyforge_use_traditional_quotes', checked ? 'true' : 'false');
                  }}
                  className="w-3 h-3 accent-purple-500 bg-slate-800 border border-slate-600 rounded focus:ring-purple-500 cursor-pointer"
                  />
                </label>
              </div>
            
            {/* 自动写 */}
            <div className="flex items-center gap-1 border-l border-slate-700 pl-1.5">
              <span className="text-[9px] text-slate-500 whitespace-nowrap">自动写</span>
              <input
                type="number"
                min="1"
                max="100"
                value={autoWriteChapters}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                  if (onSetAutoWriteChapters) {
                    onSetAutoWriteChapters(val);
                  } else {
                    console.warn('⚠️ onSetAutoWriteChapters is not available');
                  }
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-10 bg-slate-800 border border-slate-600 text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500 h-6 cursor-text"
                title="要写的章节数"
                disabled={isLoading || autoWriteEnabled}
                style={{ pointerEvents: (isLoading || autoWriteEnabled) ? 'none' : 'auto' }}
              />
              <span className="text-[9px] text-slate-500">章</span>
              <input
                type="number"
                min="0"
                max="300"
                value={autoWriteCooldownDuration}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(300, parseInt(e.target.value) || 0));
                  if (onSetAutoWriteCooldownDuration) {
                    onSetAutoWriteCooldownDuration(val);
                  } else {
                    console.warn('⚠️ onSetAutoWriteCooldownDuration is not available');
                  }
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-10 bg-slate-800 border border-slate-600 text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500 h-6 cursor-text"
                title="API冷却时间（秒）"
                disabled={isLoading || autoWriteEnabled}
                style={{ pointerEvents: (isLoading || autoWriteEnabled) ? 'none' : 'auto' }}
              />
              <span className="text-[9px] text-slate-500">秒</span>
              {autoWriteEnabled ? (
                <>
                  {autoWriteCurrentChapter > 0 && (
                    <span className="text-[9px] text-emerald-400 ml-0.5">
                      ({autoWriteCurrentChapter}/{autoWriteChapters})
                    </span>
                  )}
                  {autoWriteCooldown && autoWriteCooldown > 0 && (
                    <span className="text-[9px] text-amber-400 ml-0.5" title="API冷却倒计时">
                      ⏱️ {autoWriteCooldown}s
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (onStopAutoWrite) {
                        onStopAutoWrite();
                      }
                      if (onSetAutoWriteEnabled) {
                        onSetAutoWriteEnabled(false);
                      }
                    }}
                    className="px-1.5 py-0.5 text-[9px] bg-red-600 hover:bg-red-700 text-white rounded transition-colors h-6 flex items-center gap-0.5"
                    title="停止自动写"
                    disabled={isLoading}
                  >
                    <Square className="w-2.5 h-2.5" />
                    停止
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🟣 自动写开始按钮被点击', { onStartAutoWrite: !!onStartAutoWrite, story: !!story, isLoading });
                    if (isLoading) {
                      console.warn('⚠️ 正在加载中，无法开始自动写');
                      return;
                    }
                    if (!onStartAutoWrite) {
                      console.error('❌ onStartAutoWrite is not available');
                      alert('错误：自动写功能未初始化，请刷新页面重试');
                      return;
                    }
                    if (!story) {
                      console.error('❌ story is not available');
                      alert('错误：请先创建或选择故事');
                      return;
                    }
                      // 找到当前最新章节号
                      const chapters = story.outline || [];
                      let maxChapterNumber = 0;
                      if (chapters.length > 0) {
                        maxChapterNumber = Math.max(...chapters.map(ch => ch.number));
                      }
                      // 从下一章开始写
                      const startChapter = maxChapterNumber + 1;
                    console.log('📝 开始自动写，起始章节:', startChapter, '章节数:', autoWriteChapters);
                      onStartAutoWrite(startChapter);
                  }}
                  className="px-1.5 py-0.5 text-[9px] bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors h-6 flex items-center gap-0.5 cursor-pointer relative z-10"
                  title={`从第${story && story.outline.length > 0 ? Math.max(...story.outline.map(ch => ch.number)) + 1 : 1}章开始自动写${autoWriteChapters}章`}
                  disabled={isLoading}
                  style={{ pointerEvents: isLoading ? 'none' : 'auto' }}
                >
                  <Play className="w-2.5 h-2.5" />
                  开始
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            {/* Quick Prompt Buttons */}
            <div ref={quickPromptsContainerRef} className="absolute left-3 top-3 flex items-center gap-1 z-10 flex-wrap max-w-[calc(100%-80px)]">
              {quickPrompts.slice(0, 8).map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onMouseDown={(e) => handleQuickPromptMouseDown(e, prompt)}
                  onMouseUp={(e) => handleQuickPromptMouseUp(e, prompt)}
                  onMouseLeave={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onTouchStart={(e) => handleQuickPromptTouchStart(e, prompt)}
                  onTouchEnd={(e) => handleQuickPromptTouchEnd(e, prompt)}
                  className="px-1.5 py-0.5 md:px-2 md:py-1 text-[10px] md:text-xs bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded-md transition-colors border border-slate-600 whitespace-nowrap"
                  title={`短按插入，长按编辑: ${prompt.text}`}
                >
                  {prompt.label}
                </button>
              ))}
              {quickPrompts.length < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuickPrompt(null);
                    setShowQuickPromptEditor(true);
                  }}
                  className="px-1.5 py-0.5 md:px-2 md:py-1 text-[10px] md:text-xs bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded-md transition-colors border border-slate-600 flex items-center justify-center"
                  title="添加快捷提示词"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <textarea
              ref={inputTextareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
              onInput={() => autoGrowTextarea(inputTextareaRef.current, 260)}
            placeholder="描述灵感，或寻求建议..."
              className={`w-full bg-slate-800 text-slate-200 placeholder-slate-500 border-2 border-slate-600 rounded-xl ${quickPrompts.length > 0 ? 'pl-4 pr-20' : 'pl-4 pr-20 pt-2'} focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-inner text-sm md:text-base max-h-[220px] resize-none overflow-x-hidden overflow-y-auto break-words text-left ${
                isMobile
                  ? isInputEmpty ? 'py-0 min-h-[8px]' : 'py-1 min-h-[25px]'
                  : isInputEmpty ? 'py-1.5 min-h-[32px]' : 'py-2.5 min-h-[44px]'
              }`}
              style={{ 
                wordBreak: 'break-word', 
                overflowWrap: 'break-word', 
                textAlign: 'left',
                paddingTop: quickPrompts.length > 0 
                  ? `${Math.max(quickPromptsHeight > 0 ? quickPromptsHeight + 20 : 40, 40)}px` 
                  : undefined
              }}
            disabled={isLoading}
          />
            {isLoading && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="absolute right-3 bottom-3 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg z-10"
                title="停止生成"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 bottom-3 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-lg z-10"
                >
                  <Send className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Prompt Confirmation Modal */}
      {showConfirmModal && pendingMessage && getPromptContext && (
        <PromptConfirmModal
          isOpen={showConfirmModal}
          onClose={handleCancelSend}
          onConfirm={handleConfirmSend}
          userMessage={pendingMessage}
          systemInstruction={getPromptContext(pendingMessage).systemInstruction || ''}
          context={getPromptContext(pendingMessage).context || {}}
          history={limitedHistoryForPrompt}
        />
      )}

      {/* Prompt View Modal (View current prompt chain) */}
      {showPromptViewModal && getPromptContext && (
        <PromptConfirmModal
          isOpen={showPromptViewModal}
          onClose={() => setShowPromptViewModal(false)}
          onConfirm={() => setShowPromptViewModal(false)}
          userMessage="[查看模式 - 当前提示词链]"
          systemInstruction={getPromptContext('').systemInstruction || ''}
          context={getPromptContext('').context || {}}
          history={limitedHistoryForPrompt}
          viewMode={true}
        />
      )}

      {/* Writing Samples Manager Modal */}
      {showSampleManager && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl flex-shrink-0">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  写作范文管理
                </h2>
                <p className="text-xs text-slate-400 mt-1">添加范文供AI学习模仿，勾选的范文会在生成正文时自动添加到提示词中</p>
              </div>
              <button onClick={() => { setShowSampleManager(false); setEditingSample(null); setSampleName(''); setSampleContent(''); }} className="text-slate-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div ref={sampleManagerContentRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Add New Form - Only show when adding new (not editing existing) */}
              {editingSample && !editingSample.id ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">添加范文</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">范文名称</label>
                    <input
                      type="text"
                      value={sampleName}
                      onChange={(e) => setSampleName(e.target.value)}
                      placeholder="例如：金庸小说风格"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">范文内容</label>
                    <textarea
                      value={sampleContent}
                      onChange={(e) => setSampleContent(e.target.value)}
                      placeholder="粘贴或输入要模仿的范文内容..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm min-h-[200px] max-h-[400px] overflow-y-auto resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // 自动分配编号：找到最大编号+1，如果没有编号则从1开始
                        const maxOrder = writingSamples.reduce((max, s) => {
                          const order = s.order || 0;
                          return order > max ? order : max;
                        }, 0);
                        const newOrder = maxOrder + 1;
                        
                        const newSample: WritingSample = {
                          id: Date.now().toString(),
                          name: sampleName,
                          content: sampleContent,
                          selected: false,
                          order: newOrder
                        };
                        setWritingSamples([...writingSamples, newSample]);
                        setEditingSample(null);
                        setSampleName('');
                        setSampleContent('');
                      }}
                      disabled={!sampleName.trim() || !sampleContent.trim()}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      添加
                    </button>
                    <button
                      onClick={() => {
                        setEditingSample(null);
                        setSampleName('');
                        setSampleContent('');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : !editingSample ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingSample({ id: '', name: '', content: '', selected: false });
                      setSampleName('');
                      setSampleContent('');
                    }}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    添加新范文
                  </button>
                  <button
                    onClick={() => sampleFileInputRef.current?.click()}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导入txt文件
                  </button>
                  <input
                    ref={sampleFileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleImportSampleFile}
                    className="hidden"
                  />
                </div>
              ) : null}

              {/* Samples List */}
              {writingSamples.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-200">已添加的范文（按编号排序）</h3>
                  {[...writingSamples].sort((a, b) => {
                    // 按编号排序，没有编号的排在最后
                    const orderA = a.order || 999999;
                    const orderB = b.order || 999999;
                    return orderA - orderB;
                  }).map(sample => (
                    <div key={sample.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                      {editingSample && editingSample.id === sample.id ? (
                        // Edit form inline in the sample item
                        <div ref={sampleEditFormRef} className="space-y-3">
                          <h3 className="text-sm font-semibold text-slate-200">编辑范文</h3>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">范文名称</label>
                            <input
                              type="text"
                              value={sampleName}
                              onChange={(e) => setSampleName(e.target.value)}
                              placeholder="例如：金庸小说风格"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">范文内容</label>
                            <textarea
                              value={sampleContent}
                              onChange={(e) => setSampleContent(e.target.value)}
                              placeholder="粘贴或输入要模仿的范文内容..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm min-h-[200px] max-h-[400px] overflow-y-auto resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setWritingSamples(writingSamples.map(s => 
                                  s.id === sample.id 
                                    ? { ...s, name: sampleName, content: sampleContent }
                                    : s
                                ));
                                setEditingSample(null);
                                setSampleName('');
                                setSampleContent('');
                              }}
                              disabled={!sampleName.trim() || !sampleContent.trim()}
                              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              保存
                            </button>
                            <button
                              onClick={() => {
                                setEditingSample(null);
                                setSampleName('');
                                setSampleContent('');
                              }}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Normal display
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={sample.selected}
                            onChange={(e) => {
                              setWritingSamples(writingSamples.map(s =>
                                s.id === sample.id ? { ...s, selected: e.target.checked } : s
                              ));
                            }}
                            className="mt-1 w-4 h-4 text-purple-600 bg-slate-800 border-slate-700 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={sample.order || ''}
                                  onChange={(e) => {
                                    const newOrder = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                    if (!isNaN(newOrder as any) || newOrder === undefined) {
                                      setWritingSamples(writingSamples.map(s =>
                                        s.id === sample.id ? { ...s, order: newOrder } : s
                                      ));
                                    }
                                  }}
                                  placeholder="编号"
                                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                                  min="1"
                                />
                                <span className="text-xs text-slate-500">号</span>
                              </div>
                              <h4 className="text-sm font-semibold text-slate-200">{sample.name}</h4>
                              {sample.selected && (
                                <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">已勾选</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-3 mb-2 whitespace-pre-wrap">{sample.content}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingSample(sample);
                                  setSampleName(sample.name);
                                  setSampleContent(sample.content);
                                }}
                                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`确定要删除"${sample.name}"吗？`)) {
                                    setWritingSamples(writingSamples.filter(s => s.id !== sample.id));
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {writingSamples.length === 0 && !editingSample && (
                <div className="text-center py-8 text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">还没有添加任何范文</p>
                  <p className="text-xs mt-1">点击上方"添加新范文"按钮开始添加</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/50 flex-shrink-0">
              <button
                onClick={() => {
                  setShowSampleManager(false);
                  setEditingSample(null);
                  setSampleName('');
                  setSampleContent('');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 font-bold transition-all shadow-lg hover:shadow-purple-500/20"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save to Chapter Modal */}
      {showSaveModal && story && onManualSaveToChapter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                保存到正文
              </h3>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSelectedChapter(null);
                  setSaveMessageContent('');
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">选择章节</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {story.outline.length === 0 ? (
                    <p className="text-slate-500 text-sm">暂无章节，请先在章纲中创建章节</p>
                  ) : (
                    story.outline.map((ch) => {
                      const vol = ch.volumeId ? story.volumes.find(v => v.id === ch.volumeId) : null;
                      const isSelected = selectedChapter?.number === ch.number && 
                        (selectedChapter?.volumeNumber === undefined || selectedChapter?.volumeNumber === vol?.number);
                      
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChapter({ number: ch.number, volumeNumber: vol?.number })}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-blue-900/30 border-blue-500 text-blue-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">
                                {vol ? `第${vol.number}卷 ` : ''}第{ch.number}章 {ch.title}
                              </span>
                              {ch.summary && (
                                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ch.summary}</p>
                              )}
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">内容预览（前200字）</label>
                <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 max-h-32 overflow-y-auto">
                  {saveMessageContent.substring(0, 200)}
                  {saveMessageContent.length > 200 && '...'}
                </div>
                <p className="text-xs text-slate-500 mt-1">总字数: {saveMessageContent.length}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSelectedChapter(null);
                    setSaveMessageContent('');
                  }}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (selectedChapter) {
                      // Check if chapter has existing content
                      const chapter = story.outline.find(ch => {
                        if (ch.number === selectedChapter.number) {
                          if (selectedChapter.volumeNumber !== undefined) {
                            const vol = story.volumes.find(v => v.number === selectedChapter.volumeNumber);
                            return vol && ch.volumeId === vol.id;
                          }
                          return true;
                        }
                        return false;
                      });
                      
                      const hasContent = chapter && chapter.contentVersions && chapter.contentVersions.length > 0 && 
                        chapter.contentVersions.some(v => v.text && v.text.trim().length > 0);
                      
                      if (hasContent) {
                        // Ask user if they want to create a new version
                        setPendingSaveData({
                          content: saveMessageContent,
                          chapterNumber: selectedChapter.number,
                          volumeNumber: selectedChapter.volumeNumber
                        });
                        setShowCreateVersionConfirm(true);
                      } else {
                        // No existing content, save directly
                        onManualSaveToChapter(
                          saveMessageContent,
                          selectedChapter.number,
                          selectedChapter.volumeNumber
                        );
                        setShowSaveModal(false);
                        setSelectedChapter(null);
                        setSaveMessageContent('');
                      }
                    }
                  }}
                  disabled={!selectedChapter}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning View Modal */}
      {showReasoningModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                思维链内容
              </h3>
              <button
                onClick={() => {
                  setShowReasoningModal(false);
                  setSelectedMessageForReasoning(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {selectedMessageForReasoning ? (
                // Show specific message reasoning
                (() => {
                  const msg = messages.find(m => m.id === selectedMessageForReasoning);
                  if (!msg || !msg.reasoning) {
                    return <p className="text-slate-500 text-sm">该消息没有思维链内容</p>;
                  }
                  return (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400 mb-2">
                        消息 ID: {msg.id.substring(0, 8)}...
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap break-words font-mono">
                        {msg.reasoning}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Show all messages with reasoning
                messages.filter(m => m.reasoning).length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">暂无思维链内容</p>
                ) : (
                  messages
                    .filter(m => m.reasoning)
                    .map(msg => (
                      <div key={msg.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-slate-400">
                            消息 ID: {msg.id.substring(0, 8)}...
                          </div>
                          <button
                            onClick={() => handleCopy(msg.reasoning || '')}
                            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                            title="复制思维链"
                          >
                            <Copy className="w-3 h-3" />
                            复制
                          </button>
                        </div>
                        <div className="bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-300 whitespace-pre-wrap break-words font-mono max-h-60 overflow-y-auto">
                          {msg.reasoning}
                        </div>
                      </div>
                    ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompt Editor Modal */}
      {showQuickPromptEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-400" />
                {editingQuickPrompt ? '编辑快捷提示词' : '添加快捷提示词'}
              </h3>
              <button
                onClick={() => {
                  setShowQuickPromptEditor(false);
                  setEditingQuickPrompt(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <QuickPromptEditor
              prompt={editingQuickPrompt}
              onSave={handleSaveQuickPrompt}
              onDelete={editingQuickPrompt ? () => {
                handleDeleteQuickPrompt(editingQuickPrompt.id);
                setShowQuickPromptEditor(false);
                setEditingQuickPrompt(null);
              } : undefined}
              onCancel={() => {
                setShowQuickPromptEditor(false);
                setEditingQuickPrompt(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Create New Version Confirmation Modal */}
      {showCreateVersionConfirm && pendingSaveData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                创建新版本
              </h3>
              <button
                onClick={() => {
                  setShowCreateVersionConfirm(false);
                  setPendingSaveData(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                该章节已有正文内容。是否创建新版本保存？
              </p>
              <p className="text-slate-400 text-xs">
                创建新版本将保留原有内容，您可以随时切换查看不同版本。
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCreateVersionConfirm(false);
                    setPendingSaveData(null);
                  }}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (pendingSaveData && onManualSaveToChapter) {
                      // Save with createNewVersion flag
                      onManualSaveToChapter(
                        pendingSaveData.content,
                        pendingSaveData.chapterNumber,
                        pendingSaveData.volumeNumber,
                        true // createNewVersion
                      );
                      setShowCreateVersionConfirm(false);
                      setShowSaveModal(false);
                      setSelectedChapter(null);
                      setSaveMessageContent('');
                      setPendingSaveData(null);
                    }
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  确定创建新版本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick Prompt Editor Component
interface QuickPromptEditorProps {
  prompt: { id: string; label: string; text: string } | null;
  onSave: (label: string, text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const QuickPromptEditor: React.FC<QuickPromptEditorProps> = ({ prompt, onSave, onDelete, onCancel }) => {
  const [label, setLabel] = useState(prompt?.label || '');
  const [text, setText] = useState(prompt?.text || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim() && text.trim()) {
      onSave(label.trim(), text.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          按钮标签
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例如：继续、优化、扩展"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          maxLength={10}
          required
        />
        <p className="text-xs text-slate-500 mt-1">最多10个字符，显示在按钮上</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          提示词内容
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：继续、优化这段内容、扩展这段内容"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          rows={4}
          required
        />
        <p className="text-xs text-slate-500 mt-1">点击按钮时插入到输入框的内容</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            删除
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!label.trim() || !text.trim()}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
        >
          保存
        </button>
      </div>
    </form>
  );
};

// Data Directory Selector Component (Electron only)
const DataDirectorySelectorComponent: React.FC = () => {
  const [dataDir, setDataDir] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

  // Load current data directory
  useEffect(() => {
    if (!isElectron) return;
    
    const loadDataDir = async () => {
      try {
        const dir = await (window as any).electronAPI.data.getCurrentDataDir();
        setDataDir(dir || '');
      } catch (e) {
        console.error('Failed to load data directory:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadDataDir();
  }, [isElectron]);

  const handleSelectDir = async () => {
    if (!isElectron) return;
    
    try {
      const selectedDir = await (window as any).electronAPI.data.selectDataDir();
      if (selectedDir) {
        setDataDir(selectedDir);
        // 提示用户需要重启应用才能生效
        alert(`数据目录已更改为:\n${selectedDir}\n\n⚠️ 请重启应用以使更改生效！`);
      }
    } catch (e) {
      console.error('Failed to select data directory:', e);
      alert('选择目录失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleResetDir = async () => {
    if (!isElectron) return;
    
    if (!confirm('确定要重置数据目录为默认位置吗？\n\n⚠️ 请确保已备份当前数据！')) {
      return;
    }

    try {
      const defaultDir = await (window as any).electronAPI.data.resetDataDir();
      setDataDir(defaultDir);
      alert(`数据目录已重置为默认位置:\n${defaultDir}\n\n⚠️ 请重启应用以使更改生效！`);
    } catch (e) {
      console.error('Failed to reset data directory:', e);
      alert('重置目录失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  // 如果不是 Electron 环境，显示提示信息
  if (!isElectron) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs md:text-sm font-semibold text-slate-300 flex items-center gap-1.5">
            <Folder className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
            数据保存目录
          </label>
        </div>
        <p className="text-[10px] md:text-xs text-slate-500 mt-2">
          💡 此功能仅在安装版（Electron）中可用。Web 版数据保存在浏览器中。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs md:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <Folder className="w-3 h-3 md:w-4 md:h-4 text-emerald-400" />
          数据保存目录
        </label>
      </div>
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 mb-2">
        <p className="text-[10px] md:text-xs text-slate-400 font-mono break-all">
          {isLoading ? '加载中...' : (dataDir || '未设置')}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSelectDir}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs rounded-lg border border-emerald-500/30 transition-colors"
        >
          <FolderOpen className="w-3 h-3" />
          选择目录
        </button>
        <button
          onClick={handleResetDir}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-600 transition-colors"
          title="重置为默认目录"
        >
          <RotateCcwIcon className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[10px] md:text-xs text-slate-500 mt-1">
        ⚠️ 更改目录后需要重启应用才能生效。请确保已备份数据！
      </p>
    </div>
  );
};

export default ChatInterface;
