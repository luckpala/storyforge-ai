import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ApiConfig, SendMessageOptions, StoryState } from '../types';
import { X, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PromptConfirmModal from './PromptConfirmModal';

interface TempChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt: string;
  systemContent?: string;
  chapterNumber: number;
  volumeNumber?: number;
  onSaveContent: (content: string, chapterNumber: number, volumeNumber?: number, createNewVersion?: boolean) => void;
  
  // 使用主对话的设置
  apiConfig: ApiConfig | null;
  getPromptContext: (userMessage?: string) => any;
  toolsList: any[];
  story: StoryState;
  
  // 主对话的设置
  targetWordCount: number;
  temperature: number;
  enableStreaming?: boolean;
  removeContextLimit?: boolean;
  contextLength?: number;
  maxResponseLength?: number;
  useModelDefaults?: boolean;
}

const TempChatModal: React.FC<TempChatModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  systemContent,
  chapterNumber,
  volumeNumber,
  onSaveContent,
  apiConfig,
  getPromptContext,
  toolsList,
  story,
  targetWordCount,
  temperature,
  enableStreaming,
  removeContextLimit,
  contextLength,
  maxResponseLength,
  useModelDefaults
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [showPromptConfirm, setShowPromptConfirm] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleSendRef = useRef<((text: string) => Promise<void>) | null>(null);
  const hasShownConfirmRef = useRef(false); // 标记是否已经显示过确认窗口
  
  // 拖动相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // 当模态框打开时，显示提示词确认，并初始化位置（靠右显示）
  useEffect(() => {
    if (isOpen && initialPrompt && !hasShownConfirmRef.current) {
      // 清空之前的消息
      setMessages([]);
      setInput('');
      
      // 初始化位置：靠右显示
      if (typeof window !== 'undefined') {
        setPosition({ x: 0, y: 0 }); // 重置位置，使用 right 定位
      }
      
      // 显示提示词确认窗口
      setPendingPrompt(initialPrompt);
      setShowPromptConfirm(true);
      hasShownConfirmRef.current = true;
    }
  }, [isOpen, initialPrompt]);

  // 当模态框关闭时，清空消息
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setShowPromptConfirm(false);
      setPendingPrompt('');
      hasShownConfirmRef.current = false; // 重置标志
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);
  
  
  const handlePromptCancel = useCallback(() => {
    setShowPromptConfirm(false);
    onClose();
  }, [onClose]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !apiConfig || !apiConfig.apiKey) {
      return;
    }

    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      text: text.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 获取提示词上下文
      const promptContext = getPromptContext(text);
      
      // 构建系统提示词
      let finalSystemInstruction = promptContext.systemInstruction;
      if (systemContent) {
        finalSystemInstruction = `${finalSystemInstruction}${systemContent}`;
      }

      // 使用空历史（临时对话不依赖历史）
      let apiHistory: Message[] = [];
      
      // ========== 幽灵注入法：在写作模式下，将范文作为虚拟对话历史注入 ==========
      // 与主对话窗口保持一致的逻辑
      const currentWritingMethod = (localStorage.getItem('storyforge_writing_method') as any) || 'default';
      const isWritingMode = currentWritingMethod !== 'default' && currentWritingMethod !== 'chat_only';
      const isGeneratingManuscript = /(?:写|生成|创作).*?(?:正文|内容|章节|下一章|第.*?章)|(?:使用.*?文风.*?写)|(?:按.*?章纲.*?写)/i.test(text);
      
      if (isWritingMode && isGeneratingManuscript) {
        // 获取范文内容（与主对话窗口使用相同的逻辑）
        try {
          const enabled = localStorage.getItem('storyforge_writing_samples_enabled');
          const isEnabled = enabled !== 'false';
          
          if (!isEnabled) {
            // 范文未启用，跳过
          } else {
            const saved = localStorage.getItem('storyforge_writing_samples');
            if (saved) {
              const samples = JSON.parse(saved);
              const selected = samples.filter((s: any) => s.selected);
              
              if (selected.length > 0) {
                // 按编号排序，没有编号的排在最后
                const sorted = selected.sort((a: any, b: any) => {
                  const orderA = a.order || 999999;
                  const orderB = b.order || 999999;
                  return orderA - orderB;
                });
                
                const samplesContent = sorted.map((s: any, index: number) => {
                  const orderLabel = s.order ? `[编号${s.order}]` : '';
                  return `【${orderLabel}${s.name}】\n${s.content}`;
                }).join('\n\n---\n\n');
                
                if (samplesContent && samplesContent.trim()) {
                  // 构造虚拟的User消息：要求学习范文
                  const fakeUserMsg: Message = {
                    id: 'ghost_fanwen_user',
                    role: 'user',
                    text: `请学习以下文本的文风（用词、节奏、描写方式、叙事风格）。在接下来的写作中，必须严格模仿这种风格：\n\n【范文开始】\n${samplesContent}\n【范文结束】`,
                    excludeFromAI: false // 这个要发送给AI
                  };
                  
                  // 构造虚拟的Assistant消息：确认收到并理解
                  const fakeAssistantMsg: Message = {
                    id: 'ghost_fanwen_assistant',
                    role: 'model',
                    text: '明白了。我已经深刻理解了该文本的文风特点（包括用词习惯、句式结构、描写手法、叙事节奏等）。接下来的创作我将严格复刻这种风格，确保文风一致性。',
                    excludeFromAI: false // 这个要发送给AI
                  };
                  
                  // 将虚拟消息插入到消息历史的最前面（在真实对话历史之前）
                  apiHistory = [fakeUserMsg, fakeAssistantMsg, ...apiHistory];
                  
                  console.log('🔮 临时对话窗口 - 幽灵注入：已插入虚拟范文学习对话', {
                    samplesLength: samplesContent.length,
                    fakeMessagesCount: 2,
                    totalMessagesCount: apiHistory.length,
                    writingMethod: currentWritingMethod
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ 临时对话窗口 - 获取范文内容失败:', e);
        }
      }

      // 调用 LLM
      const { LLMAdapter } = await import('../services/llmAdapter');
      const result = await LLMAdapter.chat(
        apiConfig,
        apiHistory,
        text.trim(),
        finalSystemInstruction,
        toolsList,
        abortController.signal,
        {
          temperature,
          enableStreaming,
          removeContextLimit,
          contextLength,
          maxResponseLength,
          useModelDefaults,
          targetWordCount
        },
        true // forceToolCall: 强制要求工具调用
      );

      // 处理工具调用
      if (result.functionCalls && result.functionCalls.length > 0) {
        for (const toolCall of result.functionCalls) {
          if (toolCall.name === 'update_storyboard') {
            const args = toolCall.args as any;
            if (args.chapterNumber === chapterNumber && args.chapter_content) {
              // 保存内容
              onSaveContent(
                args.chapter_content,
                chapterNumber,
                volumeNumber,
                true // createNewVersion
              );
              
              // 显示成功消息
              const successMessage: Message = {
                id: `temp-success-${Date.now()}`,
                role: 'model',
                text: `✅ 已成功保存第${chapterNumber}章的新版本正文`,
                isToolCall: true,
                excludeFromAI: true  // 🔒 工具调用通知不发送给AI
              };
              setMessages(prev => [...prev, successMessage]);
              
              // 延迟关闭
              setTimeout(() => {
                onClose();
              }, 1500);
              return;
            }
          } else if (toolCall.name === 'add_chapter') {
            // 提炼信息功能会调用 add_chapter
            const successMessage: Message = {
              id: `temp-success-${Date.now()}`,
              role: 'model',
              text: `✅ 已成功更新章纲信息`,
              isToolCall: true,
              excludeFromAI: true  // 🔒 工具调用通知不发送给AI
            };
            setMessages(prev => [...prev, successMessage]);
            
            // 延迟关闭
            setTimeout(() => {
              onClose();
            }, 1500);
            return;
          }
        }
      }

      // 如果没有工具调用，显示文本回复
      if (result.text) {
        const modelMessage: Message = {
          id: `temp-model-${Date.now()}`,
          role: 'model',
          text: result.text
        };
        setMessages(prev => [...prev, modelMessage]);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('临时对话错误:', error);
      const errorMessage: Message = {
        id: `temp-error-${Date.now()}`,
        role: 'model',
        text: `❌ 错误: ${error.message || '生成失败'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, apiConfig, getPromptContext, toolsList, systemContent, chapterNumber, volumeNumber, onSaveContent, onClose, temperature, enableStreaming, removeContextLimit, contextLength, maxResponseLength, useModelDefaults, targetWordCount]);

  // 更新 ref
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // 处理提示词确认（必须在 handleSend 定义之后）
  const handlePromptConfirm = useCallback((editedUserMessage?: string, editedSystemInstruction?: string) => {
    const finalPrompt = editedUserMessage || pendingPrompt;
    setShowPromptConfirm(false);
    hasShownConfirmRef.current = true; // 标记已确认，防止再次弹出
    // 延迟发送，确保状态更新完成，临时对话窗口显示后再发送
    setTimeout(() => {
      if (finalPrompt && handleSendRef.current) {
        handleSendRef.current(finalPrompt);
      }
    }, 200);
  }, [pendingPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSend(input);
    setInput('');
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // 拖动处理函数
  const handleMouseDown = (e: React.MouseEvent) => {
    if (modalRef.current) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragStart({
        x: e.clientX - (window.innerWidth - rect.right),
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isOpen) return null;

  // 获取提示词上下文用于确认窗口
  const promptContext = isOpen && pendingPrompt ? getPromptContext(pendingPrompt) : null;
  let finalSystemInstruction = promptContext?.systemInstruction || '';
  if (systemContent && promptContext) {
    finalSystemInstruction = `${finalSystemInstruction}${systemContent}`;
  }

  return (
    <>
      {/* 提示词确认窗口 */}
      {showPromptConfirm && promptContext && (
        <PromptConfirmModal
          isOpen={showPromptConfirm}
          onClose={handlePromptCancel}
          onConfirm={handlePromptConfirm}
          userMessage={pendingPrompt}
          systemInstruction={finalSystemInstruction}
          context={promptContext.context || {}}
          history={[]}
        />
      )}
      
      {/* 临时对话窗口 - 在确认后显示 */}
      {!showPromptConfirm && isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/20 pointer-events-none" onClick={onClose}>
          <div
            ref={modalRef}
            className="absolute w-[550px] h-[650px] max-h-[85vh] bg-slate-900 rounded-lg shadow-2xl flex flex-col border border-slate-700 pointer-events-auto"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              cursor: isDragging ? 'grabbing' : 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - 可拖动区域 */}
            <div
              className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
            >
              <h2 className="text-lg font-semibold text-slate-200">
                临时对话 - 第{chapterNumber}章
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors z-10"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-slate-500 py-8">
              正在初始化...
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.isToolCall
                    ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {msg.role === 'model' ? (
                  <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-700 p-4 bg-slate-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isLoading}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </div>
      </div>
      )}
    </>
  );
};

export default TempChatModal;

