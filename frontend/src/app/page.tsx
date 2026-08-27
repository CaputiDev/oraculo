'use client';

import React from 'react';
import { ChatArea } from '../components/ChatArea';
import { PDFViewer } from '../components/PDFViewer';

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Lado Esquerdo: Área de Chat, Uploads e Citações Interativas */}
      <section className="w-full lg:w-[48%] h-full flex flex-col z-10 shadow-lg">
        <ChatArea />
      </section>

      {/* Divisor Visual */}
      <div className="hidden lg:block w-[1px] bg-slate-800 h-full shadow-md" />

      {/* Lado Direito: Visualizador de PDF com sincronização de página via Zustand */}
      <section className="hidden lg:flex lg:w-[52%] h-full flex-col">
        <PDFViewer />
      </section>
    </main>
  );
}
