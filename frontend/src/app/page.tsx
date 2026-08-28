'use client';

import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { PDFViewer } from '../components/PDFViewer';
import { useConversationStore } from '../store/useConversationStore';
import { useViewerStore } from '../store/useViewerStore';

export default function Home() {
  const { isSidebarOpen, setSidebarOpen } = useConversationStore();
  const { isViewerOpen, setViewerOpen } = useViewerStore();

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 relative">
      {/* --- SIDEBAR (HISTÓRICO DE SESSÕES) --- */}
      
      {/* Backdrop para Mobile quando Sidebar estiver aberta */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container (Desktop: Split flex | Mobile: Drawer fixo sobreposto) */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50 h-full overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-72 sm:w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="w-72 sm:w-80 h-full">
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* --- ÁREA PRINCIPAL DE CHAT --- */}
      <section className="flex-1 min-w-0 h-full flex flex-col z-10 overflow-hidden relative">
        <ChatArea />
      </section>

      {/* --- VISUALIZADOR DE DOCUMENTOS (PDF / TEXTO) --- */}
      
      {/* Backdrop para Mobile quando Viewer estiver aberto */}
      {isViewerOpen && (
        <div
          onClick={() => setViewerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* PDFViewer Container (Desktop: Split flex | Mobile: Drawer fixo sobreposto) */}
      <div
        className={`
          fixed lg:static inset-y-0 right-0 z-50 h-full overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out
          ${
            isViewerOpen
              ? 'w-full sm:w-[90%] md:w-[560px] lg:w-[48%] xl:w-[50%] translate-x-0'
              : 'w-0 translate-x-full lg:translate-x-0'
          }
        `}
      >
        <div className="w-full sm:w-[90vw] md:w-[560px] lg:w-full h-full">
          <PDFViewer onClose={() => setViewerOpen(false)} />
        </div>
      </div>
    </main>
  );
}
