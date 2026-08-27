import os
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from services.rag_service import RAGService
from infrastructure.gemini_adapter import RAGResponse


class ChatRequest(BaseModel):
    query: str
    top_k: Optional[int] = 4


class TextUploadRequest(BaseModel):
    text: str
    title: Optional[str] = "Texto Livre"


class IngestionResponse(BaseModel):
    success: bool
    results: List[dict]
    total_processed: int


def create_rag_router(rag_service: RAGService, upload_dir: str = "./uploads") -> APIRouter:
    """
    Fábrica de roteamento FastAPI com injeção de dependência do RAGService.
    """
    router = APIRouter(prefix="/api", tags=["RAG"])
    os.makedirs(upload_dir, exist_ok=True)

    @router.post("/upload", response_model=IngestionResponse)
    async def upload_files(files: List[UploadFile] = File(...)):
        """
        Recebe múltiplos arquivos PDF, salva em disco e processa na base vetorial.
        """
        results = []
        if not files:
            raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

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
                
                # Salva o PDF no disco para permitir visualização posterior no frontend
                file_path = os.path.join(upload_dir, file.filename)
                with open(file_path, "wb") as f:
                    f.write(content)

                # Ingestão através da camada de serviço
                result = rag_service.ingest_pdf(
                    file_bytes=content,
                    file_name=file.filename
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

    @router.post("/upload-text")
    def upload_text(payload: TextUploadRequest):
        """
        Ingere um texto livre na base de conhecimento.
        """
        result = rag_service.ingest_text(
            text=payload.text,
            title=payload.title or "Texto Livre"
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result

    @router.post("/chat", response_model=RAGResponse)
    def chat(payload: ChatRequest):
        """
        Executa a consulta RAG fundamentada nos documentos e retorna resposta com citações.
        """
        try:
            return rag_service.answer_query(
                query=payload.query,
                top_k=payload.top_k or 4
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro interno no chat: {str(e)}")

    @router.get("/documents")
    def list_documents():
        """
        Lista os arquivos indexados no banco vetorial.
        """
        return {"documents": rag_service.list_documents()}

    return router
