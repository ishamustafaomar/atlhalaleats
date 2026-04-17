-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Roles viewable by everyone"
  ON public.user_roles FOR SELECT USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grant admin to most recent signup
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ORDER BY created_at DESC LIMIT 1
ON CONFLICT DO NOTHING;

-- 2. Polls
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  cuisine text,
  status text NOT NULL DEFAULT 'active',
  week_start date NOT NULL DEFAULT (date_trunc('week', now())::date),
  week_end date NOT NULL DEFAULT ((date_trunc('week', now()) + interval '6 days')::date),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Polls viewable by everyone"
  ON public.polls FOR SELECT USING (true);

CREATE POLICY "Admins can insert polls"
  ON public.polls FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update polls"
  ON public.polls FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete polls"
  ON public.polls FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER polls_set_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Votes
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes viewable by everyone"
  ON public.poll_votes FOR SELECT USING (true);

CREATE POLICY "Users insert own votes"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own votes"
  ON public.poll_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own votes"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER poll_votes_set_updated_at
BEFORE UPDATE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Vote items (ranked)
CREATE TABLE public.poll_vote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES public.poll_votes(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 5),
  UNIQUE (vote_id, rank),
  UNIQUE (vote_id, restaurant_id)
);

ALTER TABLE public.poll_vote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vote items viewable by everyone"
  ON public.poll_vote_items FOR SELECT USING (true);

CREATE POLICY "Users manage own vote items"
  ON public.poll_vote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.id = vote_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.id = vote_id AND v.user_id = auth.uid()));

-- 5. Cast vote function (atomic replace)
CREATE OR REPLACE FUNCTION public.cast_poll_vote(_poll_id uuid, _restaurant_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_vote_id uuid;
  i int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF array_length(_restaurant_ids, 1) IS NULL OR array_length(_restaurant_ids, 1) > 5 THEN
    RAISE EXCEPTION 'Must rank 1 to 5 restaurants';
  END IF;

  INSERT INTO public.poll_votes (poll_id, user_id)
  VALUES (_poll_id, v_user)
  ON CONFLICT (poll_id, user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_vote_id;

  DELETE FROM public.poll_vote_items WHERE vote_id = v_vote_id;

  FOR i IN 1..array_length(_restaurant_ids, 1) LOOP
    INSERT INTO public.poll_vote_items (vote_id, restaurant_id, rank)
    VALUES (v_vote_id, _restaurant_ids[i], i);
  END LOOP;

  RETURN v_vote_id;
END;
$$;

-- 6. Results function (Borda count)
CREATE OR REPLACE FUNCTION public.poll_results(_poll_id uuid)
RETURNS TABLE (
  restaurant_id uuid,
  name text,
  cuisine text,
  points int,
  vote_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS restaurant_id,
    r.name,
    r.cuisine,
    COALESCE(SUM(6 - i.rank), 0)::int AS points,
    COUNT(i.id)::int AS vote_count
  FROM public.restaurants r
  JOIN public.poll_vote_items i ON i.restaurant_id = r.id
  JOIN public.poll_votes v ON v.id = i.vote_id
  WHERE v.poll_id = _poll_id
  GROUP BY r.id, r.name, r.cuisine
  ORDER BY points DESC, vote_count DESC;
$$;

CREATE INDEX idx_poll_votes_poll ON public.poll_votes(poll_id);
CREATE INDEX idx_poll_vote_items_vote ON public.poll_vote_items(vote_id);
CREATE INDEX idx_poll_vote_items_restaurant ON public.poll_vote_items(restaurant_id);