import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParsedNfeData } from '@/lib/xml-parser';
import { AlertCircle, CheckCircle2, FileJson, Package, Truck, User, AlertTriangle, Search, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface XmlPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (manualCompanyId?: string) => void;
  parsedData: ParsedNfeData | null;
  isLoading?: boolean;
  pendingClientMappingData?: any | null;
}

export function XmlPreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  parsedData,
  isLoading = false,
  pendingClientMappingData = null
}: XmlPreviewDialogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [clients, setClients] = React.useState<any[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<any>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (pendingClientMappingData && searchTerm.length >= 2) {
      setIsSearching(true);
      const delayFn = setTimeout(() => {
        authFetch(`/api/client-companies/search?q=${encodeURIComponent(searchTerm)}`)
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.companies)) {
                setClients(data.companies);
            }
          })
          .catch(() => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível buscar clientes.' }))
          .finally(() => setIsSearching(false));
      }, 500);

      return () => clearTimeout(delayFn);
    } else {
        setClients([]);
    }
  }, [pendingClientMappingData, searchTerm, toast]);

  if (!parsedData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileJson className="w-5 h-5 text-blue-500" />
            Confirmação de Importação XML
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <Alert className="mb-4 bg-blue-50/50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Verifique os dados da Nota</AlertTitle>
            <AlertDescription className="text-blue-700">
              Antes de prosseguir, confirme se o XML selecionado corresponde à carga correta.
            </AlertDescription>
          </Alert>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {/* Resumo da NFe */}
              <div className="bg-slate-50 p-4 rounded-lg border">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <FileJson className="w-4 h-4" />
                  Detalhes da Nota Fiscal
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block text-xs">Chave de Acesso</span>
                    <span className="font-mono text-xs break-all">{parsedData.chNFe || 'Não encontrada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs">Número da NF</span>
                    <span className="font-semibold">{parsedData.nNF || 'Não encontrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs">Valor Total (R$)</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedData.vNF)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emitente / Destinatário */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4" />
                    Emitente
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs">Razão Social</span>
                      <span className="font-medium">{parsedData.emitente.nome || 'Não encontrado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">CNPJ/CPF</span>
                      <span className="font-mono">{parsedData.emitente.cnpjCpf || 'Não encontrado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Cidade/UF</span>
                      <span>{parsedData.emitente.cidade} - {parsedData.emitente.estado}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
                    <User className="w-4 h-4" />
                    Destinatário
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs">Razão Social</span>
                      <span className="font-medium">{parsedData.destinatario.nome || 'Não encontrado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">CNPJ/CPF</span>
                      <span className="font-mono">{parsedData.destinatario.cnpjCpf || 'Não encontrado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Cidade/UF</span>
                      <span>{parsedData.destinatario.cidade} - {parsedData.destinatario.estado}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Carga */}
              <div className="bg-slate-50 p-4 rounded-lg border">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4" />
                  Dados da Carga
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block text-xs">Peso Bruto (KG)</span>
                    <span className="font-semibold">{parsedData.pesoB}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs">Volumes</span>
                    <span className="font-semibold">{parsedData.qVol}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-slate-500 block text-xs">Produto Predominante</span>
                    <span className="text-slate-700">{parsedData.xProd || parsedData.esp || 'Diversos'}</span>
                  </div>
                </div>
              </div>

              {/* Client Mapping removed from here, moved to AlertDialog */}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirm(undefined)} 
            disabled={isLoading || !!pendingClientMappingData} 
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {isLoading ? 'Processando...' : 'Confirmar Importação'}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Client Mapping Popup */}
      <AlertDialog open={!!pendingClientMappingData}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              {pendingClientMappingData?.requiresBranchMapping ? (
                 <><AlertTriangle className="w-5 h-5" /> Vincular CNPJ (Matriz ou Filial)</>
              ) : (
                 <><AlertTriangle className="w-5 h-5" /> Destinatário não cadastrado</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              {pendingClientMappingData?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {pendingClientMappingData?.requiresBranchMapping ? (
            <div className="space-y-4 py-4 flex flex-col">
               <Button 
                   variant="outline" 
                   className="h-auto p-4 flex flex-col items-start gap-1 justify-start border-blue-200 bg-blue-50 hover:bg-blue-100 whitespace-normal text-left"
                   onClick={() => onConfirm(pendingClientMappingData.mainCompany.id)}
                   disabled={isLoading}
               >
                   <span className="font-semibold text-blue-900">Vincular à Matriz</span>
                   <span className="text-sm text-blue-700">{pendingClientMappingData.mainCompany.razaoSocial}</span>
                   <span className="text-xs text-blue-600/80">CNPJ: {pendingClientMappingData.mainCompany.cnpj}</span>
               </Button>
               
               <Button 
                   variant="outline" 
                   className="h-auto p-4 flex flex-col items-start gap-1 justify-start border-slate-200 hover:bg-slate-100 whitespace-normal text-left"
                   onClick={() => onConfirm(pendingClientMappingData.branchCompany.id)}
                   disabled={isLoading}
               >
                   <span className="font-semibold text-slate-900">Manter na Filial (Destinatário)</span>
                   <span className="text-sm text-slate-700">{pendingClientMappingData.branchCompany.razaoSocial}</span>
                   <span className="text-xs text-slate-500">CNPJ: {pendingClientMappingData.branchCompany.cnpj}</span>
               </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4 relative">
              <label className="text-sm font-medium text-slate-700 block">Pesquise o Cliente (Razão Social ou CNPJ):</label>
            
            {!selectedClient ? (
                <>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            className="pl-9 bg-white" 
                            placeholder="Digite CNPJ ou Nome..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {isSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Buscando...</span>}
                    </div>
                    
                    {clients.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {clients.map(c => (
                                <div 
                                    key={c.id} 
                                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                                    onClick={() => {
                                        setSelectedClient(c);
                                        setSearchTerm('');
                                        setClients([]);
                                    }}
                                >
                                    <div className="font-medium text-slate-800">{c.razaoSocial}</div>
                                    <div className="text-xs text-slate-500">{c.cnpj}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {searchTerm.length >= 2 && !isSearching && clients.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg p-3 text-sm text-slate-500 text-center">
                            Nenhum cliente encontrado.
                        </div>
                    )}
                </>
            ) : (
                <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-md">
                    <div>
                        <div className="font-medium text-sm text-slate-800">{selectedClient.razaoSocial}</div>
                        <div className="text-xs text-slate-500">{selectedClient.cnpj}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedClient(null)}>
                        <X className="h-4 w-4 text-slate-400" />
                    </Button>
                </div>
            )}
          </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Cancelar Importação</AlertDialogCancel>
            {!pendingClientMappingData?.requiresBranchMapping && (
                <Button
                    onClick={() => onConfirm(selectedClient?.id)}
                    disabled={!selectedClient || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Processando...' : 'Vincular e Importar'}
                </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

