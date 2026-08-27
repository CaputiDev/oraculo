from typing import Protocol, List, Dict, Any, Optional, runtime_checkable
from infrastructure.pdf_parser import DocumentChunk
from infrastructure.gemini_adapter import RAGResponse, Citation
from infrastructure.conversation_repository import ConversationRepository


@runtime_checkable
class IPDFParser(Protocol):
    def parse_pdf_bytes(self, file_bytes: bytes, file_name: str) -> List[DocumentChunk]:
        ...

    def parse_raw_text(self, text: str, title: str = "Texto Livre") -> List[DocumentChunk]:
        ...


@runtime_checkable
class IVectorStore(Protocol):
    def add_chunks(self, chunks: List[DocumentChunk], conversation_id: str = "default") -> int:
        ...

    def similarity_search(self, query: str, conversation_id: Optional[str] = None, k: int = 4) -> List[DocumentChunk]:
        ...

    def get_indexed_files(self, conversation_id: Optional[str] = None) -> List[str]:
        ...

    def get_document_chunks(self, file_name: str, conversation_id: Optional[str] = None) -> List[DocumentChunk]:
        ...

    def delete_conversation_chunks(self, conversation_id: str):
        ...


@runtime_checkable
class ILLMAdapter(Protocol):
    def generate_rag_answer(self, query: str, context_chunks: List[DocumentChunk]) -> RAGResponse:
        ...


class RAGService:
    """
    Camada de Casos de Uso e Regras de Negócio (Clean Architecture).
    Gerencia ingestão, busca RAG e persistência de histórico por conversation_id.
    """

    def __init__(
        self,
        pdf_parser: IPDFParser,
        vector_store: IVectorStore,
        llm_adapter: ILLMAdapter,
        conversation_repo: Optional[ConversationRepository] = None
    ):
        self.pdf_parser = pdf_parser
        self.vector_store = vector_store
        self.llm_adapter = llm_adapter
        self.conversation_repo = conversation_repo

    def ingest_pdf(
        self,
        file_bytes: bytes,
        file_name: str,
        conversation_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Caso de uso: Ingerir arquivo PDF vinculado a uma conversa específica.
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

        total_indexed = self.vector_store.add_chunks(chunks, conversation_id=conversation_id)
        unique_pages = len(set(c.page_number for c in chunks))

        if self.conversation_repo:
            self.conversation_repo.add_file(conversation_id, file_name)

        return {
            "success": True,
            "file_name": file_name,
            "conversation_id": conversation_id,
            "total_chunks": total_indexed,
            "total_pages": unique_pages,
            "message": f"Arquivo {file_name} indexado na conversa ({unique_pages} páginas, {total_indexed} chunks)."
        }

    def ingest_text(
        self,
        text: str,
        title: str = "Texto Livre",
        conversation_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Caso de uso: Ingerir texto livre vinculado a uma conversa específica.
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

        total_indexed = self.vector_store.add_chunks(chunks, conversation_id=conversation_id)

        if self.conversation_repo:
            self.conversation_repo.add_file(conversation_id, title)

        return {
            "success": True,
            "file_name": title,
            "conversation_id": conversation_id,
            "total_chunks": total_indexed,
            "message": f"Texto '{title}' indexado na conversa ({total_indexed} chunks)."
        }

    def answer_query(
        self,
        query: str,
        conversation_id: str = "default",
        top_k: int = 4
    ) -> RAGResponse:
        """
        Caso de uso: Responder a uma pergunta do usuário utilizando RAG isolado por conversa.
        1. Registra mensagem do usuário no repositório de histórico.
        2. Recupera chunks pertencentes exclusivamente à conversation_id.
        3. Invoca o modelo Gemini com o contexto recuperado.
        4. Registra resposta da IA com citações no repositório.
        """
        if not query or not query.strip():
            return RAGResponse(
                answer="Por favor, digite uma pergunta válida.",
                citations=[]
            )

        # 1. Registra mensagem do usuário
        if self.conversation_repo:
            conv = self.conversation_repo.get_conversation(conversation_id)
            if not conv:
                self.conversation_repo.create_conversation(
                    title=query[:30] + ("..." if len(query) > 30 else ""),
                    conversation_id=conversation_id
                )
            elif len(conv.messages) == 0:
                self.conversation_repo.update_title(
                    conversation_id,
                    query[:35] + ("..." if len(query) > 35 else "")
                )
            self.conversation_repo.add_message(conversation_id, "user", query)

        # 2. Recuperação Semântica Filtrada pela Conversa
        retrieved_chunks = self.vector_store.similarity_search(
            query=query,
            conversation_id=conversation_id,
            k=top_k
        )

        # 3. Geração Fundamentada
        response = self.llm_adapter.generate_rag_answer(
            query=query,
            context_chunks=retrieved_chunks
        )

        # 4. Registra resposta no histórico
        if self.conversation_repo:
            citations_data = [
                c.model_dump() if hasattr(c, "model_dump") else c.dict()
                for c in response.citations
            ]
            self.conversation_repo.add_message(
                conversation_id,
                "assistant",
                response.answer,
                citations_data
            )

        return response

    def list_documents(self, conversation_id: Optional[str] = None) -> List[str]:
        """
        Caso de uso: Listar todos os documentos indexados na conversa.
        """
        if self.conversation_repo and conversation_id:
            files = self.conversation_repo.get_conversation_files(conversation_id)
            if files:
                return files
        return self.vector_store.get_indexed_files(conversation_id=conversation_id)

    def get_document_content(self, file_name: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Caso de uso: Recuperar o conteúdo detalhado e chunks de um documento específico da conversa.
        """
        if hasattr(self.vector_store, "get_document_chunks"):
            chunks = self.vector_store.get_document_chunks(file_name, conversation_id=conversation_id)
        else:
            chunks = []

        total_pages = len(set(c.page_number for c in chunks)) if chunks else 1

        return {
            "file_name": file_name,
            "conversation_id": conversation_id,
            "is_pdf": file_name.lower().endswith(".pdf"),
            "total_chunks": len(chunks),
            "total_pages": max(1, total_pages),
            "chunks": [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in chunks]
        }

    def delete_conversation(self, conversation_id: str) -> bool:
        """
        Caso de uso: Excluir conversa, histórico e limpar seus vetores no ChromaDB.
        """
        if hasattr(self.vector_store, "delete_conversation_chunks"):
            self.vector_store.delete_conversation_chunks(conversation_id)
        
        if self.conversation_repo:
            return self.conversation_repo.delete_conversation(conversation_id)
        return True
