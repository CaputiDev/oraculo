'use client';

import React from 'react';
import { FileText, Bookmark } from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';

interface CitationBadgeProps {
  fileName: string;
  pageNumber: number;
  snippet?: string;
  onClick?: () => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  fileName,
  pageNumber,
  snippet,
  onClick,
}) => {
  const jumpToCitation = useViewerStore((state) => state.jumpToCitation);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      jumpToCitation(fileName, pageNumber);
    }
  };

  return (
    <button
      type="button"
      data-testid="citation-badge"
      onClick={handleClick}
      title={snippet ? `"${snippet}"` : `Ir para ${fileName} (Pág. ${pageNumber})`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 mx-1 text-xs font-medium rounded-md
                 bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-800/80 
                 hover:border-indigo-400 hover:text-white transition-all duration-200 cursor-pointer shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 group"
    >
      <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-200 transition-colors" />
      <span className="truncate max-w-[140px] font-semibold">{fileName}</span>
      <span className="bg-indigo-700/60 px-1.5 py-0.2 rounded text-[10px] text-indigo-100 font-mono">
        pág. {pageNumber}
      </span>
      <Bookmark className="w-3 h-3 text-indigo-400/70 group-hover:text-indigo-300 ml-0.5" />
    </button>
  );
};
