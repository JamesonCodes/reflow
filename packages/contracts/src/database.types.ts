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
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
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
