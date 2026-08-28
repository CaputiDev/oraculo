'use client';

import React, { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Citation } from '../types';
import { CitationBalloon } from './CitationBalloon';
import { useViewerStore } from '../store/useViewerStore';

interface MessageCitationsProps {
  citations: Citation[];
}

interface GroupedCitation {
  fileName: string;
  docIndex: number;
  pages: { pageNumber: number; snippet?: string }[];
}

export const MessageCitations: React.FC<MessageCitationsProps> = ({ citations }) => {
  const documents = useViewerStore((state) => state.documents);

  // Agrupa citações por nome de arquivo, vinculando a ordem de adição do documento (1, 2...)
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

    return Array.from(map.entries()).map(([fileName, pageMap]) => {
      const idxInDocs = documents.indexOf(fileName);
      const docIndex = idxInDocs >= 0 ? idxInDocs + 1 : 1;

      return {
        fileName,
        docIndex,
        pages: Array.from(pageMap.entries())
          .map(([pageNumber, snippet]) => ({ pageNumber, snippet }))
          .sort((a, b) => a.pageNumber - b.pageNumber),
      };
    }).sort((a, b) => a.docIndex - b.docIndex);
  }, [citations, documents]);

  // Sempre recolhido por padrão conforme solicitado
  const [isMainExpanded, setIsMainExpanded] = useState(false);

  if (groupedCitations.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-700/60 select-none">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIsMainExpanded(!isMainExpanded)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition bg-slate-800/80 hover:bg-slate-700/80 px-2 py-1 rounded-lg border border-slate-700/80 cursor-pointer shadow-xs"
          data-testid="toggle-citations-button"
          aria-expanded={isMainExpanded}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Fontes ({groupedCitations.length})</span>
          {isMainExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-indigo-300 ml-0.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />
          )}
        </button>
      </div>

      {/* Balõezinhos de Citação (Exibidos quando expandido) */}
      {isMainExpanded && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 animate-in fade-in duration-150" data-testid="citations-container">
          {groupedCitations.map((group) => (
            <CitationBalloon
              key={group.fileName}
              docIndex={group.docIndex}
              fileName={group.fileName}
              pages={group.pages}
            />
          ))}
        </div>
      )}
    </div>
  );
};
