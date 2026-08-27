'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { PDFViewer } from '../components/PDFViewer';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Painel Esquerdo: Barra Lateral de Histórico e Conversas */}
      <div
        className={`${
          sidebarOpen ? 'w-64 md:w-72' : 'w-0'
        } transition-all duration-300 ease-in-out h-full overflow-hidden flex-shrink-0 relative z-20`}
      >
        <Sidebar />
      </div>

      {/* Botão Flutuante de Alternância da Barra Lateral */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute bottom-3 left-3 z-30 p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/80 rounded-lg shadow-lg backdrop-blur transition hidden md:flex items-center justify-center"
        title={sidebarOpen ? 'Recolher barra lateral' : 'Expandir barra lateral'}
      >
        {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
      </button>

      {/* Painel Central: Chat, Uploads e Ingestão de Documentos da Conversa */}
      <section className="flex-1 min-w-0 h-full flex flex-col z-10 shadow-lg border-r border-slate-800">
        <ChatArea />
      </section>

      {/* Painel Direito: Visualizador de PDF e Leitor de Textos da Conversa */}
      <section className="hidden lg:flex lg:w-[48%] xl:w-[50%] h-full flex-col">
        <PDFViewer />
      </section>
    </main>
  );
}
