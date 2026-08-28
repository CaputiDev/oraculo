import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattedMessage } from '../src/components/FormattedMessage';
import { useViewerStore } from '../src/store/useViewerStore';

describe('FormattedMessage Component - Inline Footnote Citations', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
    useViewerStore.setState({
      documents: ['contrato.pdf', 'manual.pdf', 'tcc_pedro.pdf'],
    });
  });

  it('deve identificar marcações inline [1:4] e renderizar número pequeno clicável', () => {
    const text = 'O prazo contratual é de 30 dias [1:4].';
    render(<FormattedMessage content={text} documents={['contrato.pdf', 'manual.pdf']} />);

    expect(screen.getByText(/O prazo contratual é de 30 dias/)).toBeInTheDocument();

    const inlineBadge = screen.getByTestId('inline-citation-badge');
    expect(inlineBadge).toBeInTheDocument();
    expect(inlineBadge).toHaveTextContent('1');

    // Ao clicar na citação inline, deve sincronizar o useViewerStore e abrir o visualizador na página 4
    fireEvent.click(inlineBadge);

    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('contrato.pdf');
    expect(storeState.activePage).toBe(4);
    expect(storeState.isViewerOpen).toBe(true);
  });

  it('deve identificar citações inline com nome de arquivo [manual.pdf:2] e mapear para o número do documento', () => {
    const text = 'As diretrizes de segurança devem ser seguidas [manual.pdf:2].';
    render(<FormattedMessage content={text} documents={['contrato.pdf', 'manual.pdf']} />);

    const inlineBadge = screen.getByTestId('inline-citation-badge');
    expect(inlineBadge).toBeInTheDocument();
    // manual.pdf é o 2º documento -> número 2
    expect(inlineBadge).toHaveTextContent('2');

    fireEvent.click(inlineBadge);
    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('manual.pdf');
    expect(storeState.activePage).toBe(2);
  });

  it('deve identificar citações com múltiplas páginas como [tcc_pedro.pdf:11, 15] e renderizar badge clicável', () => {
    const text = 'O TCC de Pedro trata de IA e NLP [tcc_pedro.pdf:11, 15].';
    render(<FormattedMessage content={text} documents={['contrato.pdf', 'manual.pdf', 'tcc_pedro.pdf']} />);

    expect(screen.queryByText(/\[tcc_pedro\.pdf:11, 15\]/)).not.toBeInTheDocument();
    const inlineBadge = screen.getByTestId('inline-citation-badge');
    expect(inlineBadge).toBeInTheDocument();
    // tcc_pedro.pdf é o 3º documento -> número 3
    expect(inlineBadge).toHaveTextContent('3');

    fireEvent.click(inlineBadge);
    const storeState = useViewerStore.getState();
    expect(storeState.activeFile).toBe('tcc_pedro.pdf');
    expect(storeState.activePage).toBe(11);
  });
});
