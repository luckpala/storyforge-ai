
import React, { useState, useEffect, useRef } from 'react';
import { SavedSession } from '../types';
import { Plus, Trash2, X, Book, Clock, ChevronRight, Pencil, Check, Download, Upload, Share2, Key, ExternalLink, AlertTriangle, Feather } from 'lucide-react';

interface SessionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SavedSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onExportSessions: () => void;
  onExportSingleSession: (id: string, e: React.MouseEvent) => void;
  onImportSessions: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenApiKeyModal: () => void;
  
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onExportSessions,
  onExportSingleSession,
  onImportSessions,
  onOpenApiKeyModal
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isInIframe, setIsInIframe] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
      if (editingId && inputRef.current) inputRef.current.focus(); 
  }, [editingId]);

  useEffect(() => {
      // Check if running in iframe
      setIsInIframe(window.self !== window.top);
  }, []);

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingId(id); setEditValue(currentTitle);
  };
  const saveEditing = (id: string) => { if (editValue.trim()) onRenameSession(id, editValue.trim()); setEditingId(null); };
  
  const handleOpenInNewTab = () => {
      window.open(window.location.href, '_blank');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-30 xl:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Sidebar Container */}
      {/* Changed breakpoint from lg: to xl: (1280px) so tablets use drawer mode */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 border-r border-slate-800 
        transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        xl:relative xl:translate-x-0 xl:inset-auto xl:shadow-none xl:z-0
      `}>
        
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2"><Book className="w-5 h-5 text-purple-500" />我的故事库</h2>
          <button onClick={onClose} className="xl:hidden p-1.5 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Iframe Warning / Popout Button */}
        {isInIframe && (
            <div className="mx-3 mt-3 p-3 bg-amber-900/20 border border-amber-500/50 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200 leading-relaxed">
                        检测到预览模式。硬盘同步功能被浏览器禁用。
                    </p>
                </div>
                <button 
                    onClick={handleOpenInNewTab}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs py-1.5 rounded transition-colors font-medium"
                >
                    <ExternalLink className="w-3 h-3" /> 在独立窗口打开
                </button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.sort((a, b) => b.lastUpdated - a.lastUpdated).map((session) => {
              const isActive = session.id === currentSessionId;
              const isEditing = editingId === session.id;
              return (
                <div key={session.id} onClick={() => { if (!isEditing) { onSelectSession(session.id); if (window.innerWidth < 1280) onClose(); }}}
                  className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 ${isActive ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}`}>
                  
                  {isEditing ? (
                    <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                        <input ref={inputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveEditing(session.id)} onKeyDown={e => e.key==='Enter'&&saveEditing(session.id)} className="w-full bg-slate-800 text-white text-sm px-2 py-1 rounded border border-purple-500" />
                        <button onClick={() => saveEditing(session.id)}><Check className="w-4 h-4 text-emerald-400"/></button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start mb-1 gap-2">
                        <h3 className={`font-semibold truncate flex-1 min-w-0 ${isActive ? 'text-purple-300' : 'text-slate-300'}`}>{session.story.title || "未命名故事"}</h3>
                        <div className="flex gap-1 flex-shrink-0">
                             {/* Action buttons in title row */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); startEditing(session.id, session.story.title, e); }} 
                                className={`p-1.5 hover:text-white transition-colors ${isActive ? 'text-purple-400' : 'text-slate-600'}`} 
                                type="button"
                                title="重命名"
                             >
                                <Pencil className="w-3.5 h-3.5" />
                             </button>
                             <button 
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onExportSingleSession(session.id, e); }} 
                                className={`p-1.5 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors ${isActive ? 'text-purple-400' : 'text-slate-600'}`} 
                                title="导出此故事"
                                type="button"
                             >
                                <Share2 className="w-3.5 h-3.5" />
                             </button>
                             <button 
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteSession(session.id, e); }} 
                                className={`p-1.5 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors ${isActive ? 'text-purple-400' : 'text-slate-600'}`} 
                                title="删除"
                                type="button"
                             >
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                        </div>
                    </div>
                  )}
                  
                  {!isEditing && (
                      <>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Clock className="w-3 h-3" />{new Date(session.lastUpdated).toLocaleDateString('zh-CN')}</div>
                        <p className="text-xs text-slate-600 line-clamp-2">{session.story.synopsis || "暂无简介..."}</p>
                      </>
                  )}
                </div>
              );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/30 space-y-3">
          <button onClick={() => { onCreateSession(); if (window.innerWidth < 1280) onClose(); }} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium shadow-lg"><Plus className="w-5 h-5" />新建故事</button>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onExportSessions} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm"><Upload className="w-4 h-4" />全部备份</button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm"><Download className="w-4 h-4" />导入备份</button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onImportSessions} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SessionSidebar;
