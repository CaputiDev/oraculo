from unittest.mock import MagicMock
import pytest
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.gemini_adapter import Citation, RAGResponse
from services.rag_service import RAGService


@pytest.fixture
def mock_pdf_parser():
    return MagicMock()


@pytest.fixture
def mock_chromadb_adapter():
    return MagicMock()


@pytest.fixture
def mock_gemini_adapter():
    return MagicMock()


@pytest.fixture
def rag_service(mock_pdf_parser, mock_chromadb_adapter, mock_gemini_adapter):
    return RAGService(
        pdf_parser=mock_pdf_parser,
        vector_store=mock_chromadb_adapter,
        llm_adapter=mock_gemini_adapter
    )


def test_ingest_pdf_success(rag_service, mock_pdf_parser, mock_chromadb_adapter):
    # Setup
    fake_chunks = [
        DocumentChunk(
            chunk_id="manual.pdf_p1_c0",
            file_name="manual.pdf",
            page_number=1,
            content="Instruções de instalação.",
            metadata={"page": 1}
        ),
        DocumentChunk(
            chunk_id="manual.pdf_p2_c0",
            file_name="manual.pdf",
            page_number=2,
            content="Configuração de portas.",
            metadata={"page": 2}
        )
    ]
    mock_pdf_parser.parse_pdf_bytes.return_value = fake_chunks
    mock_chromadb_adapter.add_chunks.return_value = 2

    # Execute
    result = rag_service.ingest_pdf(
        file_bytes=b"fake-binary-content",
        file_name="manual.pdf"
    )

    # Assert
    mock_pdf_parser.parse_pdf_bytes.assert_called_once_with(
        file_bytes=b"fake-binary-content",
        file_name="manual.pdf"
    )
    mock_chromadb_adapter.add_chunks.assert_called_once_with(fake_chunks, conversation_id="default")
    assert result["success"] is True
    assert result["file_name"] == "manual.pdf"
    assert result["total_chunks"] == 2
    assert result["total_pages"] == 2


def test_ingest_text_success(rag_service, mock_pdf_parser, mock_chromadb_adapter):
    fake_chunks = [
        DocumentChunk(
            chunk_id="anotacoes_p1_c0",
            file_name="anotacoes",
            page_number=1,
            content="Reunião de alinhamento sobre arquitetura.",
            metadata={"page": 1}
        )
    ]
    mock_pdf_parser.parse_raw_text.return_value = fake_chunks
    mock_chromadb_adapter.add_chunks.return_value = 1

    result = rag_service.ingest_text(
        text="Reunião de alinhamento sobre arquitetura.",
        title="anotacoes"
    )

    mock_pdf_parser.parse_raw_text.assert_called_once_with(
        text="Reunião de alinhamento sobre arquitetura.",
        title="anotacoes"
    )
    mock_chromadb_adapter.add_chunks.assert_called_once_with(fake_chunks, conversation_id="default")
    assert result["success"] is True
    assert result["file_name"] == "anotacoes"
    assert result["total_chunks"] == 1


def test_answer_query_with_citations(rag_service, mock_chromadb_adapter, mock_gemini_adapter):
    # Setup
    retrieved_chunks = [
        DocumentChunk(
            chunk_id="contrato.pdf_p3_c0",
            file_name="contrato.pdf",
            page_number=3,
            content="A taxa de juros anual é fixada em 12%.",
            metadata={"source": "contrato.pdf", "page": 3}
        )
    ]
    mock_chromadb_adapter.similarity_search.return_value = retrieved_chunks

    expected_llm_response = RAGResponse(
        answer="A taxa de juros anual acordada é de 12% [Fonte: contrato.pdf, pág. 3].",
        citations=[
            Citation(
                file_name="contrato.pdf",
                page_number=3,
                snippet="A taxa de juros anual é fixada em 12%."
            )
        ]
    )
    mock_gemini_adapter.generate_rag_answer.return_value = expected_llm_response

    # Execute
    response = rag_service.answer_query(query="Qual é a taxa de juros?")

    # Assert
    mock_chromadb_adapter.similarity_search.assert_called_once_with(
        query="Qual é a taxa de juros?",
        conversation_id="default",
        k=4
    )
    mock_gemini_adapter.generate_rag_answer.assert_called_once_with(
        query="Qual é a taxa de juros?",
        context_chunks=retrieved_chunks
    )
    assert "12%" in response.answer
    assert len(response.citations) == 1
    assert response.citations[0].file_name == "contrato.pdf"
    assert response.citations[0].page_number == 3


def test_answer_query_empty_knowledge_base(rag_service, mock_chromadb_adapter, mock_gemini_adapter):
    mock_chromadb_adapter.similarity_search.return_value = []
    mock_gemini_adapter.generate_rag_answer.return_value = RAGResponse(
        answer="Não encontrei informações relevantes nos documentos fornecidos.",
        citations=[]
    )

    response = rag_service.answer_query(query="Pergunta sem resposta")

    assert "Não encontrei informações" in response.answer
    assert len(response.citations) == 0
