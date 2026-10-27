DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.id, p.display_name, p.avatar_url FROM public.profiles p WHERE p.id = ANY(_ids) $$;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;