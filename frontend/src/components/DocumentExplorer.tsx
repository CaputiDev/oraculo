'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  FileCode, 
  FolderOpen, 
  ArrowUpDown, 
  Search, 
  Plus, 
  ArrowRight,
  BookOpen,
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';
import { useConversationStore } from '../store/useConversationStore';

interface DocumentExplorerProps {
  documents: string[];
  onSelectDocument?: (fileName: string) => void;
  apiBaseUrl?: string;
}

type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc';
type AddTab = 'pdf' | 'text';

export const DocumentExplorer: React.FC<DocumentExplorerProps> = ({
  documents,
  onSelectDocument,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
}) => {
  const setActiveFile = useViewerStore((state) => state.setActiveFile);
  const {
    activeConversationId,
    createConversation,
    addFileToActive,
    fetchConversations,
  } = useConversationStore();

  const [currentView, setCurrentView] = useState<'list' | 'add'>('list');
  const [addTab, setAddTab] = useState<AddTab>('pdf');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Add documents form states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [freeText, setFreeText] = useState('');
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (fileName: string) => {
    if (onSelectDocument) {
      onSelectDocument(fileName);
    } else {
      setActiveFile(fileName);
    }
  };

  // Upload de PDFs
  const handlePdfUpload = async (filesToUpload: FileList | File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setUploadFeedback({
        type: 'error',
        message: 'Apenas arquivos em formato PDF (.pdf) são aceitos.',
      });
      return;
    }

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = await createConversation('Conversa com Documentos', apiBaseUrl);
    }

    setIsUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    for (let i = 0; i < validFiles.length; i++) {
      formData.append('files', validFiles[i]);
    }
    formData.append('conversation_id', targetConvId);

    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(targetConvId)}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback({
          type: 'success',
          message: `Sucesso! ${data.total_processed} arquivo(s) PDF indexado(s) nesta conversa.`,
        });
        for (let i = 0; i < validFiles.length; i++) {
          addFileToActive(validFiles[i].name);
        }
        fetchConversations(apiBaseUrl);
      } else {
        setUploadFeedback({
          type: 'error',
          message: 'Erro durante o processamento dos arquivos.',
        });
      }
    } catch (err: any) {
      setUploadFeedback({
        type: 'error',
        message: `Erro no upload: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Upload de Texto Livre
  const handleTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeText.trim() || isUploading) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = await createConversation(freeTextTitle || 'Texto Livre', apiBaseUrl);
    }

    setIsUploading(true);
    setUploadFeedback(null);

    const docTitle = freeTextTitle.trim() || 'Texto Livre';

    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(targetConvId)}/upload-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: freeText.trim(),
          title: docTitle,
          conversation_id: targetConvId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUploadFeedback({
          type: 'success',
          message: `Texto '${data.file_name}' indexado com sucesso nesta conversa!`,
        });
        addFileToActive(docTitle);
        setFreeText('');
        setFreeTextTitle('');
        fetchConversations(apiBaseUrl);
      } else {
        setUploadFeedback({
          type: 'error',
          message: 'Erro ao indexar texto.',
        });
      }
    } catch (err: any) {
      setUploadFeedback({
        type: 'error',
        message: `Erro: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Documentos ordenados e filtrados
  const filteredAndSortedDocs = useMemo(() => {
    let docsWithIndex = documents.map((doc, index) => ({
      name: doc,
      originalIndex: index,
      isPdf: doc.toLowerCase().endsWith('.pdf'),
    }));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docsWithIndex = docsWithIndex.filter((d) => d.name.toLowerCase().includes(term));
    }

    switch (sortBy) {
      case 'recent':
        return [...docsWithIndex].reverse();
      case 'oldest':
        return [...docsWithIndex];
      case 'name-asc':
        return [...docsWithIndex].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      case 'name-desc':
        return [...docsWithIndex].sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
      default:
        return docsWithIndex;
    }
  }, [documents, searchTerm, sortBy]);

  // TELA 2: FORMULÁRIO DE ADICIONAR DOCUMENTOS (PDF OU TEXTO LIVRE)
  if (currentView === 'add') {
    return (
      <div className="w-full h-full flex flex-col overflow-y-auto p-4 sm:p-6 select-none max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150">
        {/* Header com botão de voltar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <button
            onClick={() => {
              setCurrentView('list');
              setUploadFeedback(null);
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-200 transition bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg cursor-pointer font-medium"
            data-testid="back-to-docs-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar aos Documentos</span>
          </button>

          {/* Sub-tabs PDF / Texto */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setAddTab('pdf')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                addTab === 'pdf'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => setAddTab('text')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                addTab === 'text'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Texto Livre</span>
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba PDF */}
        {addTab === 'pdf' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  handlePdfUpload(e.dataTransfer.files);
                }
              }}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 sm:p-10 text-center transition-all bg-slate-900/60 flex flex-col items-center justify-center group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handlePdfUpload(e.target.files)}
                multiple
                accept="application/pdf"
                className="hidden"
                id="explorer-pdf-upload"
              />
              <label
                htmlFor="explorer-pdf-upload"
                className="cursor-pointer flex flex-col items-center space-y-3 w-full"
              >
                <div className="p-3.5 bg-indigo-600/20 group-hover:bg-indigo-600/30 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner transition-all">
                  <Upload className="w-7 h-7" />
                </div>
                <span className="text-sm sm:text-base font-semibold text-slate-200">
                  Clique ou arraste arquivos PDF aqui
                </span>
                <span className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Os documentos serão processados e indexados exclusivamente nesta conversa.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba Texto Livre */}
        {addTab === 'text' && (
          <form onSubmit={handleTextUpload} className="space-y-4">
            <div className="transition-all duration-200">
              <label 
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 transition-colors flex items-center justify-between ${
                  isTitleFocused || freeTextTitle.trim() ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                <span>Título do Documento / Nota</span>
                <span className="text-[10px] lowercase font-normal italic text-slate-500">(opcional)</span>
              </label>
              <input
                type="text"
                value={freeTextTitle}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
                onChange={(e) => setFreeTextTitle(e.target.value)}
                placeholder="Ex: Resumo de Diretrizes"
                className={`w-full bg-slate-900 border text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition-all duration-200 ${
                  isTitleFocused || freeTextTitle.trim()
                    ? 'opacity-100 border-indigo-500/70 ring-1 ring-indigo-500/40'
                    : 'opacity-40 hover:opacity-75 border-slate-800 placeholder-slate-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Conteúdo de Texto
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={6}
                placeholder="Cole ou digite o texto a ser incorporado à base de conhecimento desta conversa..."
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs sm:text-sm rounded-xl p-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isUploading || !freeText.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Texto aos Documentos</span>
            </button>
          </form>
        )}

        {/* Loading e Feedback */}
        {isUploading && (
          <div className="flex items-center justify-center gap-2 p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-xl text-indigo-200 text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Processando e indexando documentos...</span>
          </div>
        )}

        {uploadFeedback && (
          <div
            className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border ${
              uploadFeedback.type === 'success'
                ? 'bg-slate-900 border-slate-800 text-slate-200'
                : 'bg-red-950/60 border-red-800/60 text-red-200'
            }`}
          >
            {uploadFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
            )}
            <span>{uploadFeedback.message}</span>
          </div>
        )}
      </div>
    );
  }

  // TELA 1: LISTAGEM DE DOCUMENTOS / EMPTY STATE
  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-3 sm:p-6 select-none max-w-4xl mx-auto">
      {/* Botão Superior "Adicionar Documentos" */}
      <div className="mb-4 flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">Documentos da Conversa</h3>
          {documents.length > 0 && (
            <span className="bg-indigo-950 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-mono border border-indigo-700/40">
              {documents.length} {documents.length === 1 ? 'arquivo' : 'arquivos'}
            </span>
          )}
        </div>

        <button
          onClick={() => {
            setCurrentView('add');
            setUploadFeedback(null);
          }}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-950/50 cursor-pointer"
          data-testid="add-documents-btn"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar Documentos</span>
        </button>
      </div>

      {documents.length === 0 ? (
        /* Empty State */
        <div 
          data-testid="no-documents-view"
          className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4 max-w-sm mx-auto"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
            <BookOpen className="w-8 h-8 text-indigo-500/50" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">
              Nenhum documento adicionado
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Esta conversa ainda não possui documentos indexados. Clique no botão acima para adicionar arquivos PDF ou notas de texto.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Controles de Filtro e Ordenação */}
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar documentos por nome..."
                data-testid="search-doc-input"
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl pl-9 pr-4 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs text-slate-300 flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 ml-1" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                data-testid="sort-select"
                aria-label="Ordenar documentos por"
                className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="recent" className="bg-slate-900 text-slate-200">Adicionados Recentemente</option>
                <option value="oldest" className="bg-slate-900 text-slate-200">Mais Antigos Primeiro</option>
                <option value="name-asc" className="bg-slate-900 text-slate-200">Nome (A - Z)</option>
                <option value="name-desc" className="bg-slate-900 text-slate-200">Nome (Z - A)</option>
              </select>
            </div>
          </div>

          {/* Grid Responsivo de Documentos */}
          <div 
            data-testid="documents-grid"
            className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start pb-4"
          >
            {filteredAndSortedDocs.length > 0 ? (
              filteredAndSortedDocs.map((doc) => (
                <div
                  key={doc.name}
                  data-testid={`doc-card-${doc.name}`}
                  onClick={() => handleSelect(doc.name)}
                  className="group p-3.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition-all shadow-sm flex flex-col justify-between cursor-pointer space-y-3 hover:shadow-indigo-950/20"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      doc.isPdf 
                        ? 'bg-red-950/40 border border-red-800/40 text-red-400 group-hover:bg-red-900/40' 
                        : 'bg-indigo-950/40 border border-indigo-700/40 text-indigo-400 group-hover:bg-indigo-900/40'
                    }`}>
                      {doc.isPdf ? <FileText className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white truncate" title={doc.name}>
                        {doc.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {doc.isPdf ? 'Documento PDF' : 'Nota de Texto Livre'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-indigo-400 group-hover:text-indigo-300 font-medium">
                    <span>Clique para abrir</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">
                  Nenhum documento encontrado para "{searchTerm}".
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
