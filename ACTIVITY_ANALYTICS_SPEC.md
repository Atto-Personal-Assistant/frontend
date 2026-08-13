# Atto Activity & Insights

## Visão

A página **Atividade** deve tornar o trabalho do Atto compreensível, auditável e
útil. Ela não é apenas um painel técnico: deve responder rapidamente o que foi
feito, o que está acontecendo, o que falhou, quais dispositivos participaram e
quanto valor o Atto gerou.

O nome principal será **Atividade**. Métricas agregadas e recomendações ficam em
uma área secundária chamada **Insights**.

## Objetivos

- Dar visibilidade imediata às ações executadas pelo Atto.
- Permitir continuar, repetir ou investigar uma atividade.
- Mostrar continuidade entre dispositivos sem expor detalhes técnicos demais.
- Tornar acessos a câmera, microfone e serviços externos transparentes.
- Identificar falhas, gargalos e oportunidades de automação.
- Mensurar tempo economizado e confiabilidade com estimativas honestas.

## Princípios

### Utilidade antes de volume

Cada métrica deve apoiar uma decisão. Gráficos decorativos e contadores sem ação
associada não devem fazer parte da primeira versão.

### Transparência

O usuário deve conseguir descobrir quando uma capacidade sensível foi utilizada,
por qual solicitação, em qual dispositivo e com qual resultado.

### Privacidade por padrão

Imagens, áudio, transcrições completas, prompts e respostas não devem ser
duplicados no sistema analítico. Os eventos devem guardar apenas metadados
necessários. Conteúdo completo continua sujeito às regras do histórico da
conversa.

### Continuidade

Uma atividade iniciada no computador e concluída no celular deve aparecer como
uma única execução, com seus dispositivos participantes.

### Tempo real

Mudanças importantes devem surgir sem recarregar a página: início, progresso,
pergunta pendente, conclusão, falha e reconexão de dispositivo.

## Arquitetura da informação

### 1. Resumo

A primeira faixa apresenta no máximo cinco indicadores:

- pedidos concluídos no período;
- taxa de sucesso;
- tarefas em andamento;
- tempo estimado economizado;
- dispositivos disponíveis agora.

Cada indicador deve abrir sua lista filtrada. A estimativa de tempo economizado
deve informar como foi calculada e nunca ser apresentada como valor exato.

### 2. Agora

Exibe execuções ativas e itens que exigem intervenção:

- tarefa e etapa atual;
- tempo decorrido;
- dispositivo de origem e dispositivos acionados;
- pergunta ou autorização pendente;
- ações de continuar, responder ou cancelar, quando suportadas.

Falhas recentes aparecem antes de execuções saudáveis, acompanhadas de uma ação
clara: tentar novamente, abrir conversa ou ver diagnóstico.

### 3. Linha do tempo

Lista cronológica pesquisável com:

- resumo do pedido;
- estado final ou atual;
- horário e duração;
- conversa relacionada;
- capacidades utilizadas;
- dispositivos participantes;
- integrações externas acionadas;
- recuperação automática, quando houver;
- ações para abrir, continuar ou repetir.

Filtros iniciais:

- período;
- estado: em andamento, concluído, falhou ou cancelado;
- dispositivo;
- capacidade;
- integração.

### 4. Dispositivos

Apresenta saúde e utilização da rede Atto:

- online agora e último contato;
- estabilidade da conexão;
- quantidade de ações;
- taxa de sucesso;
- capacidades anunciadas;
- volume aproximado de mídia compartilhada;
- erros recentes de permissão ou conectividade.

Dispositivos offline antigos devem permanecer recolhidos por padrão.

### 5. Privacidade

Trilha específica para capacidades sensíveis:

- acesso à câmera;
- uso do microfone e modo mãos livres;
- envio de mídia;
- análise por modelo visual;
- chamadas a serviços externos.

Cada registro informa finalidade, momento, dispositivo e retenção aplicável. A
página deve oferecer atalhos para apagar histórico, exportar dados e revisar
permissões.

### 6. Insights

Recomendações derivadas apenas de padrões suficientemente confiáveis:

- tarefas frequentemente repetidas que podem virar automações;
- horários com mais atividade;
- dispositivo mais adequado para uma capacidade;
- integrações com falhas recorrentes;
- tarefas que normalmente precisam de intervenção humana.

Toda recomendação deve explicar a evidência utilizada e permitir ser descartada.

## Modelo de evento

Eventos devem ser imutáveis e possuir um identificador de execução compartilhado
entre API, agent e dispositivos.

```json
{
  "event_id": "uuid",
  "execution_id": "uuid",
  "session_id": "uuid",
  "occurred_at": "2026-08-13T22:00:00Z",
  "type": "execution.completed",
  "state": "completed",
  "capability": "devices",
  "tool": "capture_camera",
  "source_device_id": "device-a",
  "target_device_ids": ["device-b"],
  "duration_ms": 1820,
  "success": true,
  "error_code": null,
  "external_services": ["ollama"],
  "media_bytes": 0,
  "sensitive_access": ["camera"],
  "metadata": {}
}
```

O campo `metadata` deve aceitar somente propriedades permitidas por tipo de
evento. Tokens, base64, conteúdo de mídia, prompts completos e credenciais são
proibidos.

## Eventos iniciais

- `execution.started`
- `execution.stage_changed`
- `execution.question_required`
- `execution.completed`
- `execution.failed`
- `execution.cancelled`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `device.connected`
- `device.disconnected`
- `device.command_completed`
- `sensitive.camera_opened`
- `sensitive.camera_closed`
- `sensitive.microphone_started`
- `sensitive.microphone_stopped`
- `media.shared`
- `external.request_completed`

## Métricas

### Confiabilidade

- taxa de conclusão;
- falhas por capacidade;
- recuperações automáticas bem-sucedidas;
- comandos de dispositivo expirados;
- reconexões por dispositivo.

### Desempenho

- latência até o primeiro feedback;
- duração total por categoria;
- duração de ferramentas externas;
- tempo aguardando decisão do usuário.

### Utilidade

- atividades repetidas;
- continuações e reruns;
- automações criadas a partir de sugestões;
- tempo estimado economizado por tipo de tarefa.

### Uso responsável

- acessos sensíveis por capacidade;
- dados enviados a serviços externos;
- retenção e exclusões solicitadas;
- custo estimado dos modelos, quando disponível.

## API proposta

```text
GET    /activity/summary?from=&to=
GET    /activity/executions?cursor=&state=&device=&capability=
GET    /activity/executions/{execution_id}
GET    /activity/devices?from=&to=
GET    /activity/privacy?from=&to=
GET    /activity/insights
POST   /activity/executions/{execution_id}/repeat
DELETE /activity/history?before=
GET    /activity/export
WS     /activity/events
```

Consultas de lista devem usar paginação por cursor. Agregações devem ser feitas
no backend; o frontend não deve baixar todo o histórico para calcular cartões.

## Estados da interface

- Carregamento com skeletons estáveis.
- Estado vazio educativo com exemplos de atividades que aparecerão ali.
- Atualização em tempo real sem reorganizar itens que o usuário esteja lendo.
- Falha parcial: cartões disponíveis continuam visíveis se uma consulta falhar.
- Offline: mostrar último snapshot local e horário da última atualização.
- Privacidade: ocultar detalhes sensíveis em notificações e telas compartilhadas.

## Layout responsivo

### Desktop

- resumo no topo;
- coluna principal com “Agora” e linha do tempo;
- coluna lateral com dispositivos, privacidade e insights;
- painel de detalhes sobreposto, sem abandonar os filtros atuais.

### Mobile

- resumo horizontal rolável ou compacto;
- “Agora” sempre antes do histórico;
- filtros em bottom sheet;
- detalhes em tela cheia;
- ações primárias alcançáveis com uma mão.

## Acessibilidade

- Não depender somente de cor para representar estado.
- Atualizações em tempo real devem evitar anúncios excessivos por leitores de tela.
- Gráficos precisam de resumo textual e tabela acessível.
- Todos os filtros e ações devem funcionar por teclado.
- Respeitar `prefers-reduced-motion`.
- Datas, durações e números devem usar formatação localizada.

## Retenção e segurança

- Retenção padrão configurável por ambiente e pelo usuário.
- Eventos sensíveis com retenção menor que métricas operacionais agregadas.
- Exclusão deve propagar para eventos derivados identificáveis.
- Exportação deve exigir autenticação recente.
- IDs externos e mensagens de erro devem ser sanitizados.
- O frontend nunca recebe tokens de integração.
- Contadores agregados não devem permitir reconstruir conteúdo apagado.

## Entrega incremental

### Fase 1 — Atividade útil

- modelo de eventos;
- resumo básico;
- execuções ativas;
- linha do tempo paginada;
- detalhes e acesso à conversa;
- filtros de estado e período.

### Fase 2 — Dispositivos e privacidade

- métricas de conexão e comandos;
- trilha de câmera, microfone e mídia;
- exportação e exclusão;
- atualização em tempo real.

### Fase 3 — Insights

- padrões de repetição;
- sugestões de automação;
- custos e tempo economizado;
- personalização e descarte de recomendações.

## Critérios de sucesso

- O usuário encontra uma atividade recente em menos de dez segundos.
- Toda falha exibida possui explicação e próximo passo.
- Todo acesso sensível pode ser auditado.
- A página continua responsiva com milhares de eventos.
- Nenhum conteúdo de câmera, áudio ou credencial é armazenado como telemetria.
- Uma atividade entre dispositivos aparece como uma única execução coerente.

## Fora do escopo inicial

- Comparação entre usuários ou rankings de produtividade.
- Monitoramento permanente de câmera ou microfone.
- Armazenamento de prompts completos para analytics.
- Gráficos financeiros sem fonte confiável de custos.
- Recomendações automáticas que executam ações sem confirmação.
