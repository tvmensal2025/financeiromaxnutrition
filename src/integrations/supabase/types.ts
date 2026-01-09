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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          business_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_intent: string | null
          pending_data: Json | null
          phone: string
          stage: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_intent?: string | null
          pending_data?: Json | null
          phone: string
          stage?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_intent?: string | null
          pending_data?: Json | null
          phone?: string
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          admin_phone: string
          admin_phones: string[] | null
          auto_respond: boolean | null
          auto_transcribe: boolean | null
          business_id: string
          created_at: string
          default_categories: string[] | null
          enabled: boolean | null
          greeting_style: string | null
          id: string
          updated_at: string
        }
        Insert: {
          admin_phone?: string
          admin_phones?: string[] | null
          auto_respond?: boolean | null
          auto_transcribe?: boolean | null
          business_id: string
          created_at?: string
          default_categories?: string[] | null
          enabled?: boolean | null
          greeting_style?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          admin_phone?: string
          admin_phones?: string[] | null
          auto_respond?: boolean | null
          auto_transcribe?: boolean | null
          business_id?: string
          created_at?: string
          default_categories?: string[] | null
          enabled?: boolean | null
          greeting_style?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          duration_minutes: number | null
          id: string
          notes: string | null
          scheduled_at: string
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          scheduled_at: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          scheduled_at?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_campaigns: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          failed_count: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          name: string
          scheduled_at: string | null
          sent_count: number | null
          status: string | null
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          name: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          business_id: string
          campaign_id: string
          customer_id: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          name: string | null
          phone: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          business_id: string
          campaign_id: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          business_id?: string
          campaign_id?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          auto_reminders_enabled: boolean | null
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance: string | null
          id: string
          logo_url: string | null
          low_credits_threshold: number | null
          n8n_webhook_url: string | null
          name: string
          primary_color: string | null
          reminder_days_before: number | null
          slug: string
          updated_at: string
          whatsapp_connected_at: string | null
          whatsapp_phone: string | null
          whatsapp_status: string | null
        }
        Insert: {
          auto_reminders_enabled?: boolean | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          logo_url?: string | null
          low_credits_threshold?: number | null
          n8n_webhook_url?: string | null
          name: string
          primary_color?: string | null
          reminder_days_before?: number | null
          slug: string
          updated_at?: string
          whatsapp_connected_at?: string | null
          whatsapp_phone?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          auto_reminders_enabled?: boolean | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          logo_url?: string | null
          low_credits_threshold?: number | null
          n8n_webhook_url?: string | null
          name?: string
          primary_color?: string | null
          reminder_days_before?: number | null
          slug?: string
          updated_at?: string
          whatsapp_connected_at?: string | null
          whatsapp_phone?: string | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          business_id: string
          content: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          lead_id: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_taxas: {
        Row: {
          business_id: string
          created_at: string
          descricao: string
          fornecedor_id: string
          id: string
          status_pagamento: string
          updated_at: string
          valor: number
        }
        Insert: {
          business_id: string
          created_at?: string
          descricao: string
          fornecedor_id: string
          id?: string
          status_pagamento?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          descricao?: string
          fornecedor_id?: string
          id?: string
          status_pagamento?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_taxas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_taxas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tag_assignments: {
        Row: {
          business_id: string
          created_at: string
          id: string
          phone: string
          tag_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          phone: string
          tag_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          phone?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tag_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          business_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          birth_date: string | null
          business_id: string
          city: string | null
          created_at: string
          current_weight_kg: number | null
          email: string | null
          fitness_level: string | null
          gender: string | null
          height_cm: number | null
          id: string
          interest_is_recurring: boolean | null
          interest_type: string | null
          interested_product_id: string | null
          interested_service_id: string | null
          lead_data: Json | null
          name: string
          notes: string | null
          phone: string | null
          points: number | null
          recurring_due_date: string | null
          recurring_message_time: string | null
          recurring_message_type: string | null
          recurring_overdue_template: string | null
          recurring_reminder_days: number | null
          recurring_reminder_template: string | null
          source: string | null
          state: string | null
          target_weight_kg: number | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          current_weight_kg?: number | null
          email?: string | null
          fitness_level?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          interest_is_recurring?: boolean | null
          interest_type?: string | null
          interested_product_id?: string | null
          interested_service_id?: string | null
          lead_data?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          points?: number | null
          recurring_due_date?: string | null
          recurring_message_time?: string | null
          recurring_message_type?: string | null
          recurring_overdue_template?: string | null
          recurring_reminder_days?: number | null
          recurring_reminder_template?: string | null
          source?: string | null
          state?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          current_weight_kg?: number | null
          email?: string | null
          fitness_level?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          interest_is_recurring?: boolean | null
          interest_type?: string | null
          interested_product_id?: string | null
          interested_service_id?: string | null
          lead_data?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          points?: number | null
          recurring_due_date?: string | null
          recurring_message_time?: string | null
          recurring_message_type?: string | null
          recurring_overdue_template?: string | null
          recurring_reminder_days?: number | null
          recurring_reminder_template?: string | null
          source?: string | null
          state?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_interested_product_id_fkey"
            columns: ["interested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_interested_service_id_fkey"
            columns: ["interested_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          business_id: string
          cep: string | null
          cidade: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_fornecedor: string
          observacoes: string | null
          telefone: string | null
          tipo_fornecedor: string
          updated_at: string
        }
        Insert: {
          business_id: string
          cep?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fornecedor: string
          observacoes?: string | null
          telefone?: string | null
          tipo_fornecedor?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          cep?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fornecedor?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_fornecedor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          service_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          discount: number
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          opportunity_id: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          discount?: number
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          opportunity_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          opportunity_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          avatar_url: string | null
          business_id: string
          company: string | null
          converted_customer_id: string | null
          created_at: string
          email: string | null
          id: string
          interest_is_recurring: boolean | null
          interest_type: string | null
          interested_product_id: string | null
          interested_service_id: string | null
          name: string
          notes: string | null
          phone: string | null
          recurring_due_date: string | null
          recurring_message_time: string | null
          recurring_message_type: string | null
          recurring_overdue_template: string | null
          recurring_reminder_days: number | null
          recurring_reminder_template: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          temperature: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          company?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_is_recurring?: boolean | null
          interest_type?: string | null
          interested_product_id?: string | null
          interested_service_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          recurring_due_date?: string | null
          recurring_message_time?: string | null
          recurring_message_type?: string | null
          recurring_overdue_template?: string | null
          recurring_reminder_days?: number | null
          recurring_reminder_template?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          company?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_is_recurring?: boolean | null
          interest_type?: string | null
          interested_product_id?: string | null
          interested_service_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          recurring_due_date?: string | null
          recurring_message_time?: string | null
          recurring_message_type?: string | null
          recurring_overdue_template?: string | null
          recurring_reminder_days?: number | null
          recurring_reminder_template?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_product_id_fkey"
            columns: ["interested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_service_id_fkey"
            columns: ["interested_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_externos: {
        Row: {
          activity_level: string | null
          birth_date: string | null
          city: string | null
          conversion_date: string | null
          converted: boolean | null
          current_weight_kg: number | null
          email: string | null
          event_type: string | null
          external_user_id: string | null
          first_name: string | null
          fitness_level: string | null
          full_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          points: number | null
          raw_payload: Json | null
          received_at: string | null
          signup_date: string | null
          source: string
          stage: string | null
          state: string | null
          target_weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          birth_date?: string | null
          city?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          current_weight_kg?: number | null
          email?: string | null
          event_type?: string | null
          external_user_id?: string | null
          first_name?: string | null
          fitness_level?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          points?: number | null
          raw_payload?: Json | null
          received_at?: string | null
          signup_date?: string | null
          source?: string
          stage?: string | null
          state?: string | null
          target_weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          birth_date?: string | null
          city?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          current_weight_kg?: number | null
          email?: string | null
          event_type?: string | null
          external_user_id?: string | null
          first_name?: string | null
          fitness_level?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          points?: number | null
          raw_payload?: Json | null
          received_at?: string | null
          signup_date?: string | null
          source?: string
          stage?: string | null
          state?: string | null
          target_weight_kg?: number | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          business_id: string
          buttons: Json | null
          content: string
          created_at: string
          emoji: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          buttons?: Json | null
          content: string
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          buttons?: Json | null
          content?: string
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          business_id: string
          content: string
          created_at: string
          customer_id: string
          id: string
          message_type: string
          sent_at: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          customer_id: string
          id?: string
          message_type?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          message_type?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          business_id: string
          closed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          business_id: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          business_id?: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_fornecedor: {
        Row: {
          business_id: string
          contrato_taxa_id: string | null
          created_at: string
          data_pagamento: string
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          produto_servico_id: string | null
          quantidade_liberada: number | null
          valor_pago: number
        }
        Insert: {
          business_id: string
          contrato_taxa_id?: string | null
          created_at?: string
          data_pagamento?: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          produto_servico_id?: string | null
          quantidade_liberada?: number | null
          valor_pago: number
        }
        Update: {
          business_id?: string
          contrato_taxa_id?: string | null
          created_at?: string
          data_pagamento?: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          produto_servico_id?: string | null
          quantidade_liberada?: number | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_fornecedor_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fornecedor_contrato_taxa_id_fkey"
            columns: ["contrato_taxa_id"]
            isOneToOne: false
            referencedRelation: "contratos_taxas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fornecedor_produto_servico_id_fkey"
            columns: ["produto_servico_id"]
            isOneToOne: false
            referencedRelation: "produtos_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_conversations: {
        Row: {
          business_id: string
          id: string
          phone: string
          pinned_at: string
        }
        Insert: {
          business_id: string
          id?: string
          phone: string
          pinned_at?: string
        }
        Update: {
          business_id?: string
          id?: string
          phone?: string
          pinned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          business_id: string
          cost: number
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          business_id: string
          cost?: number
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          business_id?: string
          cost?: number
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          cost: number
          created_at: string
          description: string | null
          discount: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          sku: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          cost?: number
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          cost?: number
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_servicos: {
        Row: {
          business_id: string
          categoria: string
          condicao_pagamento: string | null
          created_at: string
          descricao: string | null
          fornecedor_id: string
          id: string
          nome_item: string
          quantidade: number
          quantidade_estoque: number
          quantidade_paga: number
          status_pagamento: string
          updated_at: string
          valor_pago: number
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          business_id: string
          categoria?: string
          condicao_pagamento?: string | null
          created_at?: string
          descricao?: string | null
          fornecedor_id: string
          id?: string
          nome_item: string
          quantidade?: number
          quantidade_estoque?: number
          quantidade_paga?: number
          status_pagamento?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          business_id?: string
          categoria?: string
          condicao_pagamento?: string | null
          created_at?: string
          descricao?: string | null
          fornecedor_id?: string
          id?: string
          nome_item?: string
          quantidade?: number
          quantidade_estoque?: number
          quantidade_paga?: number
          status_pagamento?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "produtos_servicos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_servicos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          lead_id: string | null
          phone: string | null
          remind_at: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          lead_id?: string | null
          phone?: string | null
          remind_at: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          lead_id?: string | null
          phone?: string | null
          remind_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          id: string
          is_recurring: boolean | null
          lead_id: string | null
          message: string
          phone: string
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_recurring?: boolean | null
          lead_id?: string | null
          message: string
          phone: string
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_recurring?: boolean | null
          lead_id?: string | null
          message?: string
          phone?: string
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          business_id: string
          created_at: string
          credits_total: number
          credits_used: number
          customer_id: string
          discount: number
          end_date: string
          id: string
          plan_id: string
          quantity: number
          start_date: string
          status: string
          subtotal: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          business_id: string
          created_at?: string
          credits_total: number
          credits_used?: number
          customer_id: string
          discount?: number
          end_date: string
          id?: string
          plan_id: string
          quantity?: number
          start_date?: string
          status?: string
          subtotal?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          business_id?: string
          created_at?: string
          credits_total?: number
          credits_used?: number
          customer_id?: string
          discount?: number
          end_date?: string
          id?: string
          plan_id?: string
          quantity?: number
          start_date?: string
          status?: string
          subtotal?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          business_id: string
          category: string | null
          created_at: string
          customer_id: string | null
          description: string
          due_date: string | null
          id: string
          invoice_id: string | null
          is_recurring: boolean | null
          next_due_date: string | null
          notes: string | null
          parent_transaction_id: string | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_pattern: string | null
          source_message_id: string | null
          status: string | null
          transaction_date: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          business_id: string
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          is_recurring?: boolean | null
          next_due_date?: string | null
          notes?: string | null
          parent_transaction_id?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          source_message_id?: string | null
          status?: string | null
          transaction_date?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          business_id?: string
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          is_recurring?: boolean | null
          next_due_date?: string | null
          notes?: string | null
          parent_transaction_id?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          source_message_id?: string | null
          status?: string | null
          transaction_date?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          business_id: string
          event_type: string | null
          executed_at: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          webhook_id: string | null
        }
        Insert: {
          business_id: string
          event_type?: string | null
          executed_at?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Update: {
          business_id?: string
          event_type?: string | null
          executed_at?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          business_id: string
          created_at: string
          events: string[] | null
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          secret_key: string | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          business_id: string
          created_at?: string
          events?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          secret_key?: string | null
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          business_id?: string
          created_at?: string
          events?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          secret_key?: string | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          business_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          assigned_to: string | null
          business_id: string
          conversation_status:
            | Database["public"]["Enums"]["conversation_status"]
            | null
          created_at: string
          customer_id: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          group_name: string | null
          id: string
          is_group: boolean | null
          lead_id: string | null
          media_metadata: Json | null
          media_type: string | null
          media_url: string | null
          message: string
          participant_count: number | null
          participant_phone: string | null
          phone: string
          sender_avatar_url: string | null
          sender_name: string | null
          status: Database["public"]["Enums"]["whatsapp_message_status"]
          transcribed_text: string | null
          transcription_error: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          conversation_status?:
            | Database["public"]["Enums"]["conversation_status"]
            | null
          created_at?: string
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          lead_id?: string | null
          media_metadata?: Json | null
          media_type?: string | null
          media_url?: string | null
          message: string
          participant_count?: number | null
          participant_phone?: string | null
          phone: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          transcribed_text?: string | null
          transcription_error?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          conversation_status?:
            | Database["public"]["Enums"]["conversation_status"]
            | null
          created_at?: string
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          lead_id?: string | null
          media_metadata?: Json | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          participant_count?: number | null
          participant_phone?: string | null
          phone?: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          transcribed_text?: string | null
          transcription_error?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      conversation_status: "pending" | "inbox" | "waiting" | "finished"
      invoice_status: "draft" | "pending" | "paid" | "overdue" | "cancelled"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "unqualified"
        | "converted"
      lead_temperature: "cold" | "warm" | "hot"
      message_direction: "inbound" | "outbound"
      opportunity_stage:
        | "prospecting"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      whatsapp_message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
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
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      conversation_status: ["pending", "inbox", "waiting", "finished"],
      invoice_status: ["draft", "pending", "paid", "overdue", "cancelled"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "unqualified",
        "converted",
      ],
      lead_temperature: ["cold", "warm", "hot"],
      message_direction: ["inbound", "outbound"],
      opportunity_stage: [
        "prospecting",
        "qualification",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      whatsapp_message_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
    },
  },
} as const
