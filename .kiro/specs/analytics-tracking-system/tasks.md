# Implementation Plan: Analytics and Tracking System

## Overview

This implementation plan breaks down the analytics and tracking system into discrete, incremental coding tasks. The approach follows a bottom-up strategy: database schema → backend services → tracking libraries → dashboard UI. Each task builds on previous work, with testing integrated throughout to validate functionality early.

## Tasks

- [x] 1. Set up Supabase database schema and indexes
  - Create all analytics tables (visitors, page_views, interactions, form_interactions, users_analytics, app_sessions, app_events, ai_usage, conversions, transactions, marketing_attribution, retention_cohorts, privacy_requests)
  - Add all foreign key constraints and check constraints
  - Create indexes on frequently queried fields (timestamps, foreign keys, status fields)
  - Set up Row Level Security policies for data access control
  - _Requirements: 1.1, 1.3, 2.1, 3.1, 4.1, 5.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 16.1_

- [-] 1.1 Write property test for database schema constraints
  - **Property 18: User Status Validation**
  - **Validates: Requirements 5.4**

- [ ] 2. Implement webhook Edge Function for external data ingestion
  - [x] 2.1 Create Supabase Edge Function endpoint
    - Set up Deno function with POST handler
    - Implement CORS headers for cross-origin requests
    - _Requirements: 6.1_
  
  - [~] 2.2 Implement webhook signature validation
    - Create HMAC-SHA256 signature generation function
    - Validate incoming request signatures against shared secret
    - Implement timestamp validation to prevent replay attacks (5-minute window)
    - _Requirements: 6.1, 6.3_
  
  - [~] 2.3 Write property test for webhook signature validation
    - **Property 19: Webhook Signature Validation**
    - **Validates: Requirements 6.1**
  
  - [~] 2.4 Implement webhook payload parsing and routing
    - Parse JSON payload and extract event_type, user_id, timestamp, properties
    - Route events to appropriate database tables based on event_type
    - Handle app_event, ai_usage, and transaction event types
    - _Requirements: 6.2, 6.4_
  
  - [~] 2.5 Write property test for webhook payload parsing
    - **Property 20: Webhook Payload Parsing**
    - **Validates: Requirements 6.2**
  
  - [~] 2.6 Write property test for webhook event storage routing
    - **Property 22: Webhook Event Storage Routing**
    - **Validates: Requirements 6.4**
  
  - [~] 2.7 Implement error handling and response formatting
    - Return HTTP 401 for invalid signatures
    - Return HTTP 400 for malformed JSON
    - Return HTTP 200 with event_id for successful processing
    - Log all failed attempts
    - _Requirements: 6.3, 6.5_
  
  - [~] 2.8 Write unit tests for webhook error scenarios
    - Test invalid signature rejection
    - Test malformed JSON handling
    - Test timestamp expiration
    - _Requirements: 6.3_

- [~] 3. Checkpoint - Ensure webhook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Privacy Manager for GDPR/LGPD compliance
  - [~] 4.1 Create PrivacyManager class with core methods
    - Implement requestDataExport(userId) method
    - Implement requestDataDeletion(userId) method
    - Implement anonymizeIP(ipAddress) method
    - Implement checkConsent(visitorId) and recordConsent(visitorId, consented) methods
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [~] 4.2 Write property test for IP anonymization
    - **Property 51: IP Address Anonymization**
    - **Validates: Requirements 16.1**
  
  - [~] 4.3 Implement data export functionality
    - Query all analytics tables for user data
    - Aggregate data into comprehensive JSON export
    - Create privacy_requests record with status tracking
    - _Requirements: 16.2_
  
  - [~] 4.4 Write property test for data export completeness
    - **Property 52: Data Export Completeness**
    - **Validates: Requirements 16.2**
  
  - [~] 4.5 Implement data deletion functionality
    - Remove or anonymize PII from all tables
    - Preserve anonymized aggregate data
    - Update privacy_requests record with completion status
    - _Requirements: 16.3_
  
  - [~] 4.6 Write property test for data deletion completeness
    - **Property 53: Data Deletion Completeness**
    - **Validates: Requirements 16.3**
  
  - [~] 4.7 Implement privacy audit logging
    - Log all privacy operations (access, export, deletion)
    - Include operation type, user_id, timestamp, outcome
    - _Requirements: 16.5_
  
  - [~] 4.8 Write property test for privacy audit logging
    - **Property 55: Privacy Audit Logging**
    - **Validates: Requirements 16.5**

- [ ] 5. Implement data retention policies
  - [~] 5.1 Create retention policy SQL functions
    - Write function to delete page_views older than 90 days
    - Write function to delete visitors older than 180 days
    - Write function to delete interactions older than 90 days
    - Write function to delete form_interactions older than 90 days
    - Write function to delete app_sessions older than 90 days
    - Write function to delete app_events older than 90 days
    - Write function to delete ai_usage older than 180 days
    - Ensure transactions are never deleted
    - _Requirements: 1.5, 2.5, 3.5, 4.5, 7.5, 8.5, 9.5, 17.1, 17.2, 17.3, 17.4_
  
  - [~] 5.2 Implement retention policy logging
    - Log number of records deleted per table
    - Log execution timestamp
    - _Requirements: 17.5_
  
  - [~] 5.3 Write property test for retention policy execution
    - **Property 56: Data Retention Policy Execution**
    - **Validates: Requirements 1.5, 2.5, 3.5, 4.5, 7.5, 8.5, 9.5, 17.1, 17.2, 17.3, 17.4**
  
  - [~] 5.4 Set up scheduled job to run retention policies
    - Configure Supabase cron job or external scheduler
    - Run daily at off-peak hours
    - _Requirements: 17.1, 17.2, 17.3_

- [~] 6. Checkpoint - Ensure privacy and retention tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement JavaScript tracking library for website
  - [~] 7.1 Create Analytics class with initialization
    - Implement init(config) method accepting projectId, apiUrl, apiKey, options
    - Set up localStorage for visitor_id and session_id persistence
    - Implement session timeout logic (30 minutes of inactivity)
    - _Requirements: 1.1, 1.2, 18.1_
  
  - [~] 7.2 Write property test for visitor ID uniqueness and persistence
    - **Property 1: Visitor ID Uniqueness and Persistence**
    - **Validates: Requirements 1.1**
  
  - [~] 7.3 Write property test for session lifecycle management
    - **Property 2: Session Lifecycle Management**
    - **Validates: Requirements 1.2, 1.4**
  
  - [~] 7.4 Implement automatic page view tracking
    - Track page views on load and navigation
    - Capture URL, title, referrer, timestamp
    - Implement time on page tracking with beforeunload event
    - _Requirements: 2.1, 2.2, 18.2_
  
  - [~] 7.5 Write property test for page view data completeness
    - **Property 4: Page View Data Completeness**
    - **Validates: Requirements 2.1**
  
  - [~] 7.6 Implement scroll depth tracking
    - Track scroll events at 25%, 50%, 75%, 100% thresholds
    - Debounce scroll events to avoid excessive tracking
    - _Requirements: 2.3_
  
  - [~] 7.7 Write property test for scroll depth validation
    - **Property 6: Scroll Depth Validation**
    - **Validates: Requirements 2.3**
  
  - [~] 7.8 Implement click tracking
    - Track clicks on elements with data-track attribute
    - Capture element type, selector, position, text, destination
    - Associate clicks with current session and page
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [~] 7.9 Write property test for click interaction data completeness
    - **Property 8: Click Interaction Data Completeness**
    - **Validates: Requirements 3.1, 3.3**
  
  - [~] 7.10 Write property test for trackable element filtering
    - **Property 10: Trackable Element Filtering**
    - **Validates: Requirements 3.4**
  
  - [~] 7.11 Implement form interaction tracking
    - Track form focus, blur, submit, and abandon events
    - Calculate completion time and fields filled count
    - Never capture actual field values
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 7.12 Write property test for form value privacy protection
    - **Property 14: Form Value Privacy Protection**
    - **Validates: Requirements 4.4**
  
  - [~] 7.13 Implement custom event tracking methods
    - Create trackEvent(eventName, properties) method
    - Create identify(userId, userProperties) method
    - _Requirements: 18.3, 18.4_
  
  - [~] 7.14 Implement event batching and sending
    - Batch events locally (send every 5 seconds or 10 events)
    - Use sendBeacon API for reliable delivery on page unload
    - Implement retry logic with exponential backoff
    - _Requirements: 18.2, 18.3, 18.4_
  
  - [~] 7.15 Write unit tests for tracking library
    - Test initialization with various configs
    - Test event batching logic
    - Test retry on network failure
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [ ] 8. Implement React Native SDK for mobile app tracking
  - [~] 8.1 Create AnalyticsSDK class with initialization
    - Implement initialize(config) method for iOS and Android
    - Set up AsyncStorage for device_id and session_id persistence
    - Implement automatic app lifecycle tracking (open, background, close)
    - _Requirements: 19.1, 19.2_
  
  - [~] 8.2 Write property test for app SDK auto-session creation
    - **Property 61: App SDK Auto-Session Creation**
    - **Validates: Requirements 19.2**
  
  - [~] 8.3 Implement app session tracking
    - Create session on app launch with device info
    - Track session duration, screens viewed, actions count
    - Record app launch time and performance metrics
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [~] 8.4 Write property test for app session data completeness
    - **Property 24: App Session Data Completeness**
    - **Validates: Requirements 7.1**
  
  - [~] 8.5 Implement screen view and event tracking methods
    - Create trackScreen(screenName, properties) method
    - Create trackEvent(eventName, properties) method
    - Capture event-specific properties (navigation, transactions, errors)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 19.3, 19.4_
  
  - [~] 8.6 Write property test for app event data completeness
    - **Property 27: App Event Data Completeness**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  
  - [~] 8.7 Implement event batching for mobile
    - Batch events locally (send every 30 seconds or 20 events)
    - Persist queue in AsyncStorage for offline support
    - Implement retry logic with exponential backoff
    - _Requirements: 19.5_
  
  - [~] 8.8 Write property test for event batching logic
    - **Property 64: Event Batching Logic**
    - **Validates: Requirements 19.5**
  
  - [~] 8.9 Write unit tests for React Native SDK
    - Test initialization on both platforms
    - Test offline queue persistence
    - Test automatic session creation
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [~] 9. Checkpoint - Ensure tracking library tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement AI usage tracking and cost calculation
  - [~] 10.1 Create AI usage tracking function
    - Accept user_id, provider, model_name, feature_name, token_count
    - Record timestamp, response_time, success status
    - Store in ai_usage table
    - _Requirements: 9.1, 9.4_
  
  - [~] 10.2 Write property test for AI usage record completeness
    - **Property 28: AI Usage Record Completeness**
    - **Validates: Requirements 9.1**
  
  - [~] 10.3 Implement AI cost calculation
    - Create pricing rate table for provider/model combinations
    - Calculate cost_usd as token_count × pricing_rate
    - Update ai_usage record with calculated cost
    - _Requirements: 9.2_
  
  - [~] 10.4 Write property test for AI cost calculation accuracy
    - **Property 29: AI Cost Calculation Accuracy**
    - **Validates: Requirements 9.2**
  
  - [~] 10.5 Create AI cost aggregation queries
    - Aggregate by time period (day, week, month)
    - Aggregate by provider, model, feature
    - Aggregate by user
    - _Requirements: 9.3_
  
  - [~] 10.6 Write property test for AI cost aggregation correctness
    - **Property 30: AI Cost Aggregation Correctness**
    - **Validates: Requirements 9.3**

- [ ] 11. Implement conversion tracking and attribution
  - [~] 11.1 Create conversion tracking functions
    - Implement trackDownload(platform, store, source, campaign, utmParams)
    - Implement trackInstall(deviceInfo, timestamp, onboardingStatus)
    - Implement trackSubscription(planName, billingCycle, price, trialDates)
    - Link conversions to visitor_id and campaign source
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [~] 11.2 Write property test for conversion attribution linking
    - **Property 35: Conversion Attribution Linking**
    - **Validates: Requirements 10.4**
  
  - [~] 11.3 Implement marketing attribution tracking
    - Capture all UTM parameters on visitor arrival
    - Store in marketing_attribution table
    - Implement first-touch attribution model
    - _Requirements: 12.1, 12.5_
  
  - [~] 11.4 Write property test for first-touch attribution model
    - **Property 45: First-Touch Attribution Model**
    - **Validates: Requirements 12.5**
  
  - [~] 11.5 Create conversion funnel calculation query
    - Count visitors, users, subscribers for time period
    - Calculate conversion rates between stages
    - _Requirements: 10.5_
  
  - [~] 11.6 Write property test for conversion funnel rate calculation
    - **Property 36: Conversion Funnel Rate Calculation**
    - **Validates: Requirements 10.5**

- [ ] 12. Implement financial metrics tracking and calculations
  - [~] 12.1 Create transaction tracking function
    - Record user_id, transaction_type, amount, currency, payment_method
    - Store in transactions table with status tracking
    - _Requirements: 11.1_
  
  - [~] 12.2 Write property test for transaction record completeness
    - **Property 37: Transaction Record Completeness**
    - **Validates: Requirements 11.1**
  
  - [~] 12.3 Implement MRR calculation query
    - Sum all active subscriptions normalized to monthly values
    - Handle annual, quarterly, monthly billing cycles
    - _Requirements: 11.2, 11.3_
  
  - [~] 12.4 Write property test for MRR calculation correctness
    - **Property 38: MRR Calculation Correctness**
    - **Validates: Requirements 11.2, 11.3**
  
  - [~] 12.5 Implement LTV and CAC calculation queries
    - Calculate LTV as average_revenue_per_user / churn_rate
    - Calculate CAC as marketing_spend / new_customer_count
    - _Requirements: 11.4, 11.5_
  
  - [~] 12.6 Write property tests for LTV and CAC calculations
    - **Property 39: LTV Calculation Correctness**
    - **Property 40: CAC Calculation Correctness**
    - **Validates: Requirements 11.4, 11.5**

- [ ] 13. Implement retention and churn analysis
  - [~] 13.1 Create cohort retention calculation query
    - Group users by signup month
    - Calculate retention rates at 7, 30, 90 day intervals
    - Store results in retention_cohorts table
    - _Requirements: 13.1, 13.2_
  
  - [~] 13.2 Write property test for cohort retention rate calculation
    - **Property 46: Cohort Retention Rate Calculation**
    - **Validates: Requirements 13.1, 13.2**
  
  - [~] 13.3 Implement churn tracking
    - Record churn_date, churn_reason, last_activity_date
    - Update retention_cohorts table
    - _Requirements: 13.3_
  
  - [~] 13.4 Implement churn risk scoring
    - Calculate risk score based on activity decline metrics
    - Score range 0-100 (higher = more at risk)
    - Update retention_cohorts table with scores
    - _Requirements: 13.4_
  
  - [~] 13.5 Write property test for churn risk scoring
    - **Property 48: Churn Risk Scoring**
    - **Validates: Requirements 13.4**
  
  - [~] 13.6 Implement retention attempt tracking
    - Track retention_attempts count and outcomes
    - Update retention_cohorts table
    - _Requirements: 13.5_

- [~] 14. Checkpoint - Ensure analytics calculation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement analytics dashboard queries and API
  - [~] 15.1 Create KPI query functions
    - getTotalVisitors(startDate, endDate)
    - getActiveUsers(startDate, endDate)
    - getAppDownloads(startDate, endDate)
    - getTotalAICosts(startDate, endDate)
    - getTotalRevenue(startDate, endDate)
    - _Requirements: 14.1_
  
  - [~] 15.2 Create time-series query functions
    - getVisitorsByDay(startDate, endDate)
    - getAIUsageByDay(startDate, endDate)
    - getRevenueByDay(startDate, endDate)
    - _Requirements: 14.3_
  
  - [~] 15.3 Create top content query functions
    - getTopPages(startDate, endDate, limit)
    - getTopUsersByAIUsage(startDate, endDate, limit)
    - getRecentDownloads(limit)
    - _Requirements: 14.4_
  
  - [~] 15.4 Create campaign performance query functions
    - getCampaignMetrics(campaignId, startDate, endDate)
    - Calculate impressions, clicks, conversions, CTR, conversion_rate, ROAS
    - _Requirements: 12.2, 12.3, 12.4_
  
  - [~] 15.5 Write property tests for campaign metric calculations
    - **Property 43: Campaign Metric Calculation**
    - **Property 44: ROAS Calculation Correctness**
    - **Validates: Requirements 12.3, 12.4**

- [ ] 16. Build analytics dashboard UI components
  - [~] 16.1 Create KPICard component
    - Display metric value, label, and trend indicator
    - Support loading and error states
    - _Requirements: 14.1_
  
  - [~] 16.2 Create TimeRangeFilter component
    - Provide preset options (today, 7 days, 30 days)
    - Support custom date range selection
    - _Requirements: 14.2_
  
  - [~] 16.3 Create chart components using Recharts
    - VisitorsChart: Line chart for visitors over time
    - AIUsageChart: Line chart for AI usage over time
    - RevenueChart: Line chart for revenue over time
    - _Requirements: 14.3_
  
  - [~] 16.4 Create table components
    - TopPagesTable: Display most visited pages
    - TopUsersTable: Display top users by AI usage
    - RecentDownloadsTable: Display recent app downloads
    - _Requirements: 14.4_
  
  - [~] 16.5 Create main Dashboard page
    - Compose KPI cards, filters, charts, and tables
    - Implement auto-refresh every 60 seconds
    - Handle loading and error states
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [~] 16.6 Write property test for dashboard auto-refresh interval
    - **Property 50: Dashboard Auto-Refresh Interval**
    - **Validates: Requirements 14.5**
  
  - [~] 16.7 Write unit tests for dashboard components
    - Test KPICard rendering with various data
    - Test TimeRangeFilter selection
    - Test chart rendering with mock data
    - Test table rendering and sorting
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 17. Implement privacy management UI
  - [~] 17.1 Create DataExportDialog component
    - Allow users to request data export
    - Display export status and download link
    - _Requirements: 16.2_
  
  - [~] 17.2 Create DataDeletionDialog component
    - Allow users to request data deletion
    - Display confirmation and status
    - _Requirements: 16.3_
  
  - [~] 17.3 Create consent management UI
    - Display consent banner on first visit
    - Record user consent choice
    - Provide consent management settings page
    - _Requirements: 16.4_
  
  - [~] 17.4 Write unit tests for privacy UI components
    - Test export dialog flow
    - Test deletion dialog confirmation
    - Test consent banner display and recording
    - _Requirements: 16.2, 16.3, 16.4_

- [ ] 18. Implement external integrations (optional)
  - [ ] 18.1 Create Google Analytics 4 integration
    - Forward page view events to GA4
    - Validate GA4 measurement ID
    - Handle GA4 API errors gracefully
    - _Requirements: 20.1, 20.4, 20.5_
  
  - [ ] 18.2 Create Facebook Pixel integration
    - Forward conversion events to Facebook
    - Validate Facebook Pixel ID
    - Handle Facebook API errors gracefully
    - _Requirements: 20.2, 20.4, 20.5_
  
  - [ ] 18.3 Create Mixpanel integration
    - Forward user events to Mixpanel
    - Validate Mixpanel project token
    - Handle Mixpanel API errors gracefully
    - _Requirements: 20.3, 20.4, 20.5_
  
  - [ ] 18.4 Write property test for external integration event forwarding
    - **Property 65: External Integration Event Forwarding**
    - **Validates: Requirements 20.1, 20.2, 20.3**
  
  - [ ] 18.5 Write property test for integration failure resilience
    - **Property 67: Integration Failure Resilience**
    - **Validates: Requirements 20.5**

- [ ] 19. Final integration and deployment
  - [ ] 19.1 Wire all components together
    - Connect tracking libraries to Supabase API
    - Connect dashboard to query functions
    - Connect privacy UI to Privacy Manager
    - Verify end-to-end data flow
    - _Requirements: All_
  
  - [ ] 19.2 Set up environment configuration
    - Configure Supabase project ID, API keys
    - Configure webhook secret
    - Configure external integration credentials (if enabled)
    - Set up environment variables for all services
    - _Requirements: All_
  
  - [ ] 19.3 Deploy Supabase Edge Functions
    - Deploy webhook function
    - Test webhook endpoint with sample data
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 19.4 Deploy tracking library to CDN
    - Build and minify JavaScript tracking library
    - Deploy to CDN or static hosting
    - Generate integration snippet for website
    - _Requirements: 18.1, 18.2, 18.3, 18.4_
  
  - [ ] 19.5 Publish React Native SDK to npm
    - Build and package SDK
    - Publish to npm registry
    - Create installation and usage documentation
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [ ] 19.6 Deploy dashboard application
    - Build React dashboard for production
    - Deploy to hosting platform (Vercel, Netlify, or similar)
    - Configure domain and SSL
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ] 19.7 Run end-to-end integration tests
    - Test complete visitor journey from website to dashboard
    - Test webhook data flow from external system
    - Test privacy operations (export, deletion)
    - Test external integrations (if enabled)
    - _Requirements: All_

- [~] 20. Final checkpoint - Ensure all tests pass and system is operational
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation with full test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: database → backend → tracking → UI
- External integrations (task 18) can be implemented later if needed, but all tests are required
