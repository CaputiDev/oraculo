import os
import json
from typing import List, Optional
from pydantic import BaseModel, Field
from infrastructure.pdf_parser import DocumentChunk


class Citation(BaseModel):
    file_name: str
    page_number: int
    snippet: Optional[str] = None


class RAGResponse(BaseModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)


SYSTEM_RAG_PROMPT = """Você é o Oráculo, um assistente corporativo de IA de alta precisão.
Sua tarefa é responder à pergunta do usuário baseando-se ESTRITAMENTE nos fragmentos de documentos fornecidos.

Regras fundamentais:
1. Se a informação constar no contexto, responda de forma direta, clara e cite os trechos relevantes.
2. Se a informação NÃO estiver nos documentos, declare explicitamente: "Não encontrei informações sobre isso nos documentos fornecidos."
3. NUNCA invente informações fora do contexto fornecido.
4. Responda SEMPRE em JSON válido no esquema:
{
  "answer": "Sua resposta com citações inline [Fonte: arquivo.pdf, pág. X].",
  "citations": [
    {
      "file_name": "nome_do_arquivo.pdf",
      "page_number": 1,
      "snippet": "trecho exato ou resumo do fato citado"
    }
  ]
}
"""


class GeminiAdapter:
    """
    Adaptador de infraestrutura para geração de respostas com Gemini AI com alta performance,
    JSON nativo estruturado e modelos otimizados para baixa latência.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.1
    ):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model_name = (
            model_name 
            or os.getenv("GEMINI_MODEL") 
            or os.getenv("LLM_MODEL") 
            or "gemini-3.1-flash-lite"
        )
        self.temperature = temperature

        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
            except Exception:
                pass

    def _format_context(self, chunks: List[DocumentChunk]) -> str:
        if not chunks:
            return "Nenhum documento disponível no momento."
        
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"--- DOCUMENTO [{i}]: {chunk.file_name} (Página {chunk.page_number}) ---\n"
                f"{chunk.content}\n"
            )
        return "\n".join(context_parts)

    def generate_rag_answer(
        self,
        query: str,
        context_chunks: List[DocumentChunk]
    ) -> RAGResponse:
        """
        Gera resposta fundamentada utilizando Gemini em modo JSON nativo ultra-rápido.
        """
        context_text = self._format_context(context_chunks)

        user_content = (
            f"DOCUMENTOS DE CONTEXTO:\n{context_text}\n\n"
            f"PERGUNTA DO USUÁRIO:\n{query}\n\n"
            f"Responda estritamente em JSON no schema estipulado."
        )

        candidate_models = [
            self.model_name,
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash-lite",
            "gemini-flash-latest",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
        ]
        candidate_models = list(dict.fromkeys(candidate_models))

        try:
            import google.generativeai as genai
            response = None
            last_err = None

            for model_candidate in candidate_models:
                try:
                    model = genai.GenerativeModel(
                        model_name=model_candidate,
                        system_instruction=SYSTEM_RAG_PROMPT,
                        generation_config={
                            "temperature": self.temperature,
                            "response_mime_type": "application/json"
                        }
                    )
                    response = model.generate_content(
                        user_content,
                        request_options={"timeout": 40.0}
                    )
                    self.model_name = model_candidate
                    break
                except Exception as e:
                    last_err = e
                    continue

            if not response:
                raise last_err or RuntimeError("Falha ao invocar modelo Gemini.")

            raw_text = response.text.strip()
            
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            parsed_data = json.loads(raw_text)

            citations_raw = parsed_data.get("citations", [])
            citations = []
            for cit in citations_raw:
                if isinstance(cit, dict):
                    citations.append(
                        Citation(
                            file_name=cit.get("file_name", "documento"),
                            page_number=int(cit.get("page_number", 1)),
                            snippet=cit.get("snippet", "")
                        )
                    )
                elif isinstance(cit, str) and context_chunks:
                    citations.append(
                        Citation(
                            file_name=context_chunks[0].file_name,
                            page_number=context_chunks[0].page_number,
                            snippet=cit
                        )
                    )

            return RAGResponse(
                answer=parsed_data.get("answer", "Não foi possível gerar a resposta."),
                citations=citations
            )

        except Exception as e:
            # Fallback limpo com nomes de arquivos desduplicados
            unique_files = list(dict.fromkeys([c.file_name for c in context_chunks]))
            files_str = ", ".join(unique_files) if unique_files else "nenhum"
            fallback_answer = (
                f"Com base nos documentos consultados ({files_str}):\n\n"
                f"Não foi possível processar a resposta formatada pelo LLM ({str(e)})."
            )
            fallback_citations = [
                Citation(
                    file_name=c.file_name,
                    page_number=c.page_number,
                    snippet=c.content[:150] + "..." if len(c.content) > 150 else c.content
                )
                for c in context_chunks
            ]
            return RAGResponse(
                answer=fallback_answer,
                citations=fallback_citations
            )
