'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  ExternalLink,
  BookOpen,
  Layers,
  Search,
  Hash,
  Loader2,
  FileCode,
  PanelRightClose,
  Maximize2,
  Smartphone,
  Home
} from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';
import { useConversationStore } from '../store/useConversationStore';
import { DocumentDetail, DocumentChunkData } from '../types';
import { DocumentExplorer } from './DocumentExplorer';

interface PDFViewerProps {
  uploadsBaseUrl?: string;
  apiBaseUrl?: string;
  onClose?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  uploadsBaseUrl = process.env.NEXT_PUBLIC_UPLOADS_URL || 'http://localhost:8000/uploads',
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  onClose,
}) => {
  const { 
    activeFile, 
    activePage, 
    totalPages, 
    zoom, 
    documents,
    setActivePage, 
    setActiveFile, 
    setTotalPages,
    setZoom,
    setViewerOpen
  } = useViewerStore();

  const activeConversationId = useConversationStore((state) => state.activeConversationId);

  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('text');
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isPdf = activeFile?.toLowerCase().endsWith('.pdf');

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setViewerOpen(false);
    }
  };

  // Ajusta o modo inicial baseado no tipo de arquivo
  useEffect(() => {
    if (isPdf) {
      setViewMode('pdf');
    } else {
      setViewMode('text');
    }
  }, [activeFile, isPdf]);

  // Busca detalhes do documento quando o arquivo ativo muda
  useEffect(() => {
    if (!activeFile) {
      setDocDetail(null);
      return;
    }

    const fetchDocContent = async () => {
      setIsLoadingDoc(true);
      try {
        const url = activeConversationId
          ? `${apiBaseUrl}/conversations/${encodeURIComponent(activeConversationId)}/documents/${encodeURIComponent(activeFile)}`
          : `${apiBaseUrl}/documents/${encodeURIComponent(activeFile)}`;

        const res = await fetch(url);
        if (res.ok) {
          const data: DocumentDetail = await res.json();
          setDocDetail(data);
          if (data.total_pages && data.total_pages > 0) {
            setTotalPages(data.total_pages);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes do documento:', err);
      } finally {
        setIsLoadingDoc(false);
      }
    };

    fetchDocContent();
  }, [activeFile, activeConversationId, apiBaseUrl, setTotalPages]);

  const handlePrevPage = () => {
    if (activePage > 1) {
      setActivePage(activePage - 1);
    }
  };

  const handleNextPage = () => {
    setActivePage(activePage + 1);
  };

  const handleZoomIn = () => {
    setZoom(zoom + 15);
  };

  const handleZoomOut = () => {
    setZoom(zoom - 15);
  };

  const pdfUrl = isPdf 
    ? `${uploadsBaseUrl}/${encodeURIComponent(activeFile!)}#page=${activePage}&zoom=${zoom}` 
    : null;

  // Filtra chunks da página atual ou da busca
  const currentPageChunks = docDetail?.chunks.filter((c) => {
    const matchesPage = c.page_number === activePage;
    if (searchTerm.trim()) {
      return matchesPage && c.content.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return matchesPage;
  }) || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none border-l border-slate-800 shadow-2xl relative">
      {/* Viewer Header / Toolbar - Otimizado para Mobile e Desktop */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900 border-b border-slate-800 shadow-sm flex flex-col gap-2">
        {/* Linha 1: Seletor de Arquivo, Modo de Visualização e Botão Fechar */}
        <div className="flex items-center justify-between gap-2">
          {/* Document Info & Switcher */}
          <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[55%] sm:max-w-[45%]">
            <button
              type="button"
              onClick={() => setActiveFile(null)}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 cursor-pointer ${
                !activeFile
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-700'
              }`}
              title="Ir para o Explorador de Documentos"
              aria-label="Ir para Explorador de Documentos"
              data-testid="home-docs-btn"
            >
              <Home className="w-4 h-4" />
            </button>

            {documents.length > 0 ? (
              <select
                value={activeFile || ''}
                onChange={(e) => setActiveFile(e.target.value || null)}
                className="bg-slate-800 text-slate-200 text-xs rounded-lg border border-slate-700 px-2.5 py-1.5 font-medium truncate focus:ring-1 focus:ring-indigo-500 focus:outline-none w-full"
              >
                <option value="">📁 Explorador de documentos...</option>
                {documents.map((doc, idx) => (
                  <option key={doc} value={doc}>
                    {idx + 1} - {doc}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400 font-medium truncate">
                {activeFile || 'Nenhum documento'}
              </span>
            )}
          </div>

          {/* View Mode Toggle (para PDFs) */}
          {isPdf && (
            <div className="flex bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 text-[10px] sm:text-[11px]">
              <button
                onClick={() => setViewMode('pdf')}
                className={`px-2 sm:px-2.5 py-1 rounded font-medium transition-all ${
                  viewMode === 'pdf'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-2 sm:px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'text'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden xs:inline">Texto</span>
              </button>
            </div>
          )}

          {/* Botão de Fechar / Recolher */}
          <button
            onClick={handleClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition flex-shrink-0"
            title="Recolher visualizador"
            aria-label="Recolher visualizador de documentos"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>

        {/* Linha 2: Paginação, Zoom (desktop) e Ação de Tela Cheia */}
        {activeFile && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
            {/* Controles de Paginação com botões touch-friendly */}
            <div className="flex items-center gap-1 bg-slate-800/90 px-1.5 py-1 rounded-lg border border-slate-700">
              <button
                onClick={handlePrevPage}
                disabled={activePage <= 1}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-700 transition"
                title="Página Anterior"
                aria-label="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-1 text-xs text-slate-300 font-mono">
                <input
                  type="number"
                  value={activePage}
                  onChange={(e) => setActivePage(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-10 bg-slate-900 border border-slate-700 text-center rounded py-0.5 text-xs text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
                />
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{totalPages > 0 ? totalPages : '—'}</span>
              </div>

              <button
                onClick={handleNextPage}
                disabled={totalPages > 0 && activePage >= totalPages}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-700 transition"
                title="Próxima Página"
                aria-label="Próxima Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Controles de Zoom (visível no desktop) */}
            {viewMode === 'pdf' && isPdf && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700">
                <button
                  onClick={handleZoomOut}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-slate-300 font-mono px-1 min-w-[32px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Botão de Tela Cheia / Nova Aba para Mobile & Desktop */}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-lg border border-indigo-700/50 transition font-medium text-[11px] shadow-sm ml-auto"
                title="Abrir PDF em tela cheia no navegador"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Tela Cheia</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Barra de Busca quando estiver visualizando texto extraído */}
      {viewMode === 'text' && activeFile && (
        <div className="px-3 sm:px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar trechos da página..."
              className="w-full bg-slate-800 border border-slate-700/80 rounded-md pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40 font-mono">
              Pág. {activePage} de {totalPages}
            </span>
          </div>
        </div>
      )}

      {/* Viewer Body */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-2 sm:p-3">
        {isLoadingDoc ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Carregando conteúdo do documento...</span>
          </div>
        ) : activeFile && isPdf && viewMode === 'pdf' ? (
          /* PDF Nativo Embutido com Container Otimizado para Touch */
          <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 relative">
            {/* Banner Auxiliar Mobile */}
            <div className="sm:hidden px-3 py-1.5 bg-indigo-950/80 border-b border-indigo-800/50 flex items-center justify-between text-[11px] text-indigo-200">
              <span className="flex items-center gap-1 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                Dica mobile
              </span>
              <a
                href={pdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-indigo-300 font-semibold hover:text-white"
              >
                Abrir em tela cheia ↗
              </a>
            </div>

            <iframe
              key={`${activeFile}-p${activePage}-${zoom}`}
              src={pdfUrl!}
              title={`Visualizador de ${activeFile}`}
              className="w-full flex-1 border-none bg-slate-900 touch-auto"
            />
          </div>
        ) : activeFile && (viewMode === 'text' || !isPdf) ? (
          /* Modo de Leitura de Texto & Chunks da Página - 100% Responsivo */
          <div className="w-full h-full overflow-y-auto pr-1 space-y-3">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-200 truncate">{activeFile}</h4>
                  <p className="text-[10px] text-slate-400">
                    Fragmentos extraídos da página {activePage}
                  </p>
                </div>
              </div>
            </div>

            {currentPageChunks.length > 0 ? (
              currentPageChunks.map((chunk, idx) => (
                <div
                  key={chunk.chunk_id || idx}
                  className="p-3.5 sm:p-4 bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-indigo-300 pb-1.5 border-b border-slate-800">
                    <span className="font-mono bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/40 text-[10px]">
                      ID: {chunk.chunk_id}
                    </span>
                    <span className="text-slate-400">Pág. {chunk.page_number}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white font-sans">
                    {chunk.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-xl space-y-2">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  {searchTerm
                    ? `Nenhum trecho com o termo "${searchTerm}" na página ${activePage}.`
                    : `Nenhum trecho indexado para a página ${activePage}.`}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Explorador de Documentos quando nenhum estiver aberto */
          <DocumentExplorer 
            documents={documents} 
            onSelectDocument={(file) => setActiveFile(file)} 
          />
        )}
      </div>
    </div>
  );
};
