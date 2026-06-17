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
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_flat: number | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          max_discount: number | null
          min_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_flat?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_flat?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
        }
        Relationships: []
      }
      dishes: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          extra_images: Json | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_available: boolean
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
          category_id?: string | null
          created_at?: string
          description?: string | null
          extra_images?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
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
          category_id?: string | null
          created_at?: string
          description?: string | null
          extra_images?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
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
          created_at: string
          customer_id: string
          delivery_address: Json
          delivery_fee: number
          delivery_instructions: string | null
          discount: number
          id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          customer_id: string
          delivery_address: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
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
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      sellers: {
        Row: {
          address_line: string
          bank_details: Json | null
          business_hours: Json | null
          city: string
          cover_image_url: string | null
          created_at: string
          delivery_radius_km: number
          description: string | null
          email: string | null
          food_license_url: string | null
          id: string
          id_proof_url: string | null
          is_open: boolean
          kitchen_name: string
          latitude: number | null
          longitude: number | null
          phone: string
          pincode: string | null
          rating_avg: number
          rating_count: number
          status: Database["public"]["Enums"]["seller_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          bank_details?: Json | null
          business_hours?: Json | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          delivery_radius_km?: number
          description?: string | null
          email?: string | null
          food_license_url?: string | null
          id?: string
          id_proof_url?: string | null
          is_open?: boolean
          kitchen_name: string
          latitude?: number | null
          longitude?: number | null
          phone: string
          pincode?: string | null
          rating_avg?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["seller_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          bank_details?: Json | null
          business_hours?: Json | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          delivery_radius_km?: number
          description?: string | null
          email?: string | null
          food_license_url?: string | null
          id?: string
          id_proof_url?: string | null
          is_open?: boolean
          kitchen_name?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          pincode?: string | null
          rating_avg?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["seller_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_deliveries: {
        Row: {
          created_at: string
          day_number: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "customer"
      order_status:
        | "placed"
        | "accepted"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "rejected"
      payment_method: "cod" | "upi" | "card" | "wallet"
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
      app_role: ["admin", "seller", "customer"],
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
      payment_method: ["cod", "upi", "card", "wallet"],
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
