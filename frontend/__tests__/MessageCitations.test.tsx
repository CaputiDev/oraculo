import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageCitations } from '../src/components/MessageCitations';
import { useViewerStore } from '../src/store/useViewerStore';
import { Citation } from '../src/types';

describe('MessageCitations Component - Multi-Page Grouping', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
  });

  it('deve renderizar CitationBadge normal quando o documento possui apenas 1 página citada', () => {
    const singleCitation: Citation[] = [
      { file_name: 'contrato.pdf', page_number: 2, snippet: 'Trecho do contrato' },
    ];

    render(<MessageCitations citations={singleCitation} />);

    expect(screen.getByText('contrato.pdf')).toBeInTheDocument();
    expect(screen.getByText('pág. 2')).toBeInTheDocument();
    expect(screen.queryByText(/págs/i)).not.toBeInTheDocument();
  });

  it('deve agrupar e exibir somente o nome e quantidade de páginas quando o documento tem múltiplas páginas citadas', () => {
    const multiPageCitations: Citation[] = [
      { file_name: 'manual.pdf', page_number: 1, snippet: 'Introdução' },
      { file_name: 'manual.pdf', page_number: 3, snippet: 'Configuração' },
      { file_name: 'manual.pdf', page_number: 5, snippet: 'Solução de problemas' },
    ];

    render(<MessageCitations citations={multiPageCitations} />);

    const groupedBadge = screen.getByTestId('grouped-doc-manual.pdf');
    expect(groupedBadge).toBeInTheDocument();
    expect(groupedBadge).toHaveTextContent('manual.pdf');
    expect(groupedBadge).toHaveTextContent('3 págs');

    // Inicialmente não deve exibir os botões de páginas individuais
    expect(screen.queryByTestId('pages-dropdown-manual.pdf')).not.toBeInTheDocument();

    // Ao clicar no badge do documento, deve abrir e especificar as páginas citadas
    fireEvent.click(groupedBadge);

    expect(screen.getByTestId('pages-dropdown-manual.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('page-btn-manual.pdf-1')).toHaveTextContent('Pág. 1');
    expect(screen.getByTestId('page-btn-manual.pdf-3')).toHaveTextContent('Pág. 3');
    expect(screen.getByTestId('page-btn-manual.pdf-5')).toHaveTextContent('Pág. 5');
  });

  it('deve sincronizar useViewerStore ao clicar em uma página específica do dropdown', () => {
    const multiPageCitations: Citation[] = [
      { file_name: 'relatorio.pdf', page_number: 4, snippet: 'Dados financeiros' },
      { file_name: 'relatorio.pdf', page_number: 9, snippet: 'Conclusão' },
    ];

    render(<MessageCitations citations={multiPageCitations} />);

    const groupedBadge = screen.getByTestId('grouped-doc-relatorio.pdf');
    fireEvent.click(groupedBadge);

    const page9Button = screen.getByTestId('page-btn-relatorio.pdf-9');
    fireEvent.click(page9Button);

    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('relatorio.pdf');
    expect(storeState.activePage).toBe(9);
    expect(storeState.isViewerOpen).toBe(true);
  });

  it('deve recolher lista quando houver mais de 2 documentos distintos citados', () => {
    const multiDocCitations: Citation[] = [
      { file_name: 'doc1.pdf', page_number: 1 },
      { file_name: 'doc2.pdf', page_number: 2 },
      { file_name: 'doc3.pdf', page_number: 3 },
    ];

    render(<MessageCitations citations={multiDocCitations} />);

    expect(screen.getByTestId('toggle-citations-button')).toBeInTheDocument();
    expect(screen.getByText('Expandir (3)')).toBeInTheDocument();
    expect(screen.getByTestId('expand-more-citations')).toHaveTextContent('+1 mais');

    // Ao clicar no botão de expandir, todos os 3 documentos são exibidos
    fireEvent.click(screen.getByTestId('toggle-citations-button'));
    expect(screen.getByText('doc3.pdf')).toBeInTheDocument();
    expect(screen.getByText('Recolher')).toBeInTheDocument();
  });
});
