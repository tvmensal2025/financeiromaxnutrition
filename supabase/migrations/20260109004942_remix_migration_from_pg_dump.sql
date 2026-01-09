CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
);


--
-- Name: conversation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_status AS ENUM (
    'pending',
    'inbox',
    'waiting',
    'finished'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'pending',
    'paid',
    'overdue',
    'cancelled'
);


--
-- Name: lead_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_status AS ENUM (
    'new',
    'contacted',
    'qualified',
    'unqualified',
    'converted'
);


--
-- Name: lead_temperature; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_temperature AS ENUM (
    'cold',
    'warm',
    'hot'
);


--
-- Name: message_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: opportunity_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.opportunity_stage AS ENUM (
    'prospecting',
    'qualification',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost'
);


--
-- Name: whatsapp_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.whatsapp_message_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_business_id UUID;
BEGIN
  -- Create a new business for the user
  INSERT INTO public.businesses (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Meu Negócio'),
    COALESCE(NEW.raw_user_meta_data ->> 'business_slug', 'negocio-' || SUBSTR(NEW.id::text, 1, 8))
  )
  RETURNING id INTO new_business_id;
  
  -- Create profile for the user
  INSERT INTO public.profiles (id, business_id, full_name, role)
  VALUES (
    NEW.id,
    new_business_id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'admin'
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone text NOT NULL,
    stage text DEFAULT 'idle'::text,
    pending_data jsonb DEFAULT '{}'::jsonb,
    last_intent text,
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_conversations_stage_check CHECK ((stage = ANY (ARRAY['idle'::text, 'collecting_name'::text, 'collecting_value'::text, 'collecting_category'::text, 'collecting_date'::text, 'collecting_status'::text, 'confirming'::text])))
);


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    admin_phone text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT false,
    auto_transcribe boolean DEFAULT true,
    auto_respond boolean DEFAULT true,
    greeting_style text DEFAULT 'friendly'::text,
    default_categories text[] DEFAULT ARRAY['Recebimentos'::text, 'Vendas'::text, 'Serviços'::text, 'Pagamentos'::text, 'Outros'::text],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_phones text[] DEFAULT '{}'::text[]
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    service_id uuid,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    status public.appointment_status DEFAULT 'scheduled'::public.appointment_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: broadcast_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broadcast_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    message text NOT NULL,
    media_url text,
    media_type text,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'draft'::text,
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT broadcast_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: broadcast_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broadcast_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    business_id uuid NOT NULL,
    phone text NOT NULL,
    name text,
    customer_id uuid,
    lead_id uuid,
    status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    error_message text,
    CONSTRAINT broadcast_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    primary_color text DEFAULT '#3B82F6'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    n8n_webhook_url text,
    reminder_days_before integer DEFAULT 3,
    low_credits_threshold integer DEFAULT 20,
    auto_reminders_enabled boolean DEFAULT false,
    evolution_instance text
);


--
-- Name: contact_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone text NOT NULL,
    customer_id uuid,
    lead_id uuid,
    content text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_tag_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_tag_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    whatsapp text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    interest_type text DEFAULT 'none'::text,
    interested_product_id uuid,
    interested_service_id uuid,
    interest_is_recurring boolean DEFAULT false,
    recurring_due_date date,
    recurring_message_time time without time zone DEFAULT '09:00:00'::time without time zone,
    recurring_reminder_days integer DEFAULT 3,
    recurring_message_type text DEFAULT 'both'::text,
    recurring_reminder_template text,
    recurring_overdue_template text
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid,
    service_id uuid,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid,
    subscription_id uuid,
    invoice_number text NOT NULL,
    status public.invoice_status DEFAULT 'pending'::public.invoice_status NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    whatsapp text,
    company text,
    source text,
    status public.lead_status DEFAULT 'new'::public.lead_status NOT NULL,
    temperature public.lead_temperature DEFAULT 'cold'::public.lead_temperature,
    notes text,
    converted_customer_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    interest_type text DEFAULT 'none'::text,
    interested_product_id uuid,
    interested_service_id uuid,
    interest_is_recurring boolean DEFAULT false,
    recurring_due_date date,
    recurring_message_time time without time zone DEFAULT '09:00:00'::time without time zone,
    recurring_reminder_days integer DEFAULT 3,
    recurring_message_type text DEFAULT 'both'::text,
    recurring_reminder_template text,
    recurring_overdue_template text
);


--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    emoji text DEFAULT '📝'::text,
    buttons jsonb DEFAULT '[]'::jsonb
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    subscription_id uuid,
    message_type text DEFAULT 'whatsapp'::text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid,
    lead_id uuid,
    title text NOT NULL,
    description text,
    stage public.opportunity_stage DEFAULT 'prospecting'::public.opportunity_stage NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    probability integer DEFAULT 50,
    expected_close_date date,
    closed_at timestamp with time zone,
    lost_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_method text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pinned_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pinned_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone text NOT NULL,
    pinned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    cost numeric(10,2) DEFAULT 0 NOT NULL,
    credits integer DEFAULT 1 NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    cost numeric DEFAULT 0 NOT NULL,
    sku text,
    stock integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    discount numeric DEFAULT 0
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    business_id uuid,
    full_name text,
    role text DEFAULT 'admin'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone text,
    customer_id uuid,
    lead_id uuid,
    title text NOT NULL,
    description text,
    remind_at timestamp with time zone NOT NULL,
    is_completed boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scheduled_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone text NOT NULL,
    message text NOT NULL,
    lead_id uuid,
    customer_id uuid,
    scheduled_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    is_recurring boolean DEFAULT false,
    recurrence_pattern text,
    recurrence_end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    duration_minutes integer DEFAULT 60,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    credits_used integer DEFAULT 0 NOT NULL,
    credits_total integer NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date NOT NULL,
    auto_renew boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid,
    invoice_id uuid,
    appointment_id uuid,
    source_message_id uuid,
    type text NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    category text DEFAULT 'Outros'::text,
    status text DEFAULT 'pending'::text,
    due_date date,
    transaction_date date DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_recurring boolean DEFAULT false,
    recurrence_pattern text,
    recurrence_interval integer DEFAULT 1,
    recurrence_end_date date,
    parent_transaction_id uuid,
    next_due_date date,
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text, 'paid'::text]))),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid,
    business_id uuid NOT NULL,
    event_type text,
    payload jsonb,
    response_status integer,
    response_body text,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    events text[] DEFAULT '{}'::text[],
    headers jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    secret_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhooks_type_check CHECK ((type = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    lead_id uuid,
    customer_id uuid,
    phone text NOT NULL,
    sender_name text,
    message text NOT NULL,
    direction public.message_direction DEFAULT 'inbound'::public.message_direction NOT NULL,
    media_url text,
    media_type text,
    status public.whatsapp_message_status DEFAULT 'pending'::public.whatsapp_message_status NOT NULL,
    external_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_group boolean DEFAULT false,
    group_name text,
    participant_phone text,
    sender_avatar_url text,
    participant_count integer DEFAULT 0,
    conversation_status public.conversation_status DEFAULT 'pending'::public.conversation_status,
    media_metadata jsonb,
    assigned_to uuid,
    transcribed_text text,
    transcription_error text
);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_business_id_key UNIQUE (business_id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: broadcast_campaigns broadcast_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_pkey PRIMARY KEY (id);


--
-- Name: broadcast_recipients broadcast_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: contact_notes contact_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_pkey PRIMARY KEY (id);


--
-- Name: conversation_tag_assignments conversation_tag_assignments_business_id_tag_id_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tag_assignments
    ADD CONSTRAINT conversation_tag_assignments_business_id_tag_id_phone_key UNIQUE (business_id, tag_id, phone);


--
-- Name: conversation_tag_assignments conversation_tag_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tag_assignments
    ADD CONSTRAINT conversation_tag_assignments_pkey PRIMARY KEY (id);


--
-- Name: conversation_tags conversation_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pinned_conversations pinned_conversations_business_id_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_conversations
    ADD CONSTRAINT pinned_conversations_business_id_phone_key UNIQUE (business_id, phone);


--
-- Name: pinned_conversations pinned_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_conversations
    ADD CONSTRAINT pinned_conversations_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: scheduled_messages scheduled_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_conversations_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conversations_business_id ON public.ai_conversations USING btree (business_id);


--
-- Name: idx_ai_conversations_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conversations_phone ON public.ai_conversations USING btree (phone);


--
-- Name: idx_broadcast_recipients_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_recipients_campaign ON public.broadcast_recipients USING btree (campaign_id);


--
-- Name: idx_broadcast_recipients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_recipients_status ON public.broadcast_recipients USING btree (status);


--
-- Name: idx_contact_notes_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_notes_business ON public.contact_notes USING btree (business_id);


--
-- Name: idx_contact_notes_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_notes_phone ON public.contact_notes USING btree (phone);


--
-- Name: idx_customers_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_recurring ON public.customers USING btree (interest_is_recurring, recurring_due_date) WHERE (interest_is_recurring = true);


--
-- Name: idx_reminders_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_business ON public.reminders USING btree (business_id);


--
-- Name: idx_reminders_remind_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_remind_at ON public.reminders USING btree (remind_at);


--
-- Name: idx_transactions_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_business_id ON public.transactions USING btree (business_id);


--
-- Name: idx_transactions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_customer_id ON public.transactions USING btree (customer_id);


--
-- Name: idx_transactions_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_recurring ON public.transactions USING btree (is_recurring, next_due_date) WHERE (is_recurring = true);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_transactions_transaction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_transaction_date ON public.transactions USING btree (transaction_date);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_webhook_logs_executed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_executed ON public.webhook_logs USING btree (executed_at DESC);


--
-- Name: idx_webhook_logs_webhook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_webhook ON public.webhook_logs USING btree (webhook_id);


--
-- Name: idx_whatsapp_messages_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_business_id ON public.whatsapp_messages USING btree (business_id);


--
-- Name: idx_whatsapp_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages USING btree (created_at DESC);


--
-- Name: idx_whatsapp_messages_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_lead_id ON public.whatsapp_messages USING btree (lead_id);


--
-- Name: idx_whatsapp_messages_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages USING btree (phone);


--
-- Name: ai_conversations update_ai_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_settings update_ai_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: broadcast_campaigns update_broadcast_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_broadcast_campaigns_updated_at BEFORE UPDATE ON public.broadcast_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: businesses update_businesses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_notes update_contact_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_notes_updated_at BEFORE UPDATE ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: message_templates update_message_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: opportunities update_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reminders update_reminders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scheduled_messages update_scheduled_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scheduled_messages_updated_at BEFORE UPDATE ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: webhooks update_webhooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_messages update_whatsapp_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON public.whatsapp_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_conversations ai_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ai_settings ai_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: broadcast_campaigns broadcast_campaigns_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: broadcast_campaigns broadcast_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: broadcast_recipients broadcast_recipients_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: broadcast_recipients broadcast_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE;


--
-- Name: broadcast_recipients broadcast_recipients_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: broadcast_recipients broadcast_recipients_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: contact_notes contact_notes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: contact_notes contact_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contact_notes contact_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: contact_notes contact_notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: conversation_tag_assignments conversation_tag_assignments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tag_assignments
    ADD CONSTRAINT conversation_tag_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: conversation_tag_assignments conversation_tag_assignments_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tag_assignments
    ADD CONSTRAINT conversation_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.conversation_tags(id) ON DELETE CASCADE;


--
-- Name: conversation_tags conversation_tags_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customers customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customers customers_interested_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_interested_product_id_fkey FOREIGN KEY (interested_product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: customers customers_interested_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_interested_service_id_fkey FOREIGN KEY (interested_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoice_items invoice_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: invoices invoices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: leads leads_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: leads leads_converted_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_customer_id_fkey FOREIGN KEY (converted_customer_id) REFERENCES public.customers(id);


--
-- Name: leads leads_interested_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_interested_product_id_fkey FOREIGN KEY (interested_product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: leads leads_interested_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_interested_service_id_fkey FOREIGN KEY (interested_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: message_templates message_templates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: messages messages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: messages messages_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: messages messages_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: opportunities opportunities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: payments payments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: pinned_conversations pinned_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_conversations
    ADD CONSTRAINT pinned_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: plans plans_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: products products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reminders reminders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: reminders reminders_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: scheduled_messages scheduled_messages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: scheduled_messages scheduled_messages_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: scheduled_messages scheduled_messages_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;


--
-- Name: transactions transactions_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_parent_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_parent_transaction_id_fkey FOREIGN KEY (parent_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;


--
-- Name: webhook_logs webhook_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: webhook_logs webhook_logs_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;


--
-- Name: webhooks webhooks_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: whatsapp_messages whatsapp_messages_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: whatsapp_messages whatsapp_messages_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: ai_conversations Service role can manage ai_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage ai_conversations" ON public.ai_conversations USING (true) WITH CHECK (true);


--
-- Name: message_templates Users can create templates for their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create templates for their business" ON public.message_templates FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: appointments Users can delete appointments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete appointments from their business" ON public.appointments FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_campaigns Users can delete campaigns from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete campaigns from their business" ON public.broadcast_campaigns FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: customers Users can delete customers from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete customers from their business" ON public.customers FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: invoice_items Users can delete invoice items from their invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete invoice items from their invoices" ON public.invoice_items FOR DELETE USING ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices
  WHERE (invoices.business_id IN ( SELECT profiles.business_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: invoices Users can delete invoices from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete invoices from their business" ON public.invoices FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: leads Users can delete leads from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete leads from their business" ON public.leads FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: contact_notes Users can delete notes from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete notes from their business" ON public.contact_notes FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: opportunities Users can delete opportunities from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete opportunities from their business" ON public.opportunities FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: payments Users can delete payments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete payments from their business" ON public.payments FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: pinned_conversations Users can delete pinned conversations from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete pinned conversations from their business" ON public.pinned_conversations FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: plans Users can delete plans from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete plans from their business" ON public.plans FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: products Users can delete products from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete products from their business" ON public.products FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_recipients Users can delete recipients from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete recipients from their business" ON public.broadcast_recipients FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: reminders Users can delete reminders from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete reminders from their business" ON public.reminders FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: scheduled_messages Users can delete scheduled messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete scheduled messages from their business" ON public.scheduled_messages FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: services Users can delete services from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete services from their business" ON public.services FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: subscriptions Users can delete subscriptions from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete subscriptions from their business" ON public.subscriptions FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tag_assignments Users can delete tag assignments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tag assignments from their business" ON public.conversation_tag_assignments FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tags Users can delete tags from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tags from their business" ON public.conversation_tags FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: message_templates Users can delete their business templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their business templates" ON public.message_templates FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: transactions Users can delete transactions of their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete transactions of their business" ON public.transactions FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhooks Users can delete webhooks from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete webhooks from their business" ON public.webhooks FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: whatsapp_messages Users can delete whatsapp messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete whatsapp messages from their business" ON public.whatsapp_messages FOR DELETE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: ai_settings Users can insert ai_settings for their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert ai_settings for their business" ON public.ai_settings FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: appointments Users can insert appointments to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert appointments to their business" ON public.appointments FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_campaigns Users can insert campaigns to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert campaigns to their business" ON public.broadcast_campaigns FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: customers Users can insert customers to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert customers to their business" ON public.customers FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: invoice_items Users can insert invoice items to their invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert invoice items to their invoices" ON public.invoice_items FOR INSERT WITH CHECK ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices
  WHERE (invoices.business_id IN ( SELECT profiles.business_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: invoices Users can insert invoices to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert invoices to their business" ON public.invoices FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: leads Users can insert leads to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert leads to their business" ON public.leads FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: messages Users can insert messages to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages to their business" ON public.messages FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: contact_notes Users can insert notes to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert notes to their business" ON public.contact_notes FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: opportunities Users can insert opportunities to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert opportunities to their business" ON public.opportunities FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: payments Users can insert payments to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert payments to their business" ON public.payments FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: pinned_conversations Users can insert pinned conversations to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert pinned conversations to their business" ON public.pinned_conversations FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: plans Users can insert plans to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert plans to their business" ON public.plans FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: products Users can insert products to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert products to their business" ON public.products FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_recipients Users can insert recipients to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert recipients to their business" ON public.broadcast_recipients FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: reminders Users can insert reminders to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert reminders to their business" ON public.reminders FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: scheduled_messages Users can insert scheduled messages to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert scheduled messages to their business" ON public.scheduled_messages FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: services Users can insert services to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert services to their business" ON public.services FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: subscriptions Users can insert subscriptions to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert subscriptions to their business" ON public.subscriptions FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tag_assignments Users can insert tag assignments to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tag assignments to their business" ON public.conversation_tag_assignments FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tags Users can insert tags to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tags to their business" ON public.conversation_tags FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: transactions Users can insert transactions for their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert transactions for their business" ON public.transactions FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhook_logs Users can insert webhook logs to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert webhook logs to their business" ON public.webhook_logs FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhooks Users can insert webhooks to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert webhooks to their business" ON public.webhooks FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: whatsapp_messages Users can insert whatsapp messages to their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert whatsapp messages to their business" ON public.whatsapp_messages FOR INSERT WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: ai_settings Users can update ai_settings of their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update ai_settings of their business" ON public.ai_settings FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: appointments Users can update appointments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update appointments from their business" ON public.appointments FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_campaigns Users can update campaigns from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update campaigns from their business" ON public.broadcast_campaigns FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: customers Users can update customers from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update customers from their business" ON public.customers FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: invoice_items Users can update invoice items from their invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update invoice items from their invoices" ON public.invoice_items FOR UPDATE USING ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices
  WHERE (invoices.business_id IN ( SELECT profiles.business_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: invoices Users can update invoices from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update invoices from their business" ON public.invoices FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: leads Users can update leads from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update leads from their business" ON public.leads FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: contact_notes Users can update notes from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update notes from their business" ON public.contact_notes FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: opportunities Users can update opportunities from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update opportunities from their business" ON public.opportunities FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: payments Users can update payments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update payments from their business" ON public.payments FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: plans Users can update plans from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update plans from their business" ON public.plans FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: products Users can update products from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update products from their business" ON public.products FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_recipients Users can update recipients from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recipients from their business" ON public.broadcast_recipients FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: reminders Users can update reminders from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update reminders from their business" ON public.reminders FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: scheduled_messages Users can update scheduled messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update scheduled messages from their business" ON public.scheduled_messages FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: services Users can update services from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update services from their business" ON public.services FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: subscriptions Users can update subscriptions from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update subscriptions from their business" ON public.subscriptions FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tags Users can update tags from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tags from their business" ON public.conversation_tags FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: message_templates Users can update their business templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their business templates" ON public.message_templates FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: businesses Users can update their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own business" ON public.businesses FOR UPDATE USING ((id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: transactions Users can update transactions of their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update transactions of their business" ON public.transactions FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhooks Users can update webhooks from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update webhooks from their business" ON public.webhooks FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: whatsapp_messages Users can update whatsapp messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update whatsapp messages from their business" ON public.whatsapp_messages FOR UPDATE USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: ai_settings Users can view ai_settings of their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ai_settings of their business" ON public.ai_settings FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: appointments Users can view appointments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view appointments from their business" ON public.appointments FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_campaigns Users can view campaigns from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaigns from their business" ON public.broadcast_campaigns FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: customers Users can view customers from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view customers from their business" ON public.customers FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: invoice_items Users can view invoice items from their invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invoice items from their invoices" ON public.invoice_items FOR SELECT USING ((invoice_id IN ( SELECT invoices.id
   FROM public.invoices
  WHERE (invoices.business_id IN ( SELECT profiles.business_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: invoices Users can view invoices from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invoices from their business" ON public.invoices FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: leads Users can view leads from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view leads from their business" ON public.leads FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: messages Users can view messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages from their business" ON public.messages FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: contact_notes Users can view notes from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view notes from their business" ON public.contact_notes FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: opportunities Users can view opportunities from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view opportunities from their business" ON public.opportunities FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: payments Users can view payments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payments from their business" ON public.payments FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: pinned_conversations Users can view pinned conversations from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view pinned conversations from their business" ON public.pinned_conversations FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: plans Users can view plans from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view plans from their business" ON public.plans FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: products Users can view products from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view products from their business" ON public.products FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: broadcast_recipients Users can view recipients from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recipients from their business" ON public.broadcast_recipients FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: reminders Users can view reminders from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reminders from their business" ON public.reminders FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: scheduled_messages Users can view scheduled messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view scheduled messages from their business" ON public.scheduled_messages FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: services Users can view services from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view services from their business" ON public.services FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: subscriptions Users can view subscriptions from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view subscriptions from their business" ON public.subscriptions FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tag_assignments Users can view tag assignments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tag assignments from their business" ON public.conversation_tag_assignments FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: conversation_tags Users can view tags from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tags from their business" ON public.conversation_tags FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: message_templates Users can view their business templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their business templates" ON public.message_templates FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: businesses Users can view their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own business" ON public.businesses FOR SELECT USING ((id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: transactions Users can view transactions of their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view transactions of their business" ON public.transactions FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhook_logs Users can view webhook logs from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view webhook logs from their business" ON public.webhook_logs FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: webhooks Users can view webhooks from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view webhooks from their business" ON public.webhooks FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: whatsapp_messages Users can view whatsapp messages from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view whatsapp messages from their business" ON public.whatsapp_messages FOR SELECT USING ((business_id IN ( SELECT profiles.business_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: broadcast_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: broadcast_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_tag_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_tag_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: message_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: pinned_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pinned_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;