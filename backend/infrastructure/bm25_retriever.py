import re
import unicodedata
from typing import List, Dict, Optional
from infrastructure.pdf_parser import DocumentChunk


def tokenize(text: str) -> List[str]:
    """
    Tokenizador multilíngue e normalizador para BM25.
    Converte para minúsculas, remove acentos mantendo letras base e extrai palavras/códigos alfanuméricos.
    """
    if not text:
        return []
    
    # Remove marcas diacríticas (acentos) preservando os caracteres base (ex: ç -> c, ã -> a)
    nfd_text = unicodedata.normalize('NFD', text.lower())
    clean_ascii = ''.join(c for c in nfd_text if unicodedata.category(c) != 'Mn')
    
    # Mantém letras, números, hífens e underlines (preserva códigos técnicos como SKU-123 ou ERR_404)
    tokens = re.findall(r'[a-z0-9_\-]+', clean_ascii)
    return [t for t in tokens if len(t) > 1 or t.isalnum()]


class BM25Retriever:
    """
    Motor de Busca Léxica Esparsa BM25 (BM25Okapi) isolado por conversation_id.
    Ideal para termos exatos, nomes próprios, números de protocolo, siglas e códigos técnicos.
    """

    def __init__(self):
        # Mapeia conversation_id -> {"chunks": List[DocumentChunk], "index": BM25Okapi}
        self._conversation_indexes: Dict[str, Dict] = {}

    def add_chunks(self, chunks: List[DocumentChunk], conversation_id: str = "default") -> int:
        """
        Adiciona e reindexa chunks no índice BM25 da conversa.
        """
        if not chunks:
            return 0

        try:
            from rank_bm25 import BM25Plus
        except ImportError:
            raise RuntimeError("rank-bm25 não está instalado. Execute pip install rank-bm25.")

        if conversation_id not in self._conversation_indexes:
            self._conversation_indexes[conversation_id] = {
                "chunks": [],
                "index": None,
                "tokenized_corpus": []
            }

        conv_data = self._conversation_indexes[conversation_id]
        
        # Evita duplicatas por chunk_id
        existing_ids = {c.chunk_id for c in conv_data["chunks"]}
        for chunk in chunks:
            if chunk.chunk_id not in existing_ids:
                conv_data["chunks"].append(chunk)
                existing_ids.add(chunk.chunk_id)

        # Reconstrói o corpus tokenizado e o índice BM25Plus da conversa
        conv_data["tokenized_corpus"] = [tokenize(c.content) for c in conv_data["chunks"]]
        if conv_data["tokenized_corpus"]:
            conv_data["index"] = BM25Plus(conv_data["tokenized_corpus"])

        return len(chunks)

    def search(
        self,
        query: str,
        conversation_id: str = "default",
        k: int = 4
    ) -> List[DocumentChunk]:
        """
        Executa busca léxica BM25 nos documentos da conversa especificada.
        """
        if not query or not query.strip():
            return []

        conv_data = self._conversation_indexes.get(conversation_id)
        if not conv_data or not conv_data.get("index") or not conv_data.get("chunks"):
            return []

        tokenized_query = tokenize(query)
        if not tokenized_query:
            return []

        bm25: BM25Plus = conv_data["index"]
        chunks: List[DocumentChunk] = conv_data["chunks"]
        tokenized_corpus: List[List[str]] = conv_data.get("tokenized_corpus", [])

        # Calcula scores BM25 para todos os documentos do corpus da conversa
        scores = bm25.get_scores(tokenized_query)

        # Filtra documentos que compartilham tokens da query e com score > 0
        scored_pairs = []
        query_set = set(tokenized_query)
        for i in range(len(chunks)):
            # Garante que há sobreposição real de termos
            has_term_overlap = bool(query_set.intersection(tokenized_corpus[i])) if i < len(tokenized_corpus) else False
            if has_term_overlap and scores[i] > 0.0:
                scored_pairs.append((chunks[i], scores[i]))

        scored_pairs.sort(key=lambda x: x[1], reverse=True)
        return [pair[0] for pair in scored_pairs[:k]]

    def delete_conversation(self, conversation_id: str):
        """
        Remove os índices BM25 da conversa especificada.
        """
        if conversation_id in self._conversation_indexes:
            del self._conversation_indexes[conversation_id]
