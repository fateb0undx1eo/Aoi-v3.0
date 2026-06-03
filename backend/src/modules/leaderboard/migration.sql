-- Leaderboard Module Migration
-- Run this in your Supabase SQL editor

-- Daily message counts
CREATE TABLE IF NOT EXISTS message_counts_daily (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_date_count ON message_counts_daily (date, count DESC);

-- Weekly message counts
CREATE TABLE IF NOT EXISTS message_counts_weekly (
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year, week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_year_week_count ON message_counts_weekly (year, week, count DESC);

-- Monthly message counts
CREATE TABLE IF NOT EXISTS message_counts_monthly (
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_year_month_count ON message_counts_monthly (year, month, count DESC);

-- Bulk increment RPC
CREATE OR REPLACE FUNCTION bulk_increment_counts(updates JSONB)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    -- Daily
    INSERT INTO message_counts_daily (user_id, date, count)
    VALUES (item->>'p_user_id', CURRENT_DATE, (item->>'p_daily_count')::INTEGER)
    ON CONFLICT (user_id, date)
    DO UPDATE SET count = message_counts_daily.count + EXCLUDED.count;

    -- Weekly
    INSERT INTO message_counts_weekly (user_id, year, week, count)
    VALUES (
      item->>'p_user_id',
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
      EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER,
      (item->>'p_weekly_count')::INTEGER
    )
    ON CONFLICT (user_id, year, week)
    DO UPDATE SET count = message_counts_weekly.count + EXCLUDED.count;

    -- Monthly
    INSERT INTO message_counts_monthly (user_id, year, month, count)
    VALUES (
      item->>'p_user_id',
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
      (item->>'p_monthly_count')::INTEGER
    )
    ON CONFLICT (user_id, year, month)
    DO UPDATE SET count = message_counts_monthly.count + EXCLUDED.count;
  END LOOP;
END;
$$;

-- Leaderboard query RPCs
CREATE OR REPLACE FUNCTION get_leaderboard_daily(p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(user_id TEXT, count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id, m.count
  FROM message_counts_daily m
  WHERE m.date = CURRENT_DATE
  ORDER BY m.count DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard_weekly(p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(user_id TEXT, count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id, m.count
  FROM message_counts_weekly m
  WHERE m.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND m.week = EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER
  ORDER BY m.count DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard_monthly(p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(user_id TEXT, count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id, m.count
  FROM message_counts_monthly m
  WHERE m.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND m.month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  ORDER BY m.count DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
