export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      activity_segments: {
        Row: {
          boundary_reason: string;
          created_at: string;
          end_step_ordinal: number;
          ended_at: string;
          id: string;
          normalization_version: number;
          observation_window_id: string;
          segment_ordinal: number;
          start_step_ordinal: number;
          started_at: string;
          workspace_id: string;
        };
        Insert: {
          boundary_reason: string;
          created_at?: string;
          end_step_ordinal: number;
          ended_at: string;
          id: string;
          normalization_version: number;
          observation_window_id: string;
          segment_ordinal: number;
          start_step_ordinal: number;
          started_at: string;
          workspace_id: string;
        };
        Update: {
          boundary_reason?: string;
          created_at?: string;
          end_step_ordinal?: number;
          ended_at?: string;
          id?: string;
          normalization_version?: number;
          observation_window_id?: string;
          segment_ordinal?: number;
          start_step_ordinal?: number;
          started_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_segments_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'activity_segments_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      allowed_domains: {
        Row: {
          created_at: string;
          hostname: string;
          id: string;
          include_subdomains: boolean;
          is_enabled: boolean;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          hostname: string;
          id?: string;
          include_subdomains?: boolean;
          is_enabled?: boolean;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          hostname?: string;
          id?: string;
          include_subdomains?: boolean;
          is_enabled?: boolean;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'allowed_domains_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'departments_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      job_roles: {
        Row: {
          created_at: string;
          department_id: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_roles_department_workspace_fkey';
            columns: ['workspace_id', 'department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'job_roles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      normalized_step_events: {
        Row: {
          created_at: string;
          normalized_step_id: string;
          raw_event_id: string;
          source_position: number;
        };
        Insert: {
          created_at?: string;
          normalized_step_id: string;
          raw_event_id: string;
          source_position: number;
        };
        Update: {
          created_at?: string;
          normalized_step_id?: string;
          raw_event_id?: string;
          source_position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'normalized_step_events_normalized_step_id_fkey';
            columns: ['normalized_step_id'];
            isOneToOne: false;
            referencedRelation: 'normalized_steps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'normalized_step_events_raw_event_id_fkey';
            columns: ['raw_event_id'];
            isOneToOne: false;
            referencedRelation: 'raw_event_tokens';
            referencedColumns: ['id'];
          },
        ];
      };
      normalized_steps: {
        Row: {
          action_type: string;
          boundary_reasons: string[];
          candidate_boundary_before: boolean;
          created_at: string;
          element_label: string | null;
          element_role: string | null;
          ended_at: string;
          hostname: string | null;
          id: string;
          interaction_group_id: string | null;
          normalization_version: number;
          normalized_path: string | null;
          observation_window_id: string;
          page_landmark: string | null;
          semantic_input_token: string | null;
          source_event_count: number;
          started_at: string;
          step_key: string;
          step_ordinal: number;
          tab_id: number;
          workspace_id: string;
        };
        Insert: {
          action_type: string;
          boundary_reasons?: string[];
          candidate_boundary_before?: boolean;
          created_at?: string;
          element_label?: string | null;
          element_role?: string | null;
          ended_at: string;
          hostname?: string | null;
          id: string;
          interaction_group_id?: string | null;
          normalization_version: number;
          normalized_path?: string | null;
          observation_window_id: string;
          page_landmark?: string | null;
          semantic_input_token?: string | null;
          source_event_count: number;
          started_at: string;
          step_key: string;
          step_ordinal: number;
          tab_id: number;
          workspace_id: string;
        };
        Update: {
          action_type?: string;
          boundary_reasons?: string[];
          candidate_boundary_before?: boolean;
          created_at?: string;
          element_label?: string | null;
          element_role?: string | null;
          ended_at?: string;
          hostname?: string | null;
          id?: string;
          interaction_group_id?: string | null;
          normalization_version?: number;
          normalized_path?: string | null;
          observation_window_id?: string;
          page_landmark?: string | null;
          semantic_input_token?: string | null;
          source_event_count?: number;
          started_at?: string;
          step_key?: string;
          step_ordinal?: number;
          tab_id?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'normalized_steps_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'normalized_steps_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      observation_windows: {
        Row: {
          created_at: string;
          department_id: string;
          department_snapshot: string;
          ended_at: string | null;
          id: string;
          installation_id: string;
          job_role_id: string | null;
          observer_id: string;
          paused_at: string | null;
          role_snapshot: string | null;
          started_at: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          department_snapshot: string;
          ended_at?: string | null;
          id: string;
          installation_id: string;
          job_role_id?: string | null;
          observer_id: string;
          paused_at?: string | null;
          role_snapshot?: string | null;
          started_at: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          department_snapshot?: string;
          ended_at?: string | null;
          id?: string;
          installation_id?: string;
          job_role_id?: string | null;
          observer_id?: string;
          paused_at?: string | null;
          role_snapshot?: string | null;
          started_at?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'observation_windows_department_fkey';
            columns: ['workspace_id', 'department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'observation_windows_installation_fkey';
            columns: ['workspace_id', 'observer_id', 'installation_id'];
            isOneToOne: false;
            referencedRelation: 'observer_installations';
            referencedColumns: ['workspace_id', 'owner_id', 'id'];
          },
          {
            foreignKeyName: 'observation_windows_job_role_fkey';
            columns: ['workspace_id', 'department_id', 'job_role_id'];
            isOneToOne: false;
            referencedRelation: 'job_roles';
            referencedColumns: ['workspace_id', 'department_id', 'id'];
          },
          {
            foreignKeyName: 'observation_windows_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      observer_installations: {
        Row: {
          id: string;
          joined_at: string;
          last_seen_at: string;
          owner_id: string;
          revoked_at: string | null;
          workspace_id: string;
        };
        Insert: {
          id: string;
          joined_at?: string;
          last_seen_at?: string;
          owner_id: string;
          revoked_at?: string | null;
          workspace_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          last_seen_at?: string;
          owner_id?: string;
          revoked_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'observer_installations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      observer_profiles: {
        Row: {
          created_at: string;
          custom_role: string | null;
          default_department_id: string;
          default_job_role_id: string | null;
          observer_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          custom_role?: string | null;
          default_department_id: string;
          default_job_role_id?: string | null;
          observer_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          custom_role?: string | null;
          default_department_id?: string;
          default_job_role_id?: string | null;
          observer_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'observer_profiles_department_fkey';
            columns: ['workspace_id', 'default_department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'observer_profiles_job_role_fkey';
            columns: [
              'workspace_id',
              'default_department_id',
              'default_job_role_id',
            ];
            isOneToOne: false;
            referencedRelation: 'job_roles';
            referencedColumns: ['workspace_id', 'department_id', 'id'];
          },
          {
            foreignKeyName: 'observer_profiles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      privacy_exclusions: {
        Row: {
          allowed_domain_id: string;
          created_at: string;
          id: string;
          is_enabled: boolean;
          path_prefix: string;
          reason: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          allowed_domain_id: string;
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          path_prefix: string;
          reason?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          allowed_domain_id?: string;
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          path_prefix?: string;
          reason?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'privacy_exclusions_domain_fkey';
            columns: ['workspace_id', 'allowed_domain_id'];
            isOneToOne: false;
            referencedRelation: 'allowed_domains';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'privacy_exclusions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_candidate_correction_sources: {
        Row: {
          correction_id: string;
          process_candidate_id: string;
          source_position: number;
        };
        Insert: {
          correction_id: string;
          process_candidate_id: string;
          source_position: number;
        };
        Update: {
          correction_id?: string;
          process_candidate_id?: string;
          source_position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'process_candidate_correction_sources_correction_id_fkey';
            columns: ['correction_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidate_corrections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_candidate_correction_sources_process_candidate_id_fkey';
            columns: ['process_candidate_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      process_candidate_corrections: {
        Row: {
          correction_type: string;
          created_at: string;
          created_by: string;
          id: string;
          mining_run_id: string;
          reason: string | null;
          replacement_labels: string[];
          selected_process_instance_ids: string[];
          workspace_id: string;
        };
        Insert: {
          correction_type: string;
          created_at?: string;
          created_by: string;
          id?: string;
          mining_run_id: string;
          reason?: string | null;
          replacement_labels?: string[];
          selected_process_instance_ids?: string[];
          workspace_id: string;
        };
        Update: {
          correction_type?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          mining_run_id?: string;
          reason?: string | null;
          replacement_labels?: string[];
          selected_process_instance_ids?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_candidate_corrections_mining_run_id_fkey';
            columns: ['mining_run_id'];
            isOneToOne: false;
            referencedRelation: 'process_mining_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_candidate_corrections_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_candidate_instances: {
        Row: {
          process_candidate_id: string;
          process_instance_id: string;
          source_position: number;
        };
        Insert: {
          process_candidate_id: string;
          process_instance_id: string;
          source_position: number;
        };
        Update: {
          process_candidate_id?: string;
          process_instance_id?: string;
          source_position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'process_candidate_instances_process_candidate_id_fkey';
            columns: ['process_candidate_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_candidate_instances_process_instance_id_fkey';
            columns: ['process_instance_id'];
            isOneToOne: true;
            referencedRelation: 'process_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      process_candidates: {
        Row: {
          apparent_outcome: string;
          candidate_key: string;
          canonical_cluster_sequence: string[];
          confidence: number;
          created_at: string;
          evidence_rationale: string;
          id: string;
          instance_count: number;
          metrics: Json;
          mining_run_id: string;
          neutral_label: string;
          observation_count: number;
          participating_systems: string[];
          scope: string;
          variant_count: number;
          workspace_id: string;
        };
        Insert: {
          apparent_outcome: string;
          candidate_key: string;
          canonical_cluster_sequence: string[];
          confidence: number;
          created_at?: string;
          evidence_rationale?: string;
          id: string;
          instance_count: number;
          metrics: Json;
          mining_run_id: string;
          neutral_label: string;
          observation_count: number;
          participating_systems: string[];
          scope?: string;
          variant_count: number;
          workspace_id: string;
        };
        Update: {
          apparent_outcome?: string;
          candidate_key?: string;
          canonical_cluster_sequence?: string[];
          confidence?: number;
          created_at?: string;
          evidence_rationale?: string;
          id?: string;
          instance_count?: number;
          metrics?: Json;
          mining_run_id?: string;
          neutral_label?: string;
          observation_count?: number;
          participating_systems?: string[];
          scope?: string;
          variant_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_candidates_mining_run_id_fkey';
            columns: ['mining_run_id'];
            isOneToOne: false;
            referencedRelation: 'process_mining_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_candidates_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_findings: {
        Row: {
          created_at: string;
          evidence_observation_window_ids: string[];
          evidence_task_snapshot_ids: string[];
          finding_type: string;
          id: string;
          process_candidate_id: string;
          severity: string;
          summary: string;
        };
        Insert: {
          created_at?: string;
          evidence_observation_window_ids: string[];
          evidence_task_snapshot_ids: string[];
          finding_type: string;
          id: string;
          process_candidate_id: string;
          severity: string;
          summary: string;
        };
        Update: {
          created_at?: string;
          evidence_observation_window_ids?: string[];
          evidence_task_snapshot_ids?: string[];
          finding_type?: string;
          id?: string;
          process_candidate_id?: string;
          severity?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_findings_process_candidate_id_fkey';
            columns: ['process_candidate_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      process_graph_edges: {
        Row: {
          id: string;
          median_transition_seconds: number;
          occurrence_count: number;
          process_candidate_id: string;
          source_cluster_key: string;
          target_cluster_key: string;
        };
        Insert: {
          id: string;
          median_transition_seconds: number;
          occurrence_count: number;
          process_candidate_id: string;
          source_cluster_key: string;
          target_cluster_key: string;
        };
        Update: {
          id?: string;
          median_transition_seconds?: number;
          occurrence_count?: number;
          process_candidate_id?: string;
          source_cluster_key?: string;
          target_cluster_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_graph_edges_process_candidate_id_fkey';
            columns: ['process_candidate_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      process_instances: {
        Row: {
          apparent_outcome: string;
          boundary_rationale: string;
          cluster_sequence: string[];
          confidence: number;
          created_at: string;
          department_snapshot: string;
          disposition: string;
          duration_seconds: number;
          ended_at: string;
          id: string;
          match_diagnostics: Json;
          mining_run_id: string;
          neutral_label: string;
          observation_window_id: string;
          range_fingerprint: string;
          related_candidate_key: string | null;
          role_snapshot: string | null;
          started_at: string;
          task_snapshot_ids: string[];
          workspace_id: string;
        };
        Insert: {
          apparent_outcome: string;
          boundary_rationale: string;
          cluster_sequence: string[];
          confidence: number;
          created_at?: string;
          department_snapshot: string;
          disposition?: string;
          duration_seconds: number;
          ended_at: string;
          id: string;
          match_diagnostics?: Json;
          mining_run_id: string;
          neutral_label: string;
          observation_window_id: string;
          range_fingerprint?: string;
          related_candidate_key?: string | null;
          role_snapshot?: string | null;
          started_at: string;
          task_snapshot_ids: string[];
          workspace_id: string;
        };
        Update: {
          apparent_outcome?: string;
          boundary_rationale?: string;
          cluster_sequence?: string[];
          confidence?: number;
          created_at?: string;
          department_snapshot?: string;
          disposition?: string;
          duration_seconds?: number;
          ended_at?: string;
          id?: string;
          match_diagnostics?: Json;
          mining_run_id?: string;
          neutral_label?: string;
          observation_window_id?: string;
          range_fingerprint?: string;
          related_candidate_key?: string | null;
          role_snapshot?: string | null;
          started_at?: string;
          task_snapshot_ids?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_instances_mining_run_id_fkey';
            columns: ['mining_run_id'];
            isOneToOne: false;
            referencedRelation: 'process_mining_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_instances_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'process_instances_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_mining_runs: {
        Row: {
          algorithm_version: number;
          created_at: string;
          department_id: string;
          id: string;
          input_digest: string;
          model: string;
          process_candidate_count: number;
          process_instance_count: number;
          prompt_version: number;
          task_snapshot_count: number;
          workspace_id: string;
        };
        Insert: {
          algorithm_version: number;
          created_at?: string;
          department_id: string;
          id: string;
          input_digest: string;
          model: string;
          process_candidate_count: number;
          process_instance_count: number;
          prompt_version: number;
          task_snapshot_count: number;
          workspace_id: string;
        };
        Update: {
          algorithm_version?: number;
          created_at?: string;
          department_id?: string;
          id?: string;
          input_digest?: string;
          model?: string;
          process_candidate_count?: number;
          process_instance_count?: number;
          prompt_version?: number;
          task_snapshot_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_mining_runs_department_fkey';
            columns: ['workspace_id', 'department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'process_mining_runs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_task_snapshot_sources: {
        Row: {
          source_position: number;
          task_instance_id: string;
          task_snapshot_id: string;
        };
        Insert: {
          source_position: number;
          task_instance_id: string;
          task_snapshot_id: string;
        };
        Update: {
          source_position?: number;
          task_instance_id?: string;
          task_snapshot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_task_snapshot_sources_task_instance_id_fkey';
            columns: ['task_instance_id'];
            isOneToOne: false;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_task_snapshot_sources_task_snapshot_id_fkey';
            columns: ['task_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'process_task_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      process_task_snapshots: {
        Row: {
          apparent_objective: string;
          cluster_key: string;
          confidence: number;
          created_at: string;
          department_id: string;
          department_snapshot: string;
          end_step_ordinal: number;
          ended_at: string;
          feature_signature: string;
          feature_tokens: Json;
          hard_segment_ordinal: number;
          id: string;
          mining_run_id: string;
          neutral_label: string;
          observation_window_id: string;
          participating_systems: string[];
          role_snapshot: string | null;
          source_correction_id: string | null;
          start_step_ordinal: number;
          started_at: string;
          task_ordinal: number;
          workspace_id: string;
        };
        Insert: {
          apparent_objective: string;
          cluster_key: string;
          confidence: number;
          created_at?: string;
          department_id: string;
          department_snapshot: string;
          end_step_ordinal: number;
          ended_at: string;
          feature_signature: string;
          feature_tokens: Json;
          hard_segment_ordinal: number;
          id: string;
          mining_run_id: string;
          neutral_label: string;
          observation_window_id: string;
          participating_systems: string[];
          role_snapshot?: string | null;
          source_correction_id?: string | null;
          start_step_ordinal: number;
          started_at: string;
          task_ordinal: number;
          workspace_id: string;
        };
        Update: {
          apparent_objective?: string;
          cluster_key?: string;
          confidence?: number;
          created_at?: string;
          department_id?: string;
          department_snapshot?: string;
          end_step_ordinal?: number;
          ended_at?: string;
          feature_signature?: string;
          feature_tokens?: Json;
          hard_segment_ordinal?: number;
          id?: string;
          mining_run_id?: string;
          neutral_label?: string;
          observation_window_id?: string;
          participating_systems?: string[];
          role_snapshot?: string | null;
          source_correction_id?: string | null;
          start_step_ordinal?: number;
          started_at?: string;
          task_ordinal?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_task_snapshots_department_fkey';
            columns: ['workspace_id', 'department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'process_task_snapshots_mining_run_id_fkey';
            columns: ['mining_run_id'];
            isOneToOne: false;
            referencedRelation: 'process_mining_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_task_snapshots_source_correction_id_fkey';
            columns: ['source_correction_id'];
            isOneToOne: false;
            referencedRelation: 'task_corrections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_task_snapshots_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'process_task_snapshots_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_unmatched_work: {
        Row: {
          classification: string;
          created_at: string;
          id: string;
          mining_run_id: string;
          observation_window_id: string;
          reason: string;
          task_snapshot_ids: string[];
          workspace_id: string;
        };
        Insert: {
          classification: string;
          created_at?: string;
          id?: string;
          mining_run_id: string;
          observation_window_id: string;
          reason: string;
          task_snapshot_ids: string[];
          workspace_id: string;
        };
        Update: {
          classification?: string;
          created_at?: string;
          id?: string;
          mining_run_id?: string;
          observation_window_id?: string;
          reason?: string;
          task_snapshot_ids?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_unmatched_work_mining_run_id_fkey';
            columns: ['mining_run_id'];
            isOneToOne: false;
            referencedRelation: 'process_mining_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_unmatched_work_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'process_unmatched_work_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      process_variants: {
        Row: {
          cluster_sequence: string[];
          created_at: string;
          id: string;
          occurrence_count: number;
          process_candidate_id: string;
          representative_process_instance_id: string;
          variant_key: string;
        };
        Insert: {
          cluster_sequence: string[];
          created_at?: string;
          id: string;
          occurrence_count: number;
          process_candidate_id: string;
          representative_process_instance_id: string;
          variant_key: string;
        };
        Update: {
          cluster_sequence?: string[];
          created_at?: string;
          id?: string;
          occurrence_count?: number;
          process_candidate_id?: string;
          representative_process_instance_id?: string;
          variant_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_variants_process_candidate_id_fkey';
            columns: ['process_candidate_id'];
            isOneToOne: false;
            referencedRelation: 'process_candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'process_variants_representative_process_instance_id_fkey';
            columns: ['representative_process_instance_id'];
            isOneToOne: false;
            referencedRelation: 'process_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      processing_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          created_at?: string;
          entity_id: string;
          error_code?: string | null;
          error_detail?: string | null;
          id?: never;
          job_type: string;
          lock_token?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempt_count?: number;
          available_at?: string;
          created_at?: string;
          entity_id?: string;
          error_code?: string | null;
          error_detail?: string | null;
          id?: never;
          job_type?: string;
          lock_token?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'processing_jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      raw_event_tokens: {
        Row: {
          action_type: string;
          element_label: string | null;
          element_role: string | null;
          hostname: string | null;
          id: string;
          ingested_at: string;
          normalized_path: string | null;
          observation_window_id: string;
          observer_id: string;
          occurred_at: string;
          page_landmark: string | null;
          semantic_input_token: string | null;
          sequence_no: number;
          tab_id: number;
          workspace_id: string;
        };
        Insert: {
          action_type: string;
          element_label?: string | null;
          element_role?: string | null;
          hostname?: string | null;
          id: string;
          ingested_at?: string;
          normalized_path?: string | null;
          observation_window_id: string;
          observer_id: string;
          occurred_at: string;
          page_landmark?: string | null;
          semantic_input_token?: string | null;
          sequence_no: number;
          tab_id: number;
          workspace_id: string;
        };
        Update: {
          action_type?: string;
          element_label?: string | null;
          element_role?: string | null;
          hostname?: string | null;
          id?: string;
          ingested_at?: string;
          normalized_path?: string | null;
          observation_window_id?: string;
          observer_id?: string;
          occurred_at?: string;
          page_landmark?: string | null;
          semantic_input_token?: string | null;
          sequence_no?: number;
          tab_id?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'raw_event_tokens_observation_window_id_fkey';
            columns: ['observation_window_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'raw_event_tokens_window_identity_fkey';
            columns: ['observation_window_id', 'workspace_id', 'observer_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id', 'observer_id'];
          },
          {
            foreignKeyName: 'raw_event_tokens_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_cluster_members: {
        Row: {
          cluster_id: string;
          created_at: string;
          task_instance_id: string;
        };
        Insert: {
          cluster_id: string;
          created_at?: string;
          task_instance_id: string;
        };
        Update: {
          cluster_id?: string;
          created_at?: string;
          task_instance_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_cluster_members_cluster_id_fkey';
            columns: ['cluster_id'];
            isOneToOne: false;
            referencedRelation: 'task_clusters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_cluster_members_task_instance_id_fkey';
            columns: ['task_instance_id'];
            isOneToOne: true;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      task_clusters: {
        Row: {
          canonical_label: string;
          cluster_key: string;
          created_at: string;
          id: string;
          participating_systems: string[];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          canonical_label: string;
          cluster_key: string;
          created_at?: string;
          id: string;
          participating_systems: string[];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          canonical_label?: string;
          cluster_key?: string;
          created_at?: string;
          id?: string;
          participating_systems?: string[];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_clusters_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_correction_sources: {
        Row: {
          correction_id: string;
          source_position: number;
          task_instance_id: string;
        };
        Insert: {
          correction_id: string;
          source_position: number;
          task_instance_id: string;
        };
        Update: {
          correction_id?: string;
          source_position?: number;
          task_instance_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_correction_sources_correction_id_fkey';
            columns: ['correction_id'];
            isOneToOne: false;
            referencedRelation: 'task_corrections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_correction_sources_task_instance_id_fkey';
            columns: ['task_instance_id'];
            isOneToOne: false;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      task_corrections: {
        Row: {
          correction_type: string;
          created_at: string;
          created_by: string;
          id: string;
          reason: string | null;
          replacement_labels: string[];
          split_after_step_ordinal: number | null;
          workspace_id: string;
        };
        Insert: {
          correction_type: string;
          created_at?: string;
          created_by: string;
          id?: string;
          reason?: string | null;
          replacement_labels?: string[];
          split_after_step_ordinal?: number | null;
          workspace_id: string;
        };
        Update: {
          correction_type?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          reason?: string | null;
          replacement_labels?: string[];
          split_after_step_ordinal?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_corrections_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_inference_exclusion_steps: {
        Row: {
          created_at: string;
          exclusion_id: string;
          normalized_step_id: string;
          step_position: number;
        };
        Insert: {
          created_at?: string;
          exclusion_id: string;
          normalized_step_id: string;
          step_position: number;
        };
        Update: {
          created_at?: string;
          exclusion_id?: string;
          normalized_step_id?: string;
          step_position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_inference_exclusion_steps_exclusion_id_fkey';
            columns: ['exclusion_id'];
            isOneToOne: false;
            referencedRelation: 'task_inference_exclusions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_inference_exclusion_steps_normalized_step_id_fkey';
            columns: ['normalized_step_id'];
            isOneToOne: false;
            referencedRelation: 'normalized_steps';
            referencedColumns: ['id'];
          },
        ];
      };
      task_inference_exclusions: {
        Row: {
          classification: string;
          created_at: string;
          end_step_ordinal: number;
          exclusion_ordinal: number;
          id: string;
          inference_run_id: string;
          observation_window_id: string;
          reason: string;
          start_step_ordinal: number;
          workspace_id: string;
        };
        Insert: {
          classification: string;
          created_at?: string;
          end_step_ordinal: number;
          exclusion_ordinal: number;
          id: string;
          inference_run_id: string;
          observation_window_id: string;
          reason: string;
          start_step_ordinal: number;
          workspace_id: string;
        };
        Update: {
          classification?: string;
          created_at?: string;
          end_step_ordinal?: number;
          exclusion_ordinal?: number;
          id?: string;
          inference_run_id?: string;
          observation_window_id?: string;
          reason?: string;
          start_step_ordinal?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_inference_exclusions_inference_run_id_fkey';
            columns: ['inference_run_id'];
            isOneToOne: false;
            referencedRelation: 'task_inference_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_inference_exclusions_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'task_inference_exclusions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_inference_runs: {
        Row: {
          created_at: string;
          id: string;
          input_digest: string;
          model: string;
          normalization_version: number;
          observation_window_id: string;
          prompt_version: number;
          task_count: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          input_digest: string;
          model: string;
          normalization_version: number;
          observation_window_id: string;
          prompt_version: number;
          task_count: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_digest?: string;
          model?: string;
          normalization_version?: number;
          observation_window_id?: string;
          prompt_version?: number;
          task_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_inference_runs_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'task_inference_runs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_instance_steps: {
        Row: {
          created_at: string;
          normalized_step_id: string;
          step_position: number;
          task_instance_id: string;
        };
        Insert: {
          created_at?: string;
          normalized_step_id: string;
          step_position: number;
          task_instance_id: string;
        };
        Update: {
          created_at?: string;
          normalized_step_id?: string;
          step_position?: number;
          task_instance_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_instance_steps_normalized_step_id_fkey';
            columns: ['normalized_step_id'];
            isOneToOne: false;
            referencedRelation: 'normalized_steps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_instance_steps_task_instance_id_fkey';
            columns: ['task_instance_id'];
            isOneToOne: false;
            referencedRelation: 'task_instances';
            referencedColumns: ['id'];
          },
        ];
      };
      task_instances: {
        Row: {
          apparent_objective: string;
          boundary_confidence: number;
          boundary_rationale: string;
          confidence: number;
          created_at: string;
          end_step_ordinal: number;
          ended_at: string;
          id: string;
          inference_run_id: string;
          label_confidence: number;
          neutral_label: string;
          objective_confidence: number;
          observation_window_id: string;
          participating_systems: string[];
          start_step_ordinal: number;
          started_at: string;
          task_ordinal: number;
          workspace_id: string;
        };
        Insert: {
          apparent_objective: string;
          boundary_confidence: number;
          boundary_rationale: string;
          confidence: number;
          created_at?: string;
          end_step_ordinal: number;
          ended_at: string;
          id: string;
          inference_run_id: string;
          label_confidence: number;
          neutral_label: string;
          objective_confidence: number;
          observation_window_id: string;
          participating_systems: string[];
          start_step_ordinal: number;
          started_at: string;
          task_ordinal: number;
          workspace_id: string;
        };
        Update: {
          apparent_objective?: string;
          boundary_confidence?: number;
          boundary_rationale?: string;
          confidence?: number;
          created_at?: string;
          end_step_ordinal?: number;
          ended_at?: string;
          id?: string;
          inference_run_id?: string;
          label_confidence?: number;
          neutral_label?: string;
          objective_confidence?: number;
          observation_window_id?: string;
          participating_systems?: string[];
          start_step_ordinal?: number;
          started_at?: string;
          task_ordinal?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_instances_inference_run_id_fkey';
            columns: ['inference_run_id'];
            isOneToOne: false;
            referencedRelation: 'task_inference_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_instances_window_fkey';
            columns: ['observation_window_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'observation_windows';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'task_instances_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invites: {
        Row: {
          code_hash: string;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          max_uses: number;
          member_role: string;
          revoked_at: string | null;
          use_count: number;
          workspace_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
          member_role?: string;
          revoked_at?: string | null;
          use_count?: number;
          workspace_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
          member_role?: string;
          revoked_at?: string | null;
          use_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invites_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          member_role: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          member_role: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          member_role?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_processing_jobs: {
        Args: {
          batch_size?: number;
          requested_job_types: string[];
          worker_identifier: string;
        };
        Returns: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'processing_jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_processing_job: {
        Args: { target_job_id: number; target_lock_token: string };
        Returns: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'processing_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_process_candidate_correction: {
        Args: {
          target_correction_type: string;
          target_mining_run_id: string;
          target_process_candidate_ids: string[];
          target_reason?: string;
          target_replacement_labels?: string[];
          target_selected_process_instance_ids?: string[];
          target_workspace_id: string;
        };
        Returns: {
          correction_type: string;
          created_at: string;
          created_by: string;
          id: string;
          mining_run_id: string;
          reason: string | null;
          replacement_labels: string[];
          selected_process_instance_ids: string[];
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'process_candidate_corrections';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_task_correction: {
        Args: {
          target_correction_type: string;
          target_reason?: string;
          target_replacement_labels?: string[];
          target_split_after_step_ordinal?: number;
          target_task_instance_ids: string[];
          target_workspace_id: string;
        };
        Returns: {
          correction_type: string;
          created_at: string;
          created_by: string;
          id: string;
          reason: string | null;
          replacement_labels: string[];
          split_after_step_ordinal: number | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'task_corrections';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_workspace: {
        Args: { workspace_name: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_workspace_invite: {
        Args: {
          invite_expires_at?: string;
          invite_max_uses?: number;
          target_workspace_id: string;
        };
        Returns: {
          invite_code: string;
          invite_id: string;
        }[];
      };
      enqueue_process_mining: {
        Args: { target_department_id: string };
        Returns: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'processing_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      enqueue_task_inference: {
        Args: { target_observation_window_id: string };
        Returns: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'processing_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fail_processing_job: {
        Args: {
          retryable?: boolean;
          target_error_code: string;
          target_error_detail: string;
          target_job_id: number;
          target_lock_token: string;
        };
        Returns: {
          attempt_count: number;
          available_at: string;
          created_at: string;
          entity_id: string;
          error_code: string | null;
          error_detail: string | null;
          id: number;
          job_type: string;
          lock_token: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'processing_jobs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_workspace_by_invite: {
        Args: { installation_id: string; invite_code: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      persist_process_mining_result: {
        Args: {
          target_algorithm_version: number;
          target_candidates: Json;
          target_department_id: string;
          target_input_digest: string;
          target_instances: Json;
          target_model: string;
          target_prompt_version: number;
          target_run_id: string;
          target_snapshots: Json;
          target_unmatched: Json;
          target_workspace_id: string;
        };
        Returns: string;
      };
      persist_process_mining_result_v2: {
        Args: {
          target_algorithm_version: number;
          target_candidates: Json;
          target_department_id: string;
          target_input_digest: string;
          target_instances: Json;
          target_model: string;
          target_prompt_version: number;
          target_run_id: string;
          target_snapshots: Json;
          target_unmatched: Json;
          target_workspace_id: string;
        };
        Returns: string;
      };
      persist_task_inference_result: {
        Args: {
          target_input_digest: string;
          target_model: string;
          target_normalization_version: number;
          target_observation_window_id: string;
          target_prompt_version: number;
          target_run_id: string;
          target_segments: Json;
          target_steps: Json;
          target_tasks: Json;
        };
        Returns: {
          created_at: string;
          id: string;
          input_digest: string;
          model: string;
          normalization_version: number;
          observation_window_id: string;
          prompt_version: number;
          task_count: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'task_inference_runs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      persist_task_inference_result_v2: {
        Args: {
          target_exclusions: Json;
          target_input_digest: string;
          target_model: string;
          target_normalization_version: number;
          target_observation_window_id: string;
          target_prompt_version: number;
          target_run_id: string;
          target_segments: Json;
          target_steps: Json;
          target_tasks: Json;
        };
        Returns: {
          created_at: string;
          id: string;
          input_digest: string;
          model: string;
          normalization_version: number;
          observation_window_id: string;
          prompt_version: number;
          task_count: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'task_inference_runs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      persist_task_inference_result_v2_inner: {
        Args: {
          target_exclusions: Json;
          target_input_digest: string;
          target_model: string;
          target_normalization_version: number;
          target_observation_window_id: string;
          target_prompt_version: number;
          target_run_id: string;
          target_segments: Json;
          target_steps: Json;
          target_tasks: Json;
        };
        Returns: {
          created_at: string;
          id: string;
          input_digest: string;
          model: string;
          normalization_version: number;
          observation_window_id: string;
          prompt_version: number;
          task_count: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'task_inference_runs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_observation_window: {
        Args: {
          target_custom_role?: string;
          target_department_id: string;
          target_job_role_id?: string;
          target_window_id: string;
        };
        Returns: {
          created_at: string;
          department_id: string;
          department_snapshot: string;
          ended_at: string | null;
          id: string;
          installation_id: string;
          job_role_id: string | null;
          observer_id: string;
          paused_at: string | null;
          role_snapshot: string | null;
          started_at: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'observation_windows';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_observation_window: {
        Args: { target_status: string; target_window_id: string };
        Returns: {
          created_at: string;
          department_id: string;
          department_snapshot: string;
          ended_at: string | null;
          id: string;
          installation_id: string;
          job_role_id: string | null;
          observer_id: string;
          paused_at: string | null;
          role_snapshot: string | null;
          started_at: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'observation_windows';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
