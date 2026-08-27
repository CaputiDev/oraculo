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

export interface DocumentChunkData {
  chunk_id: string;
  file_name: string;
  page_number: number;
  content: string;
  metadata?: Record<string, any>;
}

export interface DocumentDetail {
  file_name: string;
  is_pdf: boolean;
  total_chunks: number;
  total_pages: number;
  chunks: DocumentChunkData[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  file_count: number;
}

export interface ConversationDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  files: string[];
  messages: ChatMessage[];
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
