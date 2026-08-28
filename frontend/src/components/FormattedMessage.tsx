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

  // Regex abrangente para capturar qualquer variação de citação inline entre colchetes:
  // Exemplos suportados:
  // - [tcc_pedro.pdf:11, 15] ou [tcc_pedro.pdf:11]
  // - [tcc_pedro.pdf, págs. 11, 15] ou [tcc_pedro.pdf, pág. 11]
  // - [Fonte: tcc_pedro.pdf, pág. 11]
  // - [1:11, 15] ou [1:11] ou [1]
  // - [tcc_pedro.pdf]
  const citationRegex = /\[(?:Fonte:\s*|Doc\s*:?\s*)?([a-zA-Z0-9_\-\. \(\)\/]+?)(?::\s*([^\]]+)|,\s*(?:págs?\.?|p\.?)?\s*([^\]]+))?\]/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(content)) !== null) {
    const rawMatch = match[0];
    const matchStart = match.index;
    const matchEnd = match.index + rawMatch.length;

    const docRef = match[1]?.trim();
    const pageRefRaw = match[2] || match[3];

    // Verifica se docRef se parece com uma referência a documento ou citação
    let resolvedFile: string | null = null;
    let resolvedDocIndex = 1;

    // Caso 1: docRef é um número (ex: [1] ou [1:11, 15])
    if (/^\d+$/.test(docRef)) {
      resolvedDocIndex = parseInt(docRef, 10);
      if (allDocs[resolvedDocIndex - 1]) {
        resolvedFile = allDocs[resolvedDocIndex - 1];
      } else if (citations[resolvedDocIndex - 1]) {
        resolvedFile = citations[resolvedDocIndex - 1].file_name;
      } else if (allDocs.length > 0) {
        resolvedFile = allDocs[0];
      }
    } else {
      // Caso 2: docRef é um nome de arquivo ou termo relacionado
      // Tenta correspondência exata ou parcial com a lista de documentos conhecidos
      const foundInDocs = allDocs.find(
        (d) =>
          d.toLowerCase() === docRef.toLowerCase() ||
          d.toLowerCase().includes(docRef.toLowerCase()) ||
          docRef.toLowerCase().includes(d.toLowerCase())
      );

      if (foundInDocs) {
        resolvedFile = foundInDocs;
        resolvedDocIndex = allDocs.indexOf(foundInDocs) + 1;
      } else {
        // Tenta encontrar nas citations da mensagem
        const foundInCitations = citations.find(
          (c) =>
            c.file_name.toLowerCase() === docRef.toLowerCase() ||
            c.file_name.toLowerCase().includes(docRef.toLowerCase()) ||
            docRef.toLowerCase().includes(c.file_name.toLowerCase())
        );

        if (foundInCitations) {
          resolvedFile = foundInCitations.file_name;
          const idx = allDocs.indexOf(foundInCitations.file_name);
          resolvedDocIndex = idx >= 0 ? idx + 1 : 1;
        } else if (docRef.toLowerCase().endsWith('.pdf') || docRef.toLowerCase().endsWith('.txt')) {
          // Se termina com extensão, assume como arquivo válido
          resolvedFile = docRef;
          resolvedDocIndex = 1;
        }
      }
    }

    // Se identificou um documento, processa a citação inline
    if (resolvedFile) {
      // Adiciona o texto anterior
      if (matchStart > lastIndex) {
        elements.push(content.substring(lastIndex, matchStart));
      }

      // Extrai todos os números de página citados (ex: "11, 15" -> [11, 15])
      const extractedPages = pageRefRaw ? pageRefRaw.match(/\d+/g)?.map(Number) : null;
      let pages: number[] = [];

      if (extractedPages && extractedPages.length > 0) {
        pages = extractedPages;
      } else {
        // Fallback para página nas citations
        const matchingCits = citations.filter(
          (c) => c.file_name.toLowerCase() === resolvedFile!.toLowerCase()
        );
        pages = matchingCits.length > 0 ? matchingCits.map((c) => c.page_number) : [1];
      }

      const firstPage = pages[0] || 1;
      const pagesLabel = pages.length > 1 ? `págs. ${pages.join(', ')}` : `pág. ${firstPage}`;
      const fileNameForJump = resolvedFile;

      elements.push(
        <button
          key={`inline-cit-${matchStart}-${resolvedFile}`}
          type="button"
          data-testid="inline-citation-badge"
          onClick={(e) => {
            e.stopPropagation();
            jumpToCitation(fileNameForJump, firstPage);
          }}
          title={`Doc ${resolvedDocIndex} (${resolvedFile}), ${pagesLabel} - Clique para abrir no visualizador`}
          className="inline-flex items-center justify-center font-mono font-bold text-[9px] sm:text-[10px] bg-indigo-900/90 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/50 rounded px-1.5 py-0.2 mx-0.5 cursor-pointer transition-all shadow-xs align-super"
        >
          {resolvedDocIndex}
        </button>
      );

      lastIndex = matchEnd;
    }
  }

  // Adiciona o restante do texto após a última citação
  if (lastIndex < content.length) {
    elements.push(content.substring(lastIndex));
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{elements.length > 0 ? elements : content}</p>;
};
