-- 013_program_persistence_alignment.sql
-- Align databases that already ran 012 with the Program client column names.
-- This migration preserves RLS/policies and never stores assignee names.

DO $$
DECLARE
    mapping TEXT[][] := ARRAY[
        ARRAY['program_interventions', 'parent_id', 'parent_section_id'],
        ARRAY['program_interventions', 'duration', 'duration_min'],
        ARRAY['program_interventions', 'section_group', 'group_name'],
        ARRAY['program_interventions', 'scheduled_start_min', 'scheduled_start_minute'],
        ARRAY['program_timer_logs', 'scheduled_duration', 'scheduled_duration_min'],
        ARRAY['program_timer_logs', 'actual_start_iso', 'actual_start'],
        ARRAY['program_timer_logs', 'actual_end_iso', 'actual_end'],
        ARRAY['program_timer_logs', 'duration_seconds', 'actual_duration_sec']
    ];
    item TEXT[];
    table_exists BOOLEAN;
    old_exists BOOLEAN;
    new_exists BOOLEAN;
BEGIN
    FOREACH item SLICE 1 IN ARRAY mapping LOOP
        SELECT to_regclass(format('public.%I', item[1])) IS NOT NULL
          INTO table_exists;

        IF NOT table_exists THEN
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = item[1]
              AND column_name = item[2]
        ) INTO old_exists;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = item[1]
              AND column_name = item[3]
        ) INTO new_exists;

        IF old_exists AND NOT new_exists THEN
            EXECUTE format(
                'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
                item[1], item[2], item[3]
            );
        ELSIF old_exists AND new_exists THEN
            EXECUTE format(
                'UPDATE public.%I SET %I = COALESCE(%I, %I) WHERE %I IS NULL AND %I IS NOT NULL',
                item[1], item[3], item[3], item[2], item[3], item[2]
            );
            EXECUTE format(
                'ALTER TABLE public.%I DROP COLUMN %I',
                item[1], item[2]
            );
        END IF;
    END LOOP;
END
$$;
