import os
from typing import List, Optional
from infrastructure.pdf_parser import DocumentChunk


class ChromaDBAdapter:
    """
    Adaptador de infraestrutura para o banco vetorial ChromaDB com suporte a persistência local.
    """

    def __init__(
        self,
        persist_directory: str = "./vector_store",
        collection_name: str = "oraculo_knowledge_base",
        embedding_model_name: str = "models/text-embedding-004",
        api_key: Optional[str] = None
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model_name
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
        Gera embeddings utilizando Google Generative AI (text-embedding-004).
        """
        try:
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)
            result = genai.embed_content(
                model=self.embedding_model_name,
                content=text,
                task_type="retrieval_document"
            )
            return result["embedding"]
        except Exception as e:
            raise RuntimeError(f"Erro ao gerar embeddings com Gemini: {str(e)}")

    def _get_query_embedding(self, query: str) -> List[float]:
        try:
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)
            result = genai.embed_content(
                model=self.embedding_model_name,
                content=query,
                task_type="retrieval_query"
            )
            return result["embedding"]
        except Exception as e:
            raise RuntimeError(f"Erro ao gerar embedding de busca: {str(e)}")

    def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        """
        Adiciona lista de chunks de documentos ao ChromaDB com embeddings e metadados.
        """
        if not chunks:
            return 0
        if not self.collection:
            raise RuntimeError("ChromaDB client não foi inicializado corretamente.")

        ids = [chunk.chunk_id for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        metadatas = [
            {
                "file_name": chunk.file_name,
                "page_number": chunk.page_number,
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

    def similarity_search(self, query: str, k: int = 4) -> List[DocumentChunk]:
        """
        Executa busca por similaridade semântica para recuperar os chunks mais relevantes.
        """
        if not self.collection:
            raise RuntimeError("ChromaDB client não foi inicializado corretamente.")

        query_emb = self._get_query_embedding(query)
        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=k,
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

    def get_indexed_files(self) -> List[str]:
        """
        Retorna a lista de nomes de arquivos únicos indexados no ChromaDB.
        """
        if not self.collection:
            return []

        data = self.collection.get(include=["metadatas"])
        if not data or not data.get("metadatas"):
            return []
        
        files = set()
        for meta in data["metadatas"]:
            if meta and "file_name" in meta:
                files.add(meta["file_name"])
        return sorted(list(files))
