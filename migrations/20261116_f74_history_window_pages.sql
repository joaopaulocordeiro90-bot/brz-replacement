-- BRZ F74 · 16/11/2026 — source history by date and page.
-- Production equivalent was applied to Supabase, SECURITY INVOKER only.
-- Never expose private market quotes through anon or PUBLIC.
CREATE INDEX IF NOT EXISTS f74_market_domain_day_cursor_idx
 ON brz.f34_market_sources(domain,market_date,row_no)
 WHERE market_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS f74_market_json_day_cursor_idx
 ON brz.f34_market_sources(domain,(record_json->>'day'),row_no)
 WHERE domain IN ('basis_points','derivatives');

CREATE OR REPLACE FUNCTION public.brz_api_f74_history_page(
 p_domain text,p_from_date date,p_to_date date,
 p_after_row_no bigint DEFAULT 0,p_limit integer DEFAULT 25
)
RETURNS TABLE (
 row_no bigint,domain text,source_key text,market_date date,
 record_json jsonb,source_kind text,record_fingerprint text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','brz'
AS $f74$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR coalesce((SELECT brz.papel()),'') NOT IN ('mesa','admin')
 THEN RAISE EXCEPTION 'F74: sessão mesa/admin exigida' USING ERRCODE='42501'; END IF;
 IF p_domain NOT IN ('physical','curves','basis_points','derivatives','ocean')
    OR p_domain IS NULL OR p_from_date IS NULL OR p_to_date IS NULL
    OR p_from_date<DATE '2010-01-01'
    OR p_to_date<p_from_date OR p_to_date>CURRENT_DATE+366
    OR p_to_date-p_from_date>366
    OR p_after_row_no IS NULL OR p_after_row_no<0
    OR p_limit IS NULL OR p_limit NOT IN (10,25,50)
 THEN RAISE EXCEPTION 'F74: janela ou paginação inválida' USING ERRCODE='22023'; END IF;

 IF p_domain IN ('physical','curves','ocean') THEN
   RETURN QUERY WITH dated AS MATERIALIZED (
     SELECT s.row_no,s.domain,s.source_key,s.market_date,s.record_json,
       s.source_kind,s.record_fingerprint FROM brz.f34_market_sources s
     WHERE s.domain=p_domain
       AND s.market_date BETWEEN p_from_date AND p_to_date
       AND s.row_no>p_after_row_no)
   SELECT d.row_no,d.domain,d.source_key,d.market_date,d.record_json,
     d.source_kind,d.record_fingerprint FROM dated d
   ORDER BY d.row_no LIMIT p_limit;
 ELSIF p_domain='basis_points' THEN
   RETURN QUERY WITH dated AS MATERIALIZED (
     SELECT s.row_no,s.domain,s.source_key,s.market_date,s.record_json,
       s.source_kind,s.record_fingerprint FROM brz.f34_market_sources s
     WHERE s.domain='basis_points'
       AND s.record_json->>'day' BETWEEN to_char(p_from_date,'YYYYMMDD')
                                    AND to_char(p_to_date,'YYYYMMDD')
       AND s.row_no>p_after_row_no)
   SELECT d.row_no,d.domain,d.source_key,d.market_date,d.record_json,
     d.source_kind,d.record_fingerprint FROM dated d
   ORDER BY d.row_no LIMIT p_limit;
 ELSE
   RETURN QUERY WITH dated AS MATERIALIZED (
     SELECT s.row_no,s.domain,s.source_key,s.market_date,s.record_json,
       s.source_kind,s.record_fingerprint FROM brz.f34_market_sources s
     WHERE s.domain='derivatives'
       AND s.record_json->>'day' BETWEEN p_from_date::text AND p_to_date::text
       AND s.row_no>p_after_row_no)
   SELECT d.row_no,d.domain,d.source_key,d.market_date,d.record_json,
     d.source_kind,d.record_fingerprint FROM dated d
   ORDER BY d.row_no LIMIT p_limit;
 END IF;
END
$f74$;

REVOKE ALL ON FUNCTION public.brz_api_f74_history_page(text,date,date,bigint,integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.brz_api_f74_history_page(text,date,date,bigint,integer)
 TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
