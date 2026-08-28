'use client';

import React from 'react';
import { useViewerStore } from '../store/useViewerStore';
import { Citation } from '../types';

interface FormattedMessageProps {
  content: string;
  citations?: Citation[];
  documents?: string[];
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  citations = [],
  documents = [],
}) => {
  const jumpToCitation = useViewerStore((state) => state.jumpToCitation);
  const storeDocs = useViewerStore((state) => state.documents);
  const allDocs = documents.length > 0 ? documents : storeDocs;

  // Regex para capturar marcações como [arquivo.pdf:3], [1:3], [Fonte: arquivo.pdf, pág. 3] ou [1]
  // Grupos possíveis:
  // - [doc_name:page]
  // - [doc_num:page]
  // - [Fonte: doc_name, pág. X]
  // - [doc_num]
  const citationRegex = /\[(?:Fonte:\s*)?([a-zA-Z0-9_\-\. \(\)]+?)(?::\s*(\d+)|,\s*(?:pág\.?|p\.?)?\s*(\d+))?\]/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(content)) !== null) {
    const rawMatch = match[0];
    const matchStart = match.index;
    const matchEnd = match.index + rawMatch.length;

    // Adiciona texto anterior à citação
    if (matchStart > lastIndex) {
      elements.push(content.substring(lastIndex, matchStart));
    }

    const docRef = match[1]?.trim();
    const pageRef = match[2] || match[3];

    let resolvedFile: string | null = null;
    let resolvedDocIndex = 1;
    let resolvedPage = pageRef ? parseInt(pageRef, 10) : 1;

    // Caso 1: docRef é um número (ex: [1] ou [1:3])
    if (/^\d+$/.test(docRef)) {
      resolvedDocIndex = parseInt(docRef, 10);
      if (allDocs[resolvedDocIndex - 1]) {
        resolvedFile = allDocs[resolvedDocIndex - 1];
      } else if (citations[resolvedDocIndex - 1]) {
        resolvedFile = citations[resolvedDocIndex - 1].file_name;
      }
    } else {
      // Caso 2: docRef é um nome de arquivo (ex: [relatorio.pdf:3])
      resolvedFile = docRef;
      const docIdx = allDocs.indexOf(docRef);
      resolvedDocIndex = docIdx >= 0 ? docIdx + 1 : 1;
    }

    // Se não encontrou a página no match, busca nas citations da mensagem
    if (!pageRef && resolvedFile) {
      const foundCit = citations.find(
        (c) => c.file_name.toLowerCase() === resolvedFile!.toLowerCase()
      );
      if (foundCit) {
        resolvedPage = foundCit.page_number;
      }
    }

    if (resolvedFile) {
      const fileNameForJump = resolvedFile;
      const targetPage = resolvedPage;

      elements.push(
        <button
          key={`inline-cit-${matchStart}`}
          type="button"
          data-testid="inline-citation-badge"
          onClick={(e) => {
            e.stopPropagation();
            jumpToCitation(fileNameForJump, targetPage);
          }}
          title={`Doc ${resolvedDocIndex} (${resolvedFile}), Página ${resolvedPage} - Clique para abrir no visualizador`}
          className="inline-flex items-center justify-center font-mono font-bold text-[9px] sm:text-[10px] bg-indigo-900/90 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/50 rounded px-1 py-0.2 mx-0.5 cursor-pointer transition-all shadow-xs align-super"
        >
          {resolvedDocIndex}
        </button>
      );
    } else {
      // Se não for uma citação resolvida, mantém o texto original
      elements.push(rawMatch);
    }

    lastIndex = matchEnd;
  }

  // Adiciona o restante do texto após a última citação
  if (lastIndex < content.length) {
    elements.push(content.substring(lastIndex));
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{elements.length > 0 ? elements : content}</p>;
};
