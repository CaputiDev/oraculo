'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Bookmark, ExternalLink, Sparkles } from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';

interface PageCitation {
  pageNumber: number;
  snippet?: string;
}

interface CitationBalloonProps {
  docIndex: number;
  fileName: string;
  pages: PageCitation[];
}

export const CitationBalloon: React.FC<CitationBalloonProps> = ({
  docIndex,
  fileName,
  pages,
}) => {
  const jumpToCitation = useViewerStore((state) => state.jumpToCitation);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o balão se clicar fora (para mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    e.stopPropagation();
    jumpToCitation(fileName, pageNumber);
    setIsOpen(false);
  };

  const handleMainBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // No mobile ou clique direto, abre a primeira página ou alterna o balão
    if (pages.length === 1) {
      jumpToCitation(fileName, pages[0].pageNumber);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const isMultiPage = pages.length > 1;
  const pageLabel = isMultiPage 
    ? `${pages.length} págs` 
    : `pág. ${pages[0]?.pageNumber || 1}`;

  return (
    <div
      ref={containerRef}
      data-testid={`citation-balloon-container-${docIndex}`}
      className="relative inline-block my-0.5 mx-1"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Balãozinho / Badge Principal com o Número do Documento */}
      <button
        type="button"
        data-testid={`citation-balloon-btn-${docIndex}`}
        onClick={handleMainBadgeClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`Doc ${docIndex}: ${fileName} (${pageLabel})`}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-lg
                   border transition-all duration-200 cursor-pointer shadow-sm select-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   ${
                     isOpen
                       ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-950/40'
                       : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200 hover:bg-indigo-900 hover:border-indigo-400 hover:text-white'
                   }`}
      >
        <span className="bg-indigo-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full border border-indigo-400/40 shadow-xs min-w-[18px] text-center">
          {docIndex}
        </span>
        <span className="font-semibold truncate max-w-[120px] sm:max-w-[150px]">
          {fileName}
        </span>
        <span className="text-[10px] text-indigo-300 font-mono">
          {pageLabel}
        </span>
      </button>

      {/* Balão Flutuante (Popover) com Detalhes das Páginas e Snippets */}
      {isOpen && (
        <div
          data-testid={`citation-balloon-popover-${docIndex}`}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 sm:w-72 bg-slate-900/98 backdrop-blur-md border border-indigo-500/50 rounded-xl p-3 shadow-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Cabeçalho do Balão */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="bg-indigo-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                {docIndex}
              </span>
              <span className="text-xs font-bold text-slate-100 truncate" title={fileName}>
                {fileName}
              </span>
            </div>
            <span className="text-[10px] text-indigo-300 font-mono flex-shrink-0">
              {pages.length} {pages.length === 1 ? 'pág' : 'págs'}
            </span>
          </div>

          {/* Lista de Páginas Citadas */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {pages.map((p, idx) => (
              <div
                key={`${fileName}-${p.pageNumber}-${idx}`}
                onClick={(e) => handlePageClick(e, p.pageNumber)}
                className="group/item p-2 rounded-lg bg-slate-950/80 hover:bg-indigo-950/60 border border-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer space-y-1"
                data-testid={`balloon-page-jump-${p.pageNumber}`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                  <span className="flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-indigo-400" />
                    Página {p.pageNumber}
                  </span>
                  <span className="text-[10px] text-indigo-400 group-hover/item:text-white flex items-center gap-0.5">
                    Ver <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </div>
                {p.snippet && (
                  <p className="text-[10px] text-slate-400 group-hover/item:text-slate-300 line-clamp-2 leading-relaxed italic">
                    "{p.snippet}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Seta do Balão */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2.5 h-2.5 bg-slate-900 border-b border-r border-indigo-500/50 rotate-45" />
        </div>
      )}
    </div>
  );
};
