'use client';

import React, { useEffect } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Files, 
  Sparkles, 
  Clock, 
  PanelLeftClose
} from 'lucide-react';
import { useConversationStore } from '../store/useConversationStore';
import { useViewerStore } from '../store/useViewerStore';

interface SidebarProps {
  apiBaseUrl?: string;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  onClose,
}) => {
  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    fetchConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    setSidebarOpen,
  } = useConversationStore();

  const { resetViewer } = useViewerStore();

  useEffect(() => {
    fetchConversations(apiBaseUrl);
  }, [apiBaseUrl, fetchConversations]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setSidebarOpen(false);
    }
  };

  const handleNewConversation = async () => {
    resetViewer();
    await createConversation('Nova Conversa', apiBaseUrl);
  };

  const handleSelect = (id: string) => {
    if (id !== activeConversationId) {
      resetViewer();
      selectConversation(id, apiBaseUrl);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta conversa e seus arquivos?')) {
      deleteConversation(id, apiBaseUrl);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <aside className="w-full h-full bg-slate-950 border-r border-slate-800 flex flex-col select-none shadow-2xl">
      {/* Top App Branding, Close Button & New Chat Button */}
      <div className="p-3 border-b border-slate-800/80 space-y-3 bg-slate-950/90">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-wider text-slate-100 uppercase">Oráculo RAG</h1>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Recolher barra lateral"
            aria-label="Fechar histórico"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-950/50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conversa</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
          <span>Histórico de Sessões</span>
          <span className="text-slate-400">{conversations.length}</span>
        </div>

        {isLoadingConversations && conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Carregando conversas...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 space-y-2">
            <MessageSquare className="w-6 h-6 text-slate-400 mx-auto" />
            <p>Nenhuma conversa ainda.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`group relative flex flex-col p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                  isActive
                    ? 'bg-indigo-950/70 border border-indigo-500/50 text-white shadow-sm'
                    : 'bg-slate-900/50 hover:bg-slate-900 border border-transparent hover:border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="font-medium truncate max-w-[150px]">
                      {conv.title || 'Conversa sem título'}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-slate-400 transition rounded"
                    title="Excluir conversa"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Subtitle / Metadata */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/50 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDate(conv.updated_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {conv.file_count > 0 && (
                      <span className="flex items-center gap-0.5 text-indigo-300">
                        <Files className="w-2.5 h-2.5" />
                        {conv.file_count} doc(s)
                      </span>
                    )}
                    <span>{conv.message_count} msgs</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
