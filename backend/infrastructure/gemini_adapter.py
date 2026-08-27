import os
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from infrastructure.pdf_parser import DocumentChunk


class Citation(BaseModel):
    file_name: str
    page_number: int
    snippet: str


class RAGResponse(BaseModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)


class GeminiAdapter:
    """
    Adaptador de IA para o modelo Google Gemini (gemini-1.5-flash) com suporte a respostas estruturadas com citações.
    """

    def __init__(
        self,
        model_name: str = "gemini-1.5-flash",
        api_key: Optional[str] = None,
        temperature: float = 0.2
    ):
        self.model_name = model_name
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.temperature = temperature

    def generate_rag_answer(self, query: str, context_chunks: List[DocumentChunk]) -> RAGResponse:
        """
        Gera uma resposta fundamentada no contexto recuperado com citações estritas.
        """
        if not context_chunks:
            return RAGResponse(
                answer="Não encontrei informações relevantes nos documentos fornecidos para responder à sua pergunta.",
                citations=[]
            )

        # Monta o bloco de contexto enriquecido com os metadados de cada fonte
        context_blocks = []
        for i, chunk in enumerate(context_chunks):
            context_blocks.append(
                f"--- Bloco #{i+1} [Arquivo: {chunk.file_name} | Página: {chunk.page_number}] ---\n{chunk.content}"
            )
        context_text = "\n\n".join(context_blocks)

        prompt = f"""Você é o assistente inteligente Oráculo. Sua função é responder a perguntas de usuários exclusivamente com base nos documentos e trechos fornecidos no contexto.

REGRAS OBRIGATÓRIAS:
1. Responda apenas com informações presentes no contexto. Se a resposta não estiver no contexto, declare educadamente que a informação não foi encontrada.
2. Sempre que citar uma informação, indique explicitamente a fonte com o nome do arquivo e a página correspondente.
3. Retorne sua resposta em formato JSON estrito com o seguinte esquema:
{{
  "answer": "Sua resposta completa e formatada em Markdown, incluindo marcadores de citação interativa como [Fonte: nome_do_arquivo.pdf, pág. X]",
  "citations": [
    {{
      "file_name": "nome_do_arquivo.pdf",
      "page_number": 1,
      "snippet": "Trecho exato relevante de até 150 caracteres que fundamenta a citação"
    }}
  ]
}}

CONTEXTO DOS DOCUMENTOS:
{context_text}

PERGUNTA DO USUÁRIO:
{query}

Responda SOMENTE o JSON válido, sem tags de markdown como ```json adicionais."""

        try:
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)
            
            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config={"temperature": self.temperature}
            )
            response = model.generate_content(prompt)
            raw_text = response.text.strip()
            
            # Limpa possíveis blocos ```json
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            parsed = json.loads(raw_text)
            citations = [
                Citation(
                    file_name=c.get("file_name", "Desconhecido"),
                    page_number=int(c.get("page_number", 1)),
                    snippet=c.get("snippet", "")
                )
                for c in parsed.get("citations", [])
            ]
            return RAGResponse(
                answer=parsed.get("answer", ""),
                citations=citations
            )
        except Exception as e:
            # Fallback com citações extraídas diretamente dos chunks caso haja falha de formatação JSON do LLM
            citations = [
                Citation(
                    file_name=chunk.file_name,
                    page_number=chunk.page_number,
                    snippet=chunk.content[:120] + "..." if len(chunk.content) > 120 else chunk.content
                )
                for chunk in context_chunks[:2]
            ]
            return RAGResponse(
                answer=f"Com base nos documentos consultados ({', '.join(set(c.file_name for c in context_chunks))}):\n\nNão foi possível processar a resposta formatada pelo LLM ({str(e)}).",
                citations=citations
            )
