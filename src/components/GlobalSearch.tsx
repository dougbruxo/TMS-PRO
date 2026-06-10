
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { QuoteStatus } from '@/lib/types';
import { authFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface GlobalSearchProps<T> {
    placeholder: string;
    availableStatusFilters: string[];
    basePath: string;
    apiPath: string;
    renderResult: (item: T) => React.ReactNode;
    onResultClick: (item: T, router: any) => void;
}

export function GlobalSearch<T extends { id: string }>({ 
    placeholder, 
    availableStatusFilters, 
    apiPath,
    renderResult,
    onResultClick
}: GlobalSearchProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<T[]>([]);
    const [isResultsOpen, setIsResultsOpen] = useState(false);
    const [activeGlow, setActiveGlow] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const triggerButtonClickAnimation = () => {
        setActiveGlow(true);
        setTimeout(() => {
            setActiveGlow(false);
        }, 650);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            toast({ variant: 'destructive', title: 'Busca Inválida', description: 'Por favor, insira um termo para pesquisar.' });
            return;
        }

        setIsLoading(true);
        setResults([]);
        try {
            const params = new URLSearchParams({
                term: searchTerm.trim(),
                status: statusFilter,
            });
            const response = await authFetch(`${apiPath}?${params.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao realizar a busca.');
            }

            const data: T[] = await response.json();
            setResults(data);
            setIsResultsOpen(true);

            if (data.length === 0) {
                 toast({ title: 'Nenhum Resultado', description: 'Nenhuma despesa encontrada com os critérios informados.' });
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na Busca', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleResultClick = (item: T) => {
        onResultClick(item, router);
        setIsResultsOpen(false);
    }

    return (
        <div className="mt-6 p-4 border rounded-lg bg-card shadow-sm relative overflow-visible">
            <style>{`
                /* Search Box Wrapper Glow Pulse */
                @keyframes inputGlowPulse {
                  0%, 100% {
                    box-shadow: 0 0 0 0px hsl(var(--primary) / 0), inset 0 0 6px rgba(139, 92, 246, 0.05);
                    border-color: rgba(139, 92, 246, 0.3);
                  }
                  50% {
                    box-shadow: 0 0 15px hsl(var(--primary) / 0.25), inset 0 0 12px rgba(139, 92, 246, 0.12);
                    border-color: hsl(var(--primary));
                  }
                }

                .input-glow-pulse-focus:focus-within {
                  animation: inputGlowPulse 2.2s infinite ease-in-out !important;
                  outline: none !important;
                }

                /* Soft pulse for standard selects inside search */
                .input-pulse-focus:focus, .input-pulse-focus:focus-visible, .input-pulse-focus[data-state="open"] {
                  animation: inputGlowPulse 2.2s infinite ease-in-out !important;
                  outline: none !important;
                }

                /* Search box interior shimmer sweep */
                @keyframes inputInteriorShimmer {
                  0% { transform: translateX(-150%); }
                  50% { transform: translateX(150%); }
                  100% { transform: translateX(150%); }
                }

                .input-interior-shimmer {
                  position: absolute;
                  inset: 0;
                  background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.01) 15%,
                    rgba(255, 255, 255, 0.08) 50%,
                    rgba(255, 255, 255, 0.01) 85%,
                    transparent
                  );
                  transform: translateX(-150%);
                  animation: inputInteriorShimmer 8s infinite ease-in-out;
                  pointer-events: none;
                  z-index: 1;
                }

                /* Focus status color change on icon */
                .input-glow-pulse-focus:focus-within .search-icon-animate {
                  color: hsl(var(--primary)) !important;
                  transform: translateY(-50%) scale(1.15) !important;
                  filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.6));
                }

                /* Premium Search Button styling */
                .premium-search-btn {
                  position: relative !important;
                  overflow: hidden !important;
                  background: linear-gradient(135deg, hsl(var(--primary)) 0%, #8b5cf6 50%, #d946ef 100%) !important;
                  border: 1px solid rgba(255, 255, 255, 0.15) !important;
                  color: white !important;
                  font-weight: 600 !important;
                  letter-spacing: 0.025em !important;
                  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
                  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25), 
                              inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
                  border-radius: 12px !important;
                }

                /* Hover shine sweep glare */
                .premium-search-btn::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: -150%;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.25),
                    transparent
                  );
                  transform: skewX(-25deg);
                  pointer-events: none;
                  z-index: 2;
                }

                .premium-search-btn:hover:not(:disabled)::before {
                  left: 150%;
                  transition: left 0.85s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .premium-search-btn:hover:not(:disabled) {
                  transform: translateY(-2px) scale(1.02) !important;
                  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.45), 
                              inset 0 1px 0 rgba(255, 255, 255, 0.35) !important;
                }

                /* Spring active micro-scale click response */
                .premium-search-btn:active:not(:disabled) {
                  transform: translateY(0) scale(0.96) !important;
                  transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                }

                /* Inner Radial Light Bloom expansion */
                @keyframes innerBloomEffect {
                  0% {
                    transform: translate(-50%, -50%) scale(0);
                    opacity: 0.8;
                  }
                  100% {
                    transform: translate(-50%, -50%) scale(2.5);
                    opacity: 0;
                  }
                }

                .premium-btn-bloom {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  width: 150px;
                  height: 150px;
                  background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 70%);
                  border-radius: 50%;
                  transform: translate(-50%, -50%) scale(0);
                  pointer-events: none;
                  z-index: 1;
                }

                .premium-search-btn.blooming .premium-btn-bloom {
                  animation: innerBloomEffect 0.65s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
                }

                /* Premium dialog glass content */
                .premium-dialog-content {
                  background: rgba(255, 255, 255, 0.95) !important; /* Light bright pure white glass */
                  backdrop-filter: blur(40px) saturate(200%) !important;
                  border: 1px solid rgba(56, 189, 248, 0.35) !important; /* Soft sky blue border */
                  box-shadow: 0 40px 80px -15px rgba(15, 23, 42, 0.05), 
                              0 15px 30px -10px rgba(56, 189, 248, 0.15),
                              inset 0 1px 0 rgba(255, 255, 255, 1) !important;
                  border-radius: 24px !important;
                  overflow: hidden !important;
                }

                /* Lighter custom dialog overlay backdrop to make the screen feel bright, airy and premium */
                div[data-radix-portal] > div:first-child,
                div[class*="DialogOverlay"],
                div[class*="bg-black/80"],
                .fixed.inset-0.bg-black\\/80 {
                  background-color: rgba(255, 255, 255, 0.45) !important; /* Extremely light and bright frosted glass */
                  backdrop-filter: blur(12px) !important;
                }

                /* Cascade Entrance Animations for Result Cards */
                @keyframes resultCardEntrance {
                  0% {
                    opacity: 0;
                    transform: translateY(20px) scale(0.97);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }

                .result-card-animate {
                  opacity: 0;
                  animation: resultCardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                /* Premium Result Card Hover Effects */
                .premium-result-card {
                  position: relative;
                  background: rgba(255, 255, 255, 0.9) !important; /* Premium light card background */
                  border: 1px solid rgba(56, 189, 248, 0.4) !important; /* Pristine symmetric border */
                  border-radius: 18px !important;
                  padding: 20px !important;
                  transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1) !important;
                  overflow: hidden !important;
                  cursor: pointer !important;
                  box-shadow: 0 12px 30px -8px rgba(56, 189, 248, 0.12), 
                              inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  min-height: 110px;
                }

                .premium-result-card:hover {
                  background: rgba(255, 255, 255, 0.98) !important;
                  border-color: rgba(56, 189, 248, 0.75) !important;
                  box-shadow: 0 20px 40px -8px rgba(56, 189, 248, 0.28),
                              inset 0 1px 0 rgba(255, 255, 255, 0.95) !important;
                  transform: translateY(-6px) scale(1.02) !important;
                }

                .premium-result-card:active {
                  transform: translateY(-2px) scale(0.985) !important;
                  background: rgba(255, 255, 255, 0.98) !important;
                  transition: transform 0.12s !important;
                }

                /* Targeted internal element styles to convert basic text into a premium card layout */
                
                /* Title / Client Name style */
                .premium-result-card .font-semibold,
                .premium-result-card p.font-semibold {
                  font-size: 1.025rem !important;
                  font-weight: 700 !important;
                  color: #0284c7 !important; /* Readable, elegant sky blue */
                  margin-bottom: 6px !important;
                  line-height: 1.35 !important;
                  letter-spacing: -0.015em !important;
                  transition: color 0.3s ease;
                }
                
                .premium-result-card:hover .font-semibold {
                  color: #0369a1 !important;
                }

                /* Subtitle / Route / Date styles */
                .premium-result-card .text-sm.text-muted-foreground,
                .premium-result-card p.text-sm.text-muted-foreground {
                  font-size: 0.825rem !important;
                  font-weight: 500 !important;
                  color: #475569 !important; /* Silver slate text */
                  display: flex !important;
                  align-items: center !important;
                  gap: 6px !important;
                  margin-top: 4px !important;
                }

                /* Arrow animation inside route */
                .premium-result-card .text-sm.text-muted-foreground svg,
                .premium-result-card p.text-sm.text-muted-foreground svg {
                  color: #38bdf8 !important;
                  transition: transform 0.4s ease;
                }
                
                .premium-result-card:hover .text-sm.text-muted-foreground svg {
                  transform: translateX(4px);
                }

                /* Glass badge styling for ID / quote code */
                .premium-result-card span.inline-flex.items-center.rounded-full.border,
                .premium-result-card div[class*="badge"] {
                  background: rgba(56, 189, 248, 0.12) !important;
                  color: #0369a1 !important;
                  border: 1px solid rgba(56, 189, 248, 0.35) !important;
                  font-weight: 700 !important;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
                  letter-spacing: 0.02em !important;
                  padding: 4px 10px !important;
                  font-size: 0.75rem !important;
                  border-radius: 8px !important;
                  transition: all 0.3s ease !important;
                  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
                }
                
                .premium-result-card:hover span.inline-flex.items-center.rounded-full.border {
                  background: rgba(56, 189, 248, 0.22) !important;
                  border-color: rgba(56, 189, 248, 0.55) !important;
                  transform: scale(1.05);
                }

                /* Premium Status label/badge layout styling */
                .premium-result-card .text-xs.text-muted-foreground,
                .premium-result-card p.text-xs.text-muted-foreground {
                  font-size: 0.775rem !important;
                  font-weight: 600 !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  gap: 6px !important;
                  background: rgba(14, 165, 233, 0.12) !important;
                  border: 1px solid rgba(14, 165, 233, 0.28) !important;
                  border-radius: 8px !important;
                  padding: 4px 10px !important;
                  color: #0284c7 !important;
                  margin-top: 8px !important;
                  transition: all 0.3s ease !important;
                }
                
                .premium-result-card:hover .text-xs.text-muted-foreground {
                  background: rgba(14, 165, 233, 0.18) !important;
                  border-color: rgba(14, 165, 233, 0.40) !important;
                  color: #0369a1 !important;
                }
            `}</style>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-grow w-full rounded-xl overflow-hidden border border-muted/50 bg-background/40 backdrop-blur-md input-glow-pulse-focus transition-all duration-300">
                    {/* Interior Shimmer effect */}
                    <div className="input-interior-shimmer" />
                    
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-20 search-icon-animate transition-all duration-300" />
                    
                    <Input
                         type="text"
                         placeholder={placeholder}
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="pl-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10 w-full transition-all duration-300 text-foreground placeholder:text-muted-foreground/70"
                         disabled={isLoading}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[180px] h-11 input-pulse-focus transition-all duration-300">
                        <SelectValue placeholder="Filtrar por status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos Status</SelectItem>
                        {availableStatusFilters.map(status => (
                            <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button 
                    type="submit" 
                    className={cn(
                        "w-full sm:w-auto h-11 premium-search-btn rounded-xl transition-all duration-300",
                        activeGlow && "blooming"
                    )}
                    disabled={isLoading}
                    onClick={triggerButtonClickAnimation}
                >
                    {/* Inner premium blooming light burst */}
                    {activeGlow && <span className="premium-btn-bloom" />}
                    
                    <span className="relative z-10 flex items-center justify-center">
                        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                        {isLoading ? 'Buscando...' : 'Buscar'}
                    </span>
                </Button>
            </form>

            <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
                <DialogContent className="max-w-5xl premium-dialog-content border-none overflow-hidden">
                    {/* Background Aurora glowing spots inside the pop-up */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-400/12 rounded-full blur-[110px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '10s' }} />
                    
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-primary to-purple-600 bg-clip-text text-transparent">
                            Resultados da Busca
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium mt-1">
                            Encontrados {results.length} resultados correspondentes. Clique em um card para ver os detalhes completos.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[65vh] mt-4 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 pr-10 pb-12 mr-1">
                            {results.map((item, index) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => handleResultClick(item)} 
                                    className="premium-result-card result-card-animate group/card"
                                    style={{ animationDelay: `${index * 60}ms` }}
                                >
                                    {/* Ambient Aurora glow reveal (fully visible) */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-sky-400/10 via-primary/5 to-transparent opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    
                                    {/* Soft radial backdrop neon flare in bottom corner (fully visible) */}
                                    <div className="absolute -right-12 -bottom-12 w-28 h-28 bg-sky-400/12 rounded-full blur-xl opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        {renderResult(item)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
