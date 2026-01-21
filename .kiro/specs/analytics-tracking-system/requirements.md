# Requirements Document: Analytics and Tracking System

## Introduction

This document specifies the requirements for a comprehensive analytics and tracking system that monitors user behavior, AI costs, conversions, and financial metrics across the MaxNutrition Financeiro web application. The system receives data via webhooks from app.oficialmaxnutrition.com.br and provides real-time analytics dashboards while maintaining privacy compliance.

## Glossary

- **Analytics_System**: The complete tracking and analytics platform
- **Visitor**: An anonymous user browsing the MaxNutrition Financeiro website
- **Registered_User**: A user who has created an account
- **Session**: A continuous period of user activity
- **Webhook_Endpoint**: The Supabase Edge Function receiving external data
- **Analytics_Event**: A tracked user action or system event
- **AI_Usage_Record**: A record of AI model usage with associated costs
- **Dashboard**: The web interface displaying analytics data
- **Tracking_Library**: JavaScript code embedded in the website for data collection
- **Data_Retention_Policy**: Rules governing how long data is stored
- **Privacy_Manager**: Component handling GDPR/LGPD compliance

## Requirements

### Requirement 1: Visitor and Session Tracking

**User Story:** As a product manager, I want to track all visitors to the MaxNutrition Financeiro website, so that I can understand traffic patterns and user acquisition.

#### Acceptance Criteria

1. WHEN a visitor accesses any page on the MaxNutrition Financeiro website, THE Analytics_System SHALL create a unique visitor_id if one does not exist
2. WHEN a visitor starts browsing, THE Analytics_System SHALL create a session_id that remains valid for 30 minutes of inactivity
3. WHEN tracking a visitor, THE Analytics_System SHALL capture user_agent, anonymized IP address, geographic location, device type, and browser information
4. WHEN a session expires, THE Analytics_System SHALL create a new session_id for subsequent activity
5. THE Analytics_System SHALL store visitor data for 180 days before automatic deletion

### Requirement 2: Page View and Navigation Tracking

**User Story:** As a product manager, I want to track page views and navigation patterns, so that I can optimize the user journey and content strategy.

#### Acceptance Criteria

1. WHEN a visitor views a page, THE Analytics_System SHALL record the URL, page title, referrer, timestamp, and session_id
2. WHEN a visitor remains on a page, THE Analytics_System SHALL measure time on page with 1-second granularity
3. WHEN a visitor scrolls, THE Analytics_System SHALL track scroll depth in 25% increments (25%, 50%, 75%, 100%)
4. WHEN a visitor navigates between pages, THE Analytics_System SHALL maintain session continuity
5. THE Analytics_System SHALL store page view data for 90 days before automatic deletion

### Requirement 3: Click and Interaction Tracking

**User Story:** As a UX designer, I want to track user clicks and interactions, so that I can identify popular features and optimize interface elements.

#### Acceptance Criteria

1. WHEN a visitor clicks any tracked element, THE Analytics_System SHALL record element type, CSS selector, position coordinates, and context
2. WHEN tracking clicks, THE Analytics_System SHALL associate each click with the current session_id and page URL
3. WHEN a visitor interacts with a button or link, THE Analytics_System SHALL capture the element text and destination
4. THE Analytics_System SHALL track clicks on elements marked with data-track attributes
5. THE Analytics_System SHALL store interaction data for 90 days before automatic deletion

### Requirement 4: Form Interaction Tracking

**User Story:** As a conversion optimizer, I want to track form interactions and completion rates, so that I can identify and fix form abandonment issues.

#### Acceptance Criteria

1. WHEN a visitor focuses on a form field, THE Analytics_System SHALL record the form_id, field_name, and timestamp
2. WHEN a visitor completes a form, THE Analytics_System SHALL calculate total completion time and fields filled count
3. WHEN a visitor abandons a form, THE Analytics_System SHALL record which fields were filled and the abandonment point
4. WHEN tracking forms, THE Analytics_System SHALL NOT capture actual field values for privacy compliance
5. THE Analytics_System SHALL store form interaction data for 90 days before automatic deletion

### Requirement 5: Registered User Tracking

**User Story:** As a product manager, I want to track registered users and their account details, so that I can analyze user segments and subscription tiers.

#### Acceptance Criteria

1. WHEN a user registers, THE Analytics_System SHALL create a user record with user_id, email, signup timestamp, and initial subscription tier
2. WHEN a user's subscription changes, THE Analytics_System SHALL update the subscription tier and status
3. WHEN tracking registered users, THE Analytics_System SHALL link visitor_id to user_id upon authentication
4. THE Analytics_System SHALL store user account status (active, inactive, churned, trial)
5. THE Analytics_System SHALL retain registered user data indefinitely unless deletion is requested

### Requirement 6: Webhook Data Reception

**User Story:** As a system administrator, I want to receive analytics data via webhooks from app.oficialmaxnutrition.com.br, so that I can centralize all tracking data.

#### Acceptance Criteria

1. WHEN the Webhook_Endpoint receives a POST request, THE Analytics_System SHALL validate the request signature using a shared secret
2. WHEN webhook data is received, THE Analytics_System SHALL parse the JSON payload and extract event type, user_id, timestamp, and event properties
3. IF webhook validation fails, THEN THE Analytics_System SHALL return HTTP 401 and log the failed attempt
4. WHEN valid webhook data is received, THE Analytics_System SHALL store the event in the appropriate analytics table
5. WHEN webhook processing completes, THE Analytics_System SHALL return HTTP 200 with a confirmation message

### Requirement 7: Application Session Tracking

**User Story:** As a mobile product manager, I want to track app sessions and user activity, so that I can measure engagement and feature adoption.

#### Acceptance Criteria

1. WHEN a user opens the mobile app, THE Analytics_System SHALL create an app session with session_id, user_id, device info, and app version
2. WHEN tracking app sessions, THE Analytics_System SHALL record session duration, screens viewed, and actions performed
3. WHEN a session ends, THE Analytics_System SHALL calculate total duration and action count
4. WHEN tracking app performance, THE Analytics_System SHALL record app launch time and screen load times
5. THE Analytics_System SHALL store app session data for 90 days before automatic deletion

### Requirement 8: Application Event Tracking

**User Story:** As a product manager, I want to track all application events and user actions, so that I can understand feature usage and user behavior patterns.

#### Acceptance Criteria

1. WHEN a user performs an action in the app, THE Analytics_System SHALL record event_type, user_id, session_id, timestamp, and event properties
2. WHEN tracking navigation events, THE Analytics_System SHALL record screen_name, previous_screen, and navigation method
3. WHEN tracking transaction events, THE Analytics_System SHALL record transaction_id, amount, currency, and transaction type
4. WHEN errors occur, THE Analytics_System SHALL record error_type, error_message, stack_trace, and affected user_id
5. THE Analytics_System SHALL store application events for 90 days before automatic deletion

### Requirement 9: AI Usage and Cost Tracking

**User Story:** As a financial controller, I want to track AI usage and associated costs per user and feature, so that I can monitor expenses and optimize AI spending.

#### Acceptance Criteria

1. WHEN an AI model is invoked, THE Analytics_System SHALL record user_id, provider, model_name, feature_name, token_count, and timestamp
2. WHEN calculating AI costs, THE Analytics_System SHALL apply the current pricing rate for the provider and model combination
3. WHEN aggregating AI costs, THE Analytics_System SHALL provide totals by time period, provider, feature, and user
4. WHEN tracking AI performance, THE Analytics_System SHALL record response_time and success_rate for each request
5. THE Analytics_System SHALL store AI usage records for 180 days before automatic deletion

### Requirement 10: Conversion Tracking

**User Story:** As a growth manager, I want to track conversions from visitor to user to subscriber, so that I can measure funnel performance and optimize conversion rates.

#### Acceptance Criteria

1. WHEN a visitor downloads the app, THE Analytics_System SHALL record platform, store, source, campaign, and all UTM parameters
2. WHEN a user installs and activates the app, THE Analytics_System SHALL record device_info, installation_timestamp, and onboarding_completion status
3. WHEN a user subscribes, THE Analytics_System SHALL record plan_name, billing_cycle, price, trial_start_date, and trial_end_date
4. WHEN tracking conversions, THE Analytics_System SHALL link conversion events to the original visitor_id and campaign source
5. THE Analytics_System SHALL calculate conversion rates for each funnel stage (visitor → user → subscriber)

### Requirement 11: Financial Metrics Tracking

**User Story:** As a CFO, I want to track revenue, transactions, and key financial metrics, so that I can monitor business health and growth.

#### Acceptance Criteria

1. WHEN a transaction occurs, THE Analytics_System SHALL record user_id, transaction_type, amount, currency, payment_method, and timestamp
2. WHEN calculating MRR, THE Analytics_System SHALL sum all active monthly subscriptions normalized to monthly values
3. WHEN calculating ARR, THE Analytics_System SHALL multiply MRR by 12
4. WHEN calculating LTV, THE Analytics_System SHALL divide average revenue per user by churn rate
5. WHEN calculating CAC, THE Analytics_System SHALL divide total marketing spend by new customer count for the period

### Requirement 12: Marketing Attribution

**User Story:** As a marketing manager, I want to track campaign attribution and performance, so that I can optimize marketing spend and channel mix.

#### Acceptance Criteria

1. WHEN a visitor arrives via a campaign, THE Analytics_System SHALL capture utm_source, utm_medium, utm_campaign, utm_term, and utm_content
2. WHEN tracking campaign performance, THE Analytics_System SHALL count impressions, clicks, and conversions per campaign
3. WHEN calculating campaign metrics, THE Analytics_System SHALL compute CTR (clicks/impressions) and conversion rate
4. WHEN calculating ROAS, THE Analytics_System SHALL divide campaign revenue by campaign spend
5. THE Analytics_System SHALL attribute conversions to the first-touch campaign source

### Requirement 13: Retention and Churn Analysis

**User Story:** As a customer success manager, I want to track user retention and churn, so that I can identify at-risk users and improve retention strategies.

#### Acceptance Criteria

1. WHEN analyzing retention, THE Analytics_System SHALL calculate cohort retention rates by signup month
2. WHEN calculating retention rates, THE Analytics_System SHALL measure active users at 7-day, 30-day, and 90-day intervals
3. WHEN a user churns, THE Analytics_System SHALL record churn_date, churn_reason, and last_activity_date
4. WHEN identifying churn risk, THE Analytics_System SHALL score users based on activity decline and engagement metrics
5. THE Analytics_System SHALL track retention attempts and their outcomes for churned users

### Requirement 14: Analytics Dashboard

**User Story:** As a business stakeholder, I want to view analytics data in a dashboard, so that I can monitor key metrics and make data-driven decisions.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Analytics_System SHALL display KPI cards for total visitors, active users, app downloads, total AI costs, and total revenue
2. WHEN viewing the Dashboard, THE Analytics_System SHALL provide time range filters for today, last 7 days, last 30 days, and custom ranges
3. WHEN displaying trends, THE Analytics_System SHALL show line charts for visitors over time, AI usage over time, and revenue over time
4. WHEN showing top content, THE Analytics_System SHALL display tables of most visited pages, top users by AI usage, and recent app downloads
5. WHEN the Dashboard updates, THE Analytics_System SHALL refresh data every 60 seconds for near real-time monitoring

### Requirement 15: Query Performance and Indexing

**User Story:** As a system administrator, I want analytics queries to execute quickly, so that the dashboard remains responsive and users can access data efficiently.

#### Acceptance Criteria

1. WHEN querying page views by date range, THE Analytics_System SHALL return results within 500ms for ranges up to 90 days
2. WHEN aggregating AI costs, THE Analytics_System SHALL use database indexes on user_id, timestamp, and provider fields
3. WHEN calculating conversion funnels, THE Analytics_System SHALL use materialized views for frequently accessed aggregations
4. WHEN the database grows beyond 1 million records per table, THE Analytics_System SHALL maintain query performance through partitioning
5. THE Analytics_System SHALL create indexes on all foreign keys and frequently queried timestamp fields

### Requirement 16: Privacy and Compliance

**User Story:** As a legal compliance officer, I want the analytics system to comply with GDPR and LGPD, so that we protect user privacy and avoid regulatory penalties.

#### Acceptance Criteria

1. WHEN collecting visitor data, THE Privacy_Manager SHALL anonymize IP addresses by removing the last octet
2. WHEN a user requests data export, THE Privacy_Manager SHALL provide all stored data for that user in JSON format within 30 days
3. WHEN a user requests data deletion, THE Privacy_Manager SHALL remove all personally identifiable information within 30 days
4. WHEN tracking users, THE Analytics_System SHALL obtain and record user consent before collecting non-essential data
5. THE Privacy_Manager SHALL maintain an audit log of all data access, export, and deletion requests

### Requirement 17: Data Retention Policies

**User Story:** As a data governance officer, I want automated data retention policies, so that we minimize storage costs and comply with data minimization principles.

#### Acceptance Criteria

1. THE Analytics_System SHALL automatically delete page view records older than 90 days
2. THE Analytics_System SHALL automatically delete visitor records older than 180 days
3. THE Analytics_System SHALL automatically delete AI usage records older than 180 days
4. THE Analytics_System SHALL retain financial transaction records indefinitely for accounting compliance
5. WHEN retention policies execute, THE Analytics_System SHALL log the number of records deleted and the execution timestamp

### Requirement 18: Website Tracking Library

**User Story:** As a frontend developer, I want a JavaScript tracking library, so that I can easily integrate analytics into the MaxNutrition Financeiro website.

#### Acceptance Criteria

1. THE Tracking_Library SHALL provide an initialization function that accepts a project_id and configuration options
2. WHEN the Tracking_Library loads, THE Analytics_System SHALL automatically track page views without additional code
3. THE Tracking_Library SHALL provide methods for tracking custom events: trackEvent(eventName, properties)
4. THE Tracking_Library SHALL provide methods for identifying users: identify(userId, userProperties)
5. THE Tracking_Library SHALL add less than 100ms to page load time and use less than 50KB of bandwidth

### Requirement 19: Application Tracking SDK

**User Story:** As a mobile developer, I want a React Native tracking SDK, so that I can integrate analytics into the mobile application.

#### Acceptance Criteria

1. THE Tracking_SDK SHALL provide initialization methods for iOS and Android platforms
2. WHEN the app launches, THE Tracking_SDK SHALL automatically create a session and track the app_open event
3. THE Tracking_SDK SHALL provide methods for tracking screen views: trackScreen(screenName, properties)
4. THE Tracking_SDK SHALL provide methods for tracking custom events: trackEvent(eventName, properties)
5. THE Tracking_SDK SHALL batch events and send them every 30 seconds or when 20 events accumulate, whichever comes first

### Requirement 20: External Integration Support

**User Story:** As a marketing analyst, I want to integrate with external analytics platforms, so that I can leverage specialized tools and cross-reference data.

#### Acceptance Criteria

1. WHERE Google Analytics 4 integration is enabled, THE Analytics_System SHALL forward page view events to GA4
2. WHERE Facebook Pixel integration is enabled, THE Analytics_System SHALL forward conversion events to Facebook
3. WHERE Mixpanel integration is enabled, THE Analytics_System SHALL forward user events to Mixpanel
4. WHEN external integrations are configured, THE Analytics_System SHALL validate API keys and connection status
5. IF an external integration fails, THEN THE Analytics_System SHALL log the error and continue processing events locally
