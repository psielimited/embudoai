import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callEdge } from "@/lib/edge";

export function useImportJobs() {
  return useQuery({
    queryKey: ["import-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStartImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { file_path: string; mapping: Record<string, string> }) => {
      return callEdge("import-leads-csv", params);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-jobs"] }),
  });
}

export function useDownloadErrorReport() {
  return useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from("imports").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "error_report.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
