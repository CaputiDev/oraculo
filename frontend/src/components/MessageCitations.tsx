'use client';

import React, { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronUp, Layers, Bookmark } from 'lucide-react';
import { Citation } from '../types';
import { CitationBadge } from './CitationBadge';
import { useViewerStore } from '../store/useViewerStore';

interface MessageCitationsProps {
  citations: Citation[];
}

interface GroupedCitation {
  fileName: string;
  pages: { pageNumber: number; snippet?: string }[];
}

export const MessageCitations: React.FC<MessageCitationsProps> = ({ citations }) => {
  const jumpToCitation = useViewerStore((state) => state.jumpToCitation);

  // Agrupa citações por nome de arquivo e desduplica páginas
  const groupedCitations: GroupedCitation[] = useMemo(() => {
    if (!citations || citations.length === 0) return [];

    const map = new Map<string, Map<number, string | undefined>>();

    citations.forEach((cit) => {
      if (!map.has(cit.file_name)) {
        map.set(cit.file_name, new Map());
      }
      const pageMap = map.get(cit.file_name)!;
      if (!pageMap.has(cit.page_number)) {
        pageMap.set(cit.page_number, cit.snippet);
      }
    });

    return Array.from(map.entries()).map(([fileName, pageMap]) => ({
      fileName,
      pages: Array.from(pageMap.entries())
        .map(([pageNumber, snippet]) => ({ pageNumber, snippet }))
        .sort((a, b) => a.pageNumber - b.pageNumber),
    }));
  }, [citations]);

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const isLongList = groupedCitations.length > 2;
  const [isMainExpanded, setIsMainExpanded] = useState(!isLongList);

  if (groupedCitations.length === 0) return null;

  const toggleDocPages = (fileName: string) => {
    setExpandedDoc((prev) => (prev === fileName ? null : fileName));
  };

  const renderGroupItem = (group: GroupedCitation) => {
    const isSinglePage = group.pages.length === 1;

    if (isSinglePage) {
      const page = group.pages[0];
      return (
        <CitationBadge
          key={`${group.fileName}-${page.pageNumber}`}
          fileName={group.fileName}
          pageNumber={page.pageNumber}
          snippet={page.snippet}
        />
      );
    }

    const isDocExpanded = expandedDoc === group.fileName;

    return (
      <div key={group.fileName} className="inline-flex flex-col relative my-0.5 mx-1">
        {/* Badge do Documento Agrupado */}
        <button
          type="button"
          onClick={() => toggleDocPages(group.fileName)}
          data-testid={`grouped-doc-${group.fileName}`}
          title={`Clique para ver as ${group.pages.length} páginas citadas em ${group.fileName}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md
                     border transition-all duration-200 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                     ${
                       isDocExpanded
                         ? 'bg-indigo-800 border-indigo-400 text-white shadow-indigo-950/40'
                         : 'bg-indigo-950/70 border-indigo-500/40 text-indigo-200 hover:bg-indigo-800/80 hover:border-indigo-400 hover:text-white'
                     }`}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span className="truncate max-w-[140px] font-semibold">{group.fileName}</span>
          <span className="bg-indigo-700/70 px-1.5 py-0.2 rounded text-[10px] text-indigo-100 font-mono flex items-center gap-1">
            <Layers className="w-2.5 h-2.5 text-indigo-300" />
            {group.pages.length} págs
          </span>
          {isDocExpanded ? (
            <ChevronUp className="w-3 h-3 text-indigo-300" />
          ) : (
            <ChevronDown className="w-3 h-3 text-indigo-400" />
          )}
        </button>

        {/* Submenu com as páginas específicas ao clicar */}
        {isDocExpanded && (
          <div
            data-testid={`pages-dropdown-${group.fileName}`}
            className="flex flex-wrap gap-1 mt-1.5 p-1.5 bg-slate-900/95 border border-indigo-500/50 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150 z-20"
          >
            <span className="text-[10px] text-slate-400 font-semibold w-full px-1 flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-indigo-400" />
              Páginas citadas:
            </span>
            {group.pages.map((p) => (
              <button
                key={`${group.fileName}-p${p.pageNumber}`}
                type="button"
                data-testid={`page-btn-${group.fileName}-${p.pageNumber}`}
                onClick={(e) => {
                  e.stopPropagation();
                  jumpToCitation(group.fileName, p.pageNumber);
                }}
                title={p.snippet ? `"${p.snippet}"` : `Ir para página ${p.pageNumber}`}
                className="px-2 py-0.5 bg-indigo-950 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded border border-indigo-700/60 hover:border-indigo-400 text-[11px] font-mono transition-all cursor-pointer shadow-sm"
              >
                Pág. {p.pageNumber}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const displayedGroups = isMainExpanded ? groupedCitations : groupedCitations.slice(0, 2);

  return (
    <div className="mt-3 pt-2 border-t border-slate-700/60 select-none">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-[10px] sm:text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>Documentos Citados ({groupedCitations.length}):</span>
        </div>

        {isLongList && (
          <button
            onClick={() => setIsMainExpanded(!isMainExpanded)}
            className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-indigo-400 hover:text-indigo-200 transition bg-slate-800/90 hover:bg-slate-700/90 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
            aria-expanded={isMainExpanded}
            data-testid="toggle-citations-button"
          >
            <span>{isMainExpanded ? 'Recolher' : `Expandir (${groupedCitations.length})`}</span>
            {isMainExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Lista de Grupos */}
      <div className="flex flex-wrap items-start gap-1.5" data-testid="citations-container">
        {displayedGroups.map(renderGroupItem)}

        {!isMainExpanded && groupedCitations.length > 2 && (
          <button
            onClick={() => setIsMainExpanded(true)}
            className="text-[10px] text-indigo-300 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 rounded px-2 py-1 my-0.5 cursor-pointer transition font-mono shadow-sm flex items-center gap-1"
            title="Expandir todos os documentos"
            data-testid="expand-more-citations"
          >
            +{groupedCitations.length - 2} mais
          </button>
        )}
      </div>
    </div>
  );
};
