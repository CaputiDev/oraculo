import { useConversationStore } from '../src/store/useConversationStore';

describe('useConversationStore - Zustand Store', () => {
  beforeEach(() => {
    useConversationStore.getState().resetConversationStore();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('deve inicializar com estado padrão vazio e barra lateral recolhida por padrão', () => {
    const state = useConversationStore.getState();
    expect(state.conversations).toEqual([]);
    expect(state.activeConversationId).toBeNull();
    expect(state.activeConversation).toBeNull();
    expect(state.isSidebarOpen).toBe(false);
  });

  it('deve alternar a visibilidade da barra lateral', () => {
    expect(useConversationStore.getState().isSidebarOpen).toBe(false);
    useConversationStore.getState().toggleSidebar();
    expect(useConversationStore.getState().isSidebarOpen).toBe(true);
    useConversationStore.getState().setSidebarOpen(false);
    expect(useConversationStore.getState().isSidebarOpen).toBe(false);
  });

  it('deve criar uma nova conversa e defini-la como ativa', async () => {
    const mockNewConv = {
      id: 'conv-12345',
      title: 'Conversa de Teste',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewConv,
    });

    const createdId = await useConversationStore.getState().createConversation('Conversa de Teste');

    expect(createdId).toBe('conv-12345');
    const state = useConversationStore.getState();
    expect(state.activeConversationId).toBe('conv-12345');
    expect(state.conversations.length).toBe(1);
    expect(state.conversations[0].id).toBe('conv-12345');
  });

  it('deve anexar mensagens à conversa ativa', () => {
    useConversationStore.setState({
      activeConversationId: 'conv-1',
      activeConversation: {
        id: 'conv-1',
        title: 'Conversa Ativa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        files: [],
        messages: [],
      },
    });

    const message = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Olá Oráculo',
      timestamp: new Date().toISOString(),
    };

    useConversationStore.getState().appendMessageToActive(message);

    const state = useConversationStore.getState();
    expect(state.activeConversation?.messages.length).toBe(1);
    expect(state.activeConversation?.messages[0].content).toBe('Olá Oráculo');
  });

  it('deve adicionar arquivos à conversa ativa sem duplicatas', () => {
    useConversationStore.setState({
      activeConversationId: 'conv-1',
      activeConversation: {
        id: 'conv-1',
        title: 'Conversa Ativa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        files: ['doc1.pdf'],
        messages: [],
      },
    });

    useConversationStore.getState().addFileToActive('doc2.pdf');
    expect(useConversationStore.getState().activeConversation?.files).toEqual(['doc1.pdf', 'doc2.pdf']);

    // Tentar adicionar duplicado
    useConversationStore.getState().addFileToActive('doc1.pdf');
    expect(useConversationStore.getState().activeConversation?.files).toEqual(['doc1.pdf', 'doc2.pdf']);
  });

  it('deve excluir uma conversa da lista', async () => {
    useConversationStore.setState({
      conversations: [
        {
          id: 'conv-1',
          title: 'Conv 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0,
          file_count: 0,
        },
      ],
      activeConversationId: 'conv-1',
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await useConversationStore.getState().deleteConversation('conv-1');

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(0);
    expect(state.activeConversationId).toBeNull();
  });
});
