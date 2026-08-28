import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ChatArea } from '../src/components/ChatArea';
import { useViewerStore } from '../src/store/useViewerStore';
import { useConversationStore } from '../src/store/useConversationStore';
import { ChatMessage } from '../src/types';

describe('ChatArea Component & Citation Integration', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
    useConversationStore.getState().resetConversationStore();
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/conversations')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'conv-default',
            title: 'Conversa Teste',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            files: [],
            messages: [],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('deve renderizar a área de chat vazia com formulário de envio', async () => {
    await act(async () => {
      render(<ChatArea />);
    });
    expect(screen.getByPlaceholderText(/pergunte algo sobre os documentos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('deve atualizar o useViewerStore ao clicar no CitationBadge dentro de uma mensagem', async () => {
    const initialMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Conforme documentado no relatório técnico:',
        citations: [
          {
            file_name: 'especificacao.pdf',
            page_number: 4,
            snippet: 'Requisitos de arquitetura limpa e testes automatizados.'
          }
        ],
        timestamp: new Date().toISOString()
      }
    ];

    await act(async () => {
      render(<ChatArea initialMessages={initialMessages} />);
    });

    // Expande o footer de fontes que inicia recolhido por padrão
    const toggleButton = screen.getByTestId('toggle-citations-button');
    expect(toggleButton).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    // Verifica se a citação está na tela com o número do documento
    const citationButton = screen.getByTestId('citation-balloon-btn-1');
    expect(citationButton).toBeInTheDocument();
    expect(citationButton).toHaveTextContent('especificacao.pdf');
    expect(citationButton).toHaveTextContent('pág. 4');

    // Clica na citação
    await act(async () => {
      fireEvent.click(citationButton);
    });

    // Valida se a Store global foi sincronizada com os metadados do documento
    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('especificacao.pdf');
    expect(storeState.activePage).toBe(4);
  });

  it('deve permitir submeter uma nova pergunta e exibir o retorno da API', async () => {
    const mockApiResponse = {
      answer: 'Esta é a resposta simulada do RAG com Gemini.',
      citations: [
        {
          file_name: 'manual.pdf',
          page_number: 2,
          snippet: 'Configurações de rede.'
        }
      ]
    };

    useConversationStore.setState({
      activeConversationId: 'conv-test-1',
      activeConversation: {
        id: 'conv-test-1',
        title: 'Conversa Ativa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        files: [],
        messages: [],
      },
    });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockApiResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ documents: [] }),
      });
    });

    await act(async () => {
      render(<ChatArea />);
    });

    const input = screen.getByPlaceholderText(/pergunte algo sobre os documentos/i);
    const sendButton = screen.getByRole('button', { name: /enviar/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Como configurar a rede?' } });
      fireEvent.click(sendButton);
    });

    // Verifica se a pergunta do usuário apareceu
    expect(await screen.findByText('Como configurar a rede?')).toBeInTheDocument();

    // Verifica se a resposta da IA e o botão de fontes apareceram
    expect(await screen.findByText(/resposta simulada do RAG com Gemini/i)).toBeInTheDocument();
    const toggleFooterBtn = await screen.findByTestId('toggle-citations-button');
    expect(toggleFooterBtn).toBeInTheDocument();

    // Expande o footer de fontes para verificar os balões
    fireEvent.click(toggleFooterBtn);
    expect(await screen.findByText('manual.pdf')).toBeInTheDocument();
  });

  it('deve exibir overlay visual ao arrastar arquivo PDF sobre a tela e processar o drop', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/upload')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, total_processed: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 'conv-1', title: 'Conversa', files: [], messages: [] }),
      });
    });

    const { container } = render(<ChatArea />);

    const mainContainer = container.firstChild as HTMLElement;

    // Simula evento dragEnter
    await act(async () => {
      fireEvent.dragEnter(mainContainer, {
        dataTransfer: {
          items: [{ kind: 'file', type: 'application/pdf' }],
        },
      });
    });

    expect(screen.getByTestId('drag-drop-overlay')).toBeInTheDocument();
    expect(screen.getByText(/solte seus arquivos pdf aqui/i)).toBeInTheDocument();

    // Simula evento drop com arquivo PDF
    const fakeFile = new File(['fake-content'], 'contrato.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.drop(mainContainer, {
        dataTransfer: {
          files: [fakeFile],
        },
      });
    });

    // O overlay deve sumir após o drop
    expect(screen.queryByTestId('drag-drop-overlay')).not.toBeInTheDocument();
  });
});
