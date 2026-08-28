import os
from typing import List, Optional, Dict, Any
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.bm25_retriever import BM25Retriever


class ChromaDBAdapter:
    """
    Adaptador de infraestrutura para o banco vetorial ChromaDB com suporte a persistência local,
    particionamento por conversation_id, cache em memória, geração de Batch Embeddings (em lote)
    e Busca Híbrida (BM25 + Chroma com Reciprocal Rank Fusion - RRF).
    """

    def __init__(
        self,
        persist_directory: str = "./vector_store",
        collection_name: str = "oraculo_knowledge_base",
        embedding_model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        bm25_retriever: Optional[BM25Retriever] = None
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model_name or os.getenv(
            "EMBEDDING_MODEL", "models/gemini-embedding-001"
        )
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self._query_cache: Dict[str, List[float]] = {}
        self.bm25_retriever = bm25_retriever or BM25Retriever()

        os.makedirs(self.persist_directory, exist_ok=True)
        try:
            import chromadb
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except ImportError:
            self.client = None
            self.collection = None

        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
            except Exception:
                pass

    def _get_embedding(self, text: str) -> List[float]:
        """
        Gera embedding para um único texto (fallback individual).
        """
        batch_res = self._get_batch_embeddings([text])
        if batch_res:
            return batch_res[0]
        raise RuntimeError("Falha ao gerar embedding individual.")

    def _get_batch_embeddings(self, texts: List[str], batch_size: int = 50) -> List[List[float]]:
        """
        Gera embeddings em lote (Batch Embeddings) de alta performance, agrupando textos em requisições únicas.
        """
        if not texts:
            return []

        candidate_models = [
            self.embedding_model_name,
            "models/gemini-embedding-001",
            "models/text-embedding-004",
            "models/embedding-001",
        ]
        candidate_models = list(dict.fromkeys(candidate_models))

        all_embeddings: List[List[float]] = []

        try:
            import google.generativeai as genai
            
            # Processa em lotes de até batch_size
            for i in range(0, len(texts), batch_size):
                chunk_batch = texts[i:i + batch_size]
                last_error = None
                batch_success = False

                for model_name in candidate_models:
                    try:
                        result = genai.embed_content(
                            model=model_name,
                            content=chunk_batch,
                            task_type="retrieval_document"
                        )
                        self.embedding_model_name = model_name
                        raw_emb = result["embedding"]

                        # Se for lote de 1 elemento, a API pode retornar list[float] ou list[list[float]]
                        if len(chunk_batch) == 1 and raw_emb and isinstance(raw_emb[0], (int, float)):
                            all_embeddings.append(raw_emb)
                        else:
                            all_embeddings.extend(raw_emb)

                        batch_success = True
                        break
                    except Exception as e:
                        last_error = e
                        continue

                if not batch_success:
                    raise last_error or RuntimeError("Falha ao gerar embeddings em lote.")

            return all_embeddings
        except Exception as e:
            raise RuntimeError(f"Erro no processamento de Batch Embeddings com Gemini: {str(e)}")

    def _get_query_embedding(self, query: str) -> List[float]:
        """
        Recupera embedding de busca com cache em memória LRU para latência zero em termos recorrentes.
        """
        clean_query = query.strip()
        if clean_query in self._query_cache:
            return self._query_cache[clean_query]

        candidate_models = [
            self.embedding_model_name,
            "models/gemini-embedding-001",
            "models/text-embedding-004",
            "models/embedding-001",
        ]
        candidate_models = list(dict.fromkeys(candidate_models))

        try:
            import google.generativeai as genai
            last_error = None
            for model_name in candidate_models:
                try:
                    result = genai.embed_content(
                        model=model_name,
                        content=clean_query,
                        task_type="retrieval_query"
                    )
                    self.embedding_model_name = model_name
                    emb = result["embedding"]

                    # Mantém o cache limitado a 256 queries mais recentes
                    if len(self._query_cache) > 256:
                        self._query_cache.pop(next(iter(self._query_cache)))
                    self._query_cache[clean_query] = emb

                    return emb
                except Exception as e:
                    last_error = e
                    continue

            raise last_error or RuntimeError("Nenhum modelo de embedding para busca respondeu.")
        except Exception as e:
            raise RuntimeError(f"Erro ao gerar embedding de busca: {str(e)}")

    def add_chunks(self, chunks: List[DocumentChunk], conversation_id: str = "default") -> int:
        """
        Adiciona lista de chunks de documentos ao ChromaDB associados a uma conversation_id
        utilizando Batch Embeddings e indexa simultaneamente no BM25.
        """
        if not chunks:
            return 0
        if not self.collection:
            raise RuntimeError("ChromaDB client não foi inicializado corretamente.")

        ids = [f"{conversation_id}_{chunk.chunk_id}" for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        metadatas = [
            {
                "file_name": chunk.file_name,
                "page_number": chunk.page_number,
                "conversation_id": conversation_id,
                **chunk.metadata
            }
            for chunk in chunks
        ]

        # Geração de embeddings em lote (1 única chamada para dezenas de chunks)
        embeddings = self._get_batch_embeddings(documents, batch_size=50)

        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings
        )

        # Indexa no motor léxico BM25 com os IDs unificados
        bm25_chunks = [
            DocumentChunk(
                chunk_id=ids[i],
                file_name=chunks[i].file_name,
                page_number=chunks[i].page_number,
                content=chunks[i].content,
                metadata=metadatas[i]
            )
            for i in range(len(chunks))
        ]
        self.bm25_retriever.add_chunks(bm25_chunks, conversation_id=conversation_id)

        return len(chunks)

    def _ensure_bm25_loaded(self, conversation_id: str):
        """
        Garante que o índice BM25 em memória contenha os chunks persistidos no ChromaDB.
        """
        if conversation_id not in self.bm25_retriever._conversation_indexes:
            chunks = self.get_all_conversation_chunks(conversation_id)
            if chunks:
                self.bm25_retriever.add_chunks(chunks, conversation_id=conversation_id)

    def similarity_search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        k: int = 4
    ) -> List[DocumentChunk]:
        """
        Executa busca semântica densa filtrando exclusivamente pelos chunks da conversa ativa.
        """
        if not self.collection:
            raise RuntimeError("ChromaDB client não foi inicializado corretamente.")

        query_emb = self._get_query_embedding(query)
        where_filter = {"conversation_id": conversation_id} if conversation_id else None

        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        retrieved_chunks: List[DocumentChunk] = []
        if not results or not results.get("documents") or not results["documents"][0]:
            return retrieved_chunks

        doc_list = results["documents"][0]
        meta_list = results["metadatas"][0]
        id_list = results["ids"][0]

        for i in range(len(doc_list)):
            meta = meta_list[i] or {}
            retrieved_chunks.append(
                DocumentChunk(
                    chunk_id=id_list[i],
                    file_name=meta.get("file_name", "Desconhecido"),
                    page_number=int(meta.get("page_number", 1)),
                    content=doc_list[i],
                    metadata=meta
                )
            )

        return retrieved_chunks

    def hybrid_search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        k: int = 4,
        rrf_k: int = 60
    ) -> List[DocumentChunk]:
        """
        Executa Busca Híbrida (Busca Vetorial Densa + BM25 Léxico Esparso)
        com re-ranqueamento via Reciprocal Rank Fusion (RRF).
        """
        if not query or not query.strip():
            return []

        cid = conversation_id or "default"
        self._ensure_bm25_loaded(cid)

        fetch_k = max(k * 2, 8)

        # 1. Busca Semântica Densa (ChromaDB)
        dense_results = self.similarity_search(query, conversation_id=cid, k=fetch_k)

        # 2. Busca Léxica Esparsa (BM25)
        bm25_results = self.bm25_retriever.search(query, conversation_id=cid, k=fetch_k)

        if not dense_results and not bm25_results:
            return []

        # 3. Fusão e Re-ranqueamento via Reciprocal Rank Fusion (RRF)
        rrf_scores: Dict[str, float] = {}
        chunk_map: Dict[str, DocumentChunk] = {}

        for rank, chunk in enumerate(dense_results, 1):
            chunk_id = chunk.chunk_id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (rrf_k + rank))

        for rank, chunk in enumerate(bm25_results, 1):
            chunk_id = chunk.chunk_id
            chunk_map[chunk_id] = chunk
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (rrf_k + rank))

        # 4. Ordena por score RRF decrescente
        sorted_ids = sorted(
            rrf_scores.keys(),
            key=lambda item_id: rrf_scores[item_id],
            reverse=True
        )

        return [chunk_map[item_id] for item_id in sorted_ids[:k]]

    def get_indexed_files(self, conversation_id: Optional[str] = None) -> List[str]:
        """
        Retorna os arquivos indexados filtrados por conversation_id.
        """
        if not self.collection:
            return []

        where_filter = {"conversation_id": conversation_id} if conversation_id else None
        data = self.collection.get(where=where_filter, include=["metadatas"])
        if not data or not data.get("metadatas"):
            return []
        
        files = set()
        for meta in data["metadatas"]:
            if meta and "file_name" in meta:
                files.add(meta["file_name"])
        return sorted(list(files))

    def get_all_conversation_chunks(self, conversation_id: str) -> List[DocumentChunk]:
        """
        Recupera todos os chunks pertencentes a uma conversa no ChromaDB.
        """
        if not self.collection:
            return []

        try:
            data = self.collection.get(
                where={"conversation_id": conversation_id},
                include=["documents", "metadatas"]
            )
            if not data or not data.get("documents"):
                return []

            chunks = []
            for i in range(len(data["documents"])):
                meta = data["metadatas"][i] or {}
                chunks.append(
                    DocumentChunk(
                        chunk_id=data["ids"][i],
                        file_name=meta.get("file_name", "Desconhecido"),
                        page_number=int(meta.get("page_number", 1)),
                        content=data["documents"][i],
                        metadata=meta
                    )
                )
            return chunks
        except Exception:
            return []

    def get_document_chunks(self, file_name: str, conversation_id: Optional[str] = None) -> List[DocumentChunk]:
        """
        Recupera todos os chunks de um documento específico na conversa.
        """
        if not self.collection:
            return []

        try:
            where_filter: Dict[str, Any]
            if conversation_id:
                where_filter = {
                    "$and": [
                        {"file_name": {"$eq": file_name}},
                        {"conversation_id": {"$eq": conversation_id}}
                    ]
                }
            else:
                where_filter = {"file_name": file_name}

            data = self.collection.get(
                where=where_filter,
                include=["documents", "metadatas"]
            )
            if not data or not data.get("documents"):
                return []

            chunks = []
            for i in range(len(data["documents"])):
                meta = data["metadatas"][i] or {}
                chunks.append(
                    DocumentChunk(
                        chunk_id=data["ids"][i],
                        file_name=meta.get("file_name", file_name),
                        page_number=int(meta.get("page_number", 1)),
                        content=data["documents"][i],
                        metadata=meta
                    )
                )
            chunks.sort(key=lambda x: (x.page_number, x.chunk_id))
            return chunks
        except Exception:
            return []

    def delete_conversation_chunks(self, conversation_id: str):
        """
        Remove todos os chunks associados a uma conversa do banco vetorial e do índice BM25.
        """
        self.bm25_retriever.delete_conversation(conversation_id)
        if not self.collection:
            return
        try:
            self.collection.delete(where={"conversation_id": conversation_id})
        except Exception:
            pass
