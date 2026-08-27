import os
import shutil
import tempfile
import pytest
from unittest.mock import MagicMock
from infrastructure.conversation_repository import ConversationRepository
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.gemini_adapter import RAGResponse, Citation
from services.rag_service import RAGService


@pytest.fixture
def temp_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_conversations.db")
    repo = ConversationRepository(db_path=db_path)
    yield repo
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


def test_conversation_repository_crud(temp_db):
    # 1. Create
    conv = temp_db.create_conversation("Conversa Teste")
    assert conv.title == "Conversa Teste"
    assert conv.id.startswith("conv-")

    # 2. Add File
    temp_db.add_file(conv.id, "relatorio.pdf")
    files = temp_db.get_conversation_files(conv.id)
    assert files == ["relatorio.pdf"]

    # 3. Add Messages
    temp_db.add_message(conv.id, "user", "Qual o faturamento?")
    temp_db.add_message(
        conv.id,
        "assistant",
        "O faturamento foi de 1M [Fonte: relatorio.pdf, pág. 1].",
        citations=[{"file_name": "relatorio.pdf", "page_number": 1}]
    )

    conv_fetched = temp_db.get_conversation(conv.id)
    assert len(conv_fetched.messages) == 2
    assert conv_fetched.messages[0].role == "user"
    assert conv_fetched.messages[1].role == "assistant"
    assert conv_fetched.messages[1].citations[0]["file_name"] == "relatorio.pdf"

    # 4. List
    conv_list = temp_db.list_conversations()
    assert len(conv_list) == 1
    assert conv_list[0]["message_count"] == 2
    assert conv_list[0]["file_count"] == 1

    # 5. Delete
    deleted = temp_db.delete_conversation(conv.id)
    assert deleted is True
    assert temp_db.get_conversation(conv.id) is None


def test_rag_service_isolates_conversations(temp_db):
    mock_pdf_parser = MagicMock()
    mock_vector_store = MagicMock()
    mock_llm_adapter = MagicMock()

    service = RAGService(
        pdf_parser=mock_pdf_parser,
        vector_store=mock_vector_store,
        llm_adapter=mock_llm_adapter,
        conversation_repo=temp_db
    )

    # Ingest document for Conversation A
    fake_chunk_a = [
        DocumentChunk(
            chunk_id="docA_p1_c0",
            file_name="docA.pdf",
            page_number=1,
            content="Conteúdo da conversa A."
        )
    ]
    mock_pdf_parser.parse_pdf_bytes.return_value = fake_chunk_a
    mock_vector_store.add_chunks.return_value = 1

    service.ingest_pdf(b"bytes-a", "docA.pdf", conversation_id="conv_A")

    mock_vector_store.add_chunks.assert_called_once_with(fake_chunk_a, conversation_id="conv_A")
    assert "docA.pdf" in temp_db.get_conversation_files("conv_A")

    # Ingest document for Conversation B
    fake_chunk_b = [
        DocumentChunk(
            chunk_id="docB_p1_c0",
            file_name="docB.pdf",
            page_number=1,
            content="Conteúdo da conversa B."
        )
    ]
    mock_pdf_parser.parse_pdf_bytes.return_value = fake_chunk_b
    service.ingest_pdf(b"bytes-b", "docB.pdf", conversation_id="conv_B")

    mock_vector_store.add_chunks.assert_called_with(fake_chunk_b, conversation_id="conv_B")
    assert "docB.pdf" in temp_db.get_conversation_files("conv_B")
    assert "docB.pdf" not in temp_db.get_conversation_files("conv_A")

    # Query in Conversation A
    mock_vector_store.similarity_search.return_value = fake_chunk_a
    mock_llm_adapter.generate_rag_answer.return_value = RAGResponse(
        answer="Resposta A [Fonte: docA.pdf, pág. 1].",
        citations=[Citation(file_name="docA.pdf", page_number=1, snippet="Conteúdo A")]
    )

    resp_a = service.answer_query("Pergunta sobre A", conversation_id="conv_A")

    # Verifies similarity_search was called strictly with conversation_id="conv_A"
    mock_vector_store.similarity_search.assert_called_with(
        query="Pergunta sobre A",
        conversation_id="conv_A",
        k=4
    )
    assert "Resposta A" in resp_a.answer

    # Verifies conversation history was saved in SQLite
    conv_a = temp_db.get_conversation("conv_A")
    assert len(conv_a.messages) == 2
    assert conv_a.messages[0].content == "Pergunta sobre A"
    assert "Resposta A" in conv_a.messages[1].content
