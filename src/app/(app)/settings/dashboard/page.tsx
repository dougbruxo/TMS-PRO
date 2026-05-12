
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import useLocalStorage from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowUp, ArrowDown, ChevronsUpDown, Plus, Trash2, Globe, RotateCcw } from 'lucide-react';
import { dashboardCardsConfig } from '@/lib/dashboard-cards';
import type { User } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { getExternalShortcuts, saveExternalShortcuts, DEFAULT_SHORTCUTS, type ExternalShortcut } from '@/components/Header';

export default function DashboardSettingsPage() {
  const { user, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [storedOrder, setStoredOrder] = useLocalStorage<string[]>('dashboardCardOrder', []);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<'header' | 'sidebar'>(user?.layoutMode || 'header');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCardsVisible, setIsCardsVisible] = useState(false);

  // External Shortcuts state
  const [shortcuts, setShortcuts] = useState<ExternalShortcut[]>([]);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isShortcutsVisible, setIsShortcutsVisible] = useState(true);

  useEffect(() => {
    setShortcuts(getExternalShortcuts());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      setLayoutMode(user.layoutMode || 'header');
    }
  }, [user, authLoading, router]);

  const accessibleCardTitles = React.useMemo(() => {
    if (!user) return [];
    return dashboardCardsConfig
      .filter(card => {
        if (card.isClientOnly && (user.role === 'admin' || user.role === 'user')) return false;
        return user.role === 'admin' || !!user[card.permissionKey as keyof User];
      })
      .map(card => card.title);
  }, [user]);

  useEffect(() => {
    if (accessibleCardTitles.length > 0) {
      const initialOrdered = [...storedOrder];
      accessibleCardTitles.forEach(title => {
        if (!initialOrdered.includes(title)) {
          initialOrdered.push(title);
        }
      });
      const finalOrder = initialOrdered.filter(title => accessibleCardTitles.includes(title));
      setCardOrder(finalOrder);
    }
  }, [accessibleCardTitles, storedOrder]);

  const moveCard = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...cardOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      const [movedItem] = newOrder.splice(index, 1);
      newOrder.splice(targetIndex, 0, movedItem);
      setCardOrder(newOrder);
    }
  };

  const saveOrder = () => {
    setStoredOrder(cardOrder);
    toast({ title: "Ordem salva!", description: "A nova ordem dos cartões será exibida na página inicial." });
  };

  const handleSaveLayout = async () => {
    if (!user) return;
    setIsSubmitting(true);
    const success = await updateUser(user.id, { layoutMode });
    if (success) {
      toast({
        title: "Layout Salvo!",
        description: "O layout será aplicado na próxima vez que você recarregar a página.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a preferência de layout.",
      });
    }
    setIsSubmitting(false);
  };

  // Shortcuts handlers
  const handleAddShortcut = useCallback(() => {
    if (!newName.trim() || !newUrl.trim()) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha o nome e a URL do atalho.' });
      return;
    }
    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const newShortcut: ExternalShortcut = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      url,
    };
    const updated = [...shortcuts, newShortcut];
    setShortcuts(updated);
    saveExternalShortcuts(updated);
    setNewName('');
    setNewUrl('');
    toast({ title: 'Atalho adicionado!', description: `"${newShortcut.name}" foi adicionado aos seus atalhos.` });
  }, [newName, newUrl, shortcuts, toast]);

  const handleRemoveShortcut = useCallback((id: string) => {
    const updated = shortcuts.filter(s => s.id !== id);
    setShortcuts(updated);
    saveExternalShortcuts(updated);
    toast({ title: 'Atalho removido.' });
  }, [shortcuts, toast]);

  const handleResetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    saveExternalShortcuts(DEFAULT_SHORTCUTS);
    toast({ title: 'Atalhos restaurados!', description: 'Os atalhos padrão foram restaurados.' });
  }, [toast]);

  const moveShortcut = useCallback((index: number, direction: 'up' | 'down') => {
    const newList = [...shortcuts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newList.length) {
      const [movedItem] = newList.splice(index, 1);
      newList.splice(targetIndex, 0, movedItem);
      setShortcuts(newList);
      saveExternalShortcuts(newList);
    }
  }, [shortcuts]);

  if (authLoading || !user) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Organizar Dashboard</h1>
          <p className="text-muted-foreground">Use os botões para reordenar os atalhos da sua página inicial.</p>
        </div>
        <Button onClick={() => router.push('/dashboard')}>Voltar para a Página Inicial</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2 w-full">
          <Card>
            <Collapsible open={isCardsVisible} onOpenChange={setIsCardsVisible}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ordem dos Cartões</CardTitle>
                  <CardDescription>A ordem que definir aqui será refletida na sua página inicial.</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Expandir</span>
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-2">
                    {cardOrder.map((cardTitle, index) => {
                      const cardConfig = dashboardCardsConfig.find(c => c.title === cardTitle);
                      return (
                        <div key={cardTitle} className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                          {cardConfig?.icon && React.cloneElement(cardConfig.icon, { className: 'h-6 w-6 text-primary' })}
                          <span className="flex-grow font-medium">{cardTitle}</span>
                          <Button variant="ghost" size="icon" onClick={() => moveCard(index, 'up')} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveCard(index, 'down')} disabled={index === cardOrder.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={saveOrder}>Guardar Ordem dos Cartões</Button>
                </CardFooter>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Atalhos Externos */}
        <div className="lg:col-span-2 w-full">
          <Card>
            <Collapsible open={isShortcutsVisible} onOpenChange={setIsShortcutsVisible}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Atalhos Externos</CardTitle>
                  <CardDescription>Gerencie seus links rápidos para ferramentas externas. Eles aparecem no ícone <Globe className="inline h-4 w-4 mx-0.5" /> da barra de ferramentas.</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Expandir</span>
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {/* Lista de atalhos existentes */}
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div key={shortcut.id} className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                        <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <p className="font-medium truncate">{shortcut.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{shortcut.url}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => moveShortcut(index, 'up')} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveShortcut(index, 'down')} disabled={index === shortcuts.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveShortcut(shortcut.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {shortcuts.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Nenhum atalho configurado.</p>
                    )}
                  </div>

                  {/* Formulário para adicionar novo atalho */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                    <Input
                      placeholder="Nome (ex: Google Maps)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="URL (ex: https://maps.google.com)"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="flex-[2]"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddShortcut(); }}
                    />
                    <Button onClick={handleAddShortcut} className="flex-shrink-0">
                      <Plus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={handleResetShortcuts}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão
                  </Button>
                </CardFooter>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Layout da Aplicação</CardTitle>
            <CardDescription>Escolha como a navegação principal será exibida.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={layoutMode} onValueChange={(value) => setLayoutMode(value as 'header' | 'sidebar')}>
              <div className="flex items-center space-x-2 my-2">
                <RadioGroupItem value="header" id="layout-header" />
                <Label htmlFor="layout-header" className="cursor-pointer">Barra Superior</Label>
              </div>
              <div className="flex items-center space-x-2 my-2">
                <RadioGroupItem value="sidebar" id="layout-sidebar" />
                <Label htmlFor="layout-sidebar" className="cursor-pointer">Coluna Lateral</Label>
              </div>
            </RadioGroup>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveLayout} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Layout'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tema Visual</CardTitle>
            <CardDescription>Alterne entre o modo claro e escuro para a aplicação.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center p-6">
            <ThemeToggle />
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
