import io
import re
from typing import List, Optional
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    file_name: str
    page_number: int
    content: str
    parent_id: Optional[str] = None
    parent_content: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class PDFParser:
    """
    Parser de alta performance utilizando PyMuPDF (fitz) com fallback para PyPDF,
    integrado a Recursive Character Chunking e Parent-Child Hierarchical Chunking
    (Parent Chunks amplos para contexto do LLM + Child Chunks compactos para busca vetorial cirúrgica).
    """

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        parent_chunk_size: Optional[int] = None,
        parent_chunk_overlap: int = 150,
        child_chunk_size: Optional[int] = None,
        child_chunk_overlap: int = 50,
        child_overlap: Optional[int] = None,
        separators: Optional[List[str]] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.parent_chunk_size = parent_chunk_size if parent_chunk_size is not None else (1500 if chunk_size == 800 else chunk_size)
        self.parent_chunk_overlap = parent_chunk_overlap
        self.child_chunk_size = child_chunk_size if child_chunk_size is not None else (600 if chunk_size == 800 else min(chunk_size, 600))
        self.child_chunk_overlap = child_overlap if child_overlap is not None else (100 if chunk_size == 800 else child_chunk_overlap)
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]

    def _extract_pages_pymupdf(self, file_bytes: bytes) -> List[tuple[int, str]]:
        """
        Extrai texto de cada página utilizando PyMuPDF (C engine - 10x mais rápido).
        """
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages_content: List[tuple[int, str]] = []

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text("text")
            page_number = page_idx + 1
            if text and text.strip():
                pages_content.append((page_number, text.strip()))

        doc.close()
        return pages_content

    def _extract_pages_pypdf(self, file_bytes: bytes) -> List[tuple[int, str]]:
        """
        Fallback para pypdf caso PyMuPDF encontre algum erro de streaming.
        """
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_content: List[tuple[int, str]] = []

        for page_idx, page in enumerate(reader.pages):
            page_number = page_idx + 1
            text = page.extract_text()
            if text and text.strip():
                pages_content.append((page_number, text.strip()))

        return pages_content

    def parse_pdf_bytes(
        self,
        file_bytes: bytes,
        file_name: str,
        hierarchical: bool = True
    ) -> List[DocumentChunk]:
        """
        Lê bytes de um arquivo PDF com motor PyMuPDF e segmenta hierarquicamente (Parent-Child) por página.
        """
        pages_content: List[tuple[int, str]] = []

        try:
            pages_content = self._extract_pages_pymupdf(file_bytes)
        except Exception:
            # Fallback seguro para pypdf
            try:
                pages_content = self._extract_pages_pypdf(file_bytes)
            except Exception as e:
                raise RuntimeError(f"Erro ao extrair conteúdo do PDF '{file_name}': {str(e)}")

        chunks: List[DocumentChunk] = []
        for page_number, text in pages_content:
            if hierarchical:
                page_chunks = self._hierarchical_chunk_page(
                    text=text,
                    file_name=file_name,
                    page_number=page_number
                )
            else:
                page_chunks = self._recursive_chunk_page(
                    text=text,
                    file_name=file_name,
                    page_number=page_number,
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap
                )
            chunks.extend(page_chunks)

        return chunks

    def parse_raw_text(
        self,
        text: str,
        title: str = "Texto Livre",
        hierarchical: bool = True
    ) -> List[DocumentChunk]:
        """
        Divide um texto bruto digitado pelo usuário em chunks mantendo rastreabilidade e estrutura hierárquica.
        """
        if not text or not text.strip():
            return []

        if hierarchical:
            return self._hierarchical_chunk_page(
                text=text.strip(),
                file_name=title,
                page_number=1
            )
        else:
            return self._recursive_chunk_page(
                text=text.strip(),
                file_name=title,
                page_number=1,
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap
            )

    def _split_text_with_separator(self, text: str, separator: str) -> List[str]:
        if separator == "":
            return list(text)
        return text.split(separator)

    def _recursive_split(
        self,
        text: str,
        separators: List[str],
        max_size: int,
        overlap: int
    ) -> List[str]:
        """
        Divide o texto recursivamente utilizando a lista hierárquica de separadores com limites configuráveis.
        """
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
            if len(s) < max_size:
                good_splits.append(s)
            else:
                if new_separators:
                    other_splits = self._recursive_split(s, new_separators, max_size, overlap)
                    good_splits.extend(other_splits)
                else:
                    for idx in range(0, len(s), max(1, max_size - overlap)):
                        good_splits.append(s[idx:idx + max_size])

        current_doc: List[str] = []
        total_len = 0
        final_chunks: List[str] = []

        for piece in good_splits:
            piece_len = len(piece)
            sep_len = len(separator) if separator != "" else 0

            if total_len + piece_len + (sep_len if current_doc else 0) <= max_size:
                current_doc.append(piece)
                total_len += piece_len + (sep_len if len(current_doc) > 1 else 0)
            else:
                if current_doc:
                    doc = separator.join(current_doc).strip()
                    if doc:
                        final_chunks.append(doc)
                    
                    while total_len > overlap and len(current_doc) > 1:
                        removed = current_doc.pop(0)
                        total_len -= len(removed) + len(separator)
                    
                current_doc.append(piece)
                total_len = sum(len(p) for p in current_doc) + (len(separator) * max(0, len(current_doc) - 1))

        if current_doc:
            doc = separator.join(current_doc).strip()
            if doc:
                final_chunks.append(doc)

        return final_chunks

    def _hierarchical_chunk_page(
        self,
        text: str,
        file_name: str,
        page_number: int
    ) -> List[DocumentChunk]:
        """
        Gera Parent Chunks (contexto amplo) e os subdivide em Child Chunks (busca granular).
        """
        # 1. Gera os Parent Chunks amplos (~1200 chars)
        parent_texts = self._recursive_split(
            text=text,
            separators=self.separators,
            max_size=self.parent_chunk_size,
            overlap=self.parent_chunk_overlap
        )

        all_child_chunks: List[DocumentChunk] = []

        for p_idx, p_text in enumerate(parent_texts):
            clean_parent = p_text.strip()
            if not clean_parent:
                continue

            parent_id = f"{file_name}_p{page_number}_parent_{p_idx}"

            # 2. Subdivide o Parent Chunk em Child Chunks (~250 chars)
            child_texts = self._recursive_split(
                text=clean_parent,
                separators=self.separators,
                max_size=self.child_chunk_size,
                overlap=self.child_chunk_overlap
            )

            # Se o texto pai for pequeno o suficiente, o próprio pai vira um child
            if not child_texts:
                child_texts = [clean_parent]

            for c_idx, c_text in enumerate(child_texts):
                clean_child = c_text.strip()
                if not clean_child:
                    continue

                chunk_id = f"{parent_id}_child_{c_idx}"
                all_child_chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        file_name=file_name,
                        page_number=page_number,
                        content=clean_child,
                        parent_id=parent_id,
                        parent_content=clean_parent,
                        metadata={
                            "parent_id": parent_id,
                            "parent_content": clean_parent
                        }
                    )
                )

        return all_child_chunks

    def _recursive_chunk_page(
        self,
        text: str,
        file_name: str,
        page_number: int,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[DocumentChunk]:
        """
        Fallback para chunking simples e uniforme.
        """
        text_chunks = self._recursive_split(
            text=text,
            separators=self.separators,
            max_size=chunk_size,
            overlap=chunk_overlap
        )
        return [
            DocumentChunk(
                chunk_id=f"{file_name}_p{page_number}_c{idx}",
                file_name=file_name,
                page_number=page_number,
                content=chunk_content.strip(),
                parent_id=f"{file_name}_p{page_number}_c{idx}",
                parent_content=chunk_content.strip(),
                metadata={}
            )
            for idx, chunk_content in enumerate(text_chunks)
            if chunk_content.strip()
        ]
