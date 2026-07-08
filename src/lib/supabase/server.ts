import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isLocalMode } from "@/lib/local-mode";
import { createLocalServerClient } from "@/lib/localdb/server";

async function createRealClient(key: string) {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

type RealClient = Awaited<ReturnType<typeof createRealClient>>;

export async function createClient() {
  if (isLocalMode()) {
    return (await createLocalServerClient()) as unknown as RealClient;
  }

  return createRealClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function createServiceClient() {
  if (isLocalMode()) {
    return (await createLocalServerClient()) as unknown as RealClient;
  }

  return createRealClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
