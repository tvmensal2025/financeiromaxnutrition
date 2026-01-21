-- Analytics and Tracking System Database Schema
-- This migration creates all tables, indexes, and constraints for the analytics system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- VISITORS TABLE
-- Tracks anonymous visitors to the MaxNutrition Financeiro website
-- ============================================================================
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID UNIQUE NOT NULL,
  session_id UUID NOT NULL,
  user_agent TEXT,
  ip_address_anonymized INET,
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  browser_version VARCHAR(20),
  os VARCHAR(50),
  os_version VARCHAR(20),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for visitors table
CREATE INDEX IF NOT EXISTS idx_visitors_session ON visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_visitors_first_seen ON visitors(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen_at);

-- ============================================================================
-- PAGE VIEWS TABLE
-- Tracks page views and navigation patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES visitors(visitor_id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  time_on_page_seconds INTEGER,
  scroll_depth_percent INTEGER CHECK (scroll_depth_percent >= 0 AND scroll_depth_percent <= 100),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for page_views table
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_url ON page_views(url);

-- ============================================================================
-- INTERACTIONS TABLE
-- Tracks clicks and user interactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES visitors(visitor_id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_url TEXT NOT NULL,
  element_type VARCHAR(50) NOT NULL,
  element_selector TEXT,
  element_text TEXT,
  position_x INTEGER,
  position_y INTEGER,
  context JSONB,
  interacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for interactions table
CREATE INDEX IF NOT EXISTS idx_interactions_visitor ON interactions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_interacted_at ON interactions(interacted_at);
CREATE INDEX IF NOT EXISTS idx_interactions_element_type ON interactions(element_type);

-- ============================================================================
-- FORM INTERACTIONS TABLE
-- Tracks form interactions and completion rates
-- ============================================================================
CREATE TABLE IF NOT EXISTS form_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES visitors(visitor_id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  form_id VARCHAR(100) NOT NULL,
  field_name VARCHAR(100),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('focus', 'blur', 'submit', 'abandon')),
  completion_time_seconds INTEGER,
  fields_filled_count INTEGER,
  abandonment_point VARCHAR(100),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for form_interactions table
CREATE INDEX IF NOT EXISTS idx_form_interactions_visitor ON form_interactions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_form_interactions_session ON form_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_form_interactions_form_id ON form_interactions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_interactions_event_type ON form_interactions(event_type);
CREATE INDEX IF NOT EXISTS idx_form_interactions_occurred_at ON form_interactions(occurred_at);

-- ============================================================================
-- USERS ANALYTICS TABLE
-- Tracks registered users and their subscription details
-- ============================================================================
CREATE TABLE IF NOT EXISTS users_analytics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  signup_date TIMESTAMPTZ NOT NULL,
  subscription_tier VARCHAR(50),
  subscription_status VARCHAR(20) CHECK (subscription_status IN ('active', 'inactive', 'churned', 'trial')),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for users_analytics table
CREATE INDEX IF NOT EXISTS idx_users_analytics_subscription_tier ON users_analytics(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_analytics_subscription_status ON users_analytics(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_analytics_signup_date ON users_analytics(signup_date);

-- ============================================================================
-- APP SESSIONS TABLE
-- Tracks mobile app sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(255),
  platform VARCHAR(20) CHECK (platform IN ('ios', 'android')),
  app_version VARCHAR(20),
  os_version VARCHAR(20),
  device_model VARCHAR(100),
  session_duration_seconds INTEGER,
  screens_viewed_count INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0,
  app_launch_time_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for app_sessions table
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_session_id ON app_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_started_at ON app_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_app_sessions_platform ON app_sessions(platform);

-- ============================================================================
-- APP EVENTS TABLE
-- Tracks application events and user actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES app_sessions(session_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  screen_name VARCHAR(100),
  previous_screen VARCHAR(100),
  properties JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for app_events table
CREATE INDEX IF NOT EXISTS idx_app_events_session ON app_events(session_id);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_event_type ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_event_name ON app_events(event_name);
CREATE INDEX IF NOT EXISTS idx_app_events_occurred_at ON app_events(occurred_at);

-- ============================================================================
-- AI USAGE TABLE
-- Tracks AI usage and associated costs
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  token_count INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ai_usage table
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_used_at ON ai_usage(used_at);

-- ============================================================================
-- CONVERSIONS TABLE
-- Tracks conversions from visitor to user to subscriber
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES visitors(visitor_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversion_type VARCHAR(50) NOT NULL CHECK (conversion_type IN ('download', 'install', 'activation', 'subscription')),
  platform VARCHAR(20),
  store VARCHAR(50),
  source VARCHAR(100),
  campaign VARCHAR(100),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  plan_name VARCHAR(100),
  billing_cycle VARCHAR(20),
  price_usd DECIMAL(10, 2),
  trial_start_date DATE,
  trial_end_date DATE,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for conversions table
CREATE INDEX IF NOT EXISTS idx_conversions_visitor ON conversions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversions_user ON conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_type ON conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON conversions(converted_at);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign ON conversions(campaign);

-- ============================================================================
-- TRANSACTIONS TABLE
-- Tracks revenue and financial transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('subscription', 'purchase', 'refund')),
  amount_usd DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- ============================================================================
-- MARKETING ATTRIBUTION TABLE
-- Tracks campaign attribution and performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketing_attribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES visitors(visitor_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  referrer TEXT,
  landing_page TEXT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for marketing_attribution table
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_visitor ON marketing_attribution(visitor_id);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_user ON marketing_attribution(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_campaign ON marketing_attribution(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_source ON marketing_attribution(utm_source);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_attributed_at ON marketing_attribution(attributed_at);

-- ============================================================================
-- RETENTION COHORTS TABLE
-- Tracks user retention and churn analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS retention_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL,
  active_day_7 BOOLEAN DEFAULT false,
  active_day_30 BOOLEAN DEFAULT false,
  active_day_90 BOOLEAN DEFAULT false,
  churn_date DATE,
  churn_reason TEXT,
  churn_risk_score INTEGER CHECK (churn_risk_score >= 0 AND churn_risk_score <= 100),
  retention_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for retention_cohorts table
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_user ON retention_cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_month ON retention_cohorts(cohort_month);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_churn_date ON retention_cohorts(churn_date);

-- ============================================================================
-- PRIVACY REQUESTS TABLE
-- Tracks GDPR/LGPD data export and deletion requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('export', 'delete')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for privacy_requests table
CREATE INDEX IF NOT EXISTS idx_privacy_requests_user ON privacy_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_requested_at ON privacy_requests(requested_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role has full access to visitors" ON visitors
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to page_views" ON page_views
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to interactions" ON interactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to form_interactions" ON form_interactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to users_analytics" ON users_analytics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to app_sessions" ON app_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to app_events" ON app_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to ai_usage" ON ai_usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to conversions" ON conversions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to transactions" ON transactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to marketing_attribution" ON marketing_attribution
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to retention_cohorts" ON retention_cohorts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to privacy_requests" ON privacy_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own analytics data
CREATE POLICY "Users can view their own analytics" ON users_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own privacy requests" ON privacy_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create privacy requests
CREATE POLICY "Users can create privacy requests" ON privacy_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE visitors IS 'Tracks anonymous visitors to the MaxNutrition Financeiro website';
COMMENT ON TABLE page_views IS 'Tracks page views and navigation patterns';
COMMENT ON TABLE interactions IS 'Tracks clicks and user interactions';
COMMENT ON TABLE form_interactions IS 'Tracks form interactions and completion rates';
COMMENT ON TABLE users_analytics IS 'Tracks registered users and subscription details';
COMMENT ON TABLE app_sessions IS 'Tracks mobile app sessions';
COMMENT ON TABLE app_events IS 'Tracks application events and user actions';
COMMENT ON TABLE ai_usage IS 'Tracks AI usage and associated costs';
COMMENT ON TABLE conversions IS 'Tracks conversions from visitor to user to subscriber';
COMMENT ON TABLE transactions IS 'Tracks revenue and financial transactions';
COMMENT ON TABLE marketing_attribution IS 'Tracks campaign attribution and performance';
COMMENT ON TABLE retention_cohorts IS 'Tracks user retention and churn analysis';
COMMENT ON TABLE privacy_requests IS 'Tracks GDPR/LGPD data export and deletion requests';
