import io
import re
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
    Parser responsável por extrair texto e estruturar documentos utilizando Recursive Character Chunking
    (divisão hierárquica por parágrafos, frases e palavras) mantendo metadados estritos de arquivo,
    número de página e identificador único de bloco.
    """

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        separators: Optional[List[str]] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]

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

            page_chunks = self._recursive_chunk_page(
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

        return self._recursive_chunk_page(
            text=text.strip(),
            file_name=title,
            page_number=1
        )

    def _split_text_with_separator(self, text: str, separator: str) -> List[str]:
        if separator == "":
            return list(text)
        return text.split(separator)

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        """
        Divide o texto recursivamente utilizando a lista hierárquica de separadores.
        """
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators = []

        for i, _s in enumerate(separators):
            if _s == "":
                separator = _s
                break
            if _s in text:
                separator = _s
                new_separators = separators[i + 1:]
                break

        splits = self._split_text_with_separator(text, separator)

        good_splits: List[str] = []
        for s in splits:
            if not s:
                continue
            if len(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    other_splits = self._recursive_split(s, new_separators)
                    good_splits.extend(other_splits)
                else:
                    # Fallback final se não houver mais separadores
                    for idx in range(0, len(s), self.chunk_size - self.chunk_overlap):
                        good_splits.append(s[idx:idx + self.chunk_size])

        # Agrupa os splits menores respeitando o chunk_size e overlap
        current_doc: List[str] = []
        total_len = 0

        for piece in good_splits:
            piece_len = len(piece)
            sep_len = len(separator) if separator != "" else 0

            if total_len + piece_len + (sep_len if current_doc else 0) <= self.chunk_size:
                current_doc.append(piece)
                total_len += piece_len + (sep_len if len(current_doc) > 1 else 0)
            else:
                if current_doc:
                    merged = separator.join(current_doc).strip()
                    if merged:
                        final_chunks.append(merged)
                    
                    # Aplica overlap mantendo elementos finais
                    while current_doc and total_len > self.chunk_overlap:
                        removed = current_doc.pop(0)
                        total_len -= len(removed) + (sep_len if current_doc else 0)

                current_doc.append(piece)
                total_len += piece_len + (sep_len if len(current_doc) > 1 else 0)

        if current_doc:
            merged = separator.join(current_doc).strip()
            if merged:
                final_chunks.append(merged)

        return final_chunks

    def _recursive_chunk_page(self, text: str, file_name: str, page_number: int) -> List[DocumentChunk]:
        """
        Gera instâncias de DocumentChunk com metadados completos a partir do texto dividido.
        """
        if len(text) <= self.chunk_size:
            chunk_id = f"{file_name}_p{page_number}_c0"
            return [
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
            ]

        text_pieces = self._recursive_split(text, self.separators)
        chunks: List[DocumentChunk] = []

        for idx, piece in enumerate(text_pieces):
            chunk_id = f"{file_name}_p{page_number}_c{idx}"
            chunks.append(
                DocumentChunk(
                    chunk_id=chunk_id,
                    file_name=file_name,
                    page_number=page_number,
                    content=piece,
                    metadata={
                        "source": file_name,
                        "page": page_number,
                        "chunk_index": idx
                    }
                )
            )

        return chunks
