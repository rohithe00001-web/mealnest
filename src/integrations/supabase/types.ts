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
      abuse_reports: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      achievements: {
        Row: {
          active: boolean
          description: string | null
          icon: string | null
          id: string
          metric: string
          name: string
          reward_coins: number
          threshold: number
        }
        Insert: {
          active?: boolean
          description?: string | null
          icon?: string | null
          id: string
          metric?: string
          name: string
          reward_coins?: number
          threshold?: number
        }
        Update: {
          active?: boolean
          description?: string | null
          icon?: string | null
          id?: string
          metric?: string
          name?: string
          reward_coins?: number
          threshold?: number
        }
        Relationships: []
      }
      addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          pincode: string | null
          user_id: string
        }
        Insert: {
          address_line: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          pincode?: string | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          pincode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_payroll: {
        Row: {
          agent_id: string
          computed_amount: number
          created_at: string
          id: string
          incentive_rules: Json
          month: string
          paid_amount: number
          per_order_rate: number
          salary_base: number
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          computed_amount?: number
          created_at?: string
          id?: string
          incentive_rules?: Json
          month: string
          paid_amount?: number
          per_order_rate?: number
          salary_base?: number
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          computed_amount?: number
          created_at?: string
          id?: string
          incentive_rules?: Json
          month?: string
          paid_amount?: number
          per_order_rate?: number
          salary_base?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_payroll_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_schedules: {
        Row: {
          active: boolean
          agent_id: string
          created_at: string
          id: string
          slot: string
          weekday: number
          zone_id: string | null
        }
        Insert: {
          active?: boolean
          agent_id: string
          created_at?: string
          id?: string
          slot: string
          weekday: number
          zone_id?: string | null
        }
        Update: {
          active?: boolean
          agent_id?: string
          created_at?: string
          id?: string
          slot?: string
          weekday?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_schedules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_schedules_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_redemptions: {
        Row: {
          campaign_id: string
          discount_amount: number
          id: string
          order_id: string | null
          order_total: number
          redeemed_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          redeemed_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_redemptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promotional_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_amount: number
          id: string
          order_id: string | null
          order_total: number
          redeemed_at: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          redeemed_at?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          redeemed_at?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          applies_to: string
          category_ids: string[] | null
          code: string
          created_at: string
          created_by: string | null
          cuisine_tags: string[] | null
          description: string | null
          discount_flat: number | null
          discount_percent: number | null
          discount_type: string
          expires_at: string | null
          festival_tag: string | null
          geo_pincodes: string[] | null
          id: string
          max_discount: number | null
          metadata: Json
          min_order: number
          new_customers_only: boolean
          scope: string
          seller_id: string | null
          starts_at: string | null
          subscription_plan_types: string[] | null
          updated_at: string
          usage_count: number
          usage_limit_per_user: number | null
          usage_limit_total: number | null
        }
        Insert: {
          active?: boolean
          applies_to?: string
          category_ids?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          cuisine_tags?: string[] | null
          description?: string | null
          discount_flat?: number | null
          discount_percent?: number | null
          discount_type?: string
          expires_at?: string | null
          festival_tag?: string | null
          geo_pincodes?: string[] | null
          id?: string
          max_discount?: number | null
          metadata?: Json
          min_order?: number
          new_customers_only?: boolean
          scope?: string
          seller_id?: string | null
          starts_at?: string | null
          subscription_plan_types?: string[] | null
          updated_at?: string
          usage_count?: number
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
        }
        Update: {
          active?: boolean
          applies_to?: string
          category_ids?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          cuisine_tags?: string[] | null
          description?: string | null
          discount_flat?: number | null
          discount_percent?: number | null
          discount_type?: string
          expires_at?: string | null
          festival_tag?: string | null
          geo_pincodes?: string[] | null
          id?: string
          max_discount?: number | null
          metadata?: Json
          min_order?: number
          new_customers_only?: boolean
          scope?: string
          seller_id?: string | null
          starts_at?: string | null
          subscription_plan_types?: string[] | null
          updated_at?: string
          usage_count?: number
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_agents: {
        Row: {
          aadhaar_number: string | null
          active: boolean
          admin_approved_at: string | null
          background_check_passed: boolean
          created_at: string
          delivery_count: number
          email: string | null
          full_name: string
          id: string
          id_doc_url: string | null
          license_doc_url: string | null
          license_number: string | null
          phone: string
          rating_avg: number
          rejected_reason: string | null
          seller_approved_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["delivery_agent_status"]
          updated_at: string
          user_id: string
          vehicle_doc_url: string | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          active?: boolean
          admin_approved_at?: string | null
          background_check_passed?: boolean
          created_at?: string
          delivery_count?: number
          email?: string | null
          full_name: string
          id?: string
          id_doc_url?: string | null
          license_doc_url?: string | null
          license_number?: string | null
          phone: string
          rating_avg?: number
          rejected_reason?: string | null
          seller_approved_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["delivery_agent_status"]
          updated_at?: string
          user_id: string
          vehicle_doc_url?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          active?: boolean
          admin_approved_at?: string | null
          background_check_passed?: boolean
          created_at?: string
          delivery_count?: number
          email?: string | null
          full_name?: string
          id?: string
          id_doc_url?: string | null
          license_doc_url?: string | null
          license_number?: string | null
          phone?: string
          rating_avg?: number
          rejected_reason?: string | null
          seller_approved_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["delivery_agent_status"]
          updated_at?: string
          user_id?: string
          vehicle_doc_url?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_agents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          agent_id: string | null
          assigned_at: string
          created_at: string
          current_lat: number | null
          current_lng: number | null
          customer_feedback: string | null
          customer_id: string
          customer_rating: number | null
          delivered_at: string | null
          failed_reason: string | null
          id: string
          last_location_at: string | null
          notes: string | null
          order_id: string | null
          otp: string
          picked_up_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["delivery_assignment_status"]
          subscription_delivery_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          assigned_at?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          customer_feedback?: string | null
          customer_id: string
          customer_rating?: number | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          last_location_at?: string | null
          notes?: string | null
          order_id?: string | null
          otp?: string
          picked_up_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          subscription_delivery_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          assigned_at?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          customer_feedback?: string | null
          customer_id?: string
          customer_rating?: number | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          last_location_at?: string | null
          notes?: string | null
          order_id?: string | null
          otp?: string
          picked_up_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          subscription_delivery_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_subscription_delivery_id_fkey"
            columns: ["subscription_delivery_id"]
            isOneToOne: false
            referencedRelation: "subscription_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          admin_approved: boolean
          admin_approved_at: string | null
          created_at: string
          id: string
          name: string
          pincode: string
          radius_km: number
          rejected_reason: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean
          admin_approved_at?: string | null
          created_at?: string
          id?: string
          name: string
          pincode: string
          radius_km?: number
          rejected_reason?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean
          admin_approved_at?: string | null
          created_at?: string
          id?: string
          name?: string
          pincode?: string
          radius_km?: number
          rejected_reason?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      device_accounts: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          device_id: string
          id: string
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_id: string
          id?: string
          is_primary?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_id?: string
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          device_id: string | null
          id: string
          ip: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          device_id?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          device_id?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_audit_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fraud_events: {
        Row: {
          created_at: string
          details: Json | null
          device_id: string | null
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          device_id?: string | null
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          device_id?: string | null
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_fraud_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_override_requests: {
        Row: {
          contact: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          device_id: string | null
          fingerprint: string
          id: string
          reason: string
          requesting_email: string
          status: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          device_id?: string | null
          fingerprint: string
          id?: string
          reason: string
          requesting_email: string
          status?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          device_id?: string | null
          fingerprint?: string
          id?: string
          reason?: string
          requesting_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_override_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          created_at: string
          device_id: string
          id: string
          ip: string | null
          last_active_at: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          ip?: string | null
          last_active_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          ip?: string | null
          last_active_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_transfer_requests: {
        Row: {
          created_at: string
          expires_at: string
          from_device_id: string | null
          id: string
          otp_hash: string
          status: string
          to_device_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          from_device_id?: string | null
          id?: string
          otp_hash: string
          status?: string
          to_device_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          from_device_id?: string | null
          id?: string
          otp_hash?: string
          status?: string
          to_device_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_transfer_requests_from_device_id_fkey"
            columns: ["from_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_transfer_requests_to_device_id_fkey"
            columns: ["to_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          blacklisted: boolean
          created_at: string
          fingerprint: string
          first_seen_at: string
          id: string
          last_ip: string | null
          last_seen_at: string
          name: string | null
          notes: string | null
          platform: string | null
          risk_level: string
          risk_score: number
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          blacklisted?: boolean
          created_at?: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string
          name?: string | null
          notes?: string | null
          platform?: string | null
          risk_level?: string
          risk_score?: number
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          blacklisted?: boolean
          created_at?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_ip?: string | null
          last_seen_at?: string
          name?: string | null
          notes?: string | null
          platform?: string | null
          risk_level?: string
          risk_score?: number
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      dishes: {
        Row: {
          badge: Database["public"]["Enums"]["dish_badge"] | null
          category_id: string | null
          created_at: string
          description: string | null
          extra_images: Json | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_available: boolean
          is_featured: boolean
          is_veg: boolean
          name: string
          prep_time_min: number
          price: number
          rating_avg: number
          rating_count: number
          seller_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          badge?: Database["public"]["Enums"]["dish_badge"] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          extra_images?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_veg?: boolean
          name: string
          prep_time_min?: number
          price: number
          rating_avg?: number
          rating_count?: number
          seller_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          badge?: Database["public"]["Enums"]["dish_badge"] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          extra_images?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_veg?: boolean
          name?: string
          prep_time_min?: number
          price?: number
          rating_avg?: number
          rating_count?: number
          seller_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          coins_balance: number
          created_at: string
          current_streak: number
          last_order_date: string | null
          lifetime_coins: number
          longest_streak: number
          total_orders: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins_balance?: number
          created_at?: string
          current_streak?: number
          last_order_date?: string | null
          lifetime_coins?: number
          longest_streak?: number
          total_orders?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins_balance?: number
          created_at?: string
          current_streak?: number
          last_order_date?: string | null
          lifetime_coins?: number
          longest_streak?: number
          total_orders?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          delta: number
          description: string | null
          id: string
          kind: string
          metadata: Json
          order_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          description?: string | null
          id?: string
          kind: string
          metadata?: Json
          order_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          description?: string | null
          id?: string
          kind?: string
          metadata?: Json
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mystery_rewards: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          coupon_code: string | null
          created_at: string
          id: string
          milestone: number
          prize_kind: string
          prize_value: number
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          milestone: number
          prize_kind: string
          prize_value?: number
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          id?: string
          milestone?: number
          prize_kind?: string
          prize_value?: number
          user_id?: string
        }
        Relationships: []
      }
      mystery_wheel_segments: {
        Row: {
          active: boolean
          applies_to: string
          color: string
          coupon_expires_days: number
          coupon_max_discount: number | null
          coupon_min_order: number
          coupon_stackable: boolean
          created_at: string
          id: string
          label: string
          probability_weight: number
          reward_type: string
          reward_value: number
          sort_order: number
          wheel_id: string
        }
        Insert: {
          active?: boolean
          applies_to?: string
          color?: string
          coupon_expires_days?: number
          coupon_max_discount?: number | null
          coupon_min_order?: number
          coupon_stackable?: boolean
          created_at?: string
          id?: string
          label: string
          probability_weight?: number
          reward_type: string
          reward_value?: number
          sort_order?: number
          wheel_id: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          color?: string
          coupon_expires_days?: number
          coupon_max_discount?: number | null
          coupon_min_order?: number
          coupon_stackable?: boolean
          created_at?: string
          id?: string
          label?: string
          probability_weight?: number
          reward_type?: string
          reward_value?: number
          sort_order?: number
          wheel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_wheel_segments_wheel_id_fkey"
            columns: ["wheel_id"]
            isOneToOne: false
            referencedRelation: "mystery_wheels"
            referencedColumns: ["id"]
          },
        ]
      }
      mystery_wheels: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          min_purchase_amount: number
          name: string
          require_login: boolean
          require_order: boolean
          require_referral: boolean
          require_subscription: boolean
          scope: string
          seller_id: string | null
          spins_per_day: number
          spins_per_month: number
          spins_per_week: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          min_purchase_amount?: number
          name: string
          require_login?: boolean
          require_order?: boolean
          require_referral?: boolean
          require_subscription?: boolean
          scope?: string
          seller_id?: string | null
          spins_per_day?: number
          spins_per_month?: number
          spins_per_week?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          min_purchase_amount?: number
          name?: string
          require_login?: boolean
          require_order?: boolean
          require_referral?: boolean
          require_subscription?: boolean
          scope?: string
          seller_id?: string | null
          spins_per_day?: number
          spins_per_month?: number
          spins_per_week?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_wheels_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          dish_id: string
          dish_image_url: string | null
          dish_name: string
          id: string
          line_total: number
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          dish_id: string
          dish_image_url?: string | null
          dish_name: string
          id?: string
          line_total: number
          order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          dish_id?: string
          dish_image_url?: string | null
          dish_name?: string
          id?: string
          line_total?: number
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
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
          address_id: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string
          delivery_address: Json
          delivery_agent_id: string | null
          delivery_fee: number
          delivery_instructions: string | null
          delivery_status: string | null
          discount: number
          id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id: string
          delivery_address: Json
          delivery_agent_id?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_status?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: Json
          delivery_agent_id?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_status?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: boolean
          online_payments_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          online_payments_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          online_payments_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anniversary: string | null
          avatar_url: string | null
          country_code: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          last_login_at: string | null
          login_method: string | null
          phone: string | null
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          anniversary?: string | null
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id: string
          is_blocked?: boolean
          last_login_at?: string | null
          login_method?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          anniversary?: string | null
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          last_login_at?: string | null
          login_method?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      promotional_campaigns: {
        Row: {
          active: boolean
          audience_limit: number | null
          banner_image: string | null
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          ends_at: string | null
          featured: boolean
          id: string
          max_discount: number | null
          min_order: number | null
          name: string
          scope: string
          seller_id: string | null
          starts_at: string
          type: string
          updated_at: string
          used_count: number
        }
        Insert: {
          active?: boolean
          audience_limit?: number | null
          banner_image?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          ends_at?: string | null
          featured?: boolean
          id?: string
          max_discount?: number | null
          min_order?: number | null
          name: string
          scope?: string
          seller_id?: string | null
          starts_at?: string
          type: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          active?: boolean
          audience_limit?: number | null
          banner_image?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          ends_at?: string | null
          featured?: boolean
          id?: string
          max_discount?: number | null
          min_order?: number | null
          name?: string
          scope?: string
          seller_id?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotional_campaigns_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_campaigns: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          expiry_days: number
          fraud_device_check: boolean
          fraud_duplicate_account: boolean
          fraud_ip_validation: boolean
          fraud_multi_referral: boolean
          fraud_self_block: boolean
          id: string
          max_uses_per_referrer: number
          min_order_amount: number
          name: string
          referred_reward_type: string
          referred_reward_value: number
          referrer_reward_type: string
          referrer_reward_value: number
          reward_trigger: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          expiry_days?: number
          fraud_device_check?: boolean
          fraud_duplicate_account?: boolean
          fraud_ip_validation?: boolean
          fraud_multi_referral?: boolean
          fraud_self_block?: boolean
          id?: string
          max_uses_per_referrer?: number
          min_order_amount?: number
          name: string
          referred_reward_type?: string
          referred_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          reward_trigger?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          expiry_days?: number
          fraud_device_check?: boolean
          fraud_duplicate_account?: boolean
          fraud_ip_validation?: boolean
          fraud_multi_referral?: boolean
          fraud_self_block?: boolean
          id?: string
          max_uses_per_referrer?: number
          min_order_amount?: number
          name?: string
          referred_reward_type?: string
          referred_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          reward_trigger?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_fraud_events: {
        Row: {
          created_at: string
          details: Json | null
          device_fingerprint: string | null
          id: string
          ip: string | null
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip?: string | null
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip?: string | null
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          device_fingerprint: string | null
          id: string
          referred_id: string
          referrer_id: string
          reward_coins: number
          rewarded_at: string | null
          signup_ip: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          code: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          referred_id: string
          referrer_id: string
          reward_coins?: number
          rewarded_at?: string | null
          signup_ip?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_coins?: number
          rewarded_at?: string | null
          signup_ip?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          dish_id: string | null
          id: string
          order_id: string | null
          rating: number
          seller_id: string
          seller_reply: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          dish_id?: string | null
          id?: string
          order_id?: string | null
          rating: number
          seller_id: string
          seller_reply?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          dish_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          seller_id?: string
          seller_reply?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claim_attempts: {
        Row: {
          action: string
          created_at: string
          id: string
          reason: string | null
          success: boolean
          target_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          reason?: string | null
          success: boolean
          target_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          reason?: string | null
          success?: boolean
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rewards_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: []
      }
      seller_sponsorships: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          kind: string
          seller_id: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind: string
          seller_id: string
          starts_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          seller_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_sponsorships_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          address_line: string
          bank_details: Json | null
          banner_url: string | null
          business_hours: Json | null
          city: string
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_radius_km: number
          description: string | null
          email: string | null
          food_license_url: string | null
          gallery: Json
          id: string
          id_proof_url: string | null
          is_open: boolean
          kitchen_name: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          phone: string
          pincode: string | null
          prep_time_min_avg: number
          rating_avg: number
          rating_count: number
          slug: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["seller_status"]
          story: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          bank_details?: Json | null
          banner_url?: string | null
          business_hours?: Json | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_radius_km?: number
          description?: string | null
          email?: string | null
          food_license_url?: string | null
          gallery?: Json
          id?: string
          id_proof_url?: string | null
          is_open?: boolean
          kitchen_name: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          phone: string
          pincode?: string | null
          prep_time_min_avg?: number
          rating_avg?: number
          rating_count?: number
          slug?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["seller_status"]
          story?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          bank_details?: Json | null
          banner_url?: string | null
          business_hours?: Json | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_radius_km?: number
          description?: string | null
          email?: string | null
          food_license_url?: string | null
          gallery?: Json
          id?: string
          id_proof_url?: string | null
          is_open?: boolean
          kitchen_name?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          phone?: string
          pincode?: string | null
          prep_time_min_avg?: number
          rating_avg?: number
          rating_count?: number
          slug?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["seller_status"]
          story?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spin_wheel_spins: {
        Row: {
          coupon_code: string | null
          created_at: string
          id: string
          prize_kind: string
          prize_value: number
          segment_id: string | null
          spin_date: string
          user_id: string
          wheel_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          id?: string
          prize_kind: string
          prize_value?: number
          segment_id?: string | null
          spin_date?: string
          user_id: string
          wheel_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          id?: string
          prize_kind?: string
          prize_value?: number
          segment_id?: string | null
          spin_date?: string
          user_id?: string
          wheel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spin_wheel_spins_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "mystery_wheel_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spin_wheel_spins_wheel_id_fkey"
            columns: ["wheel_id"]
            isOneToOne: false
            referencedRelation: "mystery_wheels"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_deliveries: {
        Row: {
          created_at: string
          day_number: number
          delivery_agent_id: string | null
          delivery_status: string | null
          id: string
          meals: Json
          scheduled_date: string
          seller_id: string
          status: Database["public"]["Enums"]["subscription_delivery_status"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          delivery_agent_id?: string | null
          delivery_status?: string | null
          id?: string
          meals?: Json
          scheduled_date: string
          seller_id: string
          status?: Database["public"]["Enums"]["subscription_delivery_status"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          delivery_agent_id?: string | null
          delivery_status?: string | null
          id?: string
          meals?: Json
          scheduled_date?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["subscription_delivery_status"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_deliveries_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_deliveries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_days: {
        Row: {
          breakfast_desc: string | null
          breakfast_name: string | null
          calories: number | null
          carbs_g: number | null
          created_at: string
          day_number: number
          dinner_desc: string | null
          dinner_name: string | null
          fat_g: number | null
          id: string
          is_veg: boolean
          lunch_desc: string | null
          lunch_name: string | null
          plan_id: string
          protein_g: number | null
        }
        Insert: {
          breakfast_desc?: string | null
          breakfast_name?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          day_number: number
          dinner_desc?: string | null
          dinner_name?: string | null
          fat_g?: number | null
          id?: string
          is_veg?: boolean
          lunch_desc?: string | null
          lunch_name?: string | null
          plan_id: string
          protein_g?: number | null
        }
        Update: {
          breakfast_desc?: string | null
          breakfast_name?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          day_number?: number
          dinner_desc?: string | null
          dinner_name?: string | null
          fat_g?: number | null
          id?: string
          is_veg?: boolean
          lunch_desc?: string | null
          lunch_name?: string | null
          plan_id?: string
          protein_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          cuisines: string[]
          description: string | null
          duration_days: number
          id: string
          image_url: string | null
          is_active: boolean
          is_veg: boolean
          meal_types: string[]
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_person: number
          rating_avg: number
          rating_count: number
          seller_id: string
          status: Database["public"]["Enums"]["subscription_plan_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuisines?: string[]
          description?: string | null
          duration_days: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_veg?: boolean
          meal_types?: string[]
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_person: number
          rating_avg?: number
          rating_count?: number
          seller_id: string
          status?: Database["public"]["Enums"]["subscription_plan_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuisines?: string[]
          description?: string | null
          duration_days?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_veg?: boolean
          meal_types?: string[]
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          price_per_person?: number
          rating_avg?: number
          rating_count?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["subscription_plan_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          address_id: string | null
          created_at: string
          customer_id: string
          customizations: Json
          delivery_address: Json
          delivery_slot: string
          end_date: string
          extension_days: number
          id: string
          meal_selection: Database["public"]["Enums"]["subscription_meal_selection"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          people_count: number
          plan_id: string
          seller_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          customer_id: string
          customizations?: Json
          delivery_address: Json
          delivery_slot?: string
          end_date: string
          extension_days?: number
          id?: string
          meal_selection?: Database["public"]["Enums"]["subscription_meal_selection"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          people_count?: number
          plan_id: string
          seller_id: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          created_at?: string
          customer_id?: string
          customizations?: Json
          delivery_address?: Json
          delivery_slot?: string
          end_date?: string
          extension_days?: number
          id?: string
          meal_selection?: Database["public"]["Enums"]["subscription_meal_selection"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          people_count?: number
          plan_id?: string
          seller_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_referral_codes: {
        Row: {
          code: string
          created_at: string
          device_fingerprint: string | null
          signup_ip: string | null
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          device_fingerprint?: string | null
          signup_ip?: string | null
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          device_fingerprint?: string | null
          signup_ip?: string | null
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          dish_id: string | null
          id: string
          seller_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id?: string | null
          id?: string
          seller_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string | null
          id?: string
          seller_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_decide_override: {
        Args: { _admin: string; _approve: boolean; _id: string }
        Returns: undefined
      }
      admin_get_seller: {
        Args: { _seller_id: string }
        Returns: {
          address_line: string
          bank_details: Json | null
          banner_url: string | null
          business_hours: Json | null
          city: string
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_radius_km: number
          description: string | null
          email: string | null
          food_license_url: string | null
          gallery: Json
          id: string
          id_proof_url: string | null
          is_open: boolean
          kitchen_name: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          phone: string
          pincode: string | null
          prep_time_min_avg: number
          rating_avg: number
          rating_count: number
          slug: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["seller_status"]
          story: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sellers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_referral_code: {
        Args: { _code: string; _user: string }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      apply_referral_code_v2: {
        Args: { _code: string; _device?: string; _ip?: string; _user: string }
        Returns: {
          reason: string
          success: boolean
        }[]
      }
      check_device_signup: {
        Args: { _fingerprint: string; _role: string }
        Returns: {
          allowed: boolean
          device_id: string
          reason: string
        }[]
      }
      claim_mystery_reward: {
        Args: { _id: string; _user: string }
        Returns: {
          coupon_code: string
          prize_kind: string
          prize_value: number
          reason: string
          success: boolean
        }[]
      }
      complete_device_transfer: {
        Args: { _otp: string; _to_device: string; _user: string }
        Returns: boolean
      }
      ensure_loyalty_account: { Args: { _user: string }; Returns: undefined }
      get_agent_seller_contact: {
        Args: { _agent_id: string }
        Returns: {
          kitchen_name: string
          phone: string
          seller_id: string
        }[]
      }
      get_agent_sensitive: {
        Args: { _agent_id: string }
        Returns: {
          aadhaar_number: string
          id: string
          id_doc_url: string
          license_doc_url: string
          license_number: string
          vehicle_doc_url: string
        }[]
      }
      get_my_assignment_otp: {
        Args: { _assignment_id: string }
        Returns: string
      }
      get_my_seller_record: {
        Args: never
        Returns: {
          address_line: string
          bank_details: Json | null
          banner_url: string | null
          business_hours: Json | null
          city: string
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_radius_km: number
          description: string | null
          email: string | null
          food_license_url: string | null
          gallery: Json
          id: string
          id_proof_url: string | null
          is_open: boolean
          kitchen_name: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          phone: string
          pincode: string | null
          prep_time_min_avg: number
          rating_avg: number
          rating_count: number
          slug: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["seller_status"]
          story: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sellers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_online_payments_enabled: { Args: never; Returns: boolean }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_device_account: {
        Args: {
          _device: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      list_active_coupons_safe: {
        Args: { _seller_id: string }
        Returns: {
          applies_to: string
          code: string
          description: string
          discount_flat: number
          discount_percent: number
          discount_type: string
          expires_at: string
          festival_tag: string
          id: string
          max_discount: number
          min_order: number
          scope: string
          seller_id: string
          starts_at: string
        }[]
      }
      log_rewards_audit: {
        Args: {
          _action: string
          _admin: string
          _entity_id: string
          _entity_type: string
          _new: Json
          _previous: Json
        }
        Returns: undefined
      }
      recompute_device_risk: { Args: { _device: string }; Returns: undefined }
      record_abuse: {
        Args: {
          _details: Json
          _kind: string
          _severity: string
          _user: string
        }
        Returns: undefined
      }
      redeem_coins_for_coupon: {
        Args: { _coins: number; _user: string }
        Returns: {
          code: string
          discount: number
          reason: string
          success: boolean
        }[]
      }
      redeem_coupon: {
        Args: {
          _code: string
          _kind: string
          _order_id: string
          _order_total: number
          _seller: string
          _subscription_id: string
          _user: string
        }
        Returns: {
          discount: number
          discount_type: string
          reason: string
          success: boolean
        }[]
      }
      register_device: {
        Args: {
          _fingerprint: string
          _ip: string
          _platform: string
          _ua: string
        }
        Returns: string
      }
      request_device_override: {
        Args: {
          _contact: string
          _email: string
          _fingerprint: string
          _reason: string
        }
        Returns: string
      }
      set_online_payments_enabled: {
        Args: { _enabled: boolean }
        Returns: boolean
      }
      skip_my_subscription_delivery: {
        Args: { _delivery_id: string }
        Returns: boolean
      }
      spin_wheel: {
        Args: { _user: string }
        Returns: {
          coupon_code: string
          prize_kind: string
          prize_value: number
          reason: string
        }[]
      }
      spin_wheel_v2: {
        Args: { _user: string; _wheel?: string }
        Returns: {
          coupon_code: string
          prize_kind: string
          prize_value: number
          reason: string
          segment_label: string
          wheel_id: string
        }[]
      }
      start_device_transfer: {
        Args: { _to_device: string; _user: string }
        Returns: string
      }
      validate_assignment_otp: {
        Args: { _assignment_id: string; _otp: string }
        Returns: boolean
      }
      validate_coupon: {
        Args: {
          _code: string
          _kind?: string
          _order_total: number
          _seller: string
          _user: string
        }
        Returns: {
          coupon_id: string
          discount: number
          discount_type: string
          reason: string
          valid: boolean
        }[]
      }
      validate_wheel_probabilities: {
        Args: { _wheel: string }
        Returns: {
          reason: string
          total: number
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "customer" | "delivery_agent"
      delivery_agent_status:
        | "pending_seller"
        | "pending_admin"
        | "approved"
        | "rejected"
        | "suspended"
      delivery_assignment_status:
        | "assigned"
        | "picked_up"
        | "delivered"
        | "failed"
        | "cancelled"
      dish_badge: "best_seller" | "chef_special" | "recommended" | "new"
      order_status:
        | "placed"
        | "accepted"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "rejected"
      payment_method: "cod" | "upi" | "card" | "wallet" | "razorpay"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      seller_status: "pending" | "approved" | "rejected" | "suspended"
      subscription_delivery_status:
        | "scheduled"
        | "skipped"
        | "delivered"
        | "paused"
      subscription_meal_selection:
        | "breakfast_only"
        | "lunch_only"
        | "dinner_only"
        | "breakfast_lunch"
        | "lunch_dinner"
        | "full_day"
      subscription_plan_status: "draft" | "pending" | "approved" | "rejected"
      subscription_plan_type: "weekly" | "half_month" | "monthly"
      subscription_status: "active" | "paused" | "completed" | "cancelled"
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
      app_role: ["admin", "seller", "customer", "delivery_agent"],
      delivery_agent_status: [
        "pending_seller",
        "pending_admin",
        "approved",
        "rejected",
        "suspended",
      ],
      delivery_assignment_status: [
        "assigned",
        "picked_up",
        "delivered",
        "failed",
        "cancelled",
      ],
      dish_badge: ["best_seller", "chef_special", "recommended", "new"],
      order_status: [
        "placed",
        "accepted",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
      ],
      payment_method: ["cod", "upi", "card", "wallet", "razorpay"],
      payment_status: ["pending", "paid", "refunded", "failed"],
      seller_status: ["pending", "approved", "rejected", "suspended"],
      subscription_delivery_status: [
        "scheduled",
        "skipped",
        "delivered",
        "paused",
      ],
      subscription_meal_selection: [
        "breakfast_only",
        "lunch_only",
        "dinner_only",
        "breakfast_lunch",
        "lunch_dinner",
        "full_day",
      ],
      subscription_plan_status: ["draft", "pending", "approved", "rejected"],
      subscription_plan_type: ["weekly", "half_month", "monthly"],
      subscription_status: ["active", "paused", "completed", "cancelled"],
    },
  },
} as const
