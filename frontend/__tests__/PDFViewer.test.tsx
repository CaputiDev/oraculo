import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PDFViewer } from '../src/components/PDFViewer';
import { useViewerStore } from '../src/store/useViewerStore';

describe('PDFViewer Component', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          file_name: 'manual.pdf',
          total_pages: 5,
          total_chunks: 10,
          chunks: [
            {
              chunk_id: 'c-1',
              file_name: 'manual.pdf',
              page_number: 1,
              content: 'Conteúdo da página 1 do manual',
            },
          ],
        }),
      })
    );
  });

  it('deve exibir o botão de casinha Home na toolbar', () => {
    render(<PDFViewer />);

    const homeButton = screen.getByTestId('home-docs-btn');
    expect(homeButton).toBeInTheDocument();
    expect(homeButton).toHaveAttribute('title', 'Ir para o Explorador de Documentos');
  });

  it('deve retornar para o Explorador de Documentos ao clicar no botão de casinha', async () => {
    useViewerStore.setState({
      activeFile: 'manual.pdf',
      activePage: 1,
      documents: ['manual.pdf', 'contrato.pdf'],
    });

    render(<PDFViewer />);

    // Quando um arquivo está ativo, deve exibir controles de paginação
    expect(screen.getByRole('button', { name: /próxima página/i })).toBeInTheDocument();

    // Clica no botão de casinha (Home)
    const homeButton = screen.getByTestId('home-docs-btn');
    await act(async () => {
      fireEvent.click(homeButton);
    });

    // O activeFile na store deve ser resetado para null e o explorador deve aparecer
    expect(useViewerStore.getState().activeFile).toBeNull();
    expect(screen.getByTestId('documents-grid')).toBeInTheDocument();
  });
});
