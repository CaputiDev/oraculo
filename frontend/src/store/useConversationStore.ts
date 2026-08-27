import { create } from 'zustand';
import { ConversationSummary, ConversationDetail, ChatMessage } from '../types';

interface ConversationState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  activeConversation: ConversationDetail | null;
  isLoadingConversations: boolean;
  isLoadingDetail: boolean;

  // Actions
  fetchConversations: (apiBaseUrl?: string) => Promise<void>;
  selectConversation: (id: string, apiBaseUrl?: string) => Promise<void>;
  createConversation: (title?: string, apiBaseUrl?: string) => Promise<string>;
  deleteConversation: (id: string, apiBaseUrl?: string) => Promise<void>;
  appendMessageToActive: (message: ChatMessage) => void;
  addFileToActive: (fileName: string) => void;
  resetConversationStore: () => void;
}

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  isLoadingConversations: false,
  isLoadingDetail: false,

  fetchConversations: async (apiBaseUrl = DEFAULT_API_URL) => {
    set({ isLoadingConversations: true });
    try {
      const res = await fetch(`${apiBaseUrl}/conversations`);
      if (res.ok) {
        const data: ConversationSummary[] = await res.json();
        set({ conversations: data });

        const currentActiveId = get().activeConversationId;
        if (!currentActiveId && data.length > 0) {
          // Seleciona automaticamente a conversa mais recente
          get().selectConversation(data[0].id, apiBaseUrl);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  selectConversation: async (id: string, apiBaseUrl = DEFAULT_API_URL) => {
    set({ activeConversationId: id, isLoadingDetail: true });
    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data: ConversationDetail = await res.json();
        // Mapeia mensagens do backend para a interface ChatMessage
        const mappedMessages: ChatMessage[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations || [],
          timestamp: m.created_at || new Date().toISOString(),
        }));

        set({
          activeConversation: {
            ...data,
            messages: mappedMessages,
          },
        });
      }
    } catch (err) {
      console.error(`Erro ao carregar detalhes da conversa ${id}:`, err);
    } finally {
      set({ isLoadingDetail: false });
    }
  },

  createConversation: async (title = 'Nova Conversa', apiBaseUrl = DEFAULT_API_URL) => {
    try {
      const res = await fetch(`${apiBaseUrl}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const newConv = await res.json();
        set((state) => ({
          conversations: [
            {
              id: newConv.id,
              title: newConv.title,
              created_at: newConv.created_at,
              updated_at: newConv.updated_at,
              message_count: 0,
              file_count: 0,
            },
            ...state.conversations,
          ],
          activeConversationId: newConv.id,
          activeConversation: {
            id: newConv.id,
            title: newConv.title,
            created_at: newConv.created_at,
            updated_at: newConv.updated_at,
            files: [],
            messages: [],
          },
        }));
        return newConv.id;
      }
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
    }
    return '';
  },

  deleteConversation: async (id: string, apiBaseUrl = DEFAULT_API_URL) => {
    try {
      const res = await fetch(`${apiBaseUrl}/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const nextActive = state.activeConversationId === id 
            ? (filtered.length > 0 ? filtered[0].id : null)
            : state.activeConversationId;
          return {
            conversations: filtered,
            activeConversationId: nextActive,
            activeConversation: state.activeConversationId === id ? null : state.activeConversation,
          };
        });

        const newActiveId = get().activeConversationId;
        if (newActiveId) {
          get().selectConversation(newActiveId, apiBaseUrl);
        }
      }
    } catch (err) {
      console.error(`Erro ao deletar conversa ${id}:`, err);
    }
  },

  appendMessageToActive: (message: ChatMessage) => {
    set((state) => {
      if (!state.activeConversation) return state;
      const updatedMessages = [...state.activeConversation.messages, message];
      return {
        activeConversation: {
          ...state.activeConversation,
          messages: updatedMessages,
        },
      };
    });
  },

  addFileToActive: (fileName: string) => {
    set((state) => {
      if (!state.activeConversation) return state;
      const currentFiles = state.activeConversation.files || [];
      if (currentFiles.includes(fileName)) return state;
      return {
        activeConversation: {
          ...state.activeConversation,
          files: [...currentFiles, fileName],
        },
      };
    });
  },

  resetConversationStore: () => {
    set({
      conversations: [],
      activeConversationId: null,
      activeConversation: null,
      isLoadingConversations: false,
      isLoadingDetail: false,
    });
  },
}));
