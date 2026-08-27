import { useViewerStore } from '../src/store/useViewerStore';

describe('useViewerStore - Zustand Store', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
  });

  it('deve inicializar com valores padrões', () => {
    const state = useViewerStore.getState();
    expect(state.activeFile).toBeNull();
    expect(state.activePage).toBe(1);
    expect(state.totalPages).toBe(1);
    expect(state.documents).toEqual([]);
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

  it('deve executar jumpToCitation atualizando arquivo e página simultaneamente', () => {
    useViewerStore.getState().jumpToCitation('relatorio_anual.pdf', 7);
    
    const state = useViewerStore.getState();
    expect(state.activeFile).toBe('relatorio_anual.pdf');
    expect(state.activePage).toBe(7);
  });

  it('deve registrar lista de documentos disponíveis', () => {
    const docs = ['doc1.pdf', 'doc2.pdf'];
    useViewerStore.getState().setDocuments(docs);
    expect(useViewerStore.getState().documents).toEqual(docs);
  });
});
