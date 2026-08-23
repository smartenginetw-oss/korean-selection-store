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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          district: string
          id: string
          is_default: boolean
          phone: string
          postal_code: string
          profile_id: string
          recipient_name: string
          updated_at: string
        }
        Insert: {
          address_line: string
          city: string
          created_at?: string
          district: string
          id?: string
          is_default?: boolean
          phone: string
          postal_code: string
          profile_id: string
          recipient_name: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          phone?: string
          postal_code?: string
          profile_id?: string
          recipient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          changed_fields: string[]
          created_at: string
          id: string
          ip_hash: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          ip_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          ip_hash?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          created_at: string
          document_version: string
          granted: boolean
          id: string
          order_id: string | null
          profile_id: string | null
          source: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          document_version: string
          granted: boolean
          id?: string
          order_id?: string | null
          profile_id?: string | null
          source: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          document_version?: string
          granted?: boolean
          id?: string
          order_id?: string | null
          profile_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          low_stock_threshold: number
          on_hand: number
          reserved: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          admin_user_id: string | null
          balance_after: number
          created_at: string
          id: string
          idempotency_key: string
          order_id: string | null
          quantity_delta: number
          reason: string | null
          type: string
          variant_id: string
        }
        Insert: {
          admin_user_id?: string | null
          balance_after: number
          created_at?: string
          id?: string
          idempotency_key: string
          order_id?: string | null
          quantity_delta: number
          reason?: string | null
          type: string
          variant_id: string
        }
        Update: {
          admin_user_id?: string | null
          balance_after?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string | null
          quantity_delta?: number
          reason?: string | null
          type?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          committed_at: string | null
          created_at: string
          expires_at: string
          id: string
          order_id: string
          quantity: number
          released_at: string | null
          status: string
          variant_id: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          quantity: number
          released_at?: string | null
          status?: string
          variant_id: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          quantity?: number
          released_at?: string | null
          status?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          fulfillment_mode: string
          id: string
          image_path: string | null
          line_total: number
          order_id: string
          preorder_available_at: string | null
          product_id: string | null
          product_name: string
          quantity: number
          selected_options: Json
          sku: string
          unit_cost: number | null
          unit_price: number
          variant_id: string | null
          variant_name: string
        }
        Insert: {
          created_at?: string
          fulfillment_mode: string
          id?: string
          image_path?: string | null
          line_total: number
          order_id: string
          preorder_available_at?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          selected_options?: Json
          sku: string
          unit_cost?: number | null
          unit_price: number
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          created_at?: string
          fulfillment_mode?: string
          id?: string
          image_path?: string | null
          line_total?: number
          order_id?: string
          preorder_available_at?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_options?: Json
          sku?: string
          unit_cost?: number | null
          unit_price?: number
          variant_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          order_id: string
          to_status: string | null
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id: string
          to_status?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string
          cancelled_at: string | null
          city: string
          completed_at: string | null
          created_at: string
          currency: string
          customer_note: string | null
          discount_total: number
          district: string
          email: string
          fulfillment_status: string
          grand_total: number
          id: string
          lookup_token_hash: string | null
          order_number: string
          order_status: string
          payment_status: string
          phone: string
          placed_at: string
          postal_code: string
          profile_id: string | null
          recipient_name: string
          shipping_total: number
          stock_mode: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          address_line: string
          cancelled_at?: string | null
          city: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_note?: string | null
          discount_total?: number
          district: string
          email: string
          fulfillment_status?: string
          grand_total: number
          id?: string
          lookup_token_hash?: string | null
          order_number: string
          order_status?: string
          payment_status?: string
          phone: string
          placed_at?: string
          postal_code: string
          profile_id?: string | null
          recipient_name: string
          shipping_total?: number
          stock_mode: string
          subtotal: number
          updated_at?: string
        }
        Update: {
          address_line?: string
          cancelled_at?: string | null
          city?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_note?: string | null
          discount_total?: number
          district?: string
          email?: string
          fulfillment_status?: string
          grand_total?: number
          id?: string
          lookup_token_hash?: string | null
          order_number?: string
          order_status?: string
          payment_status?: string
          phone?: string
          placed_at?: string
          postal_code?: string
          profile_id?: string | null
          recipient_name?: string
          shipping_total?: number
          stock_mode?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          processing_status: string
          provider_event_id: string
          signature_valid: boolean
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id: string
          signature_valid?: boolean
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string | null
          refunded_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          paid_at?: string | null
          provider: string
          provider_payment_id?: string | null
          refunded_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          refunded_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          option_id: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          position?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          cost_override: number | null
          created_at: string
          fulfillment_mode: string
          id: string
          preorder_available_at: string | null
          preorder_limit: number | null
          price_override: number | null
          product_id: string
          sku: string
          status: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          cost_override?: number | null
          created_at?: string
          fulfillment_mode: string
          id?: string
          preorder_available_at?: string | null
          preorder_limit?: number | null
          price_override?: number | null
          product_id: string
          sku: string
          status?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          cost_override?: number | null
          created_at?: string
          fulfillment_mode?: string
          id?: string
          preorder_available_at?: string | null
          preorder_limit?: number | null
          price_override?: number | null
          product_id?: string
          sku?: string
          status?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          care_instructions: string | null
          cost_price: number | null
          created_at: string
          description: string
          id: string
          material: string | null
          model_info: string | null
          name: string
          origin: string | null
          original_price: number | null
          published_at: string | null
          sale_price: number
          size_guide: string | null
          slug: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          care_instructions?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          material?: string | null
          model_info?: string | null
          name: string
          origin?: string | null
          original_price?: number | null
          published_at?: string | null
          sale_price: number
          size_guide?: string | null
          slug: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          care_instructions?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          material?: string | null
          model_info?: string | null
          name?: string
          origin?: string | null
          original_price?: number | null
          published_at?: string | null
          sale_price?: number
          size_guide?: string | null
          slug?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: string
          tracking_number: string
          updated_at: string
        }
        Insert: {
          carrier: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: string
          tracking_number: string
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      variant_option_values: {
        Row: {
          created_at: string
          option_value_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          option_value_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          option_value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_option_values_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_admin_product: {
        Args: { p_payload: Json }
        Returns: Json
      }
      update_admin_order_fulfillment: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_checkout_order: {
        Args: { p_idempotency_key: string; p_payload: Json }
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
    Enums: {},
  },
} as const
