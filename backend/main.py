import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from infrastructure.pdf_parser import PDFParser
from infrastructure.chromadb_adapter import ChromaDBAdapter
from infrastructure.gemini_adapter import GeminiAdapter
from services.rag_service import RAGService
from api.routes import create_rag_router

# Carrega variáveis de ambiente
load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./vector_store")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Garante que os diretórios necessários existam
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

# Composição de dependências (Clean Architecture Composition Root)
pdf_parser = PDFParser(chunk_size=1000, chunk_overlap=150)
chromadb_adapter = ChromaDBAdapter(persist_directory=CHROMA_DIR)
gemini_adapter = GeminiAdapter()
rag_service = RAGService(
    pdf_parser=pdf_parser,
    vector_store=chromadb_adapter,
    llm_adapter=gemini_adapter
)

# Inicialização do FastAPI
app = FastAPI(
    title="Oráculo RAG API",
    description="API de Chat com IA e RAG utilizando Clean Architecture, Google Gemini e ChromaDB",
    version="1.0.0"
)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Roteamento de arquivos estáticos para permitir visualização de PDFs no visualizador
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Inclusão de rotas da aplicação
app.include_router(create_rag_router(rag_service, upload_dir=UPLOAD_DIR))


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Oráculo RAG Backend"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
