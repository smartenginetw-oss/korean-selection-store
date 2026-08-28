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
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          minimum_subtotal: number
          starts_at: string | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          minimum_subtotal?: number
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          minimum_subtotal?: number
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      operating_expenses: {
        Row: {
          advertising_cost: number
          created_at: string
          created_by: string | null
          id: string
          notes: string
          other_cost: number
          packaging_cost: number
          period_month: string
          rent_cost: number
          shipping_cost: number
          updated_at: string
        }
        Insert: {
          advertising_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          other_cost?: number
          packaging_cost?: number
          period_month: string
          rent_cost?: number
          shipping_cost?: number
          updated_at?: string
        }
        Update: {
          advertising_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          other_cost?: number
          packaging_cost?: number
          period_month?: string
          rent_cost?: number
          shipping_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operating_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          coupon_code: string | null
          coupon_id: string | null
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
          shipping_method: string
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
          coupon_code?: string | null
          coupon_id?: string | null
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
          shipping_method?: string
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
          coupon_code?: string | null
          coupon_id?: string | null
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
          shipping_method?: string
          shipping_total?: number
          stock_mode?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
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
          payment_info: Json
          payment_method: string
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
          payment_info?: Json
          payment_method?: string
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
          payment_info?: Json
          payment_method?: string
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
          allocated_ad_cost: number
          allocated_other_cost: number
          allocated_packaging_cost: number
          allocated_rent_cost: number
          allocated_shipping_cost: number
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
          allocated_ad_cost?: number
          allocated_other_cost?: number
          allocated_packaging_cost?: number
          allocated_rent_cost?: number
          allocated_shipping_cost?: number
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
          allocated_ad_cost?: number
          allocated_other_cost?: number
          allocated_packaging_cost?: number
          allocated_rent_cost?: number
          allocated_shipping_cost?: number
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
      store_settings: {
        Row: {
          cvs_711_fee: number
          cvs_family_fee: number
          brand_name: string
          facebook_url: string | null
          instagram_url: string | null
          line_official_url: string | null
          preorder_enabled: boolean
          reservation_minutes: number
          shipping_fee: number
          support_email: string
          threads_url: string | null
          updated_at: string
          updated_by: string | null
          id: boolean
        }
        Insert: {
          cvs_711_fee?: number
          cvs_family_fee?: number
          brand_name?: string
          facebook_url?: string | null
          instagram_url?: string | null
          line_official_url?: string | null
          preorder_enabled?: boolean
          reservation_minutes?: number
          shipping_fee?: number
          support_email?: string
          threads_url?: string | null
          updated_at?: string
          updated_by?: string | null
          id?: boolean
        }
        Update: {
          cvs_711_fee?: number
          cvs_family_fee?: number
          brand_name?: string
          facebook_url?: string | null
          instagram_url?: string | null
          line_official_url?: string | null
          preorder_enabled?: boolean
          reservation_minutes?: number
          shipping_fee?: number
          support_email?: string
          threads_url?: string | null
          updated_at?: string
          updated_by?: string | null
          id?: boolean
        }
        Relationships: []
      }
      store_pages: {
        Row: {
          body: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      store_home_collections: {
        Row: {
          created_at: string
          description: string
          eyebrow: string
          href: string
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: string
          tone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          eyebrow: string
          href: string
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title: string
          tone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          eyebrow?: string
          href?: string
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_name: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          kakao: string | null
          line: string | null
          name: string
          note: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          kakao?: string | null
          line?: string | null
          name: string
          note?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          kakao?: string | null
          line?: string | null
          name?: string
          note?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_quotations: {
        Row: {
          created_at: string
          currency: string
          exchange_rate: number
          id: string
          note: string | null
          quote_date: string
          quote_number: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          exchange_rate?: number
          id?: string
          note?: string | null
          quote_date?: string
          quote_number: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          exchange_rate?: number
          id?: string
          note?: string | null
          quote_date?: string
          quote_number?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotation_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          moq: number
          product_id: string | null
          product_name: string
          quantity: number
          quotation_id: string
          sku: string | null
          total_cost: number
          unit_cost: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          moq?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          quotation_id: string
          sku?: string | null
          unit_cost: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          moq?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          quotation_id?: string
          sku?: string | null
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          currency: string
          exchange_rate: number
          expected_date: string | null
          id: string
          note: string | null
          ordered_date: string
          other_cost: number
          po_number: string
          quotation_id: string | null
          shipping_cost: number
          status: string
          subtotal: number
          supplier_id: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          note?: string | null
          ordered_date?: string
          other_cost?: number
          po_number: string
          quotation_id?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          supplier_id: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          note?: string | null
          ordered_date?: string
          other_cost?: number
          po_number?: string
          quotation_id?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          product_id: string | null
          product_name: string
          purchase_order_id: string
          quantity: number
          sku: string | null
          total_cost: number
          unit_cost: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          product_name: string
          purchase_order_id: string
          quantity?: number
          sku?: string | null
          unit_cost: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          sku?: string | null
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_receipts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          purchase_order_id: string
          receipt_number: string
          received_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          purchase_order_id: string
          receipt_number: string
          received_date?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          purchase_order_id?: string
          receipt_number?: string
          received_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_receipt_items: {
        Row: {
          created_at: string
          id: string
          product_name: string
          purchase_order_item_id: string
          quantity_received: number
          damaged_quantity: number
          receipt_id: string
          sku: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          purchase_order_item_id: string
          quantity_received: number
          damaged_quantity?: number
          receipt_id: string
          sku?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          purchase_order_item_id?: string
          quantity_received?: number
          damaged_quantity?: number
          receipt_id?: string
          sku?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          address_line: string | null
          carrier: string | null
          city: string | null
          created_at: string
          district: string | null
          delivered_at: string | null
          id: string
          order_id: string
          postal_code: string | null
          provider: string
          recipient_name: string | null
          recipient_phone: string | null
          shipped_at: string | null
          shipping_fee: number
          shipping_method: string
          store_address: string | null
          store_code: string | null
          store_name: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          delivered_at?: string | null
          id?: string
          order_id: string
          postal_code?: string | null
          provider?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          shipping_method?: string
          store_address?: string | null
          store_code?: string | null
          store_name?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          carrier?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          delivered_at?: string | null
          id?: string
          order_id?: string
          postal_code?: string | null
          provider?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          shipped_at?: string | null
          shipping_fee?: number
          shipping_method?: string
          store_address?: string | null
          store_code?: string | null
          store_name?: string | null
          status?: string
          tracking_number?: string | null
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
      update_admin_product: {
        Args: { p_product_id: string; p_payload: Json }
        Returns: Json
      }
      update_admin_product_tags: {
        Args: { p_product_id: string; p_tags: string[] | null }
        Returns: Json
      }
      update_admin_product_details: {
        Args: { p_product_id: string; p_payload: Json }
        Returns: Json
      }
      update_admin_product_financials: {
        Args: { p_product_id: string; p_payload: Json }
        Returns: Json
      }
      set_admin_product_status: {
        Args: { p_product_id: string; p_status: string }
        Returns: Json
      }
      delete_admin_product: {
        Args: { p_product_id: string }
        Returns: Json
      }
      get_public_variant_availability: {
        Args: { p_variant_ids: string[] }
        Returns: {
          variant_id: string
          is_available: boolean
        }[]
      }
      get_public_best_sellers: {
        Args: { p_limit?: number }
        Returns: {
          product_id: string
          sold_quantity: number
        }[]
      }
      upsert_admin_operating_expense: {
        Args: { p_payload: Json }
        Returns: Json
      }
      adjust_admin_inventory: {
        Args: { p_low_stock_threshold: number; p_on_hand: number; p_reason: string; p_variant_id: string }
        Returns: Json
      }
      update_admin_order_fulfillment: {
        Args: { p_payload: Json }
        Returns: Json
      }
      update_admin_order_shipment: {
        Args: { p_payload: Json }
        Returns: Json
      }
      refund_admin_order: {
        Args: { p_order_id: string; p_refund_amount: number | null; p_reason: string | null }
        Returns: Json
      }
      create_checkout_order: {
        Args: { p_idempotency_key: string; p_payload: Json }
        Returns: Json
      }
      create_checkout_order_for_member: {
        Args: { p_idempotency_key: string; p_payload: Json; p_profile_id: string | null }
        Returns: Json
      }
      create_ecpay_checkout_order_for_member: {
        Args: { p_idempotency_key: string; p_payload: Json; p_profile_id: string | null }
        Returns: Json
      }
      record_ecpay_payment_callback: {
        Args: {
          p_merchant_trade_no: string
          p_payment_date: string | null
          p_payment_type: string | null
          p_rtn_code: string
          p_rtn_msg: string | null
          p_trade_amt: number
          p_trade_no: string | null
        }
        Returns: Json
      }
      preview_coupon_discount: {
        Args: { p_payload: Json }
        Returns: Json
      }
      get_store_settings: {
        Args: Record<string, never>
        Returns: Json
      }
      list_backoffice_users: {
        Args: Record<string, never>
        Returns: Json
      }
      set_staff_member: {
        Args: { p_email: string; p_role: string }
        Returns: Json
      }
      receive_purchase_order: {
        Args: {
          p_items: Json
          p_note: string | null
          p_purchase_order_id: string
          p_received_date: string
          p_receipt_number: string
        }
        Returns: Json
      }
      update_purchase_order_status: {
        Args: { p_purchase_order_id: string; p_status: string }
        Returns: Json
      }
      update_supplier_quotation_status: {
        Args: { p_quotation_id: string; p_status: string }
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
