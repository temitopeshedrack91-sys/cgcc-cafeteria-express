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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          ordering_open: boolean
          payment_config: Json
          transfer_config: Json
          updated_at: string
        }
        Insert: {
          id: string
          ordering_open?: boolean
          payment_config?: Json
          transfer_config?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          ordering_open?: boolean
          payment_config?: Json
          transfer_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
          user_label: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
          user_label?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
          user_label?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          archived_at: string | null
          bank_name: string
          created_at: string
          enabled: boolean
          id: string
          instructions: string | null
          is_default: boolean
          logo_url: string | null
          narration: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          archived_at?: string | null
          bank_name: string
          created_at?: string
          enabled?: boolean
          id?: string
          instructions?: string | null
          is_default?: boolean
          logo_url?: string | null
          narration?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          archived_at?: string | null
          bank_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          instructions?: string | null
          is_default?: boolean
          logo_url?: string | null
          narration?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      business_day_closures: {
        Row: {
          business_day: string
          closed_at: string
          closed_by: string | null
          note: string | null
        }
        Insert: {
          business_day: string
          closed_at?: string
          closed_by?: string | null
          note?: string | null
        }
        Update: {
          business_day?: string
          closed_at?: string
          closed_by?: string | null
          note?: string | null
        }
        Relationships: []
      }
      cashier_sale_items: {
        Row: {
          id: string
          menu_item_id: string
          name: string
          price: number
          qty: number
          sale_id: string
          vendor_type: string | null
        }
        Insert: {
          id?: string
          menu_item_id: string
          name: string
          price: number
          qty: number
          sale_id: string
          vendor_type?: string | null
        }
        Update: {
          id?: string
          menu_item_id?: string
          name?: string
          price?: number
          qty?: number
          sale_id?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashier_sale_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "cashier_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_sales: {
        Row: {
          archived_at: string | null
          business_day: string | null
          cashier_id: string
          cashier_label: string | null
          code: string
          created_at: string
          customer_name: string | null
          id: string
          note: string | null
          payment_method: string
          receipt_no: string
          total: number
        }
        Insert: {
          archived_at?: string | null
          business_day?: string | null
          cashier_id: string
          cashier_label?: string | null
          code: string
          created_at?: string
          customer_name?: string | null
          id?: string
          note?: string | null
          payment_method: string
          receipt_no: string
          total?: number
        }
        Update: {
          archived_at?: string | null
          business_day?: string | null
          cashier_id?: string
          cashier_label?: string | null
          code?: string
          created_at?: string
          customer_name?: string | null
          id?: string
          note?: string | null
          payment_method?: string
          receipt_no?: string
          total?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      finance_login_events: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          id: string
          success: boolean
          user_id: string | null
          user_label: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          success?: boolean
          user_id?: string | null
          user_label?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          success?: boolean
          user_id?: string | null
          user_label?: string | null
        }
        Relationships: []
      }
      finance_otps: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          session_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          session_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_otps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "finance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_security: {
        Row: {
          configured_at: string | null
          failed_attempts: number
          id: string
          locked_until: string | null
          otp_enabled: boolean
          pin_hash: string | null
          recovery_email: string | null
          timeout_minutes: number
          updated_at: string
        }
        Insert: {
          configured_at?: string | null
          failed_attempts?: number
          id: string
          locked_until?: string | null
          otp_enabled?: boolean
          pin_hash?: string | null
          recovery_email?: string | null
          timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          configured_at?: string | null
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          otp_enabled?: boolean
          pin_hash?: string | null
          recovery_email?: string | null
          timeout_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          otp_verified: boolean
          revoked_at: string | null
          user_id: string
          user_label: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          otp_verified?: boolean
          revoked_at?: string | null
          user_id: string
          user_label?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          otp_verified?: boolean
          revoked_at?: string | null
          user_id?: string
          user_label?: string | null
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          changed_by: string | null
          changed_by_label: string | null
          created_at: string
          delta: number
          id: string
          item_name: string
          menu_item_id: string
          new_qty: number
          previous_qty: number
          reason: string | null
          source: string
          vendor_type: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_label?: string | null
          created_at?: string
          delta: number
          id?: string
          item_name: string
          menu_item_id: string
          new_qty: number
          previous_qty: number
          reason?: string | null
          source?: string
          vendor_type?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_label?: string | null
          created_at?: string
          delta?: number
          id?: string
          item_name?: string
          menu_item_id?: string
          new_qty?: number
          previous_qty?: number
          reason?: string | null
          source?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          archived_at: string | null
          available: boolean
          category_id: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          price: number
          sort_order: number
          stock_online: number
          stock_qty: number
          stock_walkin: number
          vendor_type: string
        }
        Insert: {
          archived_at?: string | null
          available?: boolean
          category_id: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          price: number
          sort_order?: number
          stock_online?: number
          stock_qty?: number
          stock_walkin?: number
          vendor_type: string
        }
        Update: {
          archived_at?: string | null
          available?: boolean
          category_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          price?: number
          sort_order?: number
          stock_online?: number
          stock_qty?: number
          stock_walkin?: number
          vendor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          preparation_status: string
          price: number
          qty: number
          vendor_type: string | null
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          preparation_status?: string
          price: number
          qty: number
          vendor_type?: string | null
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          preparation_status?: string
          price?: number
          qty?: number
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          archived_at: string | null
          business_day: string | null
          code: string
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          note: string | null
          order_type: string
          payment_amount: number | null
          payment_meta: Json | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          payment_updated_at: string | null
          phone: string
          pickup_status: string
          pickup_time: string | null
          proof_url: string | null
          receipt_no: string
          total: number
          transfer_reference: string | null
        }
        Insert: {
          archived_at?: string | null
          business_day?: string | null
          code: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          note?: string | null
          order_type: string
          payment_amount?: number | null
          payment_meta?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_updated_at?: string | null
          phone: string
          pickup_status?: string
          pickup_time?: string | null
          proof_url?: string | null
          receipt_no: string
          total: number
          transfer_reference?: string | null
        }
        Update: {
          archived_at?: string | null
          business_day?: string | null
          code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          note?: string | null
          order_type?: string
          payment_amount?: number | null
          payment_meta?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_updated_at?: string | null
          phone?: string
          pickup_status?: string
          pickup_time?: string | null
          proof_url?: string | null
          receipt_no?: string
          total?: number
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_secrets: {
        Row: {
          id: string
          secrets: Json
          updated_at: string
        }
        Insert: {
          id: string
          secrets?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          secrets?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payout_snapshots: {
        Row: {
          business_day: string
          commission_percent: number
          cost_total: number
          created_at: string
          created_by: string | null
          gross_revenue: number
          id: string
          items_count: number
          orders_count: number
          payout_amount: number
          updated_at: string
          vendor_type: string
        }
        Insert: {
          business_day: string
          commission_percent?: number
          cost_total?: number
          created_at?: string
          created_by?: string | null
          gross_revenue?: number
          id?: string
          items_count?: number
          orders_count?: number
          payout_amount?: number
          updated_at?: string
          vendor_type: string
        }
        Update: {
          business_day?: string
          commission_percent?: number
          cost_total?: number
          created_at?: string
          created_by?: string | null
          gross_revenue?: number
          id?: string
          items_count?: number
          orders_count?: number
          payout_amount?: number
          updated_at?: string
          vendor_type?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      vendors: {
        Row: {
          active: boolean
          can_increase_stock: boolean
          can_manage_stock: boolean
          can_reallocate_stock: boolean
          can_reduce_stock: boolean
          can_update_preparation: boolean
          created_at: string
          display_label: string | null
          id: string
          last_login: string | null
          login_email: string | null
          updated_at: string
          user_id: string
          username: string
          vendor_type: string
        }
        Insert: {
          active?: boolean
          can_increase_stock?: boolean
          can_manage_stock?: boolean
          can_reallocate_stock?: boolean
          can_reduce_stock?: boolean
          can_update_preparation?: boolean
          created_at?: string
          display_label?: string | null
          id?: string
          last_login?: string | null
          login_email?: string | null
          updated_at?: string
          user_id: string
          username: string
          vendor_type: string
        }
        Update: {
          active?: boolean
          can_increase_stock?: boolean
          can_manage_stock?: boolean
          can_reallocate_stock?: boolean
          can_reduce_stock?: boolean
          can_update_preparation?: boolean
          created_at?: string
          display_label?: string | null
          id?: string
          last_login?: string | null
          login_email?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          vendor_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: { _item_id: string; _new_qty: number; _reason?: string }
        Returns: Json
      }
      adjust_stock_split: {
        Args: {
          _item_id: string
          _online: number
          _reason?: string
          _walkin: number
        }
        Returns: Json
      }
      apply_payment_result: {
        Args: {
          _amount: number
          _code: string
          _meta?: Json
          _provider: string
          _reference: string
          _status: string
        }
        Returns: Json
      }
      archive_category: { Args: { _id: string }; Returns: Json }
      archive_menu_item: { Args: { _id: string }; Returns: Json }
      attach_transfer_proof: {
        Args: { _code: string; _proof_url: string; _reference: string }
        Returns: Json
      }
      bulk_move_products: {
        Args: { _category_id?: string; _ids: string[]; _vendor_type?: string }
        Returns: Json
      }
      bulk_update_products: {
        Args: { _action: string; _ids: string[]; _value?: number }
        Returns: Json
      }
      close_business_day: {
        Args: { _day?: string; _note?: string }
        Returns: Json
      }
      create_cashier_sale: {
        Args: {
          _customer_name: string
          _items: Json
          _note: string
          _payment_method: string
        }
        Returns: Json
      }
      create_customer_order: {
        Args: {
          _customer_name: string
          _items: Json
          _note: string
          _order_type: string
          _phone: string
          _pickup_time?: string
        }
        Returns: {
          code: string
          created_at: string
          id: string
          pickup_time: string
          receipt_no: string
          total: number
        }[]
      }
      current_business_day: { Args: never; Returns: string }
      delete_category: { Args: { _id: string }; Returns: Json }
      delete_menu_item: { Args: { _id: string }; Returns: Json }
      duplicate_menu_item: { Args: { _id: string }; Returns: Json }
      finance_change_pin: {
        Args: { _current: string; _new: string }
        Returns: Json
      }
      finance_logout_all: { Args: never; Returns: Json }
      finance_session_valid: { Args: { _session_id: string }; Returns: boolean }
      finance_setup: {
        Args: { _email: string; _otp_enabled: boolean; _pin: string }
        Returns: Json
      }
      finance_status: { Args: never; Returns: Json }
      finance_unlock: { Args: { _pin: string }; Returns: Json }
      finance_update_settings: {
        Args: {
          _otp_enabled: boolean
          _recovery_email: string
          _timeout_minutes: number
        }
        Returns: Json
      }
      finance_verify_otp: {
        Args: { _code: string; _session_id: string }
        Returns: Json
      }
      get_order_by_code: { Args: { _code: string }; Returns: Json }
      get_orders_by_phone: { Args: { _phone: string }; Returns: Json }
      get_payment_secrets: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_day_closed: { Args: { _day?: string }; Returns: boolean }
      list_inventory_history: {
        Args: { _limit?: number; _vendor?: string }
        Returns: {
          changed_by: string | null
          changed_by_label: string | null
          created_at: string
          delta: number
          id: string
          item_name: string
          menu_item_id: string
          new_qty: number
          previous_qty: number
          reason: string | null
          source: string
          vendor_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventory_history"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_audit: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type?: string
        }
        Returns: string
      }
      reallocate_stock: {
        Args: { _delta_to_online: number; _item_id: string; _reason?: string }
        Returns: Json
      }
      reopen_business_day: { Args: { _day: string }; Returns: Json }
      reorder_bank_accounts: { Args: { _ids: string[] }; Returns: Json }
      reorder_categories: { Args: { _ids: string[] }; Returns: Json }
      restore_category: { Args: { _id: string }; Returns: Json }
      restore_menu_item: { Args: { _id: string }; Returns: Json }
      save_payment_secrets: { Args: { _data: Json }; Returns: Json }
      save_payout_snapshot: {
        Args: {
          _business_day: string
          _commission_percent: number
          _cost_total: number
          _gross_revenue: number
          _items_count: number
          _orders_count: number
          _payout_amount: number
          _vendor_type: string
        }
        Returns: Json
      }
      save_system_settings: { Args: { _data: Json }; Returns: Json }
      save_transfer_config: { Args: { _data: Json }; Returns: Json }
      set_product_cost: {
        Args: { _cost_price: number; _id: string }
        Returns: Json
      }
      upsert_category: {
        Args: { _id: string; _name: string; _sort_order?: number }
        Returns: Json
      }
      upsert_menu_item: {
        Args: {
          _available?: boolean
          _category_id: string
          _cost_price?: number
          _description?: string
          _id: string
          _image_url?: string
          _name: string
          _price: number
          _vendor_type: string
        }
        Returns: Json
      }
      vendor_can_manage_stock: { Args: { _user_id: string }; Returns: boolean }
      vendor_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      vendor_set_item_availability: {
        Args: { _available: boolean; _id: string }
        Returns: Json
      }
      vendor_set_low_stock_threshold: {
        Args: { _id: string; _threshold: number }
        Returns: Json
      }
      vendor_set_preparation_status: {
        Args: { _item_id: string; _status: string }
        Returns: Json
      }
      vendor_type_for_user: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "food_vendor"
        | "snacks_vendor"
        | "coffee_vendor"
        | "drinks_vendor"
        | "cashier"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "food_vendor",
        "snacks_vendor",
        "coffee_vendor",
        "drinks_vendor",
        "cashier",
      ],
    },
  },
} as const
