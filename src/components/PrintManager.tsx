
"use client";

import { useEffect } from 'react';

export function PrintManager() {
  useEffect(() => {
    // Adiciona um pequeno atraso para garantir que todo o conteúdo seja renderizado
    const timer = setTimeout(() => {
      window.print();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return null; // Este componente não renderiza nada visível
}
