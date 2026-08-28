import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from infrastructure.pdf_parser import PDFParser
from infrastructure.chromadb_adapter import ChromaDBAdapter
from infrastructure.gemini_adapter import GeminiAdapter
from infrastructure.conversation_repository import ConversationRepository
from services.rag_service import RAGService
from api.routes import create_rag_router

# Carrega variáveis de ambiente
load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./vector_store")
DB_PATH = os.getenv("DB_PATH", "./data/conversations.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Garante que os diretórios necessários existam
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)

# Composição de dependências (Clean Architecture Composition Root)
pdf_parser = PDFParser(chunk_size=1000, chunk_overlap=150)
chromadb_adapter = ChromaDBAdapter(persist_directory=CHROMA_DIR)
gemini_adapter = GeminiAdapter()
conversation_repo = ConversationRepository(db_path=DB_PATH)

rag_service = RAGService(
    pdf_parser=pdf_parser,
    vector_store=chromadb_adapter,
    llm_adapter=gemini_adapter,
    conversation_repo=conversation_repo
)

# Inicialização do FastAPI
app = FastAPI(
    title="Oráculo RAG API",
    description="API de Chat com IA e RAG Multi-Conversas com Clean Architecture, Google Gemini e ChromaDB",
    version="1.1.0"
)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Roteamento de arquivos estáticos para permitir visualização de PDFs
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Inclusão de rotas da aplicação
app.include_router(create_rag_router(rag_service, conversation_repo, upload_dir=UPLOAD_DIR))


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Oráculo RAG Backend Multi-Conversas"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
