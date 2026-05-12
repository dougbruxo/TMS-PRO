# 🔍 Relatório de Auditoria — DezLog Secure Freight
**Data:** 2026-04-03  
**Contexto:** Auditoria completa do código-fonte para identificar lacunas, bugs silenciosos, código morto, e inconsistências geradas por alternância entre contas de desenvolvimento.

---

## 🔄 ESTADO ATUAL (Recuperação de Produtividade)
**Última Atualização:** 03 de Abril de 2026

### 🚀 Funcionalidades Recuperadas
- **Importação de Cotação XML (NFe):** A leitura visual estrutural da NFe para preenchimento de cubagem e valores foi restabelecida e testada. O `Input` de arquivo XML foi desfeito de blocos protegidos pelo Radix UI para evitar *Client Crashes*.
- **Clonagem de Cotações:** O botão "Clonar Cotação" foi restaurado na lista de cotações passadas.
- **Histórico de Movimentações:** Adicionado filtro por data no Log de Auditoria. Por padrão, o sistema agora exibe apenas as movimentações do último dia que teve atividade, otimizando o carregamento e tamanho da lista. Um calendário foi incluído na interface para pesquisar dias anteriores.

### 🩹 Bugs e Crashes Resolvidos (Sessão Atual)
- Removido um instanciamento de biblioteca backend `require('react')` solto no server component, resolvendo tela branca total de ReferenceError.
- Corrigido travamento crítico (**Hydration Failed** `Application error`) da inicialização de `/quotes` associado à herança maldormida do botão XML dentro do `<DropdownMenu>`.
- Corrigido e reintegrado o ícone de metadados `<Info />` faltante nos imports que disparava o crash `Runtime ReferenceError` no cliente.
- O ambiente Next.js passou pelas devidas validações limpas (*Exit Code 0*) com o Compilador garantindo estabilidade de Tipos para toda rede de Componentes.

---

## 🔴 BUGS CRÍTICOS (Afetam funcionalidade em produção)

### 1. `getValues()` não exposto pelo `FreightFormHandle` 
**Arquivos:** `FreightForm.tsx:156-170`, `quotes/page.tsx:549`

O `useImperativeHandle` só expõe `reset()`, mas o `handleSaveQuote` chama `formRef.current?.getValues()` para verificar se campos foram alterados após o cálculo. Como `getValues` não existe no handle, **retorna sempre `undefined`**, e a guarda de recalculação **nunca dispara**.

**Impacto:** O usuário pode editar campos de precificação (peso, cubagem, origem, destino) APÓS calcular, e salvar a cotação com valores desatualizados sem receber aviso.

**Correção:** Adicionar `getValues` ao `useImperativeHandle`:
```typescript
useImperativeHandle(ref, () => ({
    reset() { ... },
    getValues() { return form.getValues(); }
}));
```
E atualizar a interface `FreightFormHandle`:
```typescript
export interface FreightFormHandle {
    reset: () => void;
    getValues: () => any;
}
```

---

### 2. Numeração de cotação com race condition
**Arquivo:** `api/quotes/route.ts:141-142`

Usa `countDocuments()` para gerar número sequencial. Duas abas simultâneas geram o mesmo número.

**Impacto:** Cotações duplicadas em produção (já reportado pelo usuário).

**Correção:** Usar contador atômico com `findOneAndUpdate` + `$inc` em uma collection `counters`.

---

### 3. Mesmo bug de race condition em Romaneios
**Arquivo:** `api/manifests/route.ts:45-46`

```js
const totalManifests = await db.collection('manifests').countDocuments();
const manifestCode = `ROM${...}${(totalManifests + 1)...}`;
```

Idêntica vulnerabilidade ao de cotações. Dois romaneios criados simultaneamente terão o mesmo código.

---

### 4. Comprovante de entrega é substituído (não acumula)
**Arquivo:** `api/quotes/[id]/upload-proof/route.ts:47-58`

O upload de novo comprovante **deleta o arquivo anterior** e sobrescreve o campo `proofOfDeliveryUrl`. Não permite múltiplos comprovantes. Já reportado pelo usuário.

---

## 🟡 INCONSISTÊNCIAS FUNCIONAIS (Podem gerar confusão)

### 5. Operacional Legacy no diretório API
**Arquivo:** `src/app/api/operational/page.tsx` (220 linhas)

Existe uma **página React completa** dentro da pasta `src/app/api/operational/`. Este é um componente "use client" com imports de UI (Card, Badge, etc.), localizado numa pasta que deveria conter exclusivamente API routes.

A página ativa real está em `src/app/(app)/operational/`. A versão na pasta `api/` é um vesígío da migração do Firebase Studio e não é servida pelo router do Next.js (já que está numa rota de API), mas polui o diretório.

**Correção:** Pode ser deletada com segurança.

---

### 6. Operacional Legacy Status Page no diretório API
**Arquivo:** `src/app/api/operational/status/[status]/page.tsx`

Mesma situação — página duplicada, versão legada na pasta de API. A versão ativa está em `src/app/(app)/operational/status/[status]/page.tsx`.

---

### 7. Arquivos de mapa deprecados
**Arquivos:**
- `src/components/MapDisplay.tsx` — Marcado como deprecated, 89 bytes
- `src/components/MapDisplayClient.tsx` — Marcado como deprecated, 60 bytes
- `src/components/MapDisplayInner.tsx` — Marcado como deprecated, 60 bytes

A versão ativa é `MapDisplayLeaflet.tsx`. Os 3 arquivos acima são stubs vazios com comentários de deprecação.

**Correção:** Podem ser deletados com segurança.

---

### 8. Funções deprecadas sem corpo no Operacional — RESOLVIDO ✅
**Arquivo:** `src/app/(app)/operational/status/[status]/page.tsx`

**Correção aplicada (2026-04-24):**
- Removidas as funções vazias `handleToggleDriverPayment` e `handleRevertDriverPayment`
- Removidas as props `onTogglePayment`/`onRevertPayment` do `QuoteCard` e `OperationalInfo`
- Guard de renderização do `OperationalInfo` alterado de verificação de props para condição baseada em dados (`operationalHistory.some(e => e.expense > 0 && e.driverId)`)
- Deletado o diretório legacy `src/app/api/operational/` que ainda existia no disco

---

## 🟢 CONFIRMAÇÕES (O que está correto pós-correções)

### Permissões RBAC — Consistentes ✅
Todas as 10 permissões do submenu "Acesso a Cotação de Frete" estão corretamente mapeadas entre:
- **Zod Schema** (`UserManagement.tsx` linhas 70-78)
- **Types** (`types.ts` linhas 46-54)
- **Frontend Guards** (`QuoteList.tsx`, `FreightForm.tsx`, `quotes/page.tsx`)
- **Backend Filter** (`api/quotes/route.ts:41` — `canViewOthersQuotes`)

| Permissão | Schema Zod | Types | Frontend | Backend |
|---|---|---|---|---|
| canQuoteFracionado | ✅ | ✅ | ✅ | N/A |
| canQuoteDedicado | ✅ | ✅ | ✅ | N/A |
| canGiveDiscount | ✅ | ✅ | ✅ | N/A |
| canDeleteQuote | ✅ | ✅ | ✅ | N/A |
| canViewOthersQuotes | ✅ | ✅ | ✅ | ✅ |
| canRemakeQuote | ✅ | ✅ | ✅ | N/A |
| canViewMyQuotes | ✅ | ✅ | ✅ | N/A |
| canViewBasePrice | ✅ | ✅ | ✅ | N/A |
| canViewDeliveryTime | ✅ | ✅ | ✅ | N/A |

### Autenticação e Filtro de Tenant — Correto ✅
O filtro de segurança por tenant na API de cotações está correto para todos os roles (admin, cliente, sub-cliente, user, parceiro).

---

## 📋 BACKLOG PENDENTE (Concluído ✅)

1. ~~**Botão "Cancelar Edição"** — Visível no header quando `editingQuoteId` ativo~~
2. ~~**Botão FAB "+"** — Flutuante na QuoteList para scroll ao topo~~
3. ~~**Numeração atômica** — Corrigir race condition (cotações E romaneios)~~
4. ~~**Múltiplos comprovantes** — Migrar `proofOfDeliveryUrl` para array `proofOfDeliveryUrls`~~
5. ~~**`getValues()` no FreightFormHandle** — Bug silencioso crítico a ser corrigido~~

---

## 🧹 CLEANUP RECOMENDADO (Concluído ✅)

Arquivos listados abaixo foram removidos ou marcados como finalizados:

| Arquivo | Ação Realizada | Motivo |
|---|---|---|
| `src/app/api/operational/page.tsx` | DELETADO | Página React em diretório de API |
| `src/app/api/operational/status/[status]/page.tsx` | DELETADO | Página React em diretório de API |
| `src/components/MapDisplay.tsx` | DELETADO | Deprecated, stub vazio |
| `src/components/MapDisplayClient.tsx` | DELETADO | Deprecated, stub vazio |
| `src/components/MapDisplayInner.tsx` | DELETADO | Deprecated, stub vazio |

---

*Este documento é acessível de qualquer conta que abra o workspace `c:\ANTIGRAVITY\project`.*
