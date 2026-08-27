from unittest.mock import MagicMock, patch
import pytest
from infrastructure.pdf_parser import PDFParser, DocumentChunk


def test_pdf_parser_extracts_pages_with_metadata(mocker):
    # Mocking pypdf.PdfReader to avoid needing a real physical PDF in unit tests
    mock_page1 = MagicMock()
    mock_page1.extract_text.return_value = "Esta é a primeira página de introdução."
    
    mock_page2 = MagicMock()
    mock_page2.extract_text.return_value = "Esta é a segunda página com detalhes técnicos."

    mock_reader = MagicMock()
    mock_reader.pages = [mock_page1, mock_page2]

    with patch("infrastructure.pdf_parser.PdfReader", return_value=mock_reader):
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


def test_pdf_parser_handles_empty_pages():
    mock_page_empty = MagicMock()
    mock_page_empty.extract_text.return_value = "   \n  "
    
    mock_page_valid = MagicMock()
    mock_page_valid.extract_text.return_value = "Conteúdo válido."

    mock_reader = MagicMock()
    mock_reader.pages = [mock_page_empty, mock_page_valid]

    with patch("infrastructure.pdf_parser.PdfReader", return_value=mock_reader):
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
