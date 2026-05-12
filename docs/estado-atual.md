# Estado Atual do Sistema: DezLog Secure Freight

*Última atualização: 26 de Abril de 2026 (Modernização WMS)*

Este documento consolida o estado atual do projeto **DezLog Secure Freight**, listando as correções críticas, ajustes arquiteturais interligados e novas regras de operação implementadas recentemente para assegurar a consistência entre o modo **Dedicado**, **Fracionado**, permissões de hierarquia (**Transportadora vs Cliente**) e a navegação estruturada.

---

## 1. Modernização do WMS (Warehouse Management System)

Foi implementada a base robusta do módulo de gerenciamento de armazém, permitindo controle total de estoque para a transportadora e para o cliente final.

### Funcionalidades Implementadas:
- **Infraestrutura Logística:** Definição de `StockPosition` (Posições de Paletes), `StockItem` (Itens de Inventário) e `StockMovement` (Histórico).
- **Mapa do Armazém:** Visualização gráfica da ocupação física das posições via `WarehouseMap`.
- **Dashboard de Estoque:** Painel analítico com estatísticas de ocupação e giro.
- **Integração NFe (XML):** Entrada automática de estoque via upload de XML da NFe, mapeando SKUs e quantidades para a posição "RECEBIMENTO".
- **Workflow de Conferência em Duas Etapas:** Separação entre conferência quantitativa de itens (SKUs) e alocação logística (Posicionamento de Paletes).
- **Rastreabilidade por Unidade de Palete:** Suporte ao campo `palletNumber` e distribuição automática (Round Robin) de itens entre paletes.
- **Faturamento de Armazenagem:** Geração automática de cotações financeiras baseadas em dias de ocupação, com regras de preço configuráveis por palete, volume (m³) ou peso.
- **Ações em Massa:** Movimentação entre posições e baixa coletiva de itens.
- **Expedição/Picking:** Início do workflow de separação, onde a confirmação do picking debita o estoque e gera automaticamente uma cotação de frete "Last-Mile".

### Próximos Passos (WMS):
- Implementação de conferência por leitura de código de barras.
- Alertas de validade de produtos (FEFO/FIFO).
- Integração mobile para operadores de empilhadeira.

---

## 2. Controle Hierárquico e Acessibilidade (UI e Paineis)

### Visibilidade por Role (Perfil)
Foi resolvida a poluição visual de administradores e ferramentas cruzadas, determinando regras rígidas de acesso a componentes criados originalmente para uso restrito de **clientes B2B**.

- **Propriedade `isClientOnly`:** Inclusão nativa da tag `isClientOnly: true` na configuração do _Dashboard_ (`src/lib/dashboard-cards.tsx`).
- **Cartões Ocultos para a Transportadora:** Usuários de função `admin` e `user` não possuem mais atalhos no dashboard para itens restritos a clientes.
- **Persistência de Layout Sincronizada:** A ordem customizada de cartões no dashboard passou a refletir também na barra de navegação e menu lateral.
- **Notificações do Chat Interno:** O ícone do chat agora possui badging pulsante de mensagens não lidas (`unreadChatCount`) no Header.

---

## 3. Motor de Precificação: Roteirizador Avançado e Calculadora

### Resolução do Conflito de Frete Base vs Total (Fracionado)
Corrigido o problema onde o valor total com impostos era empurrado de volta para o campo base em recalculos, gerando inflacionamento.

- **Memória de Preenchimento:** Implementação de `hasManualBaseFreight` e `valorBaseManual` no modelo `Quote`.
- **Lógica de Restauração:** O formulário agora distingue entre frete calculado pela tabela e frete inserido manualmente, evitando travamentos matemáticos.

### Importação Inteligente de Cotações via XML
- **Expansão de Extração:** Mapeamento detalhado de Logradouro, Número e Bairro dos nós `xLgr`, `nro` e `xBairro` para os endereços de coleta e entrega.
- **Preenchimento Fantasma:** O `FreightForm` agora autocompleta endereços detalhados a partir do XML, reduzindo erros operacionais.

---

## 4. Desempenho e API

- **Cache MongoDB:** Integração com cache inteligente para reduzir latência de queries repetitivas.
- **Location API:** Otimização de roteamento complexo, com respostas entre 2ms e 800ms, eliminando chamadas redundantes a serviços externos.

---

## Notas Técnicas para Próximos Ciclos
- **Performance de Front-End:** Manter a política `isClientOnly` em novos painéis.
- **Relatórios Contábeis:** Garantir que os nós de AdValorem estejam somatizados corretamente via `valorBaseManual` em futuras exportações.

O estado da branch é altamente síncrono e limpo.
