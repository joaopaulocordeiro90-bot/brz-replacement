# BRZ Replacement 2.0 — Homologação financeira: Gate 1 (18/11/2026)

## Status: PARCIAL. NÃO SUBSTITUIR O HTML OPERACIONAL.

### Fonte primária efetivamente inspecionada
- HTML original **BRZ_Replacement_2026-11-17_C49_TRES_FECHADOS_PEDRO_AGIO15_V4GE.html** (arquivo de aproximadamente 60 MB), recuperado do ZIP da Biblioteca, inspeção da implementação real de \`calcReplacement\`, \`priceCbu\`, \`freightCbu\`, \`usdTCbu\`, \`getRotasCorredor\`, \`brzMesesCBOT\`.
- Auditoria **V4GG/C51** de 17/11: 4.056 IDs únicos e cinco abas Excel, S47, Basis FOB, dados físicos, sem reescrita de séries anteriores.
- Auditorias **V4GI/C53** e **V4GJ/C54**: Gross Margin TAB milho sem fallback, embarque setembro/2027 com CBOT U27, janelas 3m/6m/1y.
- **Limitação:** arquivo HTML exato C54/V4GJ não foi localizado na Biblioteca desta sessão. C49 contém o motor numérico do mesmo ramo, mas difere em regras de apresentação introduzidas em C53/C54. Nada aqui equivale à validação de 4.056 negócios reais.

### Divergência concreta encontrada e corrigida
O piloto anteriormente rotulava \`basisFOB = flatFOB - CBOT\` como "Replacement FOB" e \`basisCFR = flatCFR - CBOT\` como "Replacement CFR". Esse erro troca o conceito flat por basis.

Fonte C49, fórmulas fundamentais:
- \`_p = ((preco/cambio)/factor)*100\`
- \`_fr = (((freteTotal*0.06)/cambio)/factor)*100\`
- \`_fb = ((fobbins*0.06)/factor)*100\`
- \`_sea = ((freteMaritimo*0.06)/factor)*100\`
- \`flatFOB = _p + _fr + _fb\`
- \`basisFOB = flatFOB - cbotFisico\`
- \`flatCFR = flatFOB + _sea\`
- \`basisCFR = flatCFR - cbotReferenciaCFR\`
- \`margemFOB = bidFOB - basisFOB\` se Bid válido; sem Bid => null, jamais Offer substituído por Bid.

### Caso de referência sintético (não é cotação executável)
Soja R$ 136/sc, dólar 5,50, frete R$ 220/t, FOBBINS US$ 12/t, marítimo US$ 35/t, CBOT 1100 c/bu, Bid FOB +100 c/bu. Fator soja 2.2046; R$/t para R$/sc usando 0,06.

| Saída | Cálculo equivalente ao C49 |
|---|---:|
| Flat FOB c/bu | 1263.14400468442 |
| Basis FOB c/bu | 163.14400468442 |
| Flat CFR c/bu | 1358.39937980915 |
| Basis CFR c/bu | 258.39937980915 |
| Gross Margin FOB c/bu | -63.14400468442 |
| Gross Margin FOB US$/t | -23.20121212121 |

### Mecanismos de proteção implementados
- Separação dos quatro campos na interface, com memória de cálculo.
- Fator soja 2.2046 e milho/sorgo 2.3621.
- Bid vs Offer: Offer não gera Gross Margin. Sem basis: margem N/D.
- Sem frete marítimo soja: CFR N/D sem zerar FOB.
- Milho/sorgo: CFR China não apresentado como margem executável.
- **Bloqueio de cálculos com embarque 2027+**, já que o piloto ainda não replica projeções rodoviárias, ferroviárias, barcaça, vigências e overrides do C49.
- Divergência de porto/origem/produto e cotação CBOT implausível: cálculo bloqueado.
- Os dados D1 existentes não foram alterados. Nenhuma migração, reprecificação histórica ou correção silenciosa.

### Gaps necessários antes da homologação integral
1. Recuperar o HTML C54 e reconciliar o estado original e o histórico completo de 4.056 IDs.
2. Portar \`dataRules\` sem criar constantes paralelas: CBOT soja/milho com vigência, setembro milho U27, meses origem/embarque, safrinha e travas de fechamento.
3. Portar frete por rota/terminal/modal: piso R$50/t, S47 e histórico semanal, estrada/ferro/barcaça, rodo 2027 0%/12% pré-26/10, ferro 2027 10%/14%, 2028 +20%, descontos e exceções por negócio; CIF e FAS sem frete duplicado.
4. Separar basis FOB de mesa por porto, **data exata**, mês de embarque, Bid/Offer; sem recuperar último valor quando ausente nas tabelas TAB.
5. Capturar CFR com **CBOT própria quando distinta** e conversões de calendário; sem extrapolar.
6. Confrontar D-1, D-7, D-30 e snapshots históricos, física, derivados e marítimo; validar importação diária Excel cinco abas.
7. Auditoria negócio-a-negócio contra resultados do motor operacional (tolerância 0,005 no formato original quando aplicável), abrir divergências, zerar antes de promover.
8. Confirmar renderização e exportações em navegador desktop/celular. Testes automáticos não substituem QA visual.

**Critério de promoção:** todas as etapas com evidência de paridade e aprovação explícita do usuário. Até lá, versão V2 é um piloto indicativo.
