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
  Sparkles,
  Loader2,
  FileCode
} from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';
import { useConversationStore } from '../store/useConversationStore';
import { DocumentDetail, DocumentChunkData } from '../types';

interface PDFViewerProps {
  uploadsBaseUrl?: string;
  apiBaseUrl?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  uploadsBaseUrl = process.env.NEXT_PUBLIC_UPLOADS_URL || 'http://localhost:8000/uploads',
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
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
    setZoom 
  } = useViewerStore();

  const activeConversationId = useConversationStore((state) => state.activeConversationId);

  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('text');
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isPdf = activeFile?.toLowerCase().endsWith('.pdf');

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
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Viewer Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shadow-sm flex-wrap gap-2">
        {/* Document Info & Switcher */}
        <div className="flex items-center gap-2 max-w-[35%]">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          {documents.length > 0 ? (
            <select
              value={activeFile || ''}
              onChange={(e) => setActiveFile(e.target.value || null)}
              className="bg-slate-800 text-slate-200 text-xs rounded-md border border-slate-700 px-2 py-1 font-medium truncate focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-full"
            >
              <option value="">Selecione um documento...</option>
              {documents.map((doc) => (
                <option key={doc} value={doc}>
                  {doc}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-400 font-medium truncate">
              {activeFile || 'Nenhum documento aberto'}
            </span>
          )}
        </div>

        {/* View Mode Toggle (for PDFs) */}
        {isPdf && (
          <div className="flex bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 text-[11px]">
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                viewMode === 'pdf'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PDF Embutido
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                viewMode === 'text'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              Texto Extraído
            </button>
          </div>
        )}

        {/* Page & Zoom Navigation Controls */}
        <div className="flex items-center gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <button
              onClick={handlePrevPage}
              disabled={!activeFile || activePage <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-700 transition"
              title="Página Anterior"
              aria-label="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs text-slate-300 font-mono">
              <input
                type="number"
                value={activePage}
                onChange={(e) => setActivePage(parseInt(e.target.value) || 1)}
                min={1}
                className="w-10 bg-slate-900 border border-slate-700 text-center rounded py-0.5 text-xs text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{totalPages > 0 ? totalPages : '—'}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={!activeFile || (totalPages > 0 && activePage >= totalPages)}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-700 transition"
              title="Próxima Página"
              aria-label="Próxima Página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls (for PDF view) */}
          {viewMode === 'pdf' && isPdf && (
            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
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

          {/* Open in new tab */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
              title="Abrir PDF em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Search & Meta Bar (When viewing Extracted Text) */}
      {viewMode === 'text' && activeFile && (
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar conteúdo da página..."
                className="w-full bg-slate-800 border border-slate-700/80 rounded-md pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-indigo-400" />
              {docDetail ? `${docDetail.total_chunks} blocos indexados` : 'Carregando...'}
            </span>
            <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
              Página {activePage} de {totalPages}
            </span>
          </div>
        </div>
      )}

      {/* Viewer Body */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-3">
        {isLoadingDoc ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Carregando conteúdo do documento...</span>
          </div>
        ) : activeFile && isPdf && viewMode === 'pdf' ? (
          /* PDF Nativo via Iframe */
          <div className="w-full h-full rounded-lg overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
            <iframe
              key={`${activeFile}-p${activePage}-${zoom}`}
              src={pdfUrl!}
              title={`Visualizador de ${activeFile}`}
              className="w-full h-full border-none"
            />
          </div>
        ) : activeFile && (viewMode === 'text' || !isPdf) ? (
          /* Modo de Leitura de Texto & Chunks da Página */
          <div className="w-full h-full overflow-y-auto pr-1 space-y-3">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">{activeFile}</h4>
                  <p className="text-[10px] text-slate-400">
                    Visualizando fragmentos extraídos da página {activePage}
                  </p>
                </div>
              </div>
            </div>

            {currentPageChunks.length > 0 ? (
              currentPageChunks.map((chunk, idx) => (
                <div
                  key={chunk.chunk_id || idx}
                  className="p-4 bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-indigo-300 pb-1.5 border-b border-slate-800">
                    <span className="font-mono bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/40">
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
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shadow-inner">
              <BookOpen className="w-8 h-8 text-indigo-500/60" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Nenhum Documento Selecionado</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Faça perguntas no chat e clique nas citações retornadas pela IA, ou escolha um documento no seletor acima para inspecionar os textos e páginas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
