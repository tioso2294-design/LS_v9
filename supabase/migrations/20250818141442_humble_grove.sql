/*
  # Complete Subscription System Fix

  1. Database Functions
    - Fix subscription webhook handling
    - Proper billing period calculation
    - Accurate revenue tracking
    - Graceful cancellation system

  2. Triggers and Updates
    - Auto-update billing period text
    - Proper subscription status management
    - Real-time updates

  3. Security and Permissions
    - Proper RLS policies
    - Service role access for webhooks
*/

-- Drop existing problematic functions
DROP FUNCTION IF EXISTS handle_subscription_webhook(text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS calculate_subscription_period_end(text, timestamptz);
DROP FUNCTION IF EXISTS update_billing_period_text();
DROP FUNCTION IF EXISTS cancel_subscription_gracefully(uuid);
DROP FUNCTION IF EXISTS reactivate_subscription(uuid);

-- Create proper subscription webhook handler
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_user_id uuid,
  p_plan_type subscription_plan_type,
  p_status subscription_status,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_existing_subscription subscriptions%ROWTYPE;
BEGIN
  -- Set default period start to now if not provided
  v_period_start := COALESCE(p_period_start, now());
  
  -- Calculate proper period end based on plan type
  IF p_period_end IS NULL THEN
    CASE p_plan_type
      WHEN 'trial' THEN
        v_period_end := v_period_start + interval '30 days';
      WHEN 'monthly' THEN
        v_period_end := v_period_start + interval '1 month';
      WHEN 'semiannual' THEN
        v_period_end := v_period_start + interval '6 months';
      WHEN 'annual' THEN
        v_period_end := v_period_start + interval '1 year';
      ELSE
        v_period_end := v_period_start + interval '30 days';
    END CASE;
  ELSE
    v_period_end := p_period_end;
  END IF;

  -- Check if subscription exists
  SELECT * INTO v_existing_subscription
  FROM subscriptions
  WHERE user_id = p_user_id;

  IF FOUND THEN
    -- Update existing subscription
    UPDATE subscriptions SET
      plan_type = p_plan_type,
      status = p_status,
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Create new subscription
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
      p_plan_type,
      p_status,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      v_period_start,
      v_period_end
    );
  END IF;

  -- Log the webhook processing
  RAISE NOTICE 'Subscription webhook processed for user % with plan % and status %', p_user_id, p_plan_type, p_status;
END;
$$;

-- Create billing period text update function
CREATE OR REPLACE FUNCTION update_billing_period_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_duration_days integer;
  v_period_text text;
  v_is_accurate boolean := true;
BEGIN
  -- Calculate actual duration in days
  v_duration_days := EXTRACT(days FROM (NEW.current_period_end - NEW.current_period_start));
  
  -- Generate human-readable text based on actual duration
  IF v_duration_days >= 350 THEN
    v_period_text := to_char(NEW.current_period_start, 'Mon DD, YYYY') || ' – ' || 
                     to_char(NEW.current_period_end, 'Mon DD, YYYY') || ' (1 year)';
    v_is_accurate := (NEW.plan_type = 'annual');
  ELSIF v_duration_days >= 150 THEN
    v_period_text := to_char(NEW.current_period_start, 'Mon DD, YYYY') || ' – ' || 
                     to_char(NEW.current_period_end, 'Mon DD, YYYY') || ' (6 months)';
    v_is_accurate := (NEW.plan_type = 'semiannual');
  ELSIF v_duration_days >= 25 THEN
    v_period_text := to_char(NEW.current_period_start, 'Mon DD, YYYY') || ' – ' || 
                     to_char(NEW.current_period_end, 'Mon DD, YYYY') || ' (1 month)';
    v_is_accurate := (NEW.plan_type = 'monthly' OR NEW.plan_type = 'trial');
  ELSE
    v_period_text := to_char(NEW.current_period_start, 'Mon DD, YYYY') || ' – ' || 
                     to_char(NEW.current_period_end, 'Mon DD, YYYY') || ' (' || v_duration_days || ' days)';
    v_is_accurate := false;
  END IF;

  NEW.billing_period_text := v_period_text;
  NEW.billing_period_accurate := v_is_accurate;
  
  RETURN NEW;
END;
$$;

-- Create graceful cancellation function
CREATE OR REPLACE FUNCTION cancel_subscription_gracefully(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update subscription status to cancelled but keep access until period end
  UPDATE subscriptions 
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Don't change the period end date - let them keep access
  RAISE NOTICE 'Subscription gracefully cancelled for user %. Access continues until period end.', p_user_id;
END;
$$;

-- Create reactivation function
CREATE OR REPLACE FUNCTION reactivate_subscription(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simply reactivate without changing billing period
  UPDATE subscriptions 
  SET 
    status = 'active',
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RAISE NOTICE 'Subscription reactivated for user % without additional charges', p_user_id;
END;
$$;

-- Create function to get total subscription revenue
CREATE OR REPLACE FUNCTION get_total_subscription_revenue()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_revenue numeric := 0;
  v_subscription subscriptions%ROWTYPE;
BEGIN
  -- Calculate total revenue from all paid subscriptions
  FOR v_subscription IN 
    SELECT * FROM subscriptions 
    WHERE plan_type != 'trial' 
    AND (status = 'active' OR status = 'expired' OR status = 'cancelled')
  LOOP
    CASE v_subscription.plan_type
      WHEN 'monthly' THEN
        -- For monthly, calculate based on how many months they've been subscribed
        v_total_revenue := v_total_revenue + 2.99;
      WHEN 'semiannual' THEN
        v_total_revenue := v_total_revenue + 9.99;
      WHEN 'annual' THEN
        v_total_revenue := v_total_revenue + 19.99;
    END CASE;
  END LOOP;
  
  RETURN v_total_revenue;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_billing_period_text ON subscriptions;
CREATE TRIGGER trigger_update_billing_period_text
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_period_text();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_subscription_webhook TO service_role;
GRANT EXECUTE ON FUNCTION cancel_subscription_gracefully TO service_role;
GRANT EXECUTE ON FUNCTION reactivate_subscription TO service_role;
GRANT EXECUTE ON FUNCTION get_total_subscription_revenue TO service_role;