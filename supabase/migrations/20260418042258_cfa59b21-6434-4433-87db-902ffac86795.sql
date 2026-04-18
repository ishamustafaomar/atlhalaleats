CREATE OR REPLACE FUNCTION public.poll_results(_poll_id uuid)
RETURNS TABLE(
  restaurant_id uuid,
  name text,
  cuisine text,
  points integer,        -- first-round first-place vote count (kept name for UI compatibility)
  vote_count integer     -- total ballots that ranked this restaurant anywhere
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int;
  v_majority int;
  v_eliminated uuid[] := ARRAY[]::uuid[];
  v_round int := 0;
  v_min_count int;
  v_loser uuid;
  v_winner uuid := NULL;
  v_round_counts jsonb := '{}'::jsonb;
  v_first_round jsonb := '{}'::jsonb;
  v_elim_round jsonb := '{}'::jsonb;
  rec record;
BEGIN
  -- Total ballots in this poll
  SELECT COUNT(*)::int INTO v_total
  FROM public.poll_votes WHERE poll_id = _poll_id;

  IF v_total = 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, 0, 0 WHERE false;
    RETURN;
  END IF;

  v_majority := (v_total / 2) + 1;

  -- IRV loop. Bound iterations so we never hang.
  LOOP
    v_round := v_round + 1;
    EXIT WHEN v_round > 50;

    -- Count each ballot's top remaining choice (lowest rank not in eliminated set)
    WITH top_choices AS (
      SELECT DISTINCT ON (v.id) v.id AS vote_id, i.restaurant_id
      FROM public.poll_votes v
      JOIN public.poll_vote_items i ON i.vote_id = v.id
      WHERE v.poll_id = _poll_id
        AND NOT (i.restaurant_id = ANY(v_eliminated))
      ORDER BY v.id, i.rank ASC
    ),
    counts AS (
      SELECT restaurant_id, COUNT(*)::int AS cnt
      FROM top_choices
      GROUP BY restaurant_id
    )
    SELECT jsonb_object_agg(restaurant_id::text, cnt) INTO v_round_counts FROM counts;

    -- No remaining candidates? bail.
    IF v_round_counts IS NULL OR v_round_counts = '{}'::jsonb THEN
      EXIT;
    END IF;

    -- Capture round-1 counts for return rows.
    IF v_round = 1 THEN
      v_first_round := v_round_counts;
    END IF;

    -- Check for a majority winner.
    SELECT (kv.key)::uuid INTO v_winner
    FROM jsonb_each_text(v_round_counts) kv
    WHERE kv.value::int >= v_majority
    ORDER BY kv.value::int DESC
    LIMIT 1;

    IF v_winner IS NOT NULL THEN EXIT; END IF;

    -- If only one candidate remains, they win by default.
    IF (SELECT COUNT(*) FROM jsonb_each(v_round_counts)) = 1 THEN
      SELECT (kv.key)::uuid INTO v_winner FROM jsonb_each_text(v_round_counts) kv LIMIT 1;
      EXIT;
    END IF;

    -- Eliminate candidate(s) with the fewest top votes. Tie-break by lowest total ballot mentions.
    SELECT MIN((kv.value)::int) INTO v_min_count
    FROM jsonb_each_text(v_round_counts) kv;

    -- Pick a single loser deterministically (least round count, then least overall mentions, then id).
    SELECT (kv.key)::uuid INTO v_loser
    FROM jsonb_each_text(v_round_counts) kv
    LEFT JOIN (
      SELECT i.restaurant_id, COUNT(*)::int AS total_mentions
      FROM public.poll_vote_items i
      JOIN public.poll_votes v ON v.id = i.vote_id
      WHERE v.poll_id = _poll_id
      GROUP BY i.restaurant_id
    ) m ON m.restaurant_id = (kv.key)::uuid
    WHERE (kv.value)::int = v_min_count
    ORDER BY COALESCE(m.total_mentions, 0) ASC, kv.key ASC
    LIMIT 1;

    EXIT WHEN v_loser IS NULL;

    v_eliminated := array_append(v_eliminated, v_loser);
    v_elim_round := v_elim_round || jsonb_build_object(v_loser::text, v_round);
  END LOOP;

  -- Build result rows: every restaurant ever ranked in this poll.
  RETURN QUERY
  WITH mentions AS (
    SELECT i.restaurant_id, COUNT(DISTINCT v.id)::int AS ballots
    FROM public.poll_vote_items i
    JOIN public.poll_votes v ON v.id = i.vote_id
    WHERE v.poll_id = _poll_id
    GROUP BY i.restaurant_id
  )
  SELECT
    r.id AS restaurant_id,
    r.name,
    r.cuisine,
    COALESCE((v_first_round ->> r.id::text)::int, 0) AS points,
    COALESCE(m.ballots, 0) AS vote_count
  FROM public.restaurants r
  JOIN mentions m ON m.restaurant_id = r.id
  ORDER BY
    -- Winner first, then survivors by current standing, eliminated last by reverse elimination order.
    (r.id = v_winner) DESC,
    CASE WHEN r.id = ANY(v_eliminated) THEN 1 ELSE 0 END ASC,
    COALESCE((v_elim_round ->> r.id::text)::int, 999) DESC,
    COALESCE((v_first_round ->> r.id::text)::int, 0) DESC,
    m.ballots DESC,
    r.name ASC;
END;
$$;