export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      custom_icons: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          pixelated: boolean
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          pixelated?: boolean
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          pixelated?: boolean
          storage_path?: string
        }
        Relationships: []
      }
      member_coupons: {
        Row: {
          allocated_at: string
          id: string
          member_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          allocated_at?: string
          id?: string
          member_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          allocated_at?: string
          id?: string
          member_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_coupons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payment_change_log: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          member_external_id: string | null
          member_first_name: string
          member_id: string | null
          member_last_name: string
          member_phone: string | null
          paid: boolean
          previous_paid: boolean | null
          year: number
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          member_external_id?: string | null
          member_first_name: string
          member_id?: string | null
          member_last_name: string
          member_phone?: string | null
          paid: boolean
          previous_paid?: boolean | null
          year: number
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          member_external_id?: string | null
          member_first_name?: string
          member_id?: string | null
          member_last_name?: string
          member_phone?: string | null
          paid?: boolean
          previous_paid?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payment_change_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payment_pending_verification: {
        Row: {
          created_at: string
          imports_without_verification: number
          last_import_missed_at: string | null
          marked_paid_at: string
          member_first_name: string
          member_id: string
          member_last_name: string
          member_phone: string | null
          year: number
        }
        Insert: {
          created_at?: string
          imports_without_verification?: number
          last_import_missed_at?: string | null
          marked_paid_at?: string
          member_first_name: string
          member_id: string
          member_last_name: string
          member_phone?: string | null
          year: number
        }
        Update: {
          created_at?: string
          imports_without_verification?: number
          last_import_missed_at?: string | null
          marked_paid_at?: string
          member_first_name?: string
          member_id?: string
          member_last_name?: string
          member_phone?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payment_pending_verification_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payments: {
        Row: {
          member_id: string
          paid: boolean
          recorded_at: string
          year: number
        }
        Insert: {
          member_id: string
          paid?: boolean
          recorded_at?: string
          year: number
        }
        Update: {
          member_id?: string
          paid?: boolean
          recorded_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          birth_year: number | null
          city: string | null
          coupons_remaining: number
          created_at: string
          email: string | null
          external_id: string | null
          first_name: string
          id: string
          joined_at: string | null
          last_allocation_at: string | null
          last_name: string
          member_type: string | null
          paid: boolean
          phone: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          birth_year?: number | null
          city?: string | null
          coupons_remaining?: number
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name: string
          id?: string
          joined_at?: string | null
          last_allocation_at?: string | null
          last_name: string
          member_type?: string | null
          paid?: boolean
          phone?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          birth_year?: number | null
          city?: string | null
          coupons_remaining?: number
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string
          id?: string
          joined_at?: string | null
          last_allocation_at?: string | null
          last_name?: string
          member_type?: string | null
          paid?: boolean
          phone?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      menu_catalog_items: {
        Row: {
          created_at: string
          default_price: number
          description: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_price: number
          description?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_price?: number
          description?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          menu_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          menu_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          menu_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_groups: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          catalog_item_id: string
          category_id: string
          created_at: string
          id: string
          is_sold_out: boolean
          price: number
          sort_order: number
        }
        Insert: {
          catalog_item_id: string
          category_id: string
          created_at?: string
          id?: string
          is_sold_out?: boolean
          price: number
          sort_order?: number
        }
        Update: {
          catalog_item_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_sold_out?: boolean
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "menu_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          group_id: string | null
          icon: string
          id: string
          is_live: boolean
          name: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          icon?: string
          id?: string
          is_live?: boolean
          name: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          icon?: string
          id?: string
          is_live?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          coupons_per_year: number
          display_name: string
          id: boolean
          public_menu_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          coupons_per_year?: number
          display_name?: string
          id?: boolean
          public_menu_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          coupons_per_year?: number
          display_name?: string
          id?: boolean
          public_menu_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      recycle_bin_items: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_copy_menu: {
        Args: { p_group_id?: string; p_menu_id: string; p_new_name?: string }
        Returns: Json
      }
      admin_clear_member_payment_change_log: { Args: never; Returns: Json }
      admin_delete_user: { Args: { p_user_id: string }; Returns: Json }
      admin_refresh_yearly_coupons: { Args: never; Returns: Json }
      admin_search_members: { Args: { p_query: string }; Returns: Json }
      admin_set_member_paid: {
        Args: { p_member_id: string; p_paid: boolean }
        Returns: Json
      }
      admin_verify_member_payment: {
        Args: { p_member_id: string }
        Returns: Json
      }
      admin_set_menu_live: { Args: { p_menu_id: string }; Returns: Json }
      admin_unuse_member_coupon: {
        Args: { p_coupon_id: string }
        Returns: Json
      }
      admin_use_member_coupon: {
        Args: { p_coupon_id?: string; p_member_id: string }
        Returns: Json
      }
      allocate_member_coupons: {
        Args: { p_count?: number; p_member_id: string }
        Returns: undefined
      }
      clear_unused_member_coupons: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      get_coupons_by_phone: {
        Args: { p_member_id?: string; p_phone: string }
        Returns: Json
      }
      health_check: { Args: never; Returns: Json }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_public_menu_enabled: { Args: never; Returns: boolean }
      normalize_member_phone: { Args: { input: string }; Returns: string }
      organization_coupons_per_year: { Args: never; Returns: number }
      sync_member_coupons_remaining: {
        Args: { p_member_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

