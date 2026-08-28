import pytest
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.bm25_retriever import BM25Retriever, tokenize
from infrastructure.chromadb_adapter import ChromaDBAdapter


def test_bm25_tokenize_handles_accents_and_technical_codes():
    tokens = tokenize("Erro crítico #ERR_504_GATEWAY na configuração de rede!")
    assert "err_504_gateway" in tokens
    assert "configuracao" in tokens
    assert "rede" in tokens


def test_bm25_retriever_exact_keyword_and_code_matching():
    retriever = BM25Retriever()
    
    chunks = [
        DocumentChunk(
            chunk_id="chunk_1",
            file_name="manual_erros.pdf",
            page_number=1,
            content="O erro ERR-904-TIMEOUT ocorre quando o servidor não responde em 30 segundos.",
            metadata={}
        ),
        DocumentChunk(
            chunk_id="chunk_2",
            file_name="contrato.pdf",
            page_number=2,
            content="O contrato tem vigência de 12 meses renováveis automaticamente.",
            metadata={}
        ),
        DocumentChunk(
            chunk_id="chunk_3",
            file_name="produtos.pdf",
            page_number=1,
            content="Código do produto SKU-X992-ALPHA com garantia estendida de 2 anos.",
            metadata={}
        ),
    ]

    retriever.add_chunks(chunks, conversation_id="conv_1")

    # Busca por código exato de erro
    results_err = retriever.search("ERR-904-TIMEOUT", conversation_id="conv_1", k=2)
    assert len(results_err) >= 1
    assert results_err[0].chunk_id == "chunk_1"

    # Busca por código SKU
    results_sku = retriever.search("SKU-X992-ALPHA", conversation_id="conv_1", k=2)
    assert len(results_sku) >= 1
    assert results_sku[0].chunk_id == "chunk_3"


def test_bm25_retriever_isolates_conversations():
    retriever = BM25Retriever()

    conv1_chunks = [
        DocumentChunk(
            chunk_id="c1",
            file_name="conv1.pdf",
            page_number=1,
            content="Documento ultra secreto da Conversa 1 sobre Projeto Fênix.",
            metadata={}
        )
    ]
    conv2_chunks = [
        DocumentChunk(
            chunk_id="c2",
            file_name="conv2.pdf",
            page_number=1,
            content="Documento público da Conversa 2 sobre Projeto Atlas.",
            metadata={}
        )
    ]

    retriever.add_chunks(conv1_chunks, conversation_id="conv_1")
    retriever.add_chunks(conv2_chunks, conversation_id="conv_2")

    # Busca Projeto Fênix na conv_2 não deve retornar resultados da conv_1
    res_conv2 = retriever.search("Fênix", conversation_id="conv_2")
    assert len(res_conv2) == 0

    # Busca Projeto Fênix na conv_1 retorna chunk da conv_1
    res_conv1 = retriever.search("Fênix", conversation_id="conv_1")
    assert len(res_conv1) == 1
    assert res_conv1[0].chunk_id == "c1"


def test_chromadb_adapter_hybrid_search_rrf(mocker, tmp_path):
    # Mock do gerador de embeddings para testes unitários rápidos
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
        persist_directory=str(tmp_path / "test_chroma_hybrid"),
        collection_name="test_hybrid_collection"
    )

    chunks = [
        DocumentChunk(
            chunk_id="chunk_a",
            file_name="doc_a.pdf",
            page_number=1,
            content="Protocolo de segurança PROT-9988-SEC para acesso remoto.",
            metadata={}
        ),
        DocumentChunk(
            chunk_id="chunk_b",
            file_name="doc_b.pdf",
            page_number=2,
            content="Instruções gerais sobre procedimentos de segurança física na portaria.",
            metadata={}
        ),
    ]

    adapter.add_chunks(chunks, conversation_id="conv_test")

    # Executa busca híbrida
    results = adapter.hybrid_search("PROT-9988-SEC", conversation_id="conv_test", k=2)

    assert len(results) >= 1
    # O chunk com o código exato é o mais relevante via BM25 e RRF
    assert results[0].chunk_id.endswith("chunk_a")
    assert "PROT-9988-SEC" in results[0].content


def test_chromadb_adapter_hybrid_search_empty_query(tmp_path):
    adapter = ChromaDBAdapter(
        persist_directory=str(tmp_path / "test_chroma_empty"),
        collection_name="test_empty_collection"
    )
    assert adapter.hybrid_search("", conversation_id="conv_1") == []
    assert adapter.hybrid_search("   ", conversation_id="conv_1") == []
