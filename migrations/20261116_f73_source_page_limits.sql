-- F73 / 2026-11-16 — Restauração da paginação entre JavaScript e RPC.
-- Idempotente. Executado no Supabase em 16/11/2026; armazenado para auditoria.
-- Nenhum DML. SQL invoker, JWT + brz.papel() e grants anteriores intactos.
-- Valores compatíveis com F40 PAGE_SIZE=1500, F41=1000 e F46=4000.
DO $F73$
DECLARE
 v_record text[];
 v_name text;
 v_old text;
 v_new text;
 v_def text;
 v_targets text[][]:=ARRAY[
  ARRAY['brz_api_f34_market_page','p_limit NOT BETWEEN 1 AND 250','p_limit NOT BETWEEN 1 AND 1500'],
  ARRAY['brz_api_f41_trade_source_page','p_limit NOT BETWEEN 1 AND 250','p_limit NOT BETWEEN 1 AND 1000'],
  ARRAY['brz_api_f46_road_page','p_limit NOT BETWEEN 1 AND 1000','p_limit NOT BETWEEN 1 AND 4000']
 ];
BEGIN
 FOREACH v_record SLICE 1 IN ARRAY v_targets LOOP
  v_name:=v_record[1];v_old:=v_record[2];v_new:=v_record[3];
  SELECT pg_get_functiondef(p.oid) INTO STRICT v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=v_name;
  IF v_def NOT LIKE '%auth.uid()%' OR v_def NOT LIKE '%brz.papel()%' OR
     v_def LIKE '%SECURITY DEFINER%'
  THEN RAISE EXCEPTION 'F73: autorização não verificada em %',v_name; END IF;
  IF position(v_new IN v_def)>0 THEN CONTINUE; END IF;
  IF length(v_def)-length(replace(v_def,v_old,''))<>length(v_old)
  THEN RAISE EXCEPTION 'F73: limite anterior inesperado para %',v_name; END IF;
  EXECUTE replace(v_def,v_old,v_new);
 END LOOP;
END;
$F73$;
