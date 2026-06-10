"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api-client';

/**
 * ThemeSyncer: Carrega o tema visual global do banco de dados quando o usuário está autenticado.
 * Atualiza o localStorage e aplica as variáveis CSS ao documentElement.
 * Deve ser montado uma vez dentro do AuthProvider.
 */
export function ThemeSyncer() {
  const { user, loading } = useAuth();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (loading || hasSynced.current) return;
    hasSynced.current = true;

    (async () => {
      try {
        const res = await authFetch('/api/settings/visual-theme');
        if (!res.ok) return;
        
        const data = await res.json();

        // Sync layout mode
        if (data.layoutMode) {
          const currentMode = document.documentElement.getAttribute('data-layout-mode');
          if (currentMode !== data.layoutMode) {
            document.documentElement.setAttribute('data-layout-mode', data.layoutMode);
            try {
              localStorage.setItem('app-layout-mode', JSON.stringify(data.layoutMode));
            } catch (e) {}
          }
        }

        // Sync theme variables
        if (data.themeVariables && typeof data.themeVariables === 'object') {
          let styleEl = document.getElementById('dynamic-theme');
          if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'dynamic-theme';
              document.head.appendChild(styleEl);
          }
          let rootCss = '';

          for (const [key, value] of Object.entries(data.themeVariables)) {
             if (key === '--primary' || key === '--ring') {
                 document.documentElement.style.setProperty(key, value as string);
             } else {
                 rootCss += `${key}: ${value};\n`;
                 // Remove any inline styles left over from previous versions
                 document.documentElement.style.removeProperty(key);
             }
          }
          
          if (rootCss) {
              styleEl.innerHTML = `:root:not(.dark) { ${rootCss} }`;
          }

          try {
            localStorage.setItem('app-theme', JSON.stringify(data.themeVariables));
          } catch (e) {}
        }
      } catch (e) {
        // Silently fail — localStorage fallback will be used
        console.error('ThemeSyncer: erro ao sincronizar tema do banco', e);
      }
    })();
  }, [loading, user]);

  return null; // Componente invisível
}
