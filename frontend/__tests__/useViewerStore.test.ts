import { useViewerStore } from '../src/store/useViewerStore';

describe('useViewerStore - Zustand Store', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
  });

  it('deve inicializar com valores padrões e painel recolhido por padrão', () => {
    const state = useViewerStore.getState();
    expect(state.activeFile).toBeNull();
    expect(state.activePage).toBe(1);
    expect(state.totalPages).toBe(1);
    expect(state.documents).toEqual([]);
    expect(state.isViewerOpen).toBe(false);
  });

  it('deve atualizar o arquivo ativo corretamente', () => {
    useViewerStore.getState().setActiveFile('manual_usuario.pdf');
    expect(useViewerStore.getState().activeFile).toBe('manual_usuario.pdf');
    expect(useViewerStore.getState().activePage).toBe(1);
  });

  it('deve atualizar a página ativa respeitando limites', () => {
    useViewerStore.getState().setTotalPages(10);
    useViewerStore.getState().setActivePage(5);
    expect(useViewerStore.getState().activePage).toBe(5);

    // Deve ignorar página menor que 1
    useViewerStore.getState().setActivePage(0);
    expect(useViewerStore.getState().activePage).toBe(1);
  });

  it('deve executar jumpToCitation atualizando arquivo, página e abrindo o visualizador', () => {
    expect(useViewerStore.getState().isViewerOpen).toBe(false);
    useViewerStore.getState().jumpToCitation('relatorio_anual.pdf', 7);
    
    const state = useViewerStore.getState();
    expect(state.activeFile).toBe('relatorio_anual.pdf');
    expect(state.activePage).toBe(7);
    expect(state.isViewerOpen).toBe(true);
  });

  it('deve alternar a visibilidade do visualizador', () => {
    expect(useViewerStore.getState().isViewerOpen).toBe(false);
    useViewerStore.getState().toggleViewer();
    expect(useViewerStore.getState().isViewerOpen).toBe(true);
    useViewerStore.getState().setViewerOpen(false);
    expect(useViewerStore.getState().isViewerOpen).toBe(false);
  });

  it('deve registrar lista de documentos disponíveis', () => {
    const docs = ['doc1.pdf', 'doc2.pdf'];
    useViewerStore.getState().setDocuments(docs);
    expect(useViewerStore.getState().documents).toEqual(docs);
  });
});
