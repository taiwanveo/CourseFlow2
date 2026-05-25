import type { PhaseLocks } from "@courseflow/core";
import type { CourseComposition } from "@courseflow/core";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface DbProject {
  id: string;
  user_id: string;
  title: string;
  public_slug: string | null;
  article: Json;
  theme_id: string | null;
  phase_locks: PhaseLocks;
  composition_snapshot: CourseComposition | Json;
  settings: Json;
  created_at: string;
  updated_at: string;
}

export interface DbChapter {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  created_at: string;
}

export interface DbStep {
  id: string;
  chapter_id: string;
  sort_order: number;
  script: string;
  screen_summary: string;
  info_pool: Json;
  created_at: string;
}

export interface DbRenderJob {
  id: string;
  project_id: string;
  user_id: string;
  kind: "preview" | "export";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  output_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUserApiKey {
  id: string;
  user_id: string;
  provider: string;
  encrypted_key: string;
  created_at: string;
  updated_at: string;
}

export interface DbJobRun {
  id: string;
  project_id: string | null;
  user_id: string;
  job_type: string;
  status: string;
  payload: Json;
  result: Json | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: DbProject;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          public_slug?: string | null;
          article?: Json;
          theme_id?: string | null;
          phase_locks?: PhaseLocks;
          composition_snapshot?: Json;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      chapters: {
        Row: DbChapter;
        Insert: {
          id?: string;
          project_id: string;
          parent_id?: string | null;
          title: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chapters"]["Insert"]>;
        Relationships: [];
      };
      steps: {
        Row: DbStep;
        Insert: {
          id?: string;
          chapter_id: string;
          sort_order?: number;
          script?: string;
          screen_summary?: string;
          info_pool?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["steps"]["Insert"]>;
        Relationships: [];
      };
      render_jobs: {
        Row: DbRenderJob;
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          kind?: "preview" | "export";
          status?: "pending" | "processing" | "completed" | "failed";
          progress?: number;
          output_path?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["render_jobs"]["Insert"]>;
        Relationships: [];
      };
      user_api_keys: {
        Row: DbUserApiKey;
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          encrypted_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_api_keys"]["Insert"]>;
        Relationships: [];
      };
      job_runs: {
        Row: DbJobRun;
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          job_type: string;
          status?: string;
          payload?: Json;
          result?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_runs"]["Insert"]>;
        Relationships: [];
      };
      audio_assets: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      subtitle_tracks: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      step_visuals: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
