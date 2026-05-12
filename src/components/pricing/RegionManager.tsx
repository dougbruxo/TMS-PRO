
"use client";

import { useState, useMemo } from 'react';
import type { Regions } from '@/lib/types';
import { ALL_UFS } from '@/lib/ufs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, X, PlusCircle, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface RegionManagerProps {
  regions: Regions;
  onRegionsChange: (newRegions: Regions) => void;
}

export function RegionManager({ regions, onRegionsChange }: RegionManagerProps) {
  const { toast } = useToast();
  const [newRegionName, setNewRegionName] = useState('');
  
  const assignedUfs = useMemo(() => {
    return new Set(Object.values(regions).flat());
  }, [regions]);

  const unassignedUfs = useMemo(() => {
    return ALL_UFS.filter(uf => !assignedUfs.has(uf)).sort();
  }, [assignedUfs]);

  const handleAddUf = (regionName: string, uf: string) => {
    const newRegions = { ...regions };
    // Remove UF from any other region it might be in
    for (const region in newRegions) {
        newRegions[region] = newRegions[region].filter(u => u !== uf);
    }
    // Add UF to the new region
    newRegions[regionName] = [...newRegions[regionName], uf];
    onRegionsChange(newRegions);
  };

  const handleRemoveUf = (regionName: string, ufToRemove: string) => {
    const newRegions = { ...regions };
    newRegions[regionName] = newRegions[regionName].filter(uf => uf !== ufToRemove);
    onRegionsChange(newRegions);
  };

  const handleAddNewRegion = () => {
    if (!newRegionName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O nome da região não pode estar vazio.' });
      return;
    }
    const formattedRegionName = newRegionName.trim().toUpperCase().replace(/\s+/g, '_');
    if (regions[formattedRegionName]) {
      toast({ variant: 'destructive', title: 'Região Existente', description: `A região "${formattedRegionName}" já existe.` });
      return;
    }
    const newRegions = { ...regions, [formattedRegionName]: [] };
    onRegionsChange(newRegions);
    setNewRegionName('');
    toast({ title: 'Sucesso!', description: `Região "${formattedRegionName}" criada.` });
  };

  const handleDeleteRegion = (regionNameToDelete: string) => {
    if (regions[regionNameToDelete]?.length > 0) {
        toast({ variant: 'destructive', title: 'Ação Bloqueada', description: 'Não é possível apagar uma região que contém estados.' });
        return;
    }
    const newRegions = { ...regions };
    delete newRegions[regionNameToDelete];
    onRegionsChange(newRegions);
    toast({ title: 'Sucesso!', description: `Região "${regionNameToDelete}" apagada.` });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organização das Regiões</CardTitle>
        <CardDescription>Crie regiões e adicione os estados (UFs) correspondentes.</CardDescription>
         <div className="flex w-full max-w-sm items-center space-x-2 pt-4">
            <Input 
              placeholder="Nome da Nova Região" 
              value={newRegionName}
              onChange={(e) => setNewRegionName(e.target.value)}
            />
            <Button type="button" onClick={handleAddNewRegion}>
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Região
            </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(regions).map(([regionName, ufs]) => (
          <Card key={regionName} className="flex flex-col">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">{regionName}</CardTitle>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={ufs.length > 0}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Região?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar a região "{regionName}"? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteRegion(regionName)} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="flex-grow p-4 space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[40px] bg-muted/50 rounded-md p-2">
                {ufs.sort().map(uf => (
                   <Badge key={uf} variant="secondary" className="text-base">
                     {uf}
                     <button onClick={() => handleRemoveUf(regionName, uf)} className="ml-2 rounded-full hover:bg-destructive/80 p-0.5">
                       <X className="h-3 w-3" />
                     </button>
                   </Badge>
                ))}
              </div>
              <UfSelector ufs={unassignedUfs} onSelect={(uf) => handleAddUf(regionName, uf)} />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}


const UfSelector = ({ ufs, onSelect }: { ufs: string[], onSelect: (uf: string) => void }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          Adicionar UF...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar UF..." />
          <CommandList>
            {ufs.length === 0 && <div className="py-6 text-center text-sm">Todas as UFs foram adicionadas.</div>}
            {ufs.map(uf => (
              <CommandItem
                key={uf}
                onSelect={() => {
                  onSelect(uf);
                  setOpen(false);
                }}
              >
                {uf}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
