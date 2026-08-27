export interface Citation {
  file_name: string;
  page_number: number;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface DocumentInfo {
  name: string;
  url: string;
  totalPages?: number;
}

export interface RAGChatResponse {
  answer: string;
  citations: Citation[];
}

export interface UploadResult {
  success: boolean;
  file_name: string;
  total_chunks?: number;
  total_pages?: number;
  message?: string;
}
