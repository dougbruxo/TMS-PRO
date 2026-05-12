# Checkpoint 37: Tabelas ANTT 2026 e Gestão de Certificados

Este documento registra a atualização das tabelas de frete mínimo ANTT 2026 e a implementação do módulo de gestão de certificados A1 para emissão fiscal.

## 🚀 Evoluções da Sessão

### 1. Atualização ANTT 2026 (Coeficientes e Tipos de Carga)
*   **Novas Categorias**: Implementada a lógica de precificação para cargas **Frigorificada** e **Conteinerizada** em `src/lib/data.ts`.
*   **Coeficientes Dinâmicos**: Adição dos novos coeficientes de Custo de Deslocamento (CCD) e Custo de Carga/Descarga (CC) conforme a resolução ANTT vigente.
*   **Cálculo de Eixos**: Expansão do suporte para veículos de até 9 eixos, garantindo a cobertura de composições pesadas (Bitrem/Rodotrem).
*   **Utilitários de Veículo**: Criado o `src/lib/vehicle-utils.ts` para centralizar a lógica de identificação de eixos e categorias de carga.

### 2. Módulo de Gestão de Certificados A1
*   **Upload de Certificado**: Desenvolvida interface em `Configurações > Certificado` para upload e gestão de arquivos `.pfx` ou `.p12`.
*   **Persistência Segura**: Implementada a rota de API para armazenamento dos certificados e senhas associadas (criptografadas), essenciais para a assinatura de MDF-e e CT-e.
*   **Status de Validade**: Integração de feedback visual sobre o status e data de expiração do certificado ativo.

### 3. Refinamento de Tabelas de Frete
*   **Tabela de Regiões**: Otimização da performance na renderização da `MinimumFreightRegionTable`, permitindo ajustes rápidos por UF.
*   **Correção em FreightForm**: Ajuste no componente principal de frete para refletir as novas categorias de carga ANTT no seletor de tipo de veículo.

## 📋 Arquivos Modificados/Criados
1.  `src/lib/data.ts` (Atualização de coeficientes ANTT 2026)
2.  `src/lib/vehicle-utils.ts` (Lógica de eixos e utilitários) - **[NOVO]**
3.  `src/app/(app)/settings/antt/page.tsx` (Configurações ANTT) - **[NOVO]**
4.  `src/app/(app)/settings/certificate/page.tsx` (Gestão de Certificados A1) - **[NOVO]**
5.  `src/app/api/settings/antt/route.ts` (API de persistência ANTT) - **[NOVO]**
6.  `src/app/api/settings/certificate/route.ts` (API de upload de certificado) - **[NOVO]**
7.  `src/components/FreightForm.tsx` (Integração com novas categorias de carga)
8.  `src/components/VehicleManagement.tsx` (Ajustes na gestão de eixos da frota)

---

# Checkpoint 36: Conformidade MDF-e v3.00 e Automação de CIOT Gratuito (Multi-tenant)


Este documento registra a resolução definitiva das rejeições de schema do MDF-e (Carga Lotação) e a implementação do módulo de integração direta com a ANTT para geração de CIOT sem custos de IPEF.

## 🚀 Evoluções da Sessão

### 1. MDF-e v3.00: Inteligência de Carga Lotação e Rejeição 611
*   **Detecção de Carga Lotação**: O frontend agora identifica automaticamente quando o manifesto possui apenas **1 documento (CT-e)** vinculado. Nestes casos, o sistema habilita condicionalmente os campos de **CEP de Carregamento e Descarregamento**.
*   **Grupo `infLotacao`**: Implementada a geração do grupo `<infLotacao>` no XML, requisito obrigatório da Nota Técnica 2021/001 para evitar a Rejeição 611.
*   **Produto Predominante (`prodPred`)**: Adicionado o grupo obrigatório que identifica o tipo de carga (Padrão: 05 - Carga Geral), garantindo a validação do schema rodoviário.
*   **Identificação Dinâmica do Contratante**: Lógica reativa que altera o contratante entre a própria transportadora (se veículo for **TAC**) e o cliente (se veículo for **ETC**), baseada na categoria do veículo no banco de dados.

### 2. Gestão de CIOT Gratuito (Integração Direta ANTT)
*   **Arquitetura Multi-tenant para VPS**: Desenvolvido um motor de CIOT (`CiotEngine`) desacoplado de nuvens proprietárias, otimizado para servidores próprios (Hostinger/VPS). Ele gerencia múltiplos certificados A1 e credenciais por cliente (tenant).
*   **Configurações Fiscais Expandidas**: Adicionada seção de CIOT em `Configurações > Emissão Fiscal`, permitindo que cada transportadora configure seu **Usuário/Senha da ANTT** e ambiente (Homologação/Produção).
*   **Motor de Emissão (SOAP/XML)**: Criado o `XmlBuilder` para CIOT seguindo o padrão ANTT 2026, com suporte a valores de frete, adiantamento, rota e documentos vinculados.
*   **Hub de Documentos**: Ativado o card de "Gerir CIOT", dando acesso ao formulário completo de gestão e emissão.

### 3. Sincronização de API e Backend
*   **Propagação de Dados**: A rota da API do MDF-e (`/api/nfe/mdfe`) foi atualizada para processar os novos metadados de CEP e lotação, garantindo que o XML assinado reflita fielmente os dados da interface.
*   **Histórico de CIOT**: Implementada a persistência dos protocolos de autorização e números de CIOT no banco de dados para consulta e auditoria futura.

## 📋 Arquivos Modificados/Criados
1.  `src/lib/sefaz/xml-builder-mdfe.ts` (Implementação de `infLotacao` e `prodPred`)
2.  `src/app/(app)/documents/mdfe/page.tsx` (UI de Carga Lotação e lógica de contratante)
3.  `src/app/api/nfe/mdfe/route.ts` (Processamento de metadados de lotação no payload)
4.  `src/lib/ciot/engine.ts` (Motor de CIOT multi-tenant para VPS) - **[NOVO]**
5.  `src/lib/ciot/xml-builder.ts` (Construtor XML SOAP ANTT) - **[NOVO]**
6.  `src/app/api/documents/ciot/route.ts` (API de orquestração de emissão) - **[NOVO]**
7.  `src/app/(app)/documents/ciot/page.tsx` (Interface de gestão de CIOT) - **[NOVO]**
8.  `src/app/(app)/settings/fiscal/page.tsx` (Configurações de credenciais ANTT)
9.  `src/app/api/settings/fiscal/route.ts` (Persistência de dados CIOT no banco)

---

# Checkpoint 35: Aprimoramento da Busca e Vínculo de Veículos na Gestão de Frota

Este documento registra a resolução dos problemas críticos relacionados à busca de veículos na tela de gestão de motoristas, permitindo vínculos precisos e transparentes entre motoristas e veículos.

## 🚀 Evoluções da Sessão

### 1. Robustez na Busca de Veículos (API)
*   **Tratamento de Hífens na Placa**: O endpoint `/api/fleet` foi reescrito para gerar um `plateRegex` inteligente. Agora, se o usuário digitar "AAA1234" (sem hífen), a busca localiza corretamente veículos salvos como "AAA-1234", eliminando os relatos de "nada encontrado" por erros de digitação.
*   **Expansão do Escopo de Pesquisa**: A busca agora contempla não apenas a Placa, Marca e Modelo, mas também os novos campos de `vehicleType` (Tipo de Rodado) e `bodyType` (Tipo de Carroceria). O usuário pode digitar "Carreta" ou "Cavalo Mecânico" para encontrar os veículos diretamente.

### 2. Remoção de Filtros Restritivos Client-Side
*   **Melhoria na Exibição**: Removido o filtro estrito do front-end que ocultava silenciosamente veículos caso a classificação interna divergissem. Agora, o sistema confia na robustez da API e exibe todos os veículos encontrados.
*   **Ordenação Inteligente**: Implementada ordenação dinâmica que prioriza exibir as carretas no topo quando o objetivo do vínculo for uma "Carreta", e vice-versa para o Veículo Principal.

### 3. Melhoria na Experiência do Usuário (UX)
*   **Identificação Visual (Badges)**: Adicionado um componente `Badge` ao lado de cada resultado da pesquisa no modal de "Vincular Veículo", que exibe explicitamente o "Tipo de Rodado" (ex: "01 - Truck", "02 - Cavalo Mecânico"). Isso guia o usuário na hora de escolher qual veículo é o "Principal" e qual é a "Carreta".

## 📋 Arquivos Modificados
1. `src/app/api/fleet/route.ts` (Implementação de Regex imune a hífens e expansão dos campos de busca)
2. `src/components/DriverManagement.tsx` (Remoção de filtros restritivos, nova ordenação e inclusão do Badge visual na pesquisa)

---

# Checkpoint 34: Estabilização de Operações Fiscais e Automação de Dados

Este documento registra a implementação da herança inteligente de dados de frota para condutores e a conclusão do ciclo de vida regulatório do MDF-e com a funcionalidade de encerramento.

## 🚀 Evoluções da Sessão

### 1. Gestão de Frota e Motoristas (Conformidade SEFAZ)
*   **Renomeação e Alinhamento Técnico**: No formulário de `/fleet`, o campo "Tipo de Veículo" foi alterado para **"Tipo de Rodado"** e "Tipos de Carroceria" para **"Tipo de Carroceria"**, seguindo a nomenclatura oficial do manual do MDF-e.
*   **Códigos Fiscais Automáticos**: O sistema agora mapeia e persiste automaticamente os códigos numéricos exigidos pela SEFAZ (ex: `01 - Truck`, `02 - Cavalo Mecânico`) a partir da seleção do usuário, garantindo a integridade do XML.
*   **Correção de Normalização**: Implementada normalização de strings (remover acentos) na comparação de tipos de veículo, corrigindo o erro que impedia o vínculo de carretas a um "Cavalo Mecânico".

### 2. Herança Inteligente de Dados (UX & Agilidade)
*   **Automação em CT-e e MDF-e**: Ao selecionar um motorista nas telas de emissão (`/documents/cte` e `/documents/mdfe`), o sistema agora busca e preenche automaticamente os dados do veículo principal vinculado (Placa, Tara, Tipo de Rodado, Tipo de Carroceria).
*   **Redução de Erros**: Essa automação elimina a necessidade de digitação manual redundante e garante que os campos obrigatórios para a validação do MDF-e estejam sempre consistentes com o cadastro de frota.

### 3. Ciclo de Vida do MDF-e (Evento de Encerramento)
*   **Gestão de Encerramento**: Adicionada a funcionalidade "Encerrar MDF-e" no Histórico de Documentos, permitindo que o usuário finalize o ciclo regulatório do manifesto após a entrega da carga.
*   **Interface de Evento (110112)**: Criado diálogo para captura dos dados de encerramento (UF e Município), com preenchimento sugerido baseado no destino final do MDF-e.
*   **Status Fiscal**: O processo aciona o endpoint de eventos da SEFAZ, garantindo que o documento seja encerrado legalmente na base nacional.

## 📋 Arquivos Modificados
1. `src/components/FleetManagement.tsx` (Ajuste de labels e lógica de persistência de códigos)
2. `src/components/DriverManagement.tsx` (Normalização de nomes de veículos e suporte a "Carreta")
3. `src/app/(app)/documents/cte/page.tsx` (Lógica de herança de dados do condutor)
4. `src/app/(app)/documents/mdfe/page.tsx` (Lógica de herança de dados do condutor)
5. `src/app/(app)/documents/history/page.tsx` (Implementação do fluxo de Encerramento)
6. `src/lib/database.ts` (Expansão dos tipos de veículos iniciais)

---

# Checkpoint 33: Estabilização de Emissão MDF-e e Conformidade de Schema

Este documento registra a resolução dos erros de comunicação SOAP e inconsistências de schema XSD no módulo de MDF-e, permitindo a comunicação bem-sucedida com a SEFAZ SVRS.

## 🚀 Evoluções da Sessão

### 1. Resolução de Erros SOAP/HTTP
*   **Protocolo de Comunicação**: Implementada a compressão **GZIP** seguida de codificação **Base64** para o payload XML, conforme exigido pelo padrão de serviços síncronos da SEFAZ (ex: `MDFeRecepcaoSinc`).
*   **Correção de SOAPAction**: Ajustado o endpoint e o header `SOAPAction` para incluir o sufixo preciso (`mdfeRecepcao`), eliminando erros de "Method Not Found" e HTTP 400.

### 2. Rigor no Schema XML (MDF-e 3.00)
*   **Sequenciamento de Tags**: Refatorado o `xml-builder-mdfe.ts` para garantir a ordem estrita exigida pelo XSD:
    *   `infMunCarrega` e `infPercurso` corretamente posicionados no bloco `ide`.
    *   `infContratante` movido para dentro de `infModal.rodo.infANTT`.
    *   Adicionados campos obrigatórios de **Tara (Peso Bruto)** e **Capacidade** no bloco `veicTracao`, com fallback inteligente para veículos sem esses dados cadastrados.
*   **Mapeamento de Dados**: A API agora realiza o parse automático de strings de capacidade (ex: "25000 kg" -> 25000) e cubagem, garantindo valores numéricos válidos no XML.

### 3. Melhorias na Experiência do Usuário (UX)
*   **Automação de Pesos e Valores**: O formulário de emissão agora calcula automaticamente o somatório de peso (`qCarga`) e valor total (`vCarga`) de todos os CT-es vinculados, com suporte a máquinas de formatação.
*   **Fix de Performance**: Substituídos componentes de checkbox pesados por implementações leves, resolvendo loops de re-renderização em listas extensas de documentos.

## 📋 Arquivos Modificados
1. `src/lib/sefaz/soap-client.ts` (Implementação de GZIP + Base64)
2. `src/lib/sefaz/xml-builder-mdfe.ts` (Correção de sequência XSD e novos campos de veículo)
3. `src/app/api/nfe/mdfe/route.ts` (Mapeamento de tara e capacidade, e orquestração de payload)
4. `src/lib/sefaz/endpoints.ts` (Correção de SOAPAction)
5. `src/app/(app)/documents/mdfe/page.tsx` (Automação de totais e correção de UI)

---

# Checkpoint 32: Integração Fiscal MDF-e (Schema 3.00 / SEFAZ 2026) e Automação de Totais

Este documento registra a finalização do módulo de MDF-e, focando na conformidade com o schema 3.00 da SEFAZ, estabilização da interface de usuário e automação completa dos cálculos de carga.

## 🚀 Evoluções da Sessão

### 1. Inteligência e Automação de Cargas
*   **Workflow Baseado em CT-e**: Implementado seletor de CT-es com busca por demanda (server-side), permitindo vincular documentos para autopreenchimento do Manifesto.
*   **Cálculo Automático de Totais**: O sistema agora realiza a soma em tempo real do **Valor Total da Carga (vCarga)** e **Peso Total (qCarga)** conforme o usuário seleciona ou desmarca CT-es, eliminando erros de digitação manual.
*   **Máscaras de Input**: Adicionada formatação monetária (R$ 0,00) e numérica (0,000) aos campos de totais, seguindo o padrão visual do sistema.

### 2. Conformidade Fiscal SEFAZ 2026 (Schema 3.00)
*   **Dados de Percurso**: Adicionado suporte ao grupo `<infPercurso>`, permitindo a seleção das UFs de trajeto obrigatórias para transporte interestadual.
*   **Informações do Contratante**: Implementada a inclusão do grupo `<infContratante>` (CNPJ/CPF) no XML, essencial para o transporte de cargas de terceiros por ETC.
*   **Tipagem Robusta**: Atualizada a interface `MdfeDados` e o mapeamento na API para suportar os novos campos fiscais.

### 3. Estabilidade Técnica e Performance
*   **Fix de Loop de Renderização**: Identificado e resolvido o erro "Maximum update depth exceeded" causado por conflitos entre o Radix UI Checkbox e listas longas de CT-es. O componente foi substituído por uma implementação customizada mais leve.
*   **Failsafe no XML Builder**: Adicionadas proteções com optional chaining e fallbacks (`?.toUpperCase()`, `?.replace()`) na construção do XML, prevenindo erros 500 no servidor por valores nulos ou indefinidos.
*   **Otimização de PDFs**: Ajustada a lógica de logos nos endpoints de DACTE e DAMDFE para converter caminhos locais em URLs absolutas dinâmicas, garantindo a exibição correta das imagens nos documentos gerados.

## 📋 Arquivos Modificados
1. `src/app/(app)/documents/mdfe/page.tsx` (UI, auto-cálculo e fix de loop)
2. `src/lib/sefaz/xml-builder-mdfe.ts` (Mapeamento de percurso, contratante e proteções de runtime)
3. `src/app/api/nfe/mdfe/route.ts` (Orquestração do payload e envio SEFAZ)
4. `src/app/api/documents/cte-search/route.ts` (Exposição do campo valorCarga para o frontend)
5. `src/app/api/sefaz/damdfe/route.ts` & `dacte/route.ts` (Correção de URLs de logo)
