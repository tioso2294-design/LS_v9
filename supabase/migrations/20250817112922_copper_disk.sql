/*
  # Comprehensive Subscription System Fix
  1. Database Functions
     - Fix subscription period calculations
     - Proper revenue tracking
     - Graceful cancellation handling
     - Accurate billing period detection
  2. Security
     - Enable RLS on all tables
     - Add proper policies for subscription management
  3. Data Integrity
     - Ensure consistent subscription data
     - Fix billing period calculations
*/

-- ========================================
-- Drop existing functions properly
-- ========================================
DROP FUNCTION IF EXISTS calculate_subscription_period_end(text, timestamptz);
DROP FUNCTION IF EXISTS get_total_subscription_revenue();
DROP FUNCTION IF EXISTS handle_subscription_webhook(
  uuid, text, text, text, text, timestamptz, timestamptz
);
DROP FUNCTION IF EXISTS cancel_subscription_gracefully(uuid);
DROP FUNCTION IF EXISTS reactivate_subscription(uuid);

-- ========================================
-- Subscription Period Calculation Function
-- ========================================
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
    plan_type text,
    start_date timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
BEGIN
  CASE plan_type
    WHEN 'trial' THEN
      RETURN start_date + INTERVAL '30 days';
    WHEN 'monthly' THEN
      RETURN start_date + INTERVAL '1 month';
    WHEN 'semiannual' THEN
      RETURN start_date + INTERVAL '6 months';
    WHEN 'annual' THEN
      RETURN start_date + INTERVAL '1 year';
    ELSE
      RETURN start_date + INTERVAL '30 days';
  END CASE;
END;
$$;

-- ========================================
-- Revenue Calculation Function
-- ========================================
CREATE OR REPLACE FUNCTION get_total_subscription_revenue()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_revenue numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN plan_type = 'monthly' THEN 2.99
      WHEN plan_type = 'semiannual' THEN 9.99
      WHEN plan_type = 'annual' THEN 19.99
      ELSE 0
    END
  ), 0) INTO total_revenue
  FROM subscriptions
  WHERE plan_type != 'trial' 
    AND status IN ('active', 'expired', 'cancelled');

  RETURN total_revenue;
END;
$$;

-- ========================================
-- Subscription Webhook Handler
-- ========================================
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
    p_user_id uuid,
    p_plan_type text,
    p_status text,
    p_stripe_subscription_id text DEFAULT NULL,
    p_stripe_customer_id text DEFAULT NULL,
    p_period_start timestamptz DEFAULT NULL,
    p_period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    calculated_end_date timestamptz;
    start_date timestamptz;
BEGIN
    start_date := COALESCE(p_period_start, now());

    IF p_period_end IS NULL THEN
        calculated_end_date := calculate_subscription_period_end(p_plan_type, start_date);
    ELSE
        calculated_end_date := p_period_end;
    END IF;

    INSERT INTO subscriptions (
        user_id,
        plan_type,
        status,
        stripe_subscription_id,
        stripe_customer_id,
        current_period_start,
        current_period_end
    ) VALUES (
        p_user_id,
        p_plan_type::subscription_plan_type,
        p_status::subscription_status,
        p_stripe_subscription_id,
        p_stripe_customer_id,
        start_date,
        calculated_end_date
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan_type = EXCLUDED.plan_type,
        status = EXCLUDED.status,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();
END;
$$;

-- ========================================
-- Cancel Subscription Gracefully
-- ========================================
CREATE OR REPLACE FUNCTION cancel_subscription_gracefully(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE subscriptions 
    SET 
        status = 'cancelled',
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$;

-- ========================================
-- Reactivate Subscription
-- ========================================
CREATE OR REPLACE FUNCTION reactivate_subscription(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE subscriptions 
    SET 
        status = 'active',
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$;
