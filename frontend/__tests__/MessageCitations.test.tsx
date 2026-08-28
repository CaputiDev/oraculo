import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageCitations } from '../src/components/MessageCitations';
import { useViewerStore } from '../src/store/useViewerStore';
import { Citation } from '../src/types';

describe('MessageCitations Component - Collapsed by Default & Balloon Popover', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
    useViewerStore.setState({
      documents: ['contrato.pdf', 'manual.pdf', 'relatorio.pdf', 'doc4.pdf'],
    });
  });

  it('deve iniciar recolhido por padrão e exibir balõezinhos após clicar no botão Fontes', () => {
    const singleCitation: Citation[] = [
      { file_name: 'contrato.pdf', page_number: 2, snippet: 'Trecho do contrato' },
    ];

    render(<MessageCitations citations={singleCitation} />);

    // Deve exibir o botão de fontes com o total
    const toggleBtn = screen.getByTestId('toggle-citations-button');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Fontes (1)');

    // Por padrão está recolhido (não exibe os balões diretamente)
    expect(screen.queryByTestId('citations-container')).not.toBeInTheDocument();

    // Ao clicar no botão, expande o footer de fontes
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('citations-container')).toBeInTheDocument();

    const balloonBtn = screen.getByTestId('citation-balloon-btn-1');
    expect(balloonBtn).toHaveTextContent('1');
    expect(balloonBtn).toHaveTextContent('contrato.pdf');

    // Ao passar o mouse, abre o popover de páginas
    fireEvent.mouseEnter(balloonBtn.parentElement!);
    expect(screen.getByTestId('citation-balloon-popover-1')).toBeInTheDocument();
    expect(screen.getByText('Página 2')).toBeInTheDocument();
  });

  it('deve navegar para a página citada ao clicar no item dentro do balão de fontes expandido', () => {
    const multiPageCitations: Citation[] = [
      { file_name: 'manual.pdf', page_number: 1, snippet: 'Introdução' },
      { file_name: 'manual.pdf', page_number: 3, snippet: 'Configuração' },
    ];

    render(<MessageCitations citations={multiPageCitations} />);

    // Expande o footer
    fireEvent.click(screen.getByTestId('toggle-citations-button'));

    // manual.pdf é o 2º documento -> 2
    const balloonBtn = screen.getByTestId('citation-balloon-btn-2');
    fireEvent.click(balloonBtn);

    const jumpPage3 = screen.getByTestId('balloon-page-jump-3');
    fireEvent.click(jumpPage3);

    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('manual.pdf');
    expect(storeState.activePage).toBe(3);
    expect(storeState.isViewerOpen).toBe(true);
  });
});
