import React from 'react';
import { createPortal } from 'react-dom';
import { X, Send, FileText, User, Bot, Settings, ChevronDown, ChevronUp, Edit2, Check } from 'lucide-react';

interface PromptConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedUserMessage?: string, editedSystemInstruction?: string) => void;
  userMessage: string;
  systemInstruction: string;
  context: {
    title: string;
    synopsis: string;
    blueprint?: any;
    volumes?: any[];
    chapters?: string;
    characters?: string;
    worldSettings?: string;
    writingGuidelines?: string;
  };
  history: Array<{ role: string; text: string }>;
  viewMode?: boolean; // If true, only show close button, no confirm button
}

const PromptConfirmModal: React.FC<PromptConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userMessage,
  systemInstruction,
  context,
  history,
  viewMode = false
}) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['user', 'system']));
  const [editingUserMessage, setEditingUserMessage] = React.useState(false);
  const [editingSystemInstruction, setEditingSystemInstruction] = React.useState(false);
  const [editedUserMessage, setEditedUserMessage] = React.useState(userMessage);
  const [editedSystemInstruction, setEditedSystemInstruction] = React.useState(systemInstruction);

  // Reset edited values when modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      setEditedUserMessage(userMessage);
      setEditedSystemInstruction(systemInstruction);
      setEditingUserMessage(false);
      setEditingSystemInstruction(false);
    }
  }, [isOpen, userMessage, systemInstruction]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleConfirm = () => {
    onConfirm(
      editedUserMessage !== userMessage ? editedUserMessage : undefined,
      editedSystemInstruction !== systemInstruction ? editedSystemInstruction : undefined
    );
  };

  const formatText = (text: string, maxLength: number = 500) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              确认发送内容
            </h2>
            <p className="text-xs text-slate-400 mt-1">请检查即将发送给AI的完整提示词链</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* User Message */}
          <EditableSection
            title="用户消息"
            icon={<User className="w-4 h-4" />}
            isExpanded={expandedSections.has('user')}
            onToggle={() => toggleSection('user')}
            content={editingUserMessage ? editedUserMessage : userMessage}
            editedContent={editedUserMessage}
            isEditing={editingUserMessage}
            onEdit={() => setEditingUserMessage(true)}
            onSave={() => setEditingUserMessage(false)}
            onCancel={() => {
              setEditedUserMessage(userMessage);
              setEditingUserMessage(false);
            }}
            onChange={setEditedUserMessage}
            color="text-blue-400"
            bgColor="bg-blue-900/10"
            borderColor="border-blue-500/30"
          />

          {/* System Instruction */}
          <EditableSection
            title="系统提示词"
            icon={<Settings className="w-4 h-4" />}
            isExpanded={expandedSections.has('system')}
            onToggle={() => toggleSection('system')}
            content={editingSystemInstruction ? editedSystemInstruction : systemInstruction}
            editedContent={editedSystemInstruction}
            isEditing={editingSystemInstruction}
            onEdit={() => setEditingSystemInstruction(true)}
            onSave={() => setEditingSystemInstruction(false)}
            onCancel={() => {
              setEditedSystemInstruction(systemInstruction);
              setEditingSystemInstruction(false);
            }}
            onChange={setEditedSystemInstruction}
            color="text-purple-400"
            bgColor="bg-purple-900/10"
            borderColor="border-purple-500/30"
          />

          {/* Context */}
          <Section
            title="故事上下文"
            icon={<FileText className="w-4 h-4" />}
            isExpanded={expandedSections.has('context')}
            onToggle={() => toggleSection('context')}
            content={`
标题: ${context.title || '未命名'}
简介: ${context.synopsis || '暂无简介'}

${context.blueprint ? `故事模板:
- 开端: ${context.blueprint.hook || '待完善'}
- 激励事件: ${context.blueprint.incitingIncident || '待完善'}
- 上升动作: ${context.blueprint.risingAction || '待完善'}
- 高潮: ${context.blueprint.climax || '待完善'}
- 下降动作: ${context.blueprint.fallingAction || '待完善'}
- 结局: ${context.blueprint.resolution || '待完善'}
` : ''}

${context.volumes && context.volumes.length > 0 ? `卷纲:\n${context.volumes.map((v: any) => `第${v.number}卷: ${v.title}\n  ${v.summary}`).join('\n\n')}\n` : ''}

${context.chapters ? `章纲:\n${context.chapters}\n` : ''}

${context.characters ? `角色设定:\n${context.characters}\n` : ''}

${context.worldSettings ? `世界观设定:\n${context.worldSettings}\n` : ''}

${context.writingGuidelines ? `写作指导:\n${context.writingGuidelines}\n` : ''}
            `.trim()}
            color="text-emerald-400"
            bgColor="bg-emerald-900/10"
            borderColor="border-emerald-500/30"
          />

          {/* History */}
          {history.length > 0 && (
            <Section
              title={`对话历史 (${history.length} 条，仅显示最近消息)`}
              icon={<Bot className="w-4 h-4" />}
              isExpanded={expandedSections.has('history')}
              onToggle={() => toggleSection('history')}
              content={history.map((msg, idx) => `[${msg.role === 'user' ? '用户' : 'AI'}] ${msg.text}`).join('\n\n')}
              color="text-slate-400"
              bgColor="bg-slate-800/30"
              borderColor="border-slate-700/50"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/50 flex-shrink-0 flex gap-3">
          {viewMode ? (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 font-bold transition-all shadow-lg hover:shadow-purple-500/20"
            >
              关闭
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 font-bold transition-all shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                确认发送
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  content: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = ({ title, icon, isExpanded, onToggle, content, color, bgColor, borderColor }) => {
  return (
    <div className={`border rounded-lg ${borderColor} ${bgColor} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full p-3 flex items-center justify-between ${color} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-xs opacity-60">({content.length} 字符)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-950/50">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono overflow-x-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};

const EditableSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  content: string;
  editedContent: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  color: string;
  bgColor: string;
  borderColor: string;
}> = ({ title, icon, isExpanded, onToggle, content, editedContent, isEditing, onEdit, onSave, onCancel, onChange, color, bgColor, borderColor }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className={`border rounded-lg ${borderColor} ${bgColor} overflow-hidden`}>
      <div className="w-full p-3 flex items-center justify-between">
        <button
          onClick={onToggle}
          className={`flex-1 flex items-center justify-between ${color} hover:opacity-80 transition-opacity`}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-sm">{title}</span>
            <span className="text-xs opacity-60">({content.length} 字符)</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {!isEditing && isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="ml-2 p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {isExpanded && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-950/50">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={handleInput}
                className="w-full bg-slate-900 text-slate-200 text-xs font-mono p-3 rounded border border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[200px] max-h-[600px] overflow-y-auto whitespace-pre-wrap"
                style={{ fontFamily: 'monospace' }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave();
                  }}
                  className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  保存
                </button>
              </div>
            </div>
          ) : (
            <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono overflow-x-auto">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptConfirmModal;

