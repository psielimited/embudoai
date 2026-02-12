
-- Enable extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Service role policies (INSERT uses only WITH CHECK, not USING)
CREATE POLICY "Service role can insert analytics_daily" ON public.analytics_daily FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can delete analytics_daily" ON public.analytics_daily FOR DELETE TO service_role USING (true);
CREATE POLICY "Service role can insert sla_events" ON public.sla_events FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update sla_events" ON public.sla_events FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);
