import { create } from 'zustand';

interface ViewerState {
  activeFile: string | null;      // arquivoAtivo
  activePage: number;             // paginaAtiva
  totalPages: number;
  zoom: number;
  documents: string[];
  
  // Actions
  setActiveFile: (file: string | null) => void;
  setActivePage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoom: (zoom: number) => void;
  setDocuments: (docs: string[]) => void;
  jumpToCitation: (fileName: string, pageNumber: number) => void;
  resetViewer: () => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  activeFile: null,
  activePage: 1,
  totalPages: 1,
  zoom: 100,
  documents: [],

  setActiveFile: (file) => set({
    activeFile: file,
    activePage: 1,
  }),

  setActivePage: (page) => {
    const { totalPages } = get();
    const validTotal = Math.max(1, totalPages);
    const targetPage = Math.max(1, Math.min(page, validTotal));
    set({ activePage: targetPage });
  },

  setTotalPages: (total) => set({
    totalPages: Math.max(1, total)
  }),

  setZoom: (zoom) => set({
    zoom: Math.min(Math.max(50, zoom), 200)
  }),

  setDocuments: (docs) => set({
    documents: docs
  }),

  jumpToCitation: (fileName, pageNumber) => {
    const validPage = Math.max(1, pageNumber);
    set((state) => ({
      activeFile: fileName,
      activePage: validPage,
      totalPages: Math.max(state.totalPages, validPage)
    }));
  },

  resetViewer: () => set({
    activeFile: null,
    activePage: 1,
    totalPages: 1,
    zoom: 100,
    documents: [],
  }),
}));
