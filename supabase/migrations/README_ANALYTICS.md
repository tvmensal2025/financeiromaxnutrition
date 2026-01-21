# Analytics Tracking System - Database Migration

## Overview

This migration creates the complete database schema for the Analytics and Tracking System. It includes 13 tables with proper indexes, foreign key constraints, and Row Level Security (RLS) policies.

## Tables Created

### 1. **visitors**
- Tracks anonymous visitors to the MaxNutrition Financeiro website
- Stores visitor_id, session_id, device info, location
- Retention: 180 days

### 2. **page_views**
- Tracks page views and navigation patterns
- Links to visitors and users
- Stores URL, title, referrer, time on page, scroll depth
- Retention: 90 days

### 3. **interactions**
- Tracks clicks and user interactions
- Stores element type, selector, position, context
- Retention: 90 days

### 4. **form_interactions**
- Tracks form interactions and completion rates
- Stores form_id, field_name, event_type, completion time
- Never stores actual field values (privacy compliance)
- Retention: 90 days

### 5. **users_analytics**
- Tracks registered users and subscription details
- Stores email, signup date, subscription tier/status
- Retention: Indefinite (unless deletion requested)

### 6. **app_sessions**
- Tracks mobile app sessions
- Stores device info, platform, app version, session duration
- Retention: 90 days

### 7. **app_events**
- Tracks application events and user actions
- Stores event type, name, screen, properties (JSONB)
- Retention: 90 days

### 8. **ai_usage**
- Tracks AI usage and associated costs
- Stores provider, model, feature, tokens, cost
- Retention: 180 days

### 9. **conversions**
- Tracks conversions (download, install, activation, subscription)
- Stores platform, source, campaign, UTM parameters
- Links to visitors and users for attribution

### 10. **transactions**
- Tracks revenue and financial transactions
- Stores transaction type, amount, currency, payment method
- Retention: Indefinite (accounting compliance)

### 11. **marketing_attribution**
- Tracks campaign attribution and performance
- Stores all UTM parameters, referrer, landing page
- First-touch attribution model

### 12. **retention_cohorts**
- Tracks user retention and churn analysis
- Stores cohort month, retention rates, churn data
- Churn risk scoring (0-100)

### 13. **privacy_requests**
- Tracks GDPR/LGPD data export and deletion requests
- Stores request type, status, timestamps

## Indexes

All tables have indexes on:
- Foreign keys (visitor_id, user_id, session_id)
- Timestamp fields (for date range queries)
- Frequently queried fields (status, type, campaign)

## Row Level Security (RLS)

- **Service role**: Full access to all tables (for backend operations)
- **Authenticated users**: Can view their own analytics data
- **Authenticated users**: Can create privacy requests for themselves

## Running the Migration

### Local Development (Supabase CLI)
```bash
supabase db reset
```

### Production
```bash
supabase db push
```

## Verification

After running the migration, verify:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%visitors%' 
OR table_name LIKE '%analytics%'
OR table_name LIKE '%app_%'
OR table_name LIKE '%ai_%'
OR table_name LIKE '%conversions%'
OR table_name LIKE '%transactions%'
OR table_name LIKE '%marketing_%'
OR table_name LIKE '%retention_%'
OR table_name LIKE '%privacy_%';

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'visitors', 'page_views', 'interactions', 'form_interactions',
  'users_analytics', 'app_sessions', 'app_events', 'ai_usage',
  'conversions', 'transactions', 'marketing_attribution',
  'retention_cohorts', 'privacy_requests'
);

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'visitors', 'page_views', 'interactions', 'form_interactions',
  'users_analytics', 'app_sessions', 'app_events', 'ai_usage',
  'conversions', 'transactions', 'marketing_attribution',
  'retention_cohorts', 'privacy_requests'
);
```

## Data Retention Policies

Automated cleanup functions will be created in a separate migration to handle:
- Delete page_views older than 90 days
- Delete visitors older than 180 days
- Delete interactions older than 90 days
- Delete form_interactions older than 90 days
- Delete app_sessions older than 90 days
- Delete app_events older than 90 days
- Delete ai_usage older than 180 days
- Keep transactions indefinitely

## Next Steps

1. Deploy the webhook Edge Function to receive external data
2. Implement the JavaScript tracking library for the website
3. Implement the React Native SDK for the mobile app
4. Create the analytics dashboard UI
5. Set up data retention policies (scheduled jobs)
