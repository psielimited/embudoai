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
      ai_agent_actions: {
        Row: {
          action_type: string
          created_at: string
          error: string | null
          executed_at: string | null
          id: string
          org_id: string
          payload: Json
          run_id: string
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          org_id: string
          payload?: Json
          run_id: string
          status?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          org_id?: string
          payload?: Json
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          input_summary: Json
          merchant_id: string
          model: string
          org_id: string
          output: Json
          status: string
          trigger_message_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: Json
          merchant_id: string
          model: string
          org_id: string
          output?: Json
          status: string
          trigger_message_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: Json
          merchant_id?: string
          model?: string
          org_id?: string
          output?: Json
          status?: string
          trigger_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
      channel_events: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          external_contact: string | null
          id: string
          merchant_id: string
          org_id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          severity: string
        }
        Insert: {
          channel: string
          created_at?: string
          event_type: string
          external_contact?: string | null
          id?: string
          merchant_id: string
          org_id: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          severity?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          external_contact?: string | null
          id?: string
          merchant_id?: string
          org_id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_channels: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          external_contact: string
          id: string
          lead_id: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          contact_id?: string | null
          created_at?: string
          external_contact: string
          id?: string
          lead_id?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          external_contact?: string
          id?: string
          lead_id?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_channels_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_channels_org_id_fkey"
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
      conversation_events: {
        Row: {
          actor_user_id: string | null
          conversation_id: string
          created_at: string
          details: Json
          event_type: string
          id: string
          org_id: string
        }
        Insert: {
          actor_user_id?: string | null
          conversation_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          org_id: string
        }
        Update: {
          actor_user_id?: string | null
          conversation_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_handoffs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          conversation_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          merchant_id: string
          org_id: string
          packet: Json
          reason_code: string
          reason_text: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          run_id: string | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          conversation_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          merchant_id: string
          org_id: string
          packet?: Json
          reason_code: string
          reason_text?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          run_id?: string | null
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          conversation_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          merchant_id?: string
          org_id?: string
          packet?: Json
          reason_code?: string
          reason_text?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          run_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_handoffs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_handoffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_handoffs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sla_policies: {
        Row: {
          created_at: string
          enabled: boolean
          first_response_minutes: number
          id: string
          merchant_id: string
          next_response_minutes: number
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          first_response_minutes?: number
          id?: string
          merchant_id: string
          next_response_minutes?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          first_response_minutes?: number
          id?: string
          merchant_id?: string
          next_response_minutes?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sla_policies_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sla_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_suggestions: {
        Row: {
          conversation_id: string
          created_at: string
          handoff_id: string | null
          id: string
          language: string | null
          merchant_id: string
          org_id: string
          source_run_id: string | null
          status: string
          suggestions: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          handoff_id?: string | null
          id?: string
          language?: string | null
          merchant_id: string
          org_id: string
          source_run_id?: string | null
          status?: string
          suggestions?: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          handoff_id?: string | null
          id?: string
          language?: string | null
          merchant_id?: string
          org_id?: string
          source_run_id?: string | null
          status?: string
          suggestions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "conversation_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_suggestions_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "conversation_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_suggestions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_suggestions_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          ai_last_error: string | null
          ai_last_generated_at: string | null
          ai_paused: boolean
          ai_status: string
          contact_id: string | null
          created_at: string
          external_contact: string
          handoff_active: boolean
          handoff_reason_code: string | null
          handoff_reason_text: string | null
          id: string
          intent: string | null
          language: string
          last_ai_outbound_at: string | null
          last_entities: Json
          last_human_outbound_at: string | null
          last_inbound_at: string | null
          last_intent: string | null
          last_outbound_at: string | null
          lead_id: string | null
          lead_score: number
          lead_score_reason: Json
          merchant_id: string
          opportunity_id: string | null
          org_id: string
          outcome: string | null
          owner_team_id: string | null
          owner_user_id: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_last_error?: string | null
          ai_last_generated_at?: string | null
          ai_paused?: boolean
          ai_status?: string
          contact_id?: string | null
          created_at?: string
          external_contact: string
          handoff_active?: boolean
          handoff_reason_code?: string | null
          handoff_reason_text?: string | null
          id?: string
          intent?: string | null
          language?: string
          last_ai_outbound_at?: string | null
          last_entities?: Json
          last_human_outbound_at?: string | null
          last_inbound_at?: string | null
          last_intent?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          lead_score?: number
          lead_score_reason?: Json
          merchant_id: string
          opportunity_id?: string | null
          org_id: string
          outcome?: string | null
          owner_team_id?: string | null
          owner_user_id?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_last_error?: string | null
          ai_last_generated_at?: string | null
          ai_paused?: boolean
          ai_status?: string
          contact_id?: string | null
          created_at?: string
          external_contact?: string
          handoff_active?: boolean
          handoff_reason_code?: string | null
          handoff_reason_text?: string | null
          id?: string
          intent?: string | null
          language?: string
          last_ai_outbound_at?: string | null
          last_entities?: Json
          last_human_outbound_at?: string | null
          last_inbound_at?: string | null
          last_intent?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          lead_score?: number
          lead_score_reason?: Json
          merchant_id?: string
          opportunity_id?: string | null
          org_id?: string
          outcome?: string | null
          owner_team_id?: string | null
          owner_user_id?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
      merchant_agent_settings: {
        Row: {
          created_at: string
          enabled: boolean
          handoff_rules: Json
          merchant_id: string
          objective: string
          org_id: string
          stage_mapping: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          handoff_rules?: Json
          merchant_id: string
          objective?: string
          org_id: string
          stage_mapping?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          handoff_rules?: Json
          merchant_id?: string
          objective?: string
          org_id?: string
          stage_mapping?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_agent_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_agent_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settings: {
        Row: {
          connectivity_inbound_last_checked_at: string | null
          connectivity_inbound_marker: string | null
          connectivity_inbound_ok: boolean
          connectivity_outbound_error: string | null
          connectivity_outbound_last_checked_at: string | null
          connectivity_outbound_ok: boolean
          created_at: string
          credentials_error: string | null
          credentials_last_checked_at: string | null
          credentials_valid: boolean
          embedded_signup_error: string | null
          embedded_signup_payload: Json
          embedded_signup_status: string | null
          id: string
          last_outbound_failure_at: string | null
          last_outbound_success_at: string | null
          last_webhook_received_at: string | null
          merchant_id: string
          meta_access_token_last4: string | null
          meta_phone_number_id: string | null
          meta_token_updated_at: string | null
          meta_waba_id: string | null
          onboarding_step: number
          org_id: string
          template_approval_state: string | null
          template_approved_count: number
          template_pending_count: number
          template_rejected_count: number
          token_expires_at: string | null
          token_last_checked_at: string | null
          token_valid: boolean
          updated_at: string
          validation_results: Json
          webhook_challenge_error: string | null
          webhook_challenge_last_checked_at: string | null
          webhook_challenge_valid: boolean
        }
        Insert: {
          connectivity_inbound_last_checked_at?: string | null
          connectivity_inbound_marker?: string | null
          connectivity_inbound_ok?: boolean
          connectivity_outbound_error?: string | null
          connectivity_outbound_last_checked_at?: string | null
          connectivity_outbound_ok?: boolean
          created_at?: string
          credentials_error?: string | null
          credentials_last_checked_at?: string | null
          credentials_valid?: boolean
          embedded_signup_error?: string | null
          embedded_signup_payload?: Json
          embedded_signup_status?: string | null
          id?: string
          last_outbound_failure_at?: string | null
          last_outbound_success_at?: string | null
          last_webhook_received_at?: string | null
          merchant_id: string
          meta_access_token_last4?: string | null
          meta_phone_number_id?: string | null
          meta_token_updated_at?: string | null
          meta_waba_id?: string | null
          onboarding_step?: number
          org_id: string
          template_approval_state?: string | null
          template_approved_count?: number
          template_pending_count?: number
          template_rejected_count?: number
          token_expires_at?: string | null
          token_last_checked_at?: string | null
          token_valid?: boolean
          updated_at?: string
          validation_results?: Json
          webhook_challenge_error?: string | null
          webhook_challenge_last_checked_at?: string | null
          webhook_challenge_valid?: boolean
        }
        Update: {
          connectivity_inbound_last_checked_at?: string | null
          connectivity_inbound_marker?: string | null
          connectivity_inbound_ok?: boolean
          connectivity_outbound_error?: string | null
          connectivity_outbound_last_checked_at?: string | null
          connectivity_outbound_ok?: boolean
          created_at?: string
          credentials_error?: string | null
          credentials_last_checked_at?: string | null
          credentials_valid?: boolean
          embedded_signup_error?: string | null
          embedded_signup_payload?: Json
          embedded_signup_status?: string | null
          id?: string
          last_outbound_failure_at?: string | null
          last_outbound_success_at?: string | null
          last_webhook_received_at?: string | null
          merchant_id?: string
          meta_access_token_last4?: string | null
          meta_phone_number_id?: string | null
          meta_token_updated_at?: string | null
          meta_waba_id?: string | null
          onboarding_step?: number
          org_id?: string
          template_approval_state?: string | null
          template_approved_count?: number
          template_pending_count?: number
          template_rejected_count?: number
          token_expires_at?: string | null
          token_last_checked_at?: string | null
          token_valid?: boolean
          updated_at?: string
          validation_results?: Json
          webhook_challenge_error?: string | null
          webhook_challenge_last_checked_at?: string | null
          webhook_challenge_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          status: string
          whatsapp_access_token: string | null
          whatsapp_app_secret: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          status?: string
          whatsapp_access_token?: string | null
          whatsapp_app_secret?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          status?: string
          whatsapp_access_token?: string | null
          whatsapp_app_secret?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          delivery_status: string
          direction: string
          failed_at: string | null
          id: string
          metadata: Json
          org_id: string
          provider: string | null
          provider_message_id: string | null
          read_at: string | null
          reply_to_message_id: string | null
          send_error: string | null
          send_status: string
          sender: string
          sent_at: string | null
        }
        Insert: {
          channel?: string
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          direction?: string
          failed_at?: string | null
          id?: string
          metadata?: Json
          org_id: string
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          reply_to_message_id?: string | null
          send_error?: string | null
          send_status?: string
          sender: string
          sent_at?: string | null
        }
        Update: {
          channel?: string
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          direction?: string
          failed_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          reply_to_message_id?: string | null
          send_error?: string | null
          send_status?: string
          sender?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_signup_nonces: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          merchant_id: string
          org_id: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          merchant_id: string
          org_id: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          merchant_id?: string
          org_id?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_signup_nonces_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_signup_nonces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
      org_message_usage_ledger: {
        Row: {
          created_at: string
          id: string
          message_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_message_usage_ledger_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_message_usage_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          created_at: string
          id: string
          org_id: string
          sla_first_response_minutes: number
          sla_next_response_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          sla_first_response_minutes?: number
          sla_next_response_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          sla_first_response_minutes?: number
          sla_next_response_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string
          id: string
          messages_used: number
          org_id: string
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          messages_used?: number
          org_id: string
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          messages_used?: number
          org_id?: string
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
      outbound_jobs: {
        Row: {
          attempts: number
          channel: string
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_retries: number
          merchant_id: string
          message_id: string
          next_retry_at: string | null
          org_id: string
          provider: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          conversation_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_retries?: number
          merchant_id: string
          message_id: string
          next_retry_at?: string | null
          org_id: string
          provider: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          conversation_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_retries?: number
          merchant_id?: string
          message_id?: string
          next_retry_at?: string | null
          org_id?: string
          provider?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_jobs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
      subscription_plans: {
        Row: {
          ai_enabled: boolean
          automation_enabled: boolean
          catalog_enabled: boolean
          created_at: string
          id: string
          message_limit: number
          monthly_price: number
          multi_user_enabled: boolean
          name: string
          sla_monitoring_enabled: boolean
          support_level: string
        }
        Insert: {
          ai_enabled?: boolean
          automation_enabled?: boolean
          catalog_enabled?: boolean
          created_at?: string
          id?: string
          message_limit?: number
          monthly_price?: number
          multi_user_enabled?: boolean
          name: string
          sla_monitoring_enabled?: boolean
          support_level?: string
        }
        Update: {
          ai_enabled?: boolean
          automation_enabled?: boolean
          catalog_enabled?: boolean
          created_at?: string
          id?: string
          message_limit?: number
          monthly_price?: number
          multi_user_enabled?: boolean
          name?: string
          sla_monitoring_enabled?: boolean
          support_level?: string
        }
        Relationships: []
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
      conversation_timeline_view: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          metadata: Json | null
          org_id: string | null
          severity: string | null
          source_type: string | null
        }
        Relationships: []
      }
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
      increment_org_messages_used: {
        Args: { p_message_id?: string; p_org_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      reset_subscription_message_usage: { Args: never; Returns: number }
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
