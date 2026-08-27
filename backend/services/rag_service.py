from typing import Protocol, List, Dict, Any, Optional, runtime_checkable
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.gemini_adapter import RAGResponse, Citation


@runtime_checkable
class IPDFParser(Protocol):
    def parse_pdf_bytes(self, file_bytes: bytes, file_name: str) -> List[DocumentChunk]:
        ...

    def parse_raw_text(self, text: str, title: str = "Texto Livre") -> List[DocumentChunk]:
        ...


@runtime_checkable
class IVectorStore(Protocol):
    def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        ...

    def similarity_search(self, query: str, k: int = 4) -> List[DocumentChunk]:
        ...

    def get_indexed_files(self) -> List[str]:
        ...


@runtime_checkable
class ILLMAdapter(Protocol):
    def generate_rag_answer(self, query: str, context_chunks: List[DocumentChunk]) -> RAGResponse:
        ...


class RAGService:
    """
    Camada de Casos de Uso e Regras de Negócio (Clean Architecture).
    Depende exclusivamente de interfaces/protocolos abstratos (Dependency Inversion Principle).
    """

    def __init__(
        self,
        pdf_parser: IPDFParser,
        vector_store: IVectorStore,
        llm_adapter: ILLMAdapter
    ):
        self.pdf_parser = pdf_parser
        self.vector_store = vector_store
        self.llm_adapter = llm_adapter

    def ingest_pdf(self, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
        """
        Caso de uso: Ingerir arquivo PDF na base de conhecimento.
        """
        chunks: List[DocumentChunk] = self.pdf_parser.parse_pdf_bytes(
            file_bytes=file_bytes,
            file_name=file_name
        )

        if not chunks:
            return {
                "success": False,
                "file_name": file_name,
                "total_chunks": 0,
                "total_pages": 0,
                "message": "Nenhum texto legível foi extraído do PDF."
            }

        total_indexed = self.vector_store.add_chunks(chunks)
        unique_pages = len(set(c.page_number for c in chunks))

        return {
            "success": True,
            "file_name": file_name,
            "total_chunks": total_indexed,
            "total_pages": unique_pages,
            "message": f"Arquivo {file_name} indexado com sucesso ({unique_pages} páginas, {total_indexed} chunks)."
        }

    def ingest_text(self, text: str, title: str = "Texto Livre") -> Dict[str, Any]:
        """
        Caso de uso: Ingerir texto livre fornecido pelo usuário.
        """
        chunks: List[DocumentChunk] = self.pdf_parser.parse_raw_text(
            text=text,
            title=title
        )

        if not chunks:
            return {
                "success": False,
                "file_name": title,
                "total_chunks": 0,
                "message": "O texto fornecido está vazio."
            }

        total_indexed = self.vector_store.add_chunks(chunks)

        return {
            "success": True,
            "file_name": title,
            "total_chunks": total_indexed,
            "message": f"Texto '{title}' indexado com sucesso ({total_indexed} chunks)."
        }

    def answer_query(self, query: str, top_k: int = 4) -> RAGResponse:
        """
        Caso de uso: Responder a uma pergunta do usuário utilizando RAG.
        1. Consulta o banco vetorial para recuperar os chunks mais relevantes.
        2. Envia os chunks e a pergunta para o adaptador do LLM.
        3. Retorna a resposta estruturada com citações e metadados.
        """
        if not query or not query.strip():
            return RAGResponse(
                answer="Por favor, digite uma pergunta válida.",
                citations=[]
            )

        # 1. Recuperação Semântica
        retrieved_chunks = self.vector_store.similarity_search(query=query, k=top_k)

        # 2. Geração Fundamentada
        return self.llm_adapter.generate_rag_answer(
            query=query,
            context_chunks=retrieved_chunks
        )

    def list_documents(self) -> List[str]:
        """
        Caso de uso: Listar todos os documentos indexados na base vetorial.
        """
        return self.vector_store.get_indexed_files()
