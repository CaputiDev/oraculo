'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Upload, 
  FileText, 
  Sparkles, 
  Loader2, 
  Plus, 
  Database, 
  CheckCircle2, 
  Menu, 
  PanelLeft, 
  PanelRight, 
  BookOpen,
  FileUp,
  AlertCircle
} from 'lucide-react';
import { ChatMessage, Citation } from '../types';
import { CitationBadge } from './CitationBadge';
import { MessageCitations } from './MessageCitations';
import { useViewerStore } from '../store/useViewerStore';
import { useConversationStore } from '../store/useConversationStore';

interface ChatAreaProps {
  initialMessages?: ChatMessage[];
  apiBaseUrl?: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  initialMessages = [],
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
}) => {
  const {
    activeConversationId,
    activeConversation,
    isLoadingDetail,
    isSidebarOpen,
    toggleSidebar,
    appendMessageToActive,
    addFileToActive,
    createConversation,
    fetchConversations,
  } = useConversationStore();

  const { isViewerOpen, toggleViewer, setDocuments, documents } = useViewerStore();

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'upload' | 'text'>('chat');
  
  // Drag & drop states
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Free text upload state
  const [freeText, setFreeText] = useState('');
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: ChatMessage[] = activeConversation?.messages || initialMessages;

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Sincroniza os arquivos da conversa ativa com o visualizador de documentos
  useEffect(() => {
    if (activeConversation?.files) {
      setDocuments(activeConversation.files);
    }
  }, [activeConversation?.files, setDocuments]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = await createConversation(inputQuery.slice(0, 30), apiBaseUrl);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputQuery.trim(),
      timestamp: new Date().toISOString(),
    };

    appendMessageToActive(userMessage);
    const currentQuery = inputQuery.trim();
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(targetConvId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, conversation_id: targetConvId, top_k: 3 }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        timestamp: new Date().toISOString(),
      };

      appendMessageToActive(assistantMessage);
      fetchConversations(apiBaseUrl);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Erro ao processar a pergunta: ${error.message || 'Verifique se o backend está em execução.'}`,
        timestamp: new Date().toISOString(),
      };
      appendMessageToActive(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFiles = async (filesToUpload: FileList | File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setUploadFeedback({
        type: 'error',
        message: 'Apenas arquivos em formato PDF (.pdf) são aceitos para indexação.',
      });
      return;
    }

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = await createConversation('Conversa com Documentos', apiBaseUrl);
    }

    setIsUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    for (let i = 0; i < validFiles.length; i++) {
      formData.append('files', validFiles[i]);
    }
    formData.append('conversation_id', targetConvId);

    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(targetConvId)}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback({
          type: 'success',
          message: `Sucesso! ${data.total_processed} arquivo(s) PDF indexado(s) via Batch Embedding nesta conversa.`,
        });
        for (let i = 0; i < validFiles.length; i++) {
          addFileToActive(validFiles[i].name);
        }
        fetchConversations(apiBaseUrl);
      } else {
        setUploadFeedback({
          type: 'error',
          message: 'Erro durante o processamento de alguns arquivos.',
        });
      }
    } catch (err: any) {
      setUploadFeedback({
        type: 'error',
        message: `Erro no upload: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
      setIsDraggingOver(false);
      setDragCounter(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
    }
  };

  // Drag & Drop handlers globais e da zona de drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setIsDraggingOver(false);
        return 0;
      }
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeText.trim() || isUploading) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = await createConversation(freeTextTitle || 'Texto Livre', apiBaseUrl);
    }

    setIsUploading(true);
    setUploadFeedback(null);

    const docTitle = freeTextTitle.trim() || 'Texto Livre';

    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(targetConvId)}/upload-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: freeText.trim(),
          title: docTitle,
          conversation_id: targetConvId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback({
          type: 'success',
          message: `Texto '${data.file_name}' indexado com sucesso nesta conversa!`,
        });
        addFileToActive(docTitle);
        setFreeText('');
        setFreeTextTitle('');
        fetchConversations(apiBaseUrl);
      } else {
        setUploadFeedback({
          type: 'error',
          message: 'Erro ao indexar texto.',
        });
      }
    } catch (err: any) {
      setUploadFeedback({
        type: 'error',
        message: `Erro: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const docCount = activeConversation?.files?.length ?? documents?.length ?? 0;

  return (
    <div 
      className="flex flex-col h-full bg-slate-900 text-slate-100 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Overlay Visual Global de Drag & Drop */}
      {isDraggingOver && (
        <div 
          data-testid="drag-drop-overlay"
          className="absolute inset-0 z-50 bg-indigo-950/90 backdrop-blur-md border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200"
        >
          <div className="p-5 bg-indigo-600/30 text-indigo-300 rounded-3xl border border-indigo-400/50 shadow-2xl mb-4 animate-bounce">
            <FileUp className="w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            Solte seus arquivos PDF aqui
          </h3>
          <p className="text-sm text-indigo-200 max-w-sm">
            Eles serão processados em alta velocidade com PyMuPDF e Batch Embeddings nesta conversa.
          </p>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md gap-2 flex-wrap sm:flex-nowrap">
        {/* Left: Sidebar Toggle & Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
              isSidebarOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
            title={isSidebarOpen ? 'Recolher histórico' : 'Abrir histórico de conversas'}
            aria-label="Alternar histórico"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="truncate">
            <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white truncate">
              {activeConversation?.title || 'Chat com IA'}
            </h2>
            <p className="text-[10px] text-slate-400 font-mono truncate hidden sm:block">
              {docCount > 0 ? `${docCount} doc(s) vinculados` : 'Nenhum documento anexado'}
            </p>
          </div>
        </div>

        {/* Center/Right: Tabs + Document Viewer Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Navigation Tabs */}
          <div className="flex bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 text-[11px] sm:text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Upload PDF</span>
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'text'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Texto</span>
            </button>
          </div>

          {/* Right: Document Viewer Toggle Button */}
          <button
            onClick={toggleViewer}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
              isViewerOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
            title={isViewerOpen ? 'Recolher visualizador de documentos' : 'Abrir visualizador de documentos'}
            aria-label="Alternar visualizador"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-[11px] font-semibold hidden md:inline">Documentos</span>
            {docCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {docCount}
              </span>
            )}
            <PanelRight className="w-3.5 h-3.5 opacity-60 hidden sm:inline" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <>
          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              {isLoadingDetail ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Carregando histórico da conversa...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700 shadow-inner">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200 text-sm">Conversa vazia</h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                      Arraste e solte arquivos PDF aqui ou use as abas acima para alimentar a base desta conversa e faça perguntas com citações.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-md leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : msg.role === 'assistant'
                          ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none shadow-indigo-950/20'
                          : 'bg-red-950/50 text-red-200 border border-red-800/50'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Citations Box (Recolhido automaticamente se > 2) */}
                      {msg.citations && msg.citations.length > 0 && (
                        <MessageCitations citations={msg.citations} />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/60 rounded-lg w-fit border border-slate-700/40 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Consultando documentos da conversa com Gemini AI...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 backdrop-blur-sm">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Pergunte algo sobre os documentos desta conversa..."
                disabled={isLoading}
                className="flex-1 bg-slate-800/90 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 sm:py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-2.5 sm:p-3 rounded-xl font-medium transition-all shadow-md flex items-center justify-center cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Enviar"
              >
                {isLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Upload PDF Tab */}
      {activeTab === 'upload' && (
        <div className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6">
          <div 
            className="max-w-xl mx-auto border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 sm:p-10 text-center transition-all bg-slate-800/30 hover:bg-slate-800/50 flex flex-col items-center justify-center group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept="application/pdf"
              className="hidden"
              id="pdf-upload-input"
            />
            <label
              htmlFor="pdf-upload-input"
              className="cursor-pointer flex flex-col items-center space-y-3 w-full"
            >
              <div className="p-3 sm:p-4 bg-indigo-600/20 group-hover:bg-indigo-600/30 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner transition-all">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-slate-200">
                Arraste e solte seus PDFs aqui ou clique para selecionar
              </span>
              <span className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Suporta múltiplos arquivos simultâneos com extração de alta velocidade e indexação em lote.
              </span>
            </label>
          </div>

          {isUploading && (
            <div className="max-w-xl mx-auto flex items-center justify-center gap-2 p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-xl text-indigo-200 text-xs sm:text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Processando e indexando documentos na conversa...</span>
            </div>
          )}

          {uploadFeedback && (
            <div 
              className={`max-w-xl mx-auto p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border ${
                uploadFeedback.type === 'success'
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                  : 'bg-red-950/60 border-red-800/60 text-red-200'
              }`}
            >
              {uploadFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
              )}
              <span>{uploadFeedback.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Insert Free Text Tab */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextUpload} className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-4 max-w-xl mx-auto w-full">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Título do Documento / Nota
            </label>
            <input
              type="text"
              value={freeTextTitle}
              onChange={(e) => setFreeTextTitle(e.target.value)}
              placeholder="Ex: Anotações da Reunião"
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Conteúdo de Texto Livre
            </label>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={8}
              placeholder="Cole ou digite aqui o texto que deve ser incorporado aos documentos desta conversa..."
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-xl p-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isUploading || !freeText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Indexando Texto na Conversa...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Adicionar aos Documentos da Conversa</span>
              </>
            )}
          </button>

          {uploadFeedback && (
            <div 
              className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border ${
                uploadFeedback.type === 'success'
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                  : 'bg-red-950/60 border-red-800/60 text-red-200'
              }`}
            >
              {uploadFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
              )}
              <span>{uploadFeedback.message}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
