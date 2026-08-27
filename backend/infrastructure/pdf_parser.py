import io
from typing import List, Optional
from pydantic import BaseModel, Field
from pypdf import PdfReader


class DocumentChunk(BaseModel):
    chunk_id: str
    file_name: str
    page_number: int
    content: str
    metadata: dict = Field(default_factory=dict)


class PDFParser:
    """
    Parser responsável por extrair texto e estruturar documentos mantendo metadados
    estritos de arquivo, número de página e identificador único de bloco.
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def parse_pdf_bytes(self, file_bytes: bytes, file_name: str) -> List[DocumentChunk]:
        """
        Lê bytes de um arquivo PDF e extrai blocos de texto associados a cada página.
        """
        reader = PdfReader(io.BytesIO(file_bytes))
        chunks: List[DocumentChunk] = []

        for page_idx, page in enumerate(reader.pages):
            page_number = page_idx + 1
            text = page.extract_text()
            if not text or not text.strip():
                continue

            page_chunks = self._chunk_text(
                text=text.strip(),
                file_name=file_name,
                page_number=page_number
            )
            chunks.extend(page_chunks)

        return chunks

    def parse_raw_text(self, text: str, title: str = "Texto Livre") -> List[DocumentChunk]:
        """
        Divide um texto bruto digitado pelo usuário em chunks mantendo rastreabilidade.
        """
        if not text or not text.strip():
            return []

        return self._chunk_text(
            text=text.strip(),
            file_name=title,
            page_number=1
        )

    def _chunk_text(self, text: str, file_name: str, page_number: int) -> List[DocumentChunk]:
        """
        Divide o texto em pedaços menores respeitando chunk_size e overlap.
        """
        chunks: List[DocumentChunk] = []
        
        if len(text) <= self.chunk_size:
            chunk_id = f"{file_name}_p{page_number}_c0"
            chunks.append(
                DocumentChunk(
                    chunk_id=chunk_id,
                    file_name=file_name,
                    page_number=page_number,
                    content=text,
                    metadata={
                        "source": file_name,
                        "page": page_number,
                        "chunk_index": 0
                    }
                )
            )
            return chunks

        start = 0
        chunk_idx = 0
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunk_content = text[start:end].strip()
            
            if chunk_content:
                chunk_id = f"{file_name}_p{page_number}_c{chunk_idx}"
                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        file_name=file_name,
                        page_number=page_number,
                        content=chunk_content,
                        metadata={
                            "source": file_name,
                            "page": page_number,
                            "chunk_index": chunk_idx
                        }
                    )
                )
                chunk_idx += 1

            if end == len(text):
                break
            start += self.chunk_size - self.chunk_overlap

        return chunks
