import pytest
from infrastructure.pdf_parser import PDFParser, DocumentChunk
from infrastructure.chromadb_adapter import ChromaDBAdapter


def test_pdf_parser_hierarchical_chunking():
    parser = PDFParser(
        parent_chunk_size=500,
        child_chunk_size=150,
        child_overlap=30
    )

    long_paragraph = (
        "A inteligência artificial transformou o processamento de linguagem natural nos últimos anos. "
        "Modelos de linguagem como Gemini permitem raciocínio complexo sobre documentos corporativos. "
        "A recuperação hierárquica divide o texto em chunks pais e filhos para manter o contexto sem perder a precisão da busca vetorial."
    )

    chunks = parser._hierarchical_chunk_page(
        text=long_paragraph,
        file_name="artigo_ia.pdf",
        page_number=1
    )

    assert len(chunks) >= 2
    for c in chunks:
        assert c.parent_id is not None
        assert "artigo_ia.pdf_p1_parent_" in c.parent_id
        assert c.parent_content is not None
        assert len(c.parent_content) >= len(c.content)
        assert c.file_name == "artigo_ia.pdf"
        assert c.page_number == 1


def test_chromadb_parent_child_rehydration_and_deduplication(mocker, tmp_path):
    mocker.patch.object(
        ChromaDBAdapter,
        "_get_batch_embeddings",
        side_effect=lambda texts, **kwargs: [[0.1] * 768 for _ in texts]
    )
    mocker.patch.object(
        ChromaDBAdapter,
        "_get_query_embedding",
        return_value=[0.1] * 768
    )

    adapter = ChromaDBAdapter(
        persist_directory=str(tmp_path / "test_chroma_parent_child"),
        collection_name="test_pc_collection"
    )

    parent_text = "Seção 4.1: Diretrizes de Segurança Corporativa e Governança de Dados com Criptografia de Ponta a Ponta."
    child_1 = DocumentChunk(
        chunk_id="doc_p1_parent_0_child_0",
        file_name="seguranca.pdf",
        page_number=1,
        content="Diretrizes de Segurança Corporativa.",
        parent_id="doc_p1_parent_0",
        parent_content=parent_text,
        metadata={"parent_id": "doc_p1_parent_0", "parent_content": parent_text}
    )
    child_2 = DocumentChunk(
        chunk_id="doc_p1_parent_0_child_1",
        file_name="seguranca.pdf",
        page_number=1,
        content="Governança de Dados com Criptografia.",
        parent_id="doc_p1_parent_0",
        parent_content=parent_text,
        metadata={"parent_id": "doc_p1_parent_0", "parent_content": parent_text}
    )

    adapter.add_chunks([child_1, child_2], conversation_id="conv_pc")

    # Busca híbrida por "Criptografia"
    results = adapter.hybrid_search("Criptografia", conversation_id="conv_pc", k=2)

    assert len(results) == 1  # Desduplicou os dois filhos do mesmo pai
    assert results[0].chunk_id == "doc_p1_parent_0"
    assert results[0].content == parent_text  # Re-hidratou para o texto do Parent Chunk
