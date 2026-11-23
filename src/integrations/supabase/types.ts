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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_findings: {
        Row: {
          confidence: number
          created_at: string
          delivery_id: string | null
          evidence: Json
          finding_type: string
          id: string
          job_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_decision: string | null
          suggestion: Json
        }
        Insert: {
          confidence: number
          created_at?: string
          delivery_id?: string | null
          evidence: Json
          finding_type: string
          id?: string
          job_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_decision?: string | null
          suggestion: Json
        }
        Update: {
          confidence?: number
          created_at?: string
          delivery_id?: string | null
          evidence?: Json
          finding_type?: string
          id?: string
          job_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_decision?: string | null
          suggestion?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_findings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_findings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          consent_snapshot: Json
          created_at: string
          error_message: string | null
          id: string
          input_manifest: Json
          job_type: string
          match_id: string | null
          model_name: string
          model_provider: string
          model_version: string
          organisation_id: string
          requested_by: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          consent_snapshot: Json
          created_at?: string
          error_message?: string | null
          id?: string
          input_manifest: Json
          job_type: string
          match_id?: string | null
          model_name: string
          model_provider: string
          model_version: string
          organisation_id: string
          requested_by: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          consent_snapshot?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          input_manifest?: Json
          job_type?: string
          match_id?: string | null
          model_name?: string
          model_provider?: string
          model_version?: string
          organisation_id?: string
          requested_by?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_table: string
          id: number
          ip_hash: string | null
          organisation_id: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_table: string
          id?: never
          ip_hash?: string | null
          organisation_id?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_table?: string
          id?: never
          ip_hash?: string | null
          organisation_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          event_type: string
          id: string
          payload: Json
          processed_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      camera_clip_calibrations: {
        Row: {
          asset_id: string
          calibrated_at: string
          calibrated_by: string
          method: string
          offset_ms: number
          room_id: string
        }
        Insert: {
          asset_id: string
          calibrated_at?: string
          calibrated_by: string
          method?: string
          offset_ms?: number
          room_id: string
        }
        Update: {
          asset_id?: string
          calibrated_at?: string
          calibrated_by?: string
          method?: string
          offset_ms?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_clip_calibrations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_clip_calibrations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_cloud_auto_opt_ins: {
        Row: {
          adult_only_attested: boolean
          device_id: string
          enabled: boolean
          operator_id: string
          opted_in_at: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          adult_only_attested?: boolean
          device_id: string
          enabled?: boolean
          operator_id: string
          opted_in_at?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          adult_only_attested?: boolean
          device_id?: string
          enabled?: boolean
          operator_id?: string
          opted_in_at?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_cloud_auto_opt_ins_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_cloud_auto_opt_ins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_cloud_import_jobs: {
        Row: {
          approved_at: string
          approved_by: string
          asset_id: string
          claimed_at: string | null
          device_id: string
          failure_code: string | null
          guardian_permission_attested: boolean
          imported_at: string | null
          includes_junior: boolean
          organisation_id: string
          recording_id: string
          recording_permission_attested: boolean
          retention_expires_at: string
          room_id: string
          state: string
          updated_at: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          asset_id?: string
          claimed_at?: string | null
          device_id: string
          failure_code?: string | null
          guardian_permission_attested?: boolean
          imported_at?: string | null
          includes_junior?: boolean
          organisation_id: string
          recording_id: string
          recording_permission_attested: boolean
          retention_expires_at: string
          room_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          asset_id?: string
          claimed_at?: string | null
          device_id?: string
          failure_code?: string | null
          guardian_permission_attested?: boolean
          imported_at?: string | null
          includes_junior?: boolean
          organisation_id?: string
          recording_id?: string
          recording_permission_attested?: boolean
          retention_expires_at?: string
          room_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_cloud_import_jobs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_cloud_import_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_cloud_import_jobs_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: true
            referencedRelation: "camera_cloud_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_cloud_import_jobs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_cloud_recordings: {
        Row: {
          archive_check_attempts: number
          archive_check_status: string
          archive_checked_at: string | null
          archive_object_bytes: number | null
          archive_object_confirmed_at: string | null
          archive_object_etag: string | null
          created_at: string
          device_id: string
          ended_at: string | null
          id: string
          object_path: string
          provider: string
          provider_egress_id: string | null
          provider_room_name: string
          provider_status: number | null
          provider_updated_at: string | null
          requested_by: string
          room_id: string
          start_source: string
          state: string
          updated_at: string
        }
        Insert: {
          archive_check_attempts?: number
          archive_check_status?: string
          archive_checked_at?: string | null
          archive_object_bytes?: number | null
          archive_object_confirmed_at?: string | null
          archive_object_etag?: string | null
          created_at?: string
          device_id: string
          ended_at?: string | null
          id?: string
          object_path: string
          provider?: string
          provider_egress_id?: string | null
          provider_room_name: string
          provider_status?: number | null
          provider_updated_at?: string | null
          requested_by: string
          room_id: string
          start_source?: string
          state?: string
          updated_at?: string
        }
        Update: {
          archive_check_attempts?: number
          archive_check_status?: string
          archive_checked_at?: string | null
          archive_object_bytes?: number | null
          archive_object_confirmed_at?: string | null
          archive_object_etag?: string | null
          created_at?: string
          device_id?: string
          ended_at?: string | null
          id?: string
          object_path?: string
          provider?: string
          provider_egress_id?: string | null
          provider_room_name?: string
          provider_status?: number | null
          provider_updated_at?: string | null
          requested_by?: string
          room_id?: string
          start_source?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_cloud_recordings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_cloud_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_command_receipts: {
        Row: {
          command_id: string
          device_id: string
          outcome: string
          reason_code: string
          reported_at: string
          reported_by: string
          room_id: string
        }
        Insert: {
          command_id: string
          device_id: string
          outcome: string
          reason_code?: string
          reported_at?: string
          reported_by: string
          room_id: string
        }
        Update: {
          command_id?: string
          device_id?: string
          outcome?: string
          reason_code?: string
          reported_at?: string
          reported_by?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_command_receipts_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: true
            referencedRelation: "camera_recording_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_command_receipts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_command_receipts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_devices: {
        Row: {
          angle: string
          clock_offset_ms: number
          clock_round_trip_ms: number | null
          created_at: string
          device_key: string
          id: string
          label: string
          last_heartbeat_at: string
          room_id: string
          status: Json
          user_id: string
        }
        Insert: {
          angle: string
          clock_offset_ms?: number
          clock_round_trip_ms?: number | null
          created_at?: string
          device_key: string
          id?: string
          label: string
          last_heartbeat_at?: string
          room_id: string
          status?: Json
          user_id: string
        }
        Update: {
          angle?: string
          clock_offset_ms?: number
          clock_round_trip_ms?: number | null
          created_at?: string
          device_key?: string
          id?: string
          label?: string
          last_heartbeat_at?: string
          room_id?: string
          status?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_devices_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_highlight_candidates: {
        Row: {
          asset_id: string
          at_ms: number
          created_at: string
          created_by: string
          delivery_id: string | null
          duration_ms: number
          id: string
          kind: string
          note: string | null
          room_id: string
          source: string
        }
        Insert: {
          asset_id: string
          at_ms: number
          created_at?: string
          created_by: string
          delivery_id?: string | null
          duration_ms?: number
          id?: string
          kind: string
          note?: string | null
          room_id: string
          source?: string
        }
        Update: {
          asset_id?: string
          at_ms?: number
          created_at?: string
          created_by?: string
          delivery_id?: string | null
          duration_ms?: number
          id?: string
          kind?: string
          note?: string | null
          room_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_highlight_candidates_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_highlight_candidates_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_highlight_candidates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_pairing_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          room_id: string
          token_hash: string
          uses_remaining: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          room_id: string
          token_hash: string
          uses_remaining?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          room_id?: string
          token_hash?: string
          uses_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "camera_pairing_tokens_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_recording_arms: {
        Row: {
          armed: boolean
          consent_confirmed: boolean
          device_id: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          armed?: boolean
          consent_confirmed?: boolean
          device_id: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          armed?: boolean
          consent_confirmed?: boolean
          device_id?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_recording_arms_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_recording_arms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_recording_commands: {
        Row: {
          action: string
          created_at: string
          device_id: string
          id: string
          issued_by: string
          room_id: string
          source: string
        }
        Insert: {
          action: string
          created_at?: string
          device_id: string
          id?: string
          issued_by: string
          room_id: string
          source?: string
        }
        Update: {
          action?: string
          created_at?: string
          device_id?: string
          id?: string
          issued_by?: string
          room_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_recording_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_recording_commands_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_rooms: {
        Row: {
          closes_at: string | null
          id: string
          match_id: string
          max_devices: number
          name: string
          opened_at: string
          opened_by: string
          status: string
        }
        Insert: {
          closes_at?: string | null
          id?: string
          match_id: string
          max_devices?: number
          name?: string
          opened_at?: string
          opened_by: string
          status?: string
        }
        Update: {
          closes_at?: string | null
          id?: string
          match_id?: string
          max_devices?: number
          name?: string
          opened_at?: string
          opened_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_rooms_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_entries: {
        Row: {
          competition_id: string
          group_name: string | null
          seed: number | null
          status: string
          team_id: string
        }
        Insert: {
          competition_id: string
          group_name?: string | null
          seed?: number | null
          status?: string
          team_id: string
        }
        Update: {
          competition_id?: string
          group_name?: string | null
          seed?: number | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_entries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_rule_versions: {
        Row: {
          competition_id: string
          created_at: string
          created_by: string
          effective_from: string
          id: string
          rain_edition: string | null
          rain_method: string | null
          rain_parameters: Json
          rain_provider: string | null
          retired_at: string | null
          rules: Json
          version: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          created_by: string
          effective_from?: string
          id?: string
          rain_edition?: string | null
          rain_method?: string | null
          rain_parameters?: Json
          rain_provider?: string | null
          retired_at?: string | null
          rules: Json
          version: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          rain_edition?: string | null
          rain_method?: string | null
          rain_parameters?: Json
          rain_provider?: string | null
          retired_at?: string | null
          rules?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_rule_versions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          active_rule_version: number
          created_at: string
          format: string
          id: string
          name: string
          organisation_id: string
          season_id: string
          updated_at: string
        }
        Insert: {
          active_rule_version?: number
          created_at?: string
          format: string
          id?: string
          name: string
          organisation_id: string
          season_id: string
          updated_at?: string
        }
        Update: {
          active_rule_version?: number
          created_at?: string
          format?: string
          id?: string
          name?: string
          organisation_id?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      criclume_analysis_files: {
        Row: {
          analysis_consent: boolean
          created_at: string
          created_by: string
          id: string
          includes_junior: boolean
          kind: string
          label: string
          match_id: string
          organisation_id: string
          retention_expires_at: string
          storage_path: string
        }
        Insert: {
          analysis_consent?: boolean
          created_at?: string
          created_by: string
          id?: string
          includes_junior?: boolean
          kind: string
          label: string
          match_id: string
          organisation_id: string
          retention_expires_at?: string
          storage_path: string
        }
        Update: {
          analysis_consent?: boolean
          created_at?: string
          created_by?: string
          id?: string
          includes_junior?: boolean
          kind?: string
          label?: string
          match_id?: string
          organisation_id?: string
          retention_expires_at?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "criclume_analysis_files_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criclume_analysis_files_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      criclume_analysis_notes: {
        Row: {
          bowling_length: string | null
          bowling_line: string | null
          created_at: string
          created_by: string
          delivery_id: string | null
          discipline: string
          evidence_file_id: string | null
          evidence_time_seconds: number | null
          fielding_action: string | null
          id: string
          match_id: string
          note: string
          organisation_id: string
          shot_type: string | null
          tags: string
        }
        Insert: {
          bowling_length?: string | null
          bowling_line?: string | null
          created_at?: string
          created_by: string
          delivery_id?: string | null
          discipline: string
          evidence_file_id?: string | null
          evidence_time_seconds?: number | null
          fielding_action?: string | null
          id?: string
          match_id: string
          note: string
          organisation_id: string
          shot_type?: string | null
          tags?: string
        }
        Update: {
          bowling_length?: string | null
          bowling_line?: string | null
          created_at?: string
          created_by?: string
          delivery_id?: string | null
          discipline?: string
          evidence_file_id?: string | null
          evidence_time_seconds?: number | null
          fielding_action?: string | null
          id?: string
          match_id?: string
          note?: string
          organisation_id?: string
          shot_type?: string | null
          tags?: string
        }
        Relationships: [
          {
            foreignKeyName: "criclume_analysis_notes_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criclume_analysis_notes_evidence_file_id_fkey"
            columns: ["evidence_file_id"]
            isOneToOne: false
            referencedRelation: "criclume_analysis_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criclume_analysis_notes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criclume_analysis_notes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      criclume_omniqora_links: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          enabled: boolean
          omniqora_tenant_id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enabled?: boolean
          omniqora_tenant_id: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enabled?: boolean
          omniqora_tenant_id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criclume_omniqora_links_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      criclume_omniqora_runs: {
        Row: {
          admission_mode: string
          id: string
          match_id: string
          omniqora_currency: string | null
          omniqora_reservation_id: string | null
          omniqora_reserved_minor: number | null
          omniqora_run_id: string | null
          omniqora_tenant_id: string
          organisation_id: string
          reconciliation_note: string | null
          requested_at: string
          requested_by: string
          source_version: string
          status: string
          task: string
          updated_at: string
        }
        Insert: {
          admission_mode?: string
          id?: string
          match_id: string
          omniqora_currency?: string | null
          omniqora_reservation_id?: string | null
          omniqora_reserved_minor?: number | null
          omniqora_run_id?: string | null
          omniqora_tenant_id: string
          organisation_id: string
          reconciliation_note?: string | null
          requested_at?: string
          requested_by: string
          source_version: string
          status?: string
          task: string
          updated_at?: string
        }
        Update: {
          admission_mode?: string
          id?: string
          match_id?: string
          omniqora_currency?: string | null
          omniqora_reservation_id?: string | null
          omniqora_reserved_minor?: number | null
          omniqora_run_id?: string | null
          omniqora_tenant_id?: string
          organisation_id?: string
          reconciliation_note?: string | null
          requested_at?: string
          requested_by?: string
          source_version?: string
          status?: string
          task?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criclume_omniqora_runs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criclume_omniqora_runs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          ball_in_over: number
          batter_runs: number
          bowler_id: string
          delivery_style: string | null
          dismissal: Json | null
          end_name: string | null
          event_id: string | null
          extras: Json
          fielder_id: string | null
          fielding_zone: string | null
          id: string
          innings_id: string
          legal_ball: boolean
          match_id: string
          non_striker_id: string
          notes: string | null
          occurred_at: string
          outcome: string
          over_number: number
          recorded_at: string
          recorded_by: string
          sequence: number
          shot_zone: string | null
          striker_id: string
          superseded_by: string | null
          total_runs: number
          voided_by_event_id: string | null
          wicket: boolean
        }
        Insert: {
          ball_in_over: number
          batter_runs?: number
          bowler_id: string
          delivery_style?: string | null
          dismissal?: Json | null
          end_name?: string | null
          event_id?: string | null
          extras?: Json
          fielder_id?: string | null
          fielding_zone?: string | null
          id?: string
          innings_id: string
          legal_ball?: boolean
          match_id: string
          non_striker_id: string
          notes?: string | null
          occurred_at: string
          outcome: string
          over_number: number
          recorded_at?: string
          recorded_by: string
          sequence: number
          shot_zone?: string | null
          striker_id: string
          superseded_by?: string | null
          total_runs?: number
          voided_by_event_id?: string | null
          wicket?: boolean
        }
        Update: {
          ball_in_over?: number
          batter_runs?: number
          bowler_id?: string
          delivery_style?: string | null
          dismissal?: Json | null
          end_name?: string | null
          event_id?: string | null
          extras?: Json
          fielder_id?: string | null
          fielding_zone?: string | null
          id?: string
          innings_id?: string
          legal_ball?: boolean
          match_id?: string
          non_striker_id?: string
          notes?: string | null
          occurred_at?: string
          outcome?: string
          over_number?: number
          recorded_at?: string
          recorded_by?: string
          sequence?: number
          shot_zone?: string | null
          striker_id?: string
          superseded_by?: string | null
          total_runs?: number
          voided_by_event_id?: string | null
          wicket?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_fielder_id_fkey"
            columns: ["fielder_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_striker_id_fkey"
            columns: ["striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_voided_by_event_id_fkey"
            columns: ["voided_by_event_id"]
            isOneToOne: false
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_media_links: {
        Row: {
          asset_id: string
          confidence: number
          created_at: string
          delivery_id: string
          offset_end_ms: number
          offset_start_ms: number
        }
        Insert: {
          asset_id: string
          confidence?: number
          created_at?: string
          delivery_id: string
          offset_end_ms: number
          offset_start_ms: number
        }
        Update: {
          asset_id?: string
          confidence?: number
          created_at?: string
          delivery_id?: string
          offset_end_ms?: number
          offset_start_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_media_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_media_links_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_points: number | null
          away_team_id: string
          competition_id: string
          created_at: string
          ground_id: string | null
          home_points: number | null
          home_team_id: string
          id: string
          result: Json
          round_name: string | null
          rule_version_id: string
          signed_off_at: string | null
          signed_off_by: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
        }
        Insert: {
          away_points?: number | null
          away_team_id: string
          competition_id: string
          created_at?: string
          ground_id?: string | null
          home_points?: number | null
          home_team_id: string
          id?: string
          result?: Json
          round_name?: string | null
          rule_version_id: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Update: {
          away_points?: number | null
          away_team_id?: string
          competition_id?: string
          created_at?: string
          ground_id?: string | null
          home_points?: number | null
          home_team_id?: string
          id?: string
          result?: Json
          round_name?: string | null
          rule_version_id?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_ground_id_fkey"
            columns: ["ground_id"]
            isOneToOne: false
            referencedRelation: "grounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "competition_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      grounds: {
        Row: {
          address: Json
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          organisation_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          organisation_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          organisation_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grounds_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      innings: {
        Row: {
          batting_team_id: string
          bowling_team_id: string
          completed_at: string | null
          created_at: string
          id: string
          innings_number: number
          legal_balls: number
          match_id: string
          runs: number
          started_at: string | null
          status: string
          target: number | null
          updated_at: string
          wickets: number
        }
        Insert: {
          batting_team_id: string
          bowling_team_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          innings_number: number
          legal_balls?: number
          match_id: string
          runs?: number
          started_at?: string | null
          status?: string
          target?: number | null
          updated_at?: string
          wickets?: number
        }
        Update: {
          batting_team_id?: string
          bowling_team_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          innings_number?: number
          legal_balls?: number
          match_id?: string
          runs?: number
          started_at?: string | null
          status?: string
          target?: number | null
          updated_at?: string
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email_hash: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          organisation_id: string
          role: Database["public"]["Enums"]["platform_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email_hash: string
          expires_at: string
          id?: string
          invited_by: string
          invited_email: string
          organisation_id: string
          role: Database["public"]["Enums"]["platform_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email_hash?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["platform_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          match_id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          match_id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          match_id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_assignments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          client_event_id: string
          device_id: string
          event_type: string
          id: string
          match_id: string
          occurred_at: string
          payload: Json
          recorded_at: string
          recorded_by: string
          sequence: number
        }
        Insert: {
          client_event_id: string
          device_id: string
          event_type: string
          id?: string
          match_id: string
          occurred_at: string
          payload: Json
          recorded_at?: string
          recorded_by: string
          sequence: number
        }
        Update: {
          client_event_id?: string
          device_id?: string
          event_type?: string
          id?: string
          match_id?: string
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          recorded_by?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failures: number
          id: string
          kinds: string[]
          last_sent_at: string | null
          p256dh: string
          scoreboard_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failures?: number
          id?: string
          kinds?: string[]
          last_sent_at?: string | null
          p256dh: string
          scoreboard_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failures?: number
          id?: string
          kinds?: string[]
          last_sent_at?: string | null
          p256dh?: string
          scoreboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_push_subscriptions_scoreboard_id_fkey"
            columns: ["scoreboard_id"]
            isOneToOne: false
            referencedRelation: "public_scoreboards"
            referencedColumns: ["id"]
          },
        ]
      }
      match_squads: {
        Row: {
          batting_position: number | null
          captain: boolean
          match_id: string
          player_id: string
          team_id: string
          wicketkeeper: boolean
        }
        Insert: {
          batting_position?: number | null
          captain?: boolean
          match_id: string
          player_id: string
          team_id: string
          wicketkeeper?: boolean
        }
        Update: {
          batting_position?: number | null
          captain?: boolean
          match_id?: string
          player_id?: string
          team_id?: string
          wicketkeeper?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_squads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_team_id: string
          competition_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          fixture_id: string | null
          ground_id: string | null
          home_team_id: string
          id: string
          live_state: Json
          owner_organisation_id: string
          rule_version_id: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["match_visibility"]
          weather: Json
        }
        Insert: {
          away_team_id: string
          competition_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          fixture_id?: string | null
          ground_id?: string | null
          home_team_id: string
          id?: string
          live_state?: Json
          owner_organisation_id: string
          rule_version_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["match_visibility"]
          weather?: Json
        }
        Update: {
          away_team_id?: string
          competition_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          fixture_id?: string | null
          ground_id?: string | null
          home_team_id?: string
          id?: string
          live_state?: Json
          owner_organisation_id?: string
          rule_version_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["match_visibility"]
          weather?: Json
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_ground_id_fkey"
            columns: ["ground_id"]
            isOneToOne: false
            referencedRelation: "grounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_owner_organisation_id_fkey"
            columns: ["owner_organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "competition_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          organisation_id: string | null
          payload: Json
          read_at: string | null
          scheduled_for: string
          template: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          organisation_id?: string | null
          payload?: Json
          read_at?: string | null
          scheduled_for?: string
          template: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          organisation_id?: string | null
          payload?: Json
          read_at?: string | null
          scheduled_for?: string
          template?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          joined_at: string
          organisation_id: string
          role: Database["public"]["Enums"]["platform_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          joined_at?: string
          organisation_id: string
          role: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          joined_at?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string
          creation_request_id: string | null
          default_retention_days: number
          id: string
          kind: Database["public"]["Enums"]["organisation_kind"]
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          creation_request_id?: string | null
          default_retention_days?: number
          id?: string
          kind: Database["public"]["Enums"]["organisation_kind"]
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          creation_request_id?: string | null
          default_retention_days?: number
          id?: string
          kind?: Database["public"]["Enums"]["organisation_kind"]
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_consents: {
        Row: {
          biometric_analysis: Database["public"]["Enums"]["consent_state"]
          coaching_analysis: Database["public"]["Enums"]["consent_state"]
          consented_by: string | null
          created_at: string
          evidence_path: string | null
          id: string
          notes: string | null
          organisation_id: string
          player_id: string
          public_highlights: Database["public"]["Enums"]["consent_state"]
          recording: Database["public"]["Enums"]["consent_state"]
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          biometric_analysis?: Database["public"]["Enums"]["consent_state"]
          coaching_analysis?: Database["public"]["Enums"]["consent_state"]
          consented_by?: string | null
          created_at?: string
          evidence_path?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          player_id: string
          public_highlights?: Database["public"]["Enums"]["consent_state"]
          recording?: Database["public"]["Enums"]["consent_state"]
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          biometric_analysis?: Database["public"]["Enums"]["consent_state"]
          coaching_analysis?: Database["public"]["Enums"]["consent_state"]
          consented_by?: string | null
          created_at?: string
          evidence_path?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          player_id?: string
          public_highlights?: Database["public"]["Enums"]["consent_state"]
          recording?: Database["public"]["Enums"]["consent_state"]
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_consents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_consents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_private_profiles: {
        Row: {
          date_of_birth: string | null
          emergency_contact: Json
          guardian_email: string | null
          guardian_name: string | null
          medical_notes: string | null
          player_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          date_of_birth?: string | null
          emergency_contact?: Json
          guardian_email?: string | null
          guardian_name?: string | null
          medical_notes?: string | null
          player_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          date_of_birth?: string | null
          emergency_contact?: Json
          guardian_email?: string | null
          guardian_name?: string | null
          medical_notes?: string | null
          player_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_private_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string
          external_reference: string | null
          id: string
          is_junior: boolean
          linked_user_id: string | null
          organisation_id: string
          public_profile: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          external_reference?: string | null
          id?: string
          is_junior?: boolean
          linked_user_id?: string | null
          organisation_id: string
          public_profile?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          external_reference?: string | null
          id?: string
          is_junior?: boolean
          linked_user_id?: string | null
          organisation_id?: string
          public_profile?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_scoreboards: {
        Row: {
          created_at: string
          delay_seconds: number
          enabled: boolean
          id: string
          match_id: string
          slug: string
          sponsor: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          id?: string
          match_id: string
          slug: string
          sponsor?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          id?: string
          match_id?: string
          slug?: string
          sponsor?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_scoreboards_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      rain_calculations: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          edition: string
          id: string
          inputs: Json
          match_id: string
          method: string
          provider: string
          provider_calculation_id: string | null
          response_hash: string
          result: Json
          rule_version_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          edition: string
          id?: string
          inputs: Json
          match_id: string
          method: string
          provider: string
          provider_calculation_id?: string | null
          response_hash: string
          result: Json
          rule_version_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          edition?: string
          id?: string
          inputs?: Json
          match_id?: string
          method?: string
          provider?: string
          provider_calculation_id?: string | null
          response_hash?: string
          result?: Json
          rule_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rain_calculations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rain_calculations_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "competition_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          name: string
          organisation_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          name: string
          organisation_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          organisation_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: number
          organisation_id: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: never
          organisation_id?: string | null
          severity: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: never
          organisation_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          entitlements: Json
          id: string
          organisation_id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          entitlements?: Json
          id?: string
          organisation_id: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          entitlements?: Json
          id?: string
          organisation_id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          player_id: string
          shirt_number: string | null
          team_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          player_id: string
          shirt_number?: string | null
          team_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          player_id?: string
          shirt_number?: string | null
          team_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          age_group: string | null
          created_at: string
          external_reference: string | null
          id: string
          name: string
          organisation_id: string
          short_name: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          name: string
          organisation_id: string
          short_name: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          name?: string
          organisation_id?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_annotations: {
        Row: {
          asset_id: string
          at_ms: number
          author_id: string
          created_at: string
          delivery_id: string | null
          drawing: Json
          duration_ms: number
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          at_ms: number
          author_id: string
          created_at?: string
          delivery_id?: string | null
          drawing: Json
          duration_ms?: number
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          at_ms?: number
          author_id?: string
          created_at?: string
          delivery_id?: string | null
          drawing?: Json
          duration_ms?: number
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_annotations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_annotations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      video_assets: {
        Row: {
          blur_mode: string
          content_type: string
          created_at: string
          created_by: string
          device_id: string
          ended_at: string | null
          id: string
          includes_junior: boolean
          legal_hold: boolean
          organisation_id: string
          publication_consent: Database["public"]["Enums"]["consent_state"]
          recording_consent: Database["public"]["Enums"]["consent_state"]
          retention_expires_at: string
          room_id: string
          size_bytes: number | null
          source_sha256: string | null
          started_at: string
          status: Database["public"]["Enums"]["media_status"]
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          blur_mode?: string
          content_type?: string
          created_at?: string
          created_by: string
          device_id: string
          ended_at?: string | null
          id?: string
          includes_junior?: boolean
          legal_hold?: boolean
          organisation_id: string
          publication_consent?: Database["public"]["Enums"]["consent_state"]
          recording_consent?: Database["public"]["Enums"]["consent_state"]
          retention_expires_at: string
          room_id: string
          size_bytes?: number | null
          source_sha256?: string | null
          started_at: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          blur_mode?: string
          content_type?: string
          created_at?: string
          created_by?: string
          device_id?: string
          ended_at?: string | null
          id?: string
          includes_junior?: boolean
          legal_hold?: boolean
          organisation_id?: string
          publication_consent?: Database["public"]["Enums"]["consent_state"]
          recording_consent?: Database["public"]["Enums"]["consent_state"]
          retention_expires_at?: string
          room_id?: string
          size_bytes?: number | null
          source_sha256?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "camera_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_assets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "camera_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      video_processing_jobs: {
        Row: {
          asset_id: string
          completed_at: string | null
          created_at: string
          id: string
          kinds: string[]
          output_prefix: string
          status: string
        }
        Insert: {
          asset_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          kinds: string[]
          output_prefix: string
          status?: string
        }
        Update: {
          asset_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          kinds?: string[]
          output_prefix?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_processing_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      video_variants: {
        Row: {
          asset_id: string
          codec: string | null
          created_at: string
          duration_ms: number | null
          frame_rate: number | null
          height: number | null
          id: string
          kind: string
          status: Database["public"]["Enums"]["media_status"]
          storage_path: string
          width: number | null
        }
        Insert: {
          asset_id: string
          codec?: string | null
          created_at?: string
          duration_ms?: number | null
          frame_rate?: number | null
          height?: number | null
          id?: string
          kind: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path: string
          width?: number | null
        }
        Update: {
          asset_id?: string
          codec?: string | null
          created_at?: string
          duration_ms?: number | null
          frame_rate?: number | null
          height?: number | null
          id?: string
          kind?: string
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      player_career_stats: {
        Row: {
          balls_bowled: number | null
          balls_faced: number | null
          catches: number | null
          fours: number | null
          player_id: string | null
          run_outs: number | null
          runs: number | null
          runs_conceded: number | null
          sixes: number | null
          stumpings: number | null
          wickets: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_match_event: {
        Args: {
          p_client_event_id: string
          p_device_id: string
          p_event_type: string
          p_match_id: string
          p_occurred_at: string
          p_payload: Json
        }
        Returns: {
          client_event_id: string
          device_id: string
          event_type: string
          id: string
          match_id: string
          occurred_at: string
          payload: Json
          recorded_at: string
          recorded_by: string
          sequence: number
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_access_camera_signal_topic: {
        Args: { p_topic: string }
        Returns: boolean
      }
      can_direct_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_operate_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_read_camera_storage_path: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_review_camera_asset: {
        Args: { p_asset_id: string }
        Returns: boolean
      }
      can_score_match: { Args: { p_match_id: string }; Returns: boolean }
      can_upload_camera_source: { Args: { p_name: string }; Returns: boolean }
      can_upload_video: {
        Args: {
          p_asset_id: string
          p_organisation_id: string
          p_room_id: string
        }
        Returns: boolean
      }
      can_view_match: { Args: { p_match_id: string }; Returns: boolean }
      claim_criclume_omniqora_run: {
        Args: {
          _match_id: string
          _organisation_id: string
          _requested_by: string
          _source_version: string
          _task: string
          _tenant_id: string
        }
        Returns: Json
      }
      claim_video_processing: {
        Args: { p_asset: string; p_user: string }
        Returns: Json
      }
      complete_camera_asset_upload: {
        Args: { p_asset_id: string; p_storage_path: string }
        Returns: string
      }
      complete_video_processing: {
        Args: { p_job: string; p_status: string }
        Returns: Json
      }
      create_camera_room: {
        Args: { p_match_id: string; p_name?: string }
        Returns: Json
      }
      create_competition_workspace: {
        Args: {
          p_ends_on: string
          p_format: string
          p_name: string
          p_organisation_id: string
          p_rules: Json
          p_season_name: string
          p_starts_on: string
        }
        Returns: Json
      }
      create_match_workspace: {
        Args: {
          p_away_team_id: string
          p_balls_per_over: number
          p_batting_first_team_id: string
          p_competition_id: string
          p_ground_id: string
          p_home_team_id: string
          p_innings_per_side: number
          p_organisation_id: string
          p_overs_per_innings: number
          p_public_slug?: string
          p_scheduled_at: string
          p_visibility: Database["public"]["Enums"]["match_visibility"]
          p_weather: Json
        }
        Returns: Json
      }
      create_organisation_once: {
        Args: {
          p_kind: Database["public"]["Enums"]["organisation_kind"]
          p_name: string
          p_request_id: string
        }
        Returns: string
      }
      get_public_scoreboard: { Args: { p_slug: string }; Returns: Json }
      has_org_role: {
        Args: {
          p_organisation_id: string
          p_roles: Database["public"]["Enums"]["platform_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { p_organisation_id: string }; Returns: boolean }
      pair_camera_device: {
        Args: {
          p_angle: string
          p_device_key: string
          p_label: string
          p_token: string
        }
        Returns: {
          angle: string
          clock_offset_ms: number
          clock_round_trip_ms: number | null
          created_at: string
          device_key: string
          id: string
          label: string
          last_heartbeat_at: string
          room_id: string
          status: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "camera_devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_delivery_v1: {
        Args: {
          p_client_event_id: string
          p_delivery: Json
          p_device_id: string
          p_innings_id: string
          p_live_state: Json
          p_match_id: string
          p_occurred_at: string
        }
        Returns: {
          ball_in_over: number
          batter_runs: number
          bowler_id: string
          delivery_style: string | null
          dismissal: Json | null
          end_name: string | null
          event_id: string | null
          extras: Json
          fielder_id: string | null
          fielding_zone: string | null
          id: string
          innings_id: string
          legal_ball: boolean
          match_id: string
          non_striker_id: string
          notes: string | null
          occurred_at: string
          outcome: string
          over_number: number
          recorded_at: string
          recorded_by: string
          sequence: number
          shot_zone: string | null
          striker_id: string
          superseded_by: string | null
          total_runs: number
          voided_by_event_id: string | null
          wicket: boolean
        }
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_delivery_v2: {
        Args: {
          p_client_event_id: string
          p_delivery: Json
          p_device_id: string
          p_innings_id: string
          p_live_state: Json
          p_match_id: string
          p_match_snapshot: Json
          p_occurred_at: string
        }
        Returns: {
          client_event_id: string
          device_id: string
          event_type: string
          id: string
          match_id: string
          occurred_at: string
          payload: Json
          recorded_at: string
          recorded_by: string
          sequence: number
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_player_consent_decision: {
        Args: {
          p_biometric_analysis: Database["public"]["Enums"]["consent_state"]
          p_coaching_analysis: Database["public"]["Enums"]["consent_state"]
          p_notes?: string
          p_organisation_id: string
          p_player_id: string
          p_public_highlights: Database["public"]["Enums"]["consent_state"]
          p_recording: Database["public"]["Enums"]["consent_state"]
        }
        Returns: string
      }
      start_match_innings: {
        Args: {
          p_batting_team_id: string
          p_bowling_team_id: string
          p_innings_number: number
          p_match_id: string
        }
        Returns: string
      }
      void_last_delivery_v1: {
        Args: {
          p_client_event_id: string
          p_device_id: string
          p_innings_id: string
          p_live_state: Json
          p_match_id: string
          p_match_snapshot: Json
          p_occurred_at: string
        }
        Returns: {
          client_event_id: string
          device_id: string
          event_type: string
          id: string
          match_id: string
          occurred_at: string
          payload: Json
          recorded_at: string
          recorded_by: string
          sequence: number
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      consent_state: "pending" | "granted" | "denied" | "withdrawn"
      fixture_status:
        | "draft"
        | "scheduled"
        | "postponed"
        | "live"
        | "completed"
        | "abandoned"
        | "cancelled"
      job_status:
        | "queued"
        | "running"
        | "review_required"
        | "completed"
        | "failed"
        | "cancelled"
      match_status:
        | "draft"
        | "scheduled"
        | "live"
        | "innings_break"
        | "completed"
        | "abandoned"
        | "cancelled"
      match_visibility: "private" | "clubs" | "league" | "public"
      media_status:
        | "planned"
        | "uploading"
        | "uploaded"
        | "processing"
        | "ready"
        | "failed"
        | "quarantined"
        | "deleted"
      membership_status: "invited" | "active" | "suspended" | "left"
      organisation_kind: "club" | "league" | "school" | "academy"
      platform_role:
        | "owner"
        | "league_admin"
        | "club_admin"
        | "safeguarding_officer"
        | "scorer"
        | "coach"
        | "player"
        | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      consent_state: ["pending", "granted", "denied", "withdrawn"],
      fixture_status: [
        "draft",
        "scheduled",
        "postponed",
        "live",
        "completed",
        "abandoned",
        "cancelled",
      ],
      job_status: [
        "queued",
        "running",
        "review_required",
        "completed",
        "failed",
        "cancelled",
      ],
      match_status: [
        "draft",
        "scheduled",
        "live",
        "innings_break",
        "completed",
        "abandoned",
        "cancelled",
      ],
      match_visibility: ["private", "clubs", "league", "public"],
      media_status: [
        "planned",
        "uploading",
        "uploaded",
        "processing",
        "ready",
        "failed",
        "quarantined",
        "deleted",
      ],
      membership_status: ["invited", "active", "suspended", "left"],
      organisation_kind: ["club", "league", "school", "academy"],
      platform_role: [
        "owner",
        "league_admin",
        "club_admin",
        "safeguarding_officer",
        "scorer",
        "coach",
        "player",
        "viewer",
      ],
    },
  },
} as const
