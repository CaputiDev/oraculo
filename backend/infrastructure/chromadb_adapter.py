import os
from typing import List, Optional, Dict, Any
from infrastructure.pdf_parser import DocumentChunk


class ChromaDBAdapter:
    """
    Adaptador de infraestrutura para o banco vetorial ChromaDB com suporte a persistência local
    e particionamento/filtro por conversation_id.
    """

    def __init__(
        self,
        persist_directory: str = "./vector_store",
        collection_name: str = "oraculo_knowledge_base",
        embedding_model_name: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model_name or os.getenv(
            "EMBEDDING_MODEL", "models/gemini-embedding-001"
        )
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")

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

    def _get_embedding(self, text: str) -> List[float]:
        """
        Gera embeddings utilizando Google Generative AI com fallback dinâmico de modelo.
        """
        candidate_models = [
            self.embedding_model_name,
            "models/gemini-embedding-001",
            "models/text-embedding-004",
            "models/embedding-001",
        ]
        candidate_models = list(dict.fromkeys(candidate_models))

        try:
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)

            last_error = None
            for model_name in candidate_models:
                try:
                    result = genai.embed_content(
                        model=model_name,
                        content=text,
                        task_type="retrieval_document"
                    )
                    self.embedding_model_name = model_name
                    return result["embedding"]
                except Exception as e:
                    last_error = e
                    continue

            raise last_error or RuntimeError("Nenhum modelo de embedding respondeu com sucesso.")
        except Exception as e:
            raise RuntimeError(f"Erro ao gerar embeddings com Gemini: {str(e)}")

    def _get_query_embedding(self, query: str) -> List[float]:
        candidate_models = [
            self.embedding_model_name,
            "models/gemini-embedding-001",
            "models/text-embedding-004",
            "models/embedding-001",
        ]
        candidate_models = list(dict.fromkeys(candidate_models))

        try:
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)

            last_error = None
            for model_name in candidate_models:
                try:
                    result = genai.embed_content(
                        model=model_name,
                        content=query,
                        task_type="retrieval_query"
                    )
                    self.embedding_model_name = model_name
                    return result["embedding"]
                except Exception as e:
                    last_error = e
                    continue

            raise last_error or RuntimeError("Nenhum modelo de embedding para busca respondeu.")
        except Exception as e:
            raise RuntimeError(f"Erro ao gerar embedding de busca: {str(e)}")

    def add_chunks(self, chunks: List[DocumentChunk], conversation_id: str = "default") -> int:
        """
        Adiciona lista de chunks de documentos ao ChromaDB associados a uma conversation_id.
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

        embeddings = [self._get_embedding(doc) for doc in documents]

        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings
        )
        return len(chunks)

    def similarity_search(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        k: int = 4
    ) -> List[DocumentChunk]:
        """
        Executa busca semântica filtrando exclusivamente pelos chunks da conversa ativa.
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
        Remove todos os chunks associados a uma conversa do banco vetorial.
        """
        if not self.collection:
            return
        try:
            self.collection.delete(where={"conversation_id": conversation_id})
        except Exception:
            pass
