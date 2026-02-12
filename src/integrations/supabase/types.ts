export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          org_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by: string
          description?: string | null
          entity_id: string
          entity_type?: string
          id?: string
          org_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          created_at: string
          day: string
          id: string
          metric: string
          org_id: string
          owner_user_id: string | null
          pipeline_id: string
          value: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          metric: string
          org_id: string
          owner_user_id?: string | null
          pipeline_id: string
          value?: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          metric?: string
          org_id?: string
          owner_user_id?: string | null
          pipeline_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_daily_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_user_id: string
          created_at: string
          diff: Json
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          opportunity_id: string | null
          org_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          event_type: string
          id?: string
          opportunity_id?: string | null
          org_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          opportunity_id?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          addresses: Json
          created_at: string
          doc_id: string | null
          emails: Json
          full_name: string
          id: string
          org_id: string
          owner_user_id: string | null
          phones: Json
          tags: Json
          updated_at: string
        }
        Insert: {
          addresses?: Json
          created_at?: string
          doc_id?: string | null
          emails?: Json
          full_name: string
          id?: string
          org_id: string
          owner_user_id?: string | null
          phones?: Json
          tags?: Json
          updated_at?: string
        }
        Update: {
          addresses?: Json
          created_at?: string
          doc_id?: string | null
          emails?: Json
          full_name?: string
          id?: string
          org_id?: string
          owner_user_id?: string | null
          phones?: Json
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          external_contact: string
          id: string
          intent: string | null
          language: string
          merchant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_contact: string
          id?: string
          intent?: string | null
          language?: string
          merchant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_contact?: string
          id?: string
          intent?: string | null
          language?: string
          merchant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      dedupe_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          keys: Json
          name: string
          org_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          keys: Json
          name: string
          org_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          keys?: Json
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedupe_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string
          error_report_path: string | null
          file_path: string | null
          id: string
          mapping: Json
          org_id: string
          stats: Json
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error_report_path?: string | null
          file_path?: string | null
          id?: string
          mapping?: Json
          org_id: string
          stats?: Json
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error_report_path?: string | null
          file_path?: string | null
          id?: string
          mapping?: Json
          org_id?: string
          stats?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_matches: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          match_reason: string
          matched_entity_id: string
          matched_entity_type: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          match_reason: string
          matched_entity_id: string
          matched_entity_type: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          match_reason?: string
          matched_entity_id?: string
          matched_entity_type?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_matches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          consent: Json
          converted_contact_id: string | null
          created_at: string
          emails: Json
          full_name: string
          id: string
          org_id: string
          owner_user_id: string | null
          phones: Json
          source: string
          stage_id: string | null
          status: string
          tags: Json
          updated_at: string
          utm: Json
        }
        Insert: {
          consent?: Json
          converted_contact_id?: string | null
          created_at?: string
          emails?: Json
          full_name: string
          id?: string
          org_id: string
          owner_user_id?: string | null
          phones?: Json
          source?: string
          stage_id?: string | null
          status?: string
          tags?: Json
          updated_at?: string
          utm?: Json
        }
        Update: {
          consent?: Json
          converted_contact_id?: string | null
          created_at?: string
          emails?: Json
          full_name?: string
          id?: string
          org_id?: string
          owner_user_id?: string | null
          phones?: Json
          source?: string
          stage_id?: string | null
          status?: string
          tags?: Json
          updated_at?: string
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          org_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          amount: number | null
          created_at: string
          expected_close_date: string | null
          id: string
          name: string
          org_id: string
          owner_user_id: string
          pipeline_id: string
          stage_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          name: string
          org_id: string
          owner_user_id: string
          pipeline_id: string
          stage_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          name?: string
          org_id?: string
          owner_user_id?: string
          pipeline_id?: string
          stage_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          created_at: string
          full_name: string | null
          id: string
          manager_user_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_org_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          manager_user_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_org_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          manager_user_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_events: {
        Row: {
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          org_id: string
          resolved_at: string | null
          severity: string
          sla_type: string
        }
        Insert: {
          created_at?: string
          details?: Json
          entity_id: string
          entity_type?: string
          id?: string
          org_id: string
          resolved_at?: string | null
          severity?: string
          sla_type: string
        }
        Update: {
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          org_id?: string
          resolved_at?: string | null
          severity?: string
          sla_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_gates: {
        Row: {
          created_at: string
          id: string
          org_id: string
          required_activity_types: string[]
          required_fields: string[]
          stage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          required_activity_types?: string[]
          required_fields?: string[]
          stage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          required_activity_types?: string[]
          required_fields?: string[]
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_gates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_gates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          pipeline_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          pipeline_id: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          opportunity_id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          opportunity_id: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          is_team_manager: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_team_manager?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_team_manager?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_funnel_counts: {
        Row: {
          day: string | null
          entries: number | null
          org_id: string | null
          pipeline_id: string | null
          stage_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rep_performance_daily: {
        Row: {
          activities_count: number | null
          day: string | null
          org_id: string | null
          owner_user_id: string | null
          tasks_created: number | null
          tasks_overdue_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_time_in_stage: {
        Row: {
          duration_hours: number | null
          entered_at: string | null
          exited_at: string | null
          opportunity_id: string | null
          org_id: string | null
          stage_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_active_org_id: { Args: never; Returns: string }
      get_my_manager: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_org_role: { Args: { p_org_id: string }; Returns: string }
      get_team_user_ids: { Args: { p_org_id: string }; Returns: string[] }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      rpc_move_opportunity_stage: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_opportunity_id: string
          p_to_stage_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "rep"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "rep"],
    },
  },
} as const
