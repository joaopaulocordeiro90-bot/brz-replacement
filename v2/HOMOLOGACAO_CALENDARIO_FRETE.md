# BRZ Replacement 2.0 — Gate 2 · Calendário e Frete (18/11/2026)

## Estado
**IMPLEMENTADO COMO MÓDULO PURO + CONFERÊNCIA VISÍVEL. NÃO HOMOLOGADO PARA REPRECIFICAR 2027/2028 EM PRODUÇÃO.**

Fontes efetivamente inspecionadas:
- HTML operacional BRZ_Replacement_2026-11-17_C49_TRES_FECHADOS_PEDRO_AGIO15_V4GE.html, scripts \`brzMesesCBOT\`, \`brzDolEmbarque\`, \`brzRailDiscountFactor\` e \`calcReplacement\`.
- Bloco \`dataRules\`, versão V4EL-1, atualizado em 12/11/2026, com 187 regras documentadas.
- Auditoria posterior C53/V4GI (17/11/2026) — milho setembro/27 U27, sem fallback de basis e Gross Margin como Bid FOB menos replacement basis FOB.
- O HTML completo C54/V4GJ ainda não foi localizado para validação operacional integral.

## Contratos e janelas
- Soja (vigente desde 04/11): Jan–Mar H; Abr K; Mai–Jun N; Jul Q; Ago U; Set–Nov X; Dez F do próximo ano.
- Milho/sorgo (vigente desde 04/11 no C49): Jan–Mar H; Abr/Mai K; Jun N; Jul–Dez Z.
- Exceção posterior C53: milho **setembro/2027 U27** em negócios a partir de 17/11; preservar entradas históricas anteriores ao ajuste.
- Regra de embarque: última retirada +1 mês; somente se houver data final confirmada. Sem retirada: SPOT/imediato/disponível +1 mês do fechamento. Milho Santos com janeiro calculado é dezembro anterior. Outros portos seguem a régua. Sem dado suficiente, não fabricar mês.
- Dólar: DOL do mês de embarque (ex.: dezembro/2026 = DOLZ26), independente da CBOT.
- Contrato CBOT salvo divergente da tabela vigente: **bloqueio de cálculo**. Embarque incompatível com janela final confirmada: **bloqueio**. Apenas início de retirada não bloqueia automaticamente, marcado INDICATIVO.

## Fretes, data de vigência
- Rodoviário: piso R$ 50/t salvo tarifa já final ou piso individual mais alto.
- A partir de 26/10/2026, com 1 ano à frente: rodoviário +0%, ferroviário +10%.
- Registros anteriores a 26/10/2026: rodoviário +12%, ferroviário +14%, sem reprecificação retroativa.
- 2+ anos à frente: +20% no total interno (rodo, ferro e barcaça), sem acumular +0/+10 de 2027.
- Ferroviário Santos em 2026: desconto base 15%, com transição histórica GO de 18 a 25/08; para embarque 2027+ não aplicar desconto.
- Negócios podem ter adicional fixo R$/t após projeção, percentual extra, override, tarifa final manual, piso e ágio individual. A exceção Pedro Diniz/AGREX 15% somente no trecho rodoviário Santos e ID previsto.
- O frete D1 atual só guarda **freight_brl_t total**, sem discriminar trechos. Portanto a prévia rodoviária/ferroviária simples é ilustrativa e o cálculo financeiro de 2027+ permanece bloqueado até modelagem de segmentos e validação do frete origem/porto/modal. Rodo+ferro/barcaça sem desdobramento fica N/D.
- Nenhum número da base D1 foi modificado.

## UI e qualidade
- Aba Replacement mostra embarque selecionado e inferido, CBOT salva e esperada, DOL, projeção de frete (quando modalidade simples), divergências e razões.
- Novos testes unitários verificam rolagem de dezembro, CBOT vigência 04/11, alteração do milho U27, regime pré e pós 26/10, projeção 2028, descontos ferroviários GO, exceção Pedro Diniz, ausência de quote e exceção milho Santos.
- Testes GitHub Actions não substituem inspeção do HTML final e confronto negócio a negócio com valores operacionais.
- **Próximo Gate 3**: persistir trechos logísticos, tabela versionada de tarifas, migração progressiva das regras de originação, CIF/FAS, frete por terminal/porto e CBS/CBOT/FX históricos, confronto C54 com 4.056 negócios e pares de datas.
