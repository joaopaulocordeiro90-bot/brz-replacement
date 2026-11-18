# BRZ Replacement 2.0 — Piloto isolado

**Status: PILOTO, NÃO HOMOLOGADO.** Código na branch \`brz-v2-cloudflare-piloto\`; **não** modifica o BRZ operacional da branch \`main\`.

## Objetivo desta primeira entrega
- Site leve e modular, com telas de mercado, negócios, mapa e administração.
- Cadastro, edição e exclusão lógica de negócios, rotas/tarifas e referências de mercado por meio de API Cloudflare Pages Functions e D1.
- Marcação de coordenada exata pelo mapa; sede municipal não é ponto confirmado.
- Simulação **indicativa** de FOB/CFR e margem, com referências explícitas; sem cotação => N/D.
- Sem importação de negócios reais e sem qualquer escrita no Supabase.
- Não publica automaticamente nem comprova paridade com o HTML V4GG/F77.

## Publicação (após criar banco e conectar Cloudflare)
Configurar um novo projeto **Cloudflare Pages** usando o repositório GitHub \`brz-replacement\`, branch \`brz-v2-cloudflare-piloto\`, **diretório raiz \`v2\`**, diretório de saída \`public\` e sem build command (site estático).
Na Cloudflare, criar um banco **D1** e vinculá-lo ao Pages Functions com o binding exatamente \`DB\`. Depois de conectar o binding, abra o piloto e use o botão **Inicializar o D1 do piloto**, que executa o mesmo esquema da migração \`migrations/0001_base.sql\` no banco vinculado. Esta função é exclusiva de homologação e deve ser desativada antes do uso operacional. A Cloudflare pode exigir ativação das Functions conforme o fluxo de publicação escolhido.
Antes do binding/migração, a interface não grava: a verificação de saúde mostra o problema.
O código não contém senha de acesso. Esta versão não deve receber negócios confidenciais e não pode ser tratada como produção.
Para desenvolvimento local, usar \`wrangler pages dev public --d1=DB\` com o D1 local migrado, dentro de \`v2\` (conferir documentação da versão Wrangler utilizada).
As funções HTTP residem em \`functions/api/[[path]].js\`. Todo o restante do código é independente da hospedagem.

## Modelo de dados
\`trades\`: negócio + condições comerciais + localização confirmável.
\`routes\`: alternativas de transporte cadastral, por município/UF, porto, modal e vigência; tarifa R$/t explicitamente identificada.
\`market_refs\`: CBOT, câmbio, basis FOB, FOBBINS e frete marítimo por produto/porto/mês.
\`audit_events\`: trilha de alteração por entidade, com antes/depois.
Não há seed de dados reais nem inferências de frete.
Edição utiliza versionamento otimista para reduzir sobrescritas acidentais.

## Limites de homologação
- A fórmula de referência é um **protótipo** reconstruído de F77, não um motor financeiro homologado.
- Gross Margin piloto é diferença entre basis FOB de mercado e replacement FOB convertido a US$/t; não substituir a definição contratual sem conciliação.
- Não cobre integralmente os casos especiais: janelas, D-1/D-7/D-30, safrinha, U milho SET, contratos específicos, impostos, qualidade, corredores multimodais complexos e regras de parcelas.
- O mapa registra coordenadas; a geometria de rota ainda NÃO é validada nem roteirizada.
- Excel diário de cinco abas ainda NÃO é importado.
- Todos esses requisitos continuam bloqueadores da substituição do HTML operacional.

## Checklist de aprovação
1. Subir banco vazio; abrir site e constatar status \`online\`.
2. Cadastrar negócio e verificar que aparece após recarregar e em outro dispositivo.
3. Editar negócio, conferir revisão e a trilha de auditoria.
4. Marcar pin de origem e conferir precisão \`ponto_confirmado\`.
5. Cadastrar rota/tarifa cotada e referências CBOT/FX/basis do mesmo produto, porto e mês; calcular.
6. Eliminar basis e constatar que Gross Margin vira \`N/D\`.
7. Importar histórico real somente depois de inventário e auditoria contra o HTML.

Docs: https://developers.cloudflare.com/pages/functions/bindings/ ; https://developers.cloudflare.com/d1/reference/migrations/ .
