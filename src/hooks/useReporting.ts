import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAnalyticsDaily(days = 30) {
  return useQuery({
    queryKey: ["analytics-daily", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("analytics_daily")
        .select("*")
        .gte("day", since.toISOString().slice(0, 10))
        .order("day", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSlaEvents(filters?: { resolved?: boolean; sla_type?: string }) {
  return useQuery({
    queryKey: ["sla-events", filters],
    queryFn: async () => {
      let query = supabase
        .from("sla_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.resolved === false) {
        query = query.is("resolved_at", null);
      } else if (filters?.resolved === true) {
        query = query.not("resolved_at", "is", null);
      }
      if (filters?.sla_type) {
        query = query.eq("sla_type", filters.sla_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResolveSlaEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ids?: string[]; sla_type?: string }) => {
      let query = supabase
        .from("sla_events")
        .update({ resolved_at: new Date().toISOString() })
        .is("resolved_at", null);

      if (params.ids && params.ids.length > 0) {
        query = query.in("id", params.ids);
      } else if (params.sla_type) {
        query = query.eq("sla_type", params.sla_type);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}
