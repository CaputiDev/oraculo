import os
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from services.rag_service import RAGService
from infrastructure.gemini_adapter import RAGResponse
from infrastructure.conversation_repository import ConversationRepository


class ChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = "default"
    top_k: Optional[int] = 4


class TextUploadRequest(BaseModel):
    text: str
    title: Optional[str] = "Texto Livre"
    conversation_id: Optional[str] = "default"


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "Nova Conversa"


class IngestionResponse(BaseModel):
    success: bool
    results: List[dict]
    total_processed: int


def create_rag_router(
    rag_service: RAGService,
    conversation_repo: ConversationRepository,
    upload_dir: str = "./uploads"
) -> APIRouter:
    """
    Fábrica de roteamento FastAPI para RAG e Gerenciamento de Conversas.
    """
    router = APIRouter(prefix="/api", tags=["RAG & Conversas"])
    os.makedirs(upload_dir, exist_ok=True)

    # --- ROTAS DE GERENCIAMENTO DE CONVERSAS ---

    @router.get("/conversations")
    def list_conversations():
        """
        Retorna a lista de todas as conversas persistidas.
        """
        convs = conversation_repo.list_conversations()
        if not convs:
            first_conv = conversation_repo.create_conversation("Conversa Inicial")
            return [
                {
                    "id": first_conv.id,
                    "title": first_conv.title,
                    "created_at": first_conv.created_at,
                    "updated_at": first_conv.updated_at,
                    "message_count": 0,
                    "file_count": 0
                }
            ]
        return convs

    @router.post("/conversations")
    def create_conversation(payload: CreateConversationRequest):
        """
        Cria uma nova sessão de conversa.
        """
        return conversation_repo.create_conversation(title=payload.title or "Nova Conversa")

    @router.get("/conversations/{conversation_id}")
    def get_conversation(conversation_id: str):
        """
        Retorna o histórico de mensagens e arquivos de uma conversa.
        """
        conv = conversation_repo.get_conversation(conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversa não encontrada.")
        return conv

    @router.delete("/conversations/{conversation_id}")
    def delete_conversation(conversation_id: str):
        """
        Exclui a conversa, histórico e seus respectivos vetores no ChromaDB.
        """
        success = rag_service.delete_conversation(conversation_id)
        return {"success": success, "conversation_id": conversation_id}

    # --- ROTAS DE UPLOAD DE ARQUIVOS (PDF) ---

    async def _process_upload(files: List[UploadFile], conversation_id: str):
        results = []
        if not files:
            raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

        conv = conversation_repo.get_conversation(conversation_id)
        if not conv:
            conversation_repo.create_conversation(title="Nova Conversa", conversation_id=conversation_id)

        conv_upload_dir = os.path.join(upload_dir, conversation_id)
        os.makedirs(conv_upload_dir, exist_ok=True)

        for file in files:
            if not file.filename.lower().endswith(".pdf"):
                results.append({
                    "success": False,
                    "file_name": file.filename,
                    "message": "Formato não suportado. Apenas arquivos PDF são aceitos."
                })
                continue

            try:
                content = await file.read()
                
                file_path = os.path.join(conv_upload_dir, file.filename)
                with open(file_path, "wb") as f:
                    f.write(content)

                global_file_path = os.path.join(upload_dir, file.filename)
                with open(global_file_path, "wb") as f:
                    f.write(content)

                result = rag_service.ingest_pdf(
                    file_bytes=content,
                    file_name=file.filename,
                    conversation_id=conversation_id
                )
                results.append(result)
            except Exception as e:
                results.append({
                    "success": False,
                    "file_name": file.filename,
                    "message": f"Erro no processamento: {str(e)}"
                })

        return IngestionResponse(
            success=any(r.get("success") for r in results),
            results=results,
            total_processed=len(results)
        )

    @router.post("/upload", response_model=IngestionResponse)
    async def upload_files_general(
        files: List[UploadFile] = File(...),
        conversation_id: str = Form(default="default")
    ):
        return await _process_upload(files, conversation_id)

    @router.post("/conversations/{conversation_id}/upload", response_model=IngestionResponse)
    async def upload_files_for_conversation(
        conversation_id: str,
        files: List[UploadFile] = File(...)
    ):
        return await _process_upload(files, conversation_id)

    # --- ROTAS DE UPLOAD DE TEXTO LIVRE ---

    @router.post("/upload-text")
    def upload_text_general(payload: TextUploadRequest):
        target_conv = payload.conversation_id or "default"
        conv = conversation_repo.get_conversation(target_conv)
        if not conv:
            conversation_repo.create_conversation(title="Nova Conversa", conversation_id=target_conv)

        result = rag_service.ingest_text(
            text=payload.text,
            title=payload.title or "Texto Livre",
            conversation_id=target_conv
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result

    @router.post("/conversations/{conversation_id}/upload-text")
    def upload_text_for_conversation(conversation_id: str, payload: TextUploadRequest):
        conv = conversation_repo.get_conversation(conversation_id)
        if not conv:
            conversation_repo.create_conversation(title="Nova Conversa", conversation_id=conversation_id)

        result = rag_service.ingest_text(
            text=payload.text,
            title=payload.title or "Texto Livre",
            conversation_id=conversation_id
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result

    # --- ROTAS DE CHAT ---

    @router.post("/chat", response_model=RAGResponse)
    def chat_general(payload: ChatRequest):
        target_conv = payload.conversation_id or "default"
        try:
            return rag_service.answer_query(
                query=payload.query,
                conversation_id=target_conv,
                top_k=payload.top_k or 4
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro interno no chat: {str(e)}")

    @router.post("/conversations/{conversation_id}/chat", response_model=RAGResponse)
    def chat_for_conversation(conversation_id: str, payload: ChatRequest):
        try:
            return rag_service.answer_query(
                query=payload.query,
                conversation_id=conversation_id,
                top_k=payload.top_k or 4
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro interno no chat: {str(e)}")

    # --- ROTAS DE DOCUMENTOS ---

    @router.get("/documents")
    def list_documents_general():
        return {"documents": rag_service.list_documents()}

    @router.get("/conversations/{conversation_id}/documents")
    def list_documents_for_conversation(conversation_id: str):
        return {"documents": rag_service.list_documents(conversation_id=conversation_id)}

    @router.get("/documents/{file_name:path}")
    def get_document_details_general(file_name: str):
        return rag_service.get_document_content(file_name)

    @router.get("/conversations/{conversation_id}/documents/{file_name:path}")
    def get_document_details_for_conversation(conversation_id: str, file_name: str):
        return rag_service.get_document_content(file_name, conversation_id=conversation_id)

    return router
