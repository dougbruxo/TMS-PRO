"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, RefreshCw, LayoutTemplate, Layers, Sparkles, CloudUpload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import useLocalStorage from '@/hooks/use-local-storage';
import { hexToTailwindHsl, tailwindHslToHex } from '@/lib/colorUtils';
import { Label } from '@/components/ui/label';
import { authFetch } from '@/lib/api-client';

type ThemeConfig = {
  name?: string;
  variables: Record<string, string>;
};

const defaultSystemTheme: ThemeConfig = {
    name: 'Padrão Original (Azul Elétrico)',
    variables: {
        '--background': '220 17% 95%',
        '--foreground': '222 84% 5%',
        '--card': '220 17% 100%',
        '--card-foreground': '222 84% 5%',
        '--primary': '211 100% 50%',
        '--ring': '211 100% 50%'
    }
};

const predefinedThemes: ThemeConfig[] = [
  defaultSystemTheme,
  {
    name: 'Verde Esmeralda',
    variables: {
        '--background': '140 20% 96%',
        '--foreground': '150 50% 10%',
        '--card': '0 0% 100%',
        '--card-foreground': '150 50% 10%',
        '--primary': '145 58% 40%',
        '--ring': '145 58% 40%'
    }
  },
  {
    name: 'Dark Mode Forçado (Escuro Tinta)',
    variables: {
        '--background': '222 47% 11%',
        '--foreground': '210 40% 98%',
        '--card': '222 47% 15%',
        '--card-foreground': '210 40% 98%',
        '--primary': '211 100% 50%',
        '--ring': '211 100% 50%'
    }
  }
];

export default function VisualStylePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [storedTheme, setStoredTheme] = useLocalStorage<any>('app-theme', defaultSystemTheme.variables);
  const [activeTheme, setActiveTheme] = useState<Record<string, string>>(defaultSystemTheme.variables);
  const [layoutMode, setLayoutMode] = useLocalStorage<string>('app-layout-mode', 'classic');
  const [isSaving, setIsSaving] = useState(false);
  const colorDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: persist to DB
  const saveToDb = useCallback(async (data: { layoutMode?: string; themeVariables?: Record<string, string> | null }) => {
    setIsSaving(true);
    try {
      await authFetch('/api/settings/visual-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (e: any) {
      console.error('Erro ao salvar tema no banco:', e);
      toast({ variant: 'destructive', title: 'Erro de Sincronização', description: 'Não foi possível salvar o tema no servidor.' });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  // Load theme from DB on mount
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const res = await authFetch('/api/settings/visual-theme');
        if (res.ok) {
          const data = await res.json();
          if (data.layoutMode) {
            setLayoutMode(data.layoutMode);
            document.documentElement.setAttribute('data-layout-mode', data.layoutMode);
          }
          if (data.themeVariables && typeof data.themeVariables === 'object') {
            setActiveTheme(data.themeVariables);
            setStoredTheme(data.themeVariables);
            for (const [key, value] of Object.entries(data.themeVariables)) {
              document.documentElement.style.setProperty(key, value as string);
            }
          }
        }
      } catch (e) {
        console.error('Erro ao carregar tema do banco:', e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      router.push('/freight');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof storedTheme === 'string') {
        const migrated = { ...defaultSystemTheme.variables, '--primary': storedTheme, '--ring': storedTheme };
        setActiveTheme(migrated);
        setStoredTheme(migrated);
    } else if (storedTheme && typeof storedTheme === 'object') {
        setActiveTheme(storedTheme);
    }
  }, [storedTheme, setStoredTheme]);
  
  const applyThemeVariables = (variables: Record<string, string>, persistToDb = true) => {
      let styleEl = document.getElementById('dynamic-theme');
      if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'dynamic-theme';
          document.head.appendChild(styleEl);
      }
      let rootCss = '';

      for (const [key, value] of Object.entries(variables)) {
          if (key === '--primary' || key === '--ring') {
              document.documentElement.style.setProperty(key, value);
              if (key === '--primary' && !variables['--ring']) {
                 document.documentElement.style.setProperty('--ring', value);
              }
          } else {
              rootCss += `${key}: ${value};\n`;
              document.documentElement.style.removeProperty(key);
          }
      }
      
      if (rootCss) {
          styleEl.innerHTML = `:root:not(.dark) { ${rootCss} }`;
      }

      setActiveTheme(variables);
      setStoredTheme(variables);
      if (persistToDb) {
        saveToDb({ themeVariables: variables });
      }
  }

  const handleSelectPreset = (config: ThemeConfig) => {
    applyThemeVariables(config.variables);
    toast({ title: 'Tema Aplicado!', description: `O tema "${config.name}" foi aplicado para todos os usuários.` });
  };

  const handleSelectLayout = (mode: string) => {
    setLayoutMode(mode);
    document.documentElement.setAttribute('data-layout-mode', mode);
    saveToDb({ layoutMode: mode });
    const modeLabels: Record<string, string> = { classic: 'Clássico', modern: 'Moderno Fluido', aurora: 'Aurora Neon' };
    toast({ title: 'Estrutura Alterada!', description: `O motor visual transitou para ${modeLabels[mode] || mode} para todos os usuários.` });
  };

  const handleColorChange = (key: string, hexValue: string) => {
    const hslValue = hexToTailwindHsl(hexValue);
    const newConfig = { ...activeTheme, [key]: hslValue };
    if (key === '--primary') newConfig['--ring'] = hslValue;
    // Apply immediately to UI but debounce DB save (color picker fires many events)
    applyThemeVariables(newConfig, false);
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      saveToDb({ themeVariables: newConfig });
    }, 800);
  };

  const handleResetToDefault = () => {
    const keysToReset = ['--background', '--foreground', '--card', '--card-foreground', '--primary', '--ring'];
    keysToReset.forEach(k => document.documentElement.style.removeProperty(k));
    setStoredTheme(defaultSystemTheme.variables);
    setActiveTheme(defaultSystemTheme.variables);
    setLayoutMode('classic');
    document.documentElement.setAttribute('data-layout-mode', 'classic');
    saveToDb({ layoutMode: 'classic', themeVariables: defaultSystemTheme.variables });
    toast({ title: 'Restaurado', description: 'O tema voltou ao Padrão Original para todos os usuários.' });
  };

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
          <Button variant="outline" onClick={() => router.push('/settings')}>
            &larr; Voltar para Configurações
          </Button>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                <CloudUpload className="h-3.5 w-3.5" /> Sincronizando...
              </span>
            )}
            <Button variant="secondary" onClick={handleResetToDefault} className="border bg-background">
               <RefreshCw className="mr-2 h-4 w-4" /> Restaurar Original
            </Button>
          </div>
        </div>
        
        <div className="space-y-8 max-w-5xl mx-auto">
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-primary flex items-center gap-2">
                        <Layers className="h-5 w-5" /> Motor Visual do Sistema
                    </CardTitle>
                    <CardDescription>
                        Esta opção altera a fundação estética Global do sistema (fontes, bordas da arquitetura, animações e responsividade). 
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                            variant={layoutMode === 'classic' ? 'default' : 'outline'}
                            className="flex-1 h-auto py-6 flex flex-col items-center gap-2"
                            onClick={() => handleSelectLayout('classic')}
                        >
                            <LayoutTemplate className="h-6 w-6" />
                            <div>
                                <p className="font-bold">Tema Clássico Padrão</p>
                                <p className="text-xs font-normal opacity-70">Austeridade e Foco (V1)</p>
                            </div>
                        </Button>
                        <Button
                            variant={layoutMode === 'modern' ? 'default' : 'outline'}
                            className="flex-1 h-auto py-6 flex flex-col items-center gap-2"
                            onClick={() => handleSelectLayout('modern')}
                        >
                            <Layers className="h-6 w-6" />
                            <div>
                                <p className="font-bold">Tema Moderno Fluido</p>
                                <p className="text-xs font-normal opacity-70">App Premium V2 (Recomendado)</p>
                            </div>
                        </Button>
                        <Button
                            variant={layoutMode === 'aurora' ? 'default' : 'outline'}
                            className={cn(
                              "flex-1 h-auto py-6 flex flex-col items-center gap-2 relative overflow-hidden",
                              layoutMode === 'aurora' && "bg-gradient-to-br from-primary via-purple-500 to-pink-500 border-0 text-white hover:opacity-90"
                            )}
                            onClick={() => handleSelectLayout('aurora')}
                        >
                            <Sparkles className="h-6 w-6" />
                            <div>
                                <p className="font-bold">Aurora Neon</p>
                                <p className="text-xs font-normal opacity-70">Vibrante & Dinâmico (V3)</p>
                            </div>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Conjuntos de Cores (Prontos)</CardTitle>
                    <CardDescription>
                        Selecione a paleta de cores ou o tema pronto para o seu ambiente. A alteração é instantânea.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {predefinedThemes.map((theme, i) => {
                            const isSelected = Object.keys(theme.variables).every(k => activeTheme[k] === theme.variables[k]);
                            const mainBg = `hsl(${theme.variables['--background']})`;
                            const mainPrimary = `hsl(${theme.variables['--primary']})`;
                            return (
                                <div
                                    key={i}
                                    onClick={() => handleSelectPreset(theme)}
                                    className={cn(
                                        "cursor-pointer transition-all border rounded-xl overflow-hidden hover:scale-105 hover:shadow-lg relative min-h-[120px] flex flex-col",
                                        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary" : "border-border"
                                    )}
                                    style={{ backgroundColor: mainBg }}
                                >
                                    <div className="p-4 flex-grow flex flex-col items-center justify-center gap-3">
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 flex items-center justify-center bg-primary text-primary-foreground rounded-full p-1 animate-fade-in shadow-sm">
                                                <Check className="h-4 w-4" />
                                            </div>
                                        )}
                                        <div
                                            className="w-12 h-12 rounded-full shadow-md transition-transform duration-300 transform group-hover:scale-110 flex-shrink-0"
                                            style={{ backgroundColor: mainPrimary }}
                                        ></div>
                                        <p className="text-sm font-semibold text-center mt-auto" style={{ color: `hsl(${theme.variables['--foreground']})` }}>{theme.name}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Personalização Avançada</CardTitle>
                    <CardDescription>
                        Ajuste detalhadamente as cores dos objetos principais do sistema. Edições neste painel customizam o seu próprio tema exclusivo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ColorPickerRow 
                            label="Fundo Geral da Tela" 
                            hslValue={activeTheme['--background']} 
                            onChange={(hex) => handleColorChange('--background', hex)}
                        />
                        <ColorPickerRow 
                            label="Cor Principal dos Textos" 
                            hslValue={activeTheme['--foreground']} 
                            onChange={(hex) => handleColorChange('--foreground', hex)}
                        />
                        <ColorPickerRow 
                            label="Fundo dos Cards/Painéis" 
                            hslValue={activeTheme['--card']} 
                            onChange={(hex) => handleColorChange('--card', hex)}
                        />
                        <ColorPickerRow 
                            label="Cor do Texto dentro dos Cards" 
                            hslValue={activeTheme['--card-foreground']} 
                            onChange={(hex) => handleColorChange('--card-foreground', hex)}
                        />
                        <ColorPickerRow 
                            label="Cor Primária (Botões e Links)" 
                            hslValue={activeTheme['--primary']} 
                            onChange={(hex) => handleColorChange('--primary', hex)}
                        />
                   </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

function ColorPickerRow({ label, hslValue, onChange }: { label: string, hslValue: string, onChange: (v: string) => void }) {
    const hex = tailwindHslToHex(hslValue || '0 0% 0%');
    return (
         <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <Label className="font-medium text-base text-card-foreground border-0 focus:outline-none">{label}</Label>
            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">{hex.toUpperCase()}</span>
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border shadow-inner cursor-pointer hover:border-primary transition-colors">
                    <input 
                        type="color" 
                        value={hex} 
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer border-0 p-0 hover:scale-110"
                    />
                </div>
            </div>
        </div>
    )
}
