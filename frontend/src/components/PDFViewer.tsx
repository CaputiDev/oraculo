'use client';

import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  ExternalLink,
  BookOpen,
  EyeOff
} from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';

interface PDFViewerProps {
  apiBaseUrl?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  apiBaseUrl = process.env.NEXT_PUBLIC_UPLOADS_URL || 'http://localhost:8000/uploads',
}) => {
  const { 
    activeFile, 
    activePage, 
    totalPages, 
    zoom, 
    documents,
    setActivePage, 
    setActiveFile, 
    setZoom 
  } = useViewerStore();

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

  // Se o arquivo for um PDF do servidor, monta o link com âncora de página
  const isPdf = activeFile?.toLowerCase().endsWith('.pdf');
  const fileUrl = isPdf ? `${apiBaseUrl}/${encodeURIComponent(activeFile!)}#page=${activePage}&zoom=${zoom}` : null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Viewer Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shadow-sm">
        {/* Document Info & Switcher */}
        <div className="flex items-center gap-2 max-w-[40%]">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          {documents.length > 0 ? (
            <select
              value={activeFile || ''}
              onChange={(e) => setActiveFile(e.target.value || null)}
              className="bg-slate-800 text-slate-200 text-xs rounded-md border border-slate-700 px-2 py-1 font-medium truncate focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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

        {/* Page & Zoom Navigation Controls */}
        <div className="flex items-center gap-4">
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
              <span className="text-slate-400">{totalPages > 1 ? totalPages : '—'}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={!activeFile}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-700 transition"
              title="Próxima Página"
              aria-label="Próxima Página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-300 font-mono px-1 min-w-[36px] text-center">
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

          {/* Open in new tab */}
          {fileUrl && (
            <a
              href={fileUrl}
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

      {/* Viewer Body */}
      <div className="flex-1 relative bg-slate-950/80 overflow-hidden flex items-center justify-center p-2">
        {activeFile && isPdf ? (
          <div className="w-full h-full rounded-lg overflow-hidden border border-slate-800 shadow-2xl bg-white">
            <iframe
              key={`${activeFile}-p${activePage}-${zoom}`}
              src={fileUrl!}
              title={`Visualizador de ${activeFile}`}
              className="w-full h-full border-none"
            />
          </div>
        ) : activeFile && !isPdf ? (
          /* Visualização de Texto Livre */
          <div className="max-w-xl w-full p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <BookOpen className="w-5 h-5" />
              <span>Documento de Texto Livre: {activeFile}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Este registro foi adicionado através de texto livre na base de conhecimento. As citações apontam para os trechos indexados deste documento.
            </p>
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
                Ao fazer uma pergunta no chat e clicar nas citações retornadas pela IA, a página exata do documento será aberta aqui automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
