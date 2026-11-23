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
          removed_at: string | null
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
          removed_at?: string | null
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
          removed_at?: string | null
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
      club_events: {
        Row: {
          availability_open: boolean
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          kind: string
          location: string | null
          match_id: string | null
          notes: string | null
          organisation_id: string
          selection_published_at: string | null
          starts_at: string
          team_id: string | null
          title: string
          travel_meet_at: string | null
          travel_meet_point: string | null
          travel_notes: string | null
          updated_at: string
        }
        Insert: {
          availability_open?: boolean
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          match_id?: string | null
          notes?: string | null
          organisation_id: string
          selection_published_at?: string | null
          starts_at: string
          team_id?: string | null
          title: string
          travel_meet_at?: string | null
          travel_meet_point?: string | null
          travel_notes?: string | null
          updated_at?: string
        }
        Update: {
          availability_open?: boolean
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          match_id?: string | null
          notes?: string | null
          organisation_id?: string
          selection_published_at?: string | null
          starts_at?: string
          team_id?: string | null
          title?: string
          travel_meet_at?: string | null
          travel_meet_point?: string | null
          travel_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      club_items: {
        Row: {
          active: boolean
          created_at: string
          currency: string | null
          description: string | null
          id: string
          kind: string
          loanable: boolean
          name: string
          organisation_id: string
          price_minor: number | null
          sizes: string[]
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          kind: string
          loanable?: boolean
          name: string
          organisation_id: string
          price_minor?: number | null
          sizes?: string[]
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          kind?: string
          loanable?: boolean
          name?: string
          organisation_id?: string
          price_minor?: number | null
          sizes?: string[]
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payment_accounts: {
        Row: {
          account_number: string
          account_title: string
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          method: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          account_number: string
          account_title: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          method: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_title?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          method?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_payment_accounts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_site_domains: {
        Row: {
          created_at: string
          dns_a_target: string | null
          dns_txt_value: string | null
          hostname: string
          id: string
          kind: string
          live_at: string | null
          organisation_id: string
          requested_by: string | null
          staff_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dns_a_target?: string | null
          dns_txt_value?: string | null
          hostname: string
          id?: string
          kind?: string
          live_at?: string | null
          organisation_id: string
          requested_by?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dns_a_target?: string | null
          dns_txt_value?: string | null
          hostname?: string
          id?: string
          kind?: string
          live_at?: string | null
          organisation_id?: string
          requested_by?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_site_domains_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_site_photos: {
        Row: {
          caption: string
          consent_confirmed: boolean
          created_at: string
          created_by: string | null
          id: string
          organisation_id: string
          path: string
        }
        Insert: {
          caption?: string
          consent_confirmed: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id: string
          path: string
        }
        Update: {
          caption?: string
          consent_confirmed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_site_photos_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_site_posts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          kind: string
          link_url: string | null
          organisation_id: string
          pinned: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          organisation_id: string
          pinned?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          organisation_id?: string
          pinned?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_site_posts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_sites: {
        Row: {
          about: string
          accent: string
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          hero_path: string | null
          logo_path: string | null
          map_url: string | null
          organisation_id: string
          published: boolean
          socials: Json
          sponsors: Json
          tagline: string
          updated_at: string
          updated_by: string | null
          web_slug: string | null
        }
        Insert: {
          about?: string
          accent?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          hero_path?: string | null
          logo_path?: string | null
          map_url?: string | null
          organisation_id: string
          published?: boolean
          socials?: Json
          sponsors?: Json
          tagline?: string
          updated_at?: string
          updated_by?: string | null
          web_slug?: string | null
        }
        Update: {
          about?: string
          accent?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          hero_path?: string | null
          logo_path?: string | null
          map_url?: string | null
          organisation_id?: string
          published?: boolean
          socials?: Json
          sponsors?: Json
          tagline?: string
          updated_at?: string
          updated_by?: string | null
          web_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_sites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_awards: {
        Row: {
          category: string
          competition_id: string
          created_at: string
          id: string
          organisation_id: string
          prize: string | null
          updated_at: string
          updated_by: string | null
          winner_name: string | null
          winner_player_id: string | null
        }
        Insert: {
          category: string
          competition_id: string
          created_at?: string
          id?: string
          organisation_id: string
          prize?: string | null
          updated_at?: string
          updated_by?: string | null
          winner_name?: string | null
          winner_player_id?: string | null
        }
        Update: {
          category?: string
          competition_id?: string
          created_at?: string
          id?: string
          organisation_id?: string
          prize?: string | null
          updated_at?: string
          updated_by?: string | null
          winner_name?: string | null
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_awards_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_awards_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
      equipment_loans: {
        Row: {
          condition_note: string | null
          created_at: string
          due_back_on: string | null
          id: string
          issued_at: string
          issued_by: string | null
          item_id: string
          organisation_id: string
          player_id: string
          quantity: number
          returned_at: string | null
        }
        Insert: {
          condition_note?: string | null
          created_at?: string
          due_back_on?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          item_id: string
          organisation_id: string
          player_id: string
          quantity?: number
          returned_at?: string | null
        }
        Update: {
          condition_note?: string | null
          created_at?: string
          due_back_on?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          item_id?: string
          organisation_id?: string
          player_id?: string
          quantity?: number
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_loans_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "club_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_loans_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_loans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      event_availability: {
        Row: {
          event_id: string
          id: string
          note: string | null
          organisation_id: string
          player_id: string
          responded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          event_id: string
          id?: string
          note?: string | null
          organisation_id: string
          player_id: string
          responded_by?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          note?: string | null
          organisation_id?: string
          player_id?: string
          responded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_availability_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      event_selections: {
        Row: {
          batting_order: number | null
          captain: boolean
          created_at: string
          event_id: string
          id: string
          organisation_id: string
          player_id: string
          selected_by: string | null
          slot: string
          wicketkeeper: boolean
        }
        Insert: {
          batting_order?: number | null
          captain?: boolean
          created_at?: string
          event_id: string
          id?: string
          organisation_id: string
          player_id: string
          selected_by?: string | null
          slot?: string
          wicketkeeper?: boolean
        }
        Update: {
          batting_order?: number | null
          captain?: boolean
          created_at?: string
          event_id?: string
          id?: string
          organisation_id?: string
          player_id?: string
          selected_by?: string | null
          slot?: string
          wicketkeeper?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_selections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_selections_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_charges: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          currency: string
          description: string
          due_on: string | null
          id: string
          organisation_id: string
          paid_minor: number
          player_id: string
          schedule_id: string | null
          status: string
          updated_at: string
          waived_reason: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          due_on?: string | null
          id?: string
          organisation_id: string
          paid_minor?: number
          player_id: string
          schedule_id?: string | null
          status?: string
          updated_at?: string
          waived_reason?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          due_on?: string | null
          id?: string
          organisation_id?: string
          paid_minor?: number
          player_id?: string
          schedule_id?: string | null
          status?: string
          updated_at?: string
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_charges_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payment_claims: {
        Row: {
          amount_minor: number
          charge_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          method: string
          note: string | null
          organisation_id: string
          paid_on: string
          payment_id: string | null
          reference: string
          status: string
          submitted_by: string
        }
        Insert: {
          amount_minor: number
          charge_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          method: string
          note?: string | null
          organisation_id: string
          paid_on?: string
          payment_id?: string | null
          reference: string
          status?: string
          submitted_by?: string
        }
        Update: {
          amount_minor?: number
          charge_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          method?: string
          note?: string | null
          organisation_id?: string
          paid_on?: string
          payment_id?: string | null
          reference?: string
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payment_claims_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "fee_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_claims_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_claims_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "fee_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount_minor: number
          charge_id: string
          created_at: string
          id: string
          method: string
          organisation_id: string
          paid_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount_minor: number
          charge_id: string
          created_at?: string
          id?: string
          method: string
          organisation_id: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount_minor?: number
          charge_id?: string
          created_at?: string
          id?: string
          method?: string
          organisation_id?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "fee_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          active: boolean
          amount_minor: number
          created_at: string
          created_by: string | null
          currency: string
          due_on: string | null
          frequency: string
          id: string
          name: string
          organisation_id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_minor: number
          created_at?: string
          created_by?: string | null
          currency: string
          due_on?: string | null
          frequency?: string
          id?: string
          name: string
          organisation_id: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          due_on?: string | null
          frequency?: string
          id?: string
          name?: string
          organisation_id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_result_reports: {
        Row: {
          fixture_id: string
          id: string
          note: string
          result: Json
          submitted_at: string
          submitted_by: string | null
          team_id: string
        }
        Insert: {
          fixture_id: string
          id?: string
          note?: string
          result: Json
          submitted_at?: string
          submitted_by?: string | null
          team_id: string
        }
        Update: {
          fixture_id?: string
          id?: string
          note?: string
          result?: Json
          submitted_at?: string
          submitted_by?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_result_reports_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_result_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      ground_bookings: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          ends_at: string
          ground_id: string
          id: string
          note: string | null
          organisation_id: string
          purpose: string
          requested_by: string | null
          requester_organisation_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at: string
          ground_id: string
          id?: string
          note?: string | null
          organisation_id: string
          purpose?: string
          requested_by?: string | null
          requester_organisation_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at?: string
          ground_id?: string
          id?: string
          note?: string | null
          organisation_id?: string
          purpose?: string
          requested_by?: string | null
          requester_organisation_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ground_bookings_ground_id_fkey"
            columns: ["ground_id"]
            isOneToOne: false
            referencedRelation: "grounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ground_bookings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ground_bookings_requester_organisation_id_fkey"
            columns: ["requester_organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ground_screens: {
        Row: {
          interval_seconds: number
          manual_page: string
          match_id: string
          mode: string
          pages: string[]
          replay_delivery_id: string | null
          replay_requested_at: string | null
          replays: string
          scoreboard_id: string
          show_names: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          interval_seconds?: number
          manual_page?: string
          match_id: string
          mode?: string
          pages?: string[]
          replay_delivery_id?: string | null
          replay_requested_at?: string | null
          replays?: string
          scoreboard_id: string
          show_names?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          interval_seconds?: number
          manual_page?: string
          match_id?: string
          mode?: string
          pages?: string[]
          replay_delivery_id?: string | null
          replay_requested_at?: string | null
          replays?: string
          scoreboard_id?: string
          show_names?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ground_screens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ground_screens_scoreboard_id_fkey"
            columns: ["scoreboard_id"]
            isOneToOne: true
            referencedRelation: "public_scoreboards"
            referencedColumns: ["id"]
          },
        ]
      }
      grounds: {
        Row: {
          address: Json
          bookable: boolean
          booking_note: string | null
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
          bookable?: boolean
          booking_note?: string | null
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
          bookable?: boolean
          booking_note?: string | null
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
      item_orders: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          ordered_by: string
          organisation_id: string
          player_id: string | null
          quantity: number
          size: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          ordered_by?: string
          organisation_id: string
          player_id?: string | null
          quantity?: number
          size?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          ordered_by?: string
          organisation_id?: string
          player_id?: string | null
          quantity?: number
          size?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "club_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_orders_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      match_check_flags: {
        Row: {
          ball_label: string | null
          delivery_id: string | null
          id: string
          innings_number: number | null
          match_id: string
          note: string
          raised_at: string
          raised_by: string
          reply: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          ball_label?: string | null
          delivery_id?: string | null
          id?: string
          innings_number?: number | null
          match_id: string
          note: string
          raised_at?: string
          raised_by: string
          reply?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          ball_label?: string | null
          delivery_id?: string | null
          id?: string
          innings_number?: number | null
          match_id?: string
          note?: string
          raised_at?: string
          raised_by?: string
          reply?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_check_flags_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_flags_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_check_scorers: {
        Row: {
          added_by: string
          confirm_note: string | null
          confirmed_at: string | null
          created_at: string
          match_id: string
          organisation_id: string
          user_id: string
        }
        Insert: {
          added_by: string
          confirm_note?: string | null
          confirmed_at?: string | null
          created_at?: string
          match_id: string
          organisation_id: string
          user_id: string
        }
        Update: {
          added_by?: string
          confirm_note?: string | null
          confirmed_at?: string | null
          created_at?: string
          match_id?: string
          organisation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_check_scorers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_scorers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
      match_scoring_duties: {
        Row: {
          assigned_by: string | null
          created_at: string
          duty: string
          match_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          duty: string
          match_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          duty?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_scoring_duties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
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
          country_code: string | null
          created_at: string
          created_by: string
          creation_request_id: string | null
          default_retention_days: number
          id: string
          kind: Database["public"]["Enums"]["organisation_kind"]
          name: string
          region: string | null
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          created_by: string
          creation_request_id?: string | null
          default_retention_days?: number
          id?: string
          kind: Database["public"]["Enums"]["organisation_kind"]
          name: string
          region?: string | null
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          created_by?: string
          creation_request_id?: string | null
          default_retention_days?: number
          id?: string
          kind?: Database["public"]["Enums"]["organisation_kind"]
          name?: string
          region?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
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
      player_guardians: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          organisation_id: string
          player_id: string
          relationship: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          organisation_id: string
          player_id: string
          relationship?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          organisation_id?: string
          player_id?: string
          relationship?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_guardians_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_player_id_fkey"
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
      promo_campaigns: {
        Row: {
          advertiser: string
          cities: string[]
          click_url: string | null
          countries: string[]
          created_at: string
          created_by: string | null
          currency: string
          ends_on: string | null
          id: string
          name: string
          price_amount: number
          regions: string[]
          starts_on: string
          status: string
          surfaces: string[]
          updated_at: string
          weight: number
        }
        Insert: {
          advertiser: string
          cities?: string[]
          click_url?: string | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on?: string | null
          id?: string
          name: string
          price_amount?: number
          regions?: string[]
          starts_on?: string
          status?: string
          surfaces?: string[]
          updated_at?: string
          weight?: number
        }
        Update: {
          advertiser?: string
          cities?: string[]
          click_url?: string | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on?: string | null
          id?: string
          name?: string
          price_amount?: number
          regions?: string[]
          starts_on?: string
          status?: string
          surfaces?: string[]
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      promo_creatives: {
        Row: {
          active: boolean
          alt_text: string
          campaign_id: string
          created_at: string
          duration_seconds: number
          id: string
          media_kind: string
          media_path: string
          slot: string
        }
        Insert: {
          active?: boolean
          alt_text?: string
          campaign_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          media_kind: string
          media_path: string
          slot: string
        }
        Update: {
          active?: boolean
          alt_text?: string
          campaign_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          media_kind?: string
          media_path?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_play_counts: {
        Row: {
          campaign_id: string
          day: string
          organisation_id: string | null
          plays: number
          share_percent: number
          slot: string
          surface: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          day: string
          organisation_id?: string | null
          plays?: number
          share_percent?: number
          slot: string
          surface: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          day?: string
          organisation_id?: string | null
          plays?: number
          share_percent?: number
          slot?: string
          surface?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_play_counts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_play_counts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_play_guard: {
        Row: {
          bucket: string
          creative_id: string
          viewer_hash: string
        }
        Insert: {
          bucket: string
          creative_id: string
          viewer_hash: string
        }
        Update: {
          bucket?: string
          creative_id?: string
          viewer_hash?: string
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
      ride_bookings: {
        Row: {
          booked_by: string | null
          created_at: string
          guardian_consent: boolean
          id: string
          organisation_id: string
          player_id: string
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          booked_by?: string | null
          created_at?: string
          guardian_consent?: boolean
          id?: string
          organisation_id: string
          player_id: string
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          booked_by?: string | null
          created_at?: string
          guardian_consent?: boolean
          id?: string
          organisation_id?: string
          player_id?: string
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_bookings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_bookings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_bookings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          cancelled_at: string | null
          created_at: string
          departs_at: string | null
          direction: string
          driver_user_id: string
          event_id: string
          id: string
          meet_point: string
          note: string | null
          organisation_id: string
          seats: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          departs_at?: string | null
          direction?: string
          driver_user_id?: string
          event_id: string
          id?: string
          meet_point: string
          note?: string | null
          organisation_id: string
          seats: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          departs_at?: string | null
          direction?: string
          driver_user_id?: string
          event_id?: string
          id?: string
          meet_point?: string
          note?: string | null
          organisation_id?: string
          seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_reports: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_viewed_at: string | null
          organisation_id: string
          player_id: string
          recipient: string
          report: Json
          revoked_at: string | null
          token_hash: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          organisation_id: string
          player_id: string
          recipient: string
          report: Json
          revoked_at?: string | null
          token_hash: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          organisation_id?: string
          player_id?: string
          recipient?: string
          report?: Json
          revoked_at?: string | null
          token_hash?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scouting_reports_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      travel_drivers: {
        Row: {
          approved_at: string
          approved_by: string | null
          checks_note: string | null
          expires_on: string | null
          id: string
          organisation_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          checks_note?: string | null
          expires_on?: string | null
          id?: string
          organisation_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          checks_note?: string | null
          expires_on?: string | null
          id?: string
          organisation_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_drivers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_appointments: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          expenses_minor: number
          expenses_note: string | null
          fee_minor: number
          fixture_id: string | null
          id: string
          match_id: string | null
          meet_point: string | null
          organisation_id: string
          paid_on: string | null
          pay_basis: string
          payment_reference: string | null
          payment_status: string
          position: string
          report_at: string | null
          responded_at: string | null
          response_note: string | null
          starts_at: string
          status: string
          timezone: string
          title: string
          travel_km: number | null
          travel_notes: string | null
          umpire_id: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expenses_minor?: number
          expenses_note?: string | null
          fee_minor?: number
          fixture_id?: string | null
          id?: string
          match_id?: string | null
          meet_point?: string | null
          organisation_id: string
          paid_on?: string | null
          pay_basis?: string
          payment_reference?: string | null
          payment_status?: string
          position?: string
          report_at?: string | null
          responded_at?: string | null
          response_note?: string | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          travel_km?: number | null
          travel_notes?: string | null
          umpire_id: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expenses_minor?: number
          expenses_note?: string | null
          fee_minor?: number
          fixture_id?: string | null
          id?: string
          match_id?: string | null
          meet_point?: string | null
          organisation_id?: string
          paid_on?: string | null
          pay_basis?: string
          payment_reference?: string | null
          payment_status?: string
          position?: string
          report_at?: string | null
          responded_at?: string | null
          response_note?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          travel_km?: number | null
          travel_notes?: string | null
          umpire_id?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_appointments_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_appointments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_appointments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_appointments_umpire_id_fkey"
            columns: ["umpire_id"]
            isOneToOne: false
            referencedRelation: "umpires"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_availability: {
        Row: {
          day: string
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          day: string
          note?: string | null
          status: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          day?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      umpire_panel_settings: {
        Row: {
          currency: string
          default_fee_minor: number
          default_pay_basis: string
          guidance: string | null
          organisation_id: string
          requires_first_aid: boolean
          requires_kit: boolean
          requires_qualification: boolean
          requires_safeguarding: boolean
          travel_rate_minor: number
          updated_at: string
        }
        Insert: {
          currency?: string
          default_fee_minor?: number
          default_pay_basis?: string
          guidance?: string | null
          organisation_id: string
          requires_first_aid?: boolean
          requires_kit?: boolean
          requires_qualification?: boolean
          requires_safeguarding?: boolean
          travel_rate_minor?: number
          updated_at?: string
        }
        Update: {
          currency?: string
          default_fee_minor?: number
          default_pay_basis?: string
          guidance?: string | null
          organisation_id?: string
          requires_first_aid?: boolean
          requires_kit?: boolean
          requires_qualification?: boolean
          requires_safeguarding?: boolean
          travel_rate_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "umpire_panel_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      umpires: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          email: string | null
          first_aid_expires: string | null
          grade: string
          home_area: string | null
          id: string
          kit_ok: boolean
          match_fee_minor: number | null
          max_travel_km: number | null
          notes: string | null
          organisation_id: string
          pay_basis: string
          phone: string | null
          qualification: string | null
          qualification_expires: string | null
          safeguarding_expires: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          email?: string | null
          first_aid_expires?: string | null
          grade?: string
          home_area?: string | null
          id?: string
          kit_ok?: boolean
          match_fee_minor?: number | null
          max_travel_km?: number | null
          notes?: string | null
          organisation_id: string
          pay_basis?: string
          phone?: string | null
          qualification?: string | null
          qualification_expires?: string | null
          safeguarding_expires?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string | null
          first_aid_expires?: string | null
          grade?: string
          home_area?: string | null
          id?: string
          kit_ok?: boolean
          match_fee_minor?: number | null
          max_travel_km?: number | null
          notes?: string | null
          organisation_id?: string
          pay_basis?: string
          phone?: string | null
          qualification?: string | null
          qualification_expires?: string | null
          safeguarding_expires?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpires_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      add_match_check_scorer: {
        Args: { p_email: string; p_match_id: string }
        Returns: string
      }
      admin_club_plans: {
        Args: never
        Returns: {
          kind: string
          organisation_id: string
          organisation_name: string
          plan: string
          status: string
          video_addon: boolean
        }[]
      }
      admin_club_site_domains: {
        Args: never
        Returns: {
          created_at: string
          dns_a_target: string
          dns_txt_value: string
          hostname: string
          id: string
          kind: string
          live_at: string
          organisation_id: string
          organisation_name: string
          plan_allowed: boolean
          site_published: boolean
          site_slug: string
          staff_note: string
          status: string
        }[]
      }
      admin_promo_payouts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          currency: string
          estimated_earnings: number
          organisation_id: string
          organisation_name: string
          plays: number
        }[]
      }
      admin_set_club_plan: {
        Args: {
          p_organisation_id: string
          p_plan: string
          p_video_addon: boolean
        }
        Returns: undefined
      }
      admin_update_club_site_domain: {
        Args: {
          p_dns_a_target: string
          p_dns_txt_value: string
          p_id: string
          p_staff_note: string
          p_status: string
        }
        Returns: undefined
      }
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
      approved_driver_ids: { Args: { p_org: string }; Returns: string[] }
      can_access_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_access_camera_signal_topic: {
        Args: { p_topic: string }
        Returns: boolean
      }
      can_act_for_player: { Args: { p_player_id: string }; Returns: boolean }
      can_approve_drivers: { Args: { p_org: string }; Returns: boolean }
      can_assign_role: {
        Args: {
          p_actor: Database["public"]["Enums"]["platform_role"]
          p_target: Database["public"]["Enums"]["platform_role"]
        }
        Returns: boolean
      }
      can_direct_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_name_check_scorer: { Args: { p_match_id: string }; Returns: boolean }
      can_operate_camera_room: { Args: { p_room_id: string }; Returns: boolean }
      can_pay_charge: { Args: { p_charge_id: string }; Returns: boolean }
      can_read_camera_storage_path: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_record_balls: { Args: { p_match_id: string }; Returns: boolean }
      can_request_booking: { Args: { p_org: string }; Returns: boolean }
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
      can_view_fee_charge: { Args: { p_charge_id: string }; Returns: boolean }
      can_view_fixture_reports: {
        Args: { p_fixture_id: string }
        Returns: boolean
      }
      can_view_match: { Args: { p_match_id: string }; Returns: boolean }
      can_view_umpire_availability: {
        Args: { p_user: string }
        Returns: boolean
      }
      cancel_ground_booking: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      charge_fee_schedule: {
        Args: { p_player_ids: string[]; p_schedule_id: string }
        Returns: number
      }
      check_scoring_view: { Args: { p_match_id: string }; Returns: Json }
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
      claim_umpire_expenses: {
        Args: {
          p_amount_minor: number
          p_id: string
          p_km: number
          p_note?: string
        }
        Returns: undefined
      }
      claim_video_processing: {
        Args: { p_asset: string; p_user: string }
        Returns: Json
      }
      clean_fixture_result: { Args: { p_result: Json }; Returns: Json }
      club_custom_domain_allowed: { Args: { p_org: string }; Returns: boolean }
      club_promo_earnings: {
        Args: { p_from: string; p_organisation_id: string; p_to: string }
        Returns: {
          advertiser: string
          campaign_id: string
          campaign_name: string
          club_plays: number
          currency: string
          estimated_earnings: number
          share_percent: number
        }[]
      }
      club_site_file_public: { Args: { p_name: string }; Returns: boolean }
      club_site_path_org: { Args: { p_name: string }; Returns: string }
      complete_camera_asset_upload: {
        Args: { p_asset_id: string; p_storage_path: string }
        Returns: string
      }
      complete_video_processing: {
        Args: { p_job: string; p_status: string }
        Returns: Json
      }
      confirm_check_scorecard: {
        Args: { p_match_id: string; p_note: string }
        Returns: undefined
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
      decide_fee_claim: {
        Args: { p_claim_id: string; p_confirm: boolean; p_note: string }
        Returns: undefined
      }
      event_org: { Args: { p_event_id: string }; Returns: string }
      event_selection_published: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      fixture_result_is_valid: {
        Args: { p_away: string; p_home: string; p_result: Json }
        Returns: boolean
      }
      fixture_results_inbox: { Args: { p_org: string }; Returns: Json }
      get_club_site: { Args: { p_slug: string }; Returns: Json }
      get_ground_screen: { Args: { p_slug: string }; Returns: Json }
      get_ground_screen_names: { Args: { p_slug: string }; Returns: Json }
      get_public_scoreboard: { Args: { p_slug: string }; Returns: Json }
      get_shared_scouting_report: { Args: { p_token: string }; Returns: Json }
      ground_busy_slots: {
        Args: { p_from: string; p_ground_id: string; p_to: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      ground_replay_candidates: {
        Args: { p_match_id: string }
        Returns: {
          ball_in_over: number
          batter_runs: number
          id: string
          occurred_at: string
          over_number: number
          sequence: number
          wicket: boolean
        }[]
      }
      has_match_duty: {
        Args: { p_duties: string[]; p_match_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          p_organisation_id: string
          p_roles: Database["public"]["Enums"]["platform_role"][]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_driver: {
        Args: { p_org: string; p_user: string }
        Returns: boolean
      }
      is_booking_manager: { Args: { p_org: string }; Returns: boolean }
      is_check_scorer: { Args: { p_match_id: string }; Returns: boolean }
      is_event_manager: { Args: { p_org: string }; Returns: boolean }
      is_finance_manager: { Args: { p_org: string }; Returns: boolean }
      is_guardian_manager: { Args: { p_org: string }; Returns: boolean }
      is_home_scoring_side: { Args: { p_match_id: string }; Returns: boolean }
      is_match_manager: { Args: { p_match_id: string }; Returns: boolean }
      is_my_umpire: { Args: { p_umpire_id: string }; Returns: boolean }
      is_org_member: { Args: { p_organisation_id: string }; Returns: boolean }
      is_reserved_club_label: { Args: { p_label: string }; Returns: boolean }
      is_ride_driver: { Args: { p_ride_id: string }; Returns: boolean }
      is_site_editor: { Args: { p_org: string }; Returns: boolean }
      is_store_manager: { Args: { p_org: string }; Returns: boolean }
      is_travel_manager: { Args: { p_org: string }; Returns: boolean }
      is_umpire_manager: { Args: { p_org: string }; Returns: boolean }
      is_umpire_payer: { Args: { p_org: string }; Returns: boolean }
      link_my_umpire_profiles: { Args: never; Returns: number }
      list_bookable_grounds: {
        Args: never
        Returns: {
          booking_note: string
          ground_id: string
          ground_name: string
          organisation_id: string
          organisation_name: string
          timezone: string
        }[]
      }
      list_live_promos: {
        Args: { p_surface: string }
        Returns: {
          advertiser: string
          alt_text: string
          campaign_id: string
          cities: string[]
          click_url: string
          countries: string[]
          creative_id: string
          duration_seconds: number
          media_kind: string
          media_path: string
          regions: string[]
          slot: string
          weight: number
        }[]
      }
      list_my_check_matches: { Args: never; Returns: Json }
      list_public_live_matches: { Args: never; Returns: Json }
      match_away_organisation: { Args: { p_match_id: string }; Returns: string }
      match_scoring_team: {
        Args: { p_match_id: string }
        Returns: {
          always_full: boolean
          club_role: string
          display_name: string
          duties: string[]
          user_id: string
        }[]
      }
      my_match_duties: { Args: { p_match_id: string }; Returns: string[] }
      my_umpire_panels: { Args: never; Returns: Json }
      normalise_club_hostname: { Args: { p_input: string }; Returns: string }
      on_my_umpire_panel: { Args: { p_org: string }; Returns: boolean }
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
          removed_at: string | null
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
      player_allows_public_highlights: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      promo_share_percent: {
        Args: { p_organisation_id: string }
        Returns: number
      }
      raise_check_flag: {
        Args: { p_delivery_id: string; p_match_id: string; p_note: string }
        Returns: string
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
      record_promo_plays: {
        Args: {
          p_creative_ids: string[]
          p_organisation_id: string
          p_surface: string
          p_viewer_hash: string
        }
        Returns: number
      }
      remove_camera_device: {
        Args: { p_device_id: string }
        Returns: undefined
      }
      remove_club_site_domain: {
        Args: { p_organisation_id: string }
        Returns: undefined
      }
      remove_match_check_scorer: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: undefined
      }
      reopen_fixture_result: {
        Args: { p_fixture_id: string }
        Returns: undefined
      }
      report_fixture_result: {
        Args: {
          p_fixture_id: string
          p_note?: string
          p_result: Json
          p_team_id: string
        }
        Returns: undefined
      }
      request_club_criclume_address: {
        Args: { p_label: string; p_organisation_id: string }
        Returns: string
      }
      request_club_site_domain: {
        Args: { p_hostname: string; p_organisation_id: string }
        Returns: string
      }
      request_ground_booking: {
        Args: {
          p_ends_at: string
          p_ground_id: string
          p_note: string
          p_purpose: string
          p_requester_org: string
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      request_ground_replay: {
        Args: { p_delivery_id: string; p_match_id: string }
        Returns: undefined
      }
      resolve_check_flag: {
        Args: { p_flag_id: string; p_reply: string; p_status: string }
        Returns: undefined
      }
      resolve_club_site_domain: { Args: { p_host: string }; Returns: string }
      respond_umpire_appointment: {
        Args: { p_accept: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      scouting_consent_granted: {
        Args: { p_organisation_id: string; p_player_id: string }
        Returns: boolean
      }
      set_camera_room_capacity: {
        Args: { p_max_devices: number; p_room_id: string }
        Returns: number
      }
      set_ground_screen: {
        Args: {
          p_interval_seconds: number
          p_manual_page: string
          p_match_id: string
          p_mode: string
          p_pages: string[]
          p_replays: string
          p_show_names: boolean
        }
        Returns: undefined
      }
      set_match_scoring_duty: {
        Args: {
          p_duty: string
          p_enabled: boolean
          p_match_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      set_selection_role: {
        Args: { p_event_id: string; p_field: string; p_player_id: string }
        Returns: undefined
      }
      set_umpire_payment: {
        Args: {
          p_id: string
          p_paid_on?: string
          p_reference?: string
          p_status: string
        }
        Returns: undefined
      }
      sign_off_fixture_result: {
        Args: { p_abandoned?: boolean; p_fixture_id: string; p_result: Json }
        Returns: undefined
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
      start_match_innings_v2: {
        Args: {
          p_batting_team_id: string
          p_bowling_team_id: string
          p_client_event_id: string
          p_device_id: string
          p_innings_id: string
          p_innings_number: number
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
      tag_delivery_v1: {
        Args: {
          p_client_event_id: string
          p_delivery_id: string
          p_device_id: string
          p_innings_id: string
          p_match_id: string
          p_occurred_at: string
          p_tag: Json
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
      update_my_umpire_details: {
        Args: {
          p_home_area: string
          p_max_travel_km: number
          p_phone: string
          p_umpire_id: string
        }
        Returns: undefined
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
      app_role: "admin"
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
        | "treasurer"
        | "team_manager"
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
      app_role: ["admin"],
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
        "treasurer",
        "team_manager",
      ],
    },
  },
} as const
