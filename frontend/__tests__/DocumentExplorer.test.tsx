import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DocumentExplorer } from '../src/components/DocumentExplorer';
import { useViewerStore } from '../src/store/useViewerStore';
import { useConversationStore } from '../src/store/useConversationStore';

describe('DocumentExplorer Component', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
    useConversationStore.getState().resetConversationStore();
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/upload-text')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, file_name: 'Minhas Anotações' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  it('deve exibir a tela de "Nenhum documento adicionado" quando a lista for vazia', () => {
    render(<DocumentExplorer documents={[]} />);

    expect(screen.getByTestId('no-documents-view')).toBeInTheDocument();
    expect(screen.getByText('Nenhum documento adicionado')).toBeInTheDocument();
    expect(screen.getByTestId('add-documents-btn')).toBeInTheDocument();
  });

  it('deve listar os documentos existentes e permitir selecioná-los ao clicar', () => {
    const docs = ['contrato.pdf', 'relatorio_anual.pdf', 'anotacoes'];
    const handleSelectMock = jest.fn();

    render(<DocumentExplorer documents={docs} onSelectDocument={handleSelectMock} />);

    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
    expect(screen.getByText('contrato.pdf')).toBeInTheDocument();
    expect(screen.getByText('relatorio_anual.pdf')).toBeInTheDocument();
    expect(screen.getByText('anotacoes')).toBeInTheDocument();

    // Clica no card de contrato.pdf
    const contractCard = screen.getByTestId('doc-card-contrato.pdf');
    fireEvent.click(contractCard);

    expect(handleSelectMock).toHaveBeenCalledWith('contrato.pdf');
  });

  it('deve alternar para a tela de Adicionar Documentos e permitir voltar', () => {
    render(<DocumentExplorer documents={['arquivo.pdf']} />);

    // Clica no botão "Adicionar Documentos"
    const addBtn = screen.getByTestId('add-documents-btn');
    fireEvent.click(addBtn);

    // Deve exibir as abas de PDF e Texto Livre
    expect(screen.getByText(/clique ou arraste arquivos pdf aqui/i)).toBeInTheDocument();
    expect(screen.getByText('Texto Livre')).toBeInTheDocument();

    // Clica na aba "Texto Livre"
    fireEvent.click(screen.getByText('Texto Livre'));
    expect(screen.getByPlaceholderText(/cole ou digite o texto/i)).toBeInTheDocument();

    // Clica em voltar aos documentos
    const backBtn = screen.getByTestId('back-to-docs-btn');
    fireEvent.click(backBtn);

    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
    expect(screen.getByText('arquivo.pdf')).toBeInTheDocument();
  });

  it('deve permitir adicionar uma nota de texto livre pela tela de adicionar documentos', async () => {
    render(<DocumentExplorer documents={[]} />);

    fireEvent.click(screen.getByTestId('add-documents-btn'));
    fireEvent.click(screen.getByText('Texto Livre'));

    const titleInput = screen.getByPlaceholderText(/resumo de diretrizes/i);
    const contentTextarea = screen.getByPlaceholderText(/cole ou digite o texto/i);
    const submitButton = screen.getByRole('button', { name: /adicionar texto aos documentos/i });

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Minhas Anotações' } });
      fireEvent.change(contentTextarea, { target: { value: 'Conteúdo relevante para a IA' } });
      fireEvent.click(submitButton);
    });

    expect(await screen.findByText(/indexado com sucesso/i)).toBeInTheDocument();
  });

  it('deve ordenar os documentos por nome (A-Z e Z-A)', () => {
    const docs = ['Zeus.pdf', 'Atlas.pdf', 'Boreal.pdf'];
    render(<DocumentExplorer documents={docs} />);

    const sortSelect = screen.getByTestId('sort-select');

    // Ordena por Nome A-Z
    fireEvent.change(sortSelect, { target: { value: 'name-asc' } });
    const cardsAsc = screen.getAllByRole('heading', { level: 4 });
    expect(cardsAsc[0]).toHaveTextContent('Atlas.pdf');
    expect(cardsAsc[1]).toHaveTextContent('Boreal.pdf');
    expect(cardsAsc[2]).toHaveTextContent('Zeus.pdf');

    // Ordena por Nome Z-A
    fireEvent.change(sortSelect, { target: { value: 'name-desc' } });
    const cardsDesc = screen.getAllByRole('heading', { level: 4 });
    expect(cardsDesc[0]).toHaveTextContent('Zeus.pdf');
    expect(cardsDesc[1]).toHaveTextContent('Boreal.pdf');
    expect(cardsDesc[2]).toHaveTextContent('Atlas.pdf');
  });

  it('deve filtrar documentos pelo campo de busca', () => {
    const docs = ['manual_usuario.pdf', 'especificacao_tecnica.pdf', 'politica_privacidade.pdf'];
    render(<DocumentExplorer documents={docs} />);

    const searchInput = screen.getByTestId('search-doc-input');
    fireEvent.change(searchInput, { target: { value: 'manual' } });

    expect(screen.getByText('manual_usuario.pdf')).toBeInTheDocument();
    expect(screen.queryByText('especificacao_tecnica.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('politica_privacidade.pdf')).not.toBeInTheDocument();
  });
});
