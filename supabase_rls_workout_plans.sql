-- Enable RLS policies for workout_plans table
-- This allows users to manage their own workout plans

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can insert own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can update own workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "Users can delete own workout plans" ON public.workout_plans;

-- Policy: Users can view their own workout plans
CREATE POLICY "Users can view own workout plans"
  ON public.workout_plans
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own workout plans
CREATE POLICY "Users can insert own workout plans"
  ON public.workout_plans
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own workout plans
CREATE POLICY "Users can update own workout plans"
  ON public.workout_plans
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can delete their own workout plans
CREATE POLICY "Users can delete own workout plans"
  ON public.workout_plans
  FOR DELETE
  USING (auth.uid()::text = user_id);
