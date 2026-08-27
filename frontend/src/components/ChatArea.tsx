'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, Sparkles, AlertCircle, Loader2, Plus, Database, CheckCircle2 } from 'lucide-react';
import { ChatMessage, Citation } from '../types';
import { CitationBadge } from './CitationBadge';
import { useViewerStore } from '../store/useViewerStore';

interface ChatAreaProps {
  initialMessages?: ChatMessage[];
  apiBaseUrl?: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  initialMessages = [],
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'upload' | 'text'>('chat');
  
  // Free text upload state
  const [freeText, setFreeText] = useState('');
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { setDocuments, documents } = useViewerStore();

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Fetch available documents on load
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/documents`);
        if (res.ok) {
          const data = await res.json();
          if (data.documents) {
            setDocuments(data.documents);
          }
        }
      } catch (err) {
        console.warn('Servidor backend ainda não inicializado ou inacessível no momento.');
      }
    };
    fetchDocs();
  }, [apiBaseUrl, setDocuments]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputQuery.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = inputQuery.trim();
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, top_k: 4 }),
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

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Erro ao processar a pergunta: ${error.message || 'Verifique se o backend está em execução.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${apiBaseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback(`Sucesso! ${data.total_processed} arquivo(s) indexado(s).`);
        // Atualiza a lista de documentos
        const docsRes = await fetch(`${apiBaseUrl}/documents`);
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents);
        }
      } else {
        setUploadFeedback('Erro durante a indexação de alguns arquivos.');
      }
    } catch (err: any) {
      setUploadFeedback(`Erro no upload: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeText.trim() || isUploading) return;

    setIsUploading(true);
    setUploadFeedback(null);

    try {
      const res = await fetch(`${apiBaseUrl}/upload-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: freeText.trim(),
          title: freeTextTitle.trim() || 'Texto Livre',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback(`Texto '${data.file_name}' indexado com sucesso!`);
        setFreeText('');
        setFreeTextTitle('');
      } else {
        setUploadFeedback('Erro ao indexar texto.');
      }
    } catch (err: any) {
      setUploadFeedback(`Erro: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white">Oráculo RAG AI</h2>
            <p className="text-[11px] text-slate-400">Gemini 1.5 Flash + ChromaDB</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload PDF
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Texto
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <>
          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 text-sm">Nenhuma conversa iniciada</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Faça upload de documentos PDF ou insira textos para começar a consultar o Oráculo com citações interativas.
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
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : msg.role === 'assistant'
                        ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none'
                        : 'bg-red-950/50 text-red-200 border border-red-800/50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {/* Citations Box */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-700/60">
                        <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Fontes Citadas (Clique para visualizar):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((cit, idx) => (
                            <CitationBadge
                              key={`${cit.file_name}-${cit.page_number}-${idx}`}
                              fileName={cit.file_name}
                              pageNumber={cit.page_number}
                              snippet={cit.snippet}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/50 rounded-lg w-fit border border-slate-700/40 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Consultando documentos com Gemini AI...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Pergunte algo sobre seus documentos..."
                disabled={isLoading}
                className="flex-1 bg-slate-800/90 border border-slate-700 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-2.5 rounded-lg font-medium transition-all shadow-md flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                aria-label="Enviar"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Upload PDF Tab */}
      {activeTab === 'upload' && (
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center transition-all bg-slate-800/30 flex flex-col items-center justify-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="application/pdf"
              className="hidden"
              id="pdf-upload-input"
            />
            <label
              htmlFor="pdf-upload-input"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-full border border-indigo-500/30">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-slate-200">
                Clique para selecionar arquivos PDF
              </span>
              <span className="text-xs text-slate-400">
                Suporte a múltiplos PDFs para chunking e vetorização com ChromaDB
              </span>
            </label>
          </div>

          {isUploading && (
            <div className="flex items-center justify-center gap-2 p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-indigo-200 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Processando e indexando documentos...</span>
            </div>
          )}

          {uploadFeedback && (
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{uploadFeedback}</span>
            </div>
          )}
        </div>
      )}

      {/* Insert Free Text Tab */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextUpload} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Título do Documento / Nota
            </label>
            <input
              type="text"
              value={freeTextTitle}
              onChange={(e) => setFreeTextTitle(e.target.value)}
              placeholder="Ex: Anotações da Reunião de Arquitetura"
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              placeholder="Cole ou digite aqui o texto que deve ser incorporado à base de conhecimento RAG..."
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-sm rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isUploading || !freeText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Indexando Texto...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Adicionar à Base de Conhecimento</span>
              </>
            )}
          </button>

          {uploadFeedback && (
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{uploadFeedback}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
