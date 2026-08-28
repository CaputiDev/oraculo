from unittest.mock import MagicMock, patch
import pytest
from infrastructure.pdf_parser import PDFParser, DocumentChunk


def test_pdf_parser_extracts_pages_with_pymupdf():
    mock_page1 = MagicMock()
    mock_page1.get_text.return_value = "Esta é a primeira página de introdução via PyMuPDF."
    
    mock_page2 = MagicMock()
    mock_page2.get_text.return_value = "Esta é a segunda página com detalhes técnicos."

    mock_doc = [mock_page1, mock_page2]
    mock_doc_obj = MagicMock()
    mock_doc_obj.__len__.return_value = 2
    mock_doc_obj.__getitem__.side_effect = lambda idx: mock_doc[idx]

    with patch("fitz.open", return_value=mock_doc_obj):
        parser = PDFParser(chunk_size=500, chunk_overlap=50)
        chunks = parser.parse_pdf_bytes(
            file_bytes=b"fake-pdf-content",
            file_name="manual_usuario.pdf"
        )

        assert len(chunks) == 2
        
        # Test Page 1 metadata
        assert chunks[0].file_name == "manual_usuario.pdf"
        assert chunks[0].page_number == 1
        assert "primeira página" in chunks[0].content
        assert chunks[0].chunk_id == "manual_usuario.pdf_p1_c0"
        
        # Test Page 2 metadata
        assert chunks[1].file_name == "manual_usuario.pdf"
        assert chunks[1].page_number == 2
        assert "segunda página" in chunks[1].content
        assert chunks[1].chunk_id == "manual_usuario.pdf_p2_c0"


def test_pdf_parser_fallback_to_pypdf_on_pymupdf_failure():
    # Simula falha no fitz.open para verificar se o fallback para pypdf funciona de forma transparente
    mock_page_pypdf = MagicMock()
    mock_page_pypdf.extract_text.return_value = "Texto extraído via fallback pypdf."

    mock_reader = MagicMock()
    mock_reader.pages = [mock_page_pypdf]

    with patch("fitz.open", side_effect=Exception("PyMuPDF engine error")), \
         patch("pypdf.PdfReader", return_value=mock_reader):
        parser = PDFParser()
        chunks = parser.parse_pdf_bytes(
            file_bytes=b"fake-pdf-content",
            file_name="fallback_doc.pdf"
        )

        assert len(chunks) == 1
        assert chunks[0].page_number == 1
        assert "fallback pypdf" in chunks[0].content


def test_pdf_parser_handles_empty_pages():
    mock_page_empty = MagicMock()
    mock_page_empty.get_text.return_value = "   \n  "
    
    mock_page_valid = MagicMock()
    mock_page_valid.get_text.return_value = "Conteúdo válido."

    mock_doc = [mock_page_empty, mock_page_valid]
    mock_doc_obj = MagicMock()
    mock_doc_obj.__len__.return_value = 2
    mock_doc_obj.__getitem__.side_effect = lambda idx: mock_doc[idx]

    with patch("fitz.open", return_value=mock_doc_obj):
        parser = PDFParser()
        chunks = parser.parse_pdf_bytes(
            file_bytes=b"fake-pdf-content",
            file_name="relatorio.pdf"
        )

        assert len(chunks) == 1
        assert chunks[0].page_number == 2
        assert chunks[0].content == "Conteúdo válido."


def test_text_parser_splits_free_text():
    parser = PDFParser(chunk_size=100, chunk_overlap=20)
    text = "Este é um texto livre digitado pelo usuário com informações relevantes sobre o projeto Oráculo."
    chunks = parser.parse_raw_text(
        text=text,
        title="Notas Rápidas"
    )

    assert len(chunks) >= 1
    assert chunks[0].file_name == "Notas Rápidas"
    assert chunks[0].page_number == 1
    assert "Oráculo" in chunks[0].content


def test_recursive_chunking_preserves_paragraphs():
    parser = PDFParser(chunk_size=60, chunk_overlap=15)
    text = "Primeiro parágrafo conciso.\n\nSegundo parágrafo com mais detalhes importantes.\n\nTerceiro parágrafo final."
    chunks = parser.parse_raw_text(text=text, title="Paragrafos")

    assert len(chunks) >= 2
    assert "Primeiro parágrafo" in chunks[0].content
    assert chunks[0].file_name == "Paragrafos"
