import { createBrowserClient } from "@supabase/ssr";
import { isLocalMode } from "@/lib/local-mode";
import { createLocalBrowserClient } from "@/lib/localdb/browser";

function createRealClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createClient() {
  if (isLocalMode()) {
    return createLocalBrowserClient() as unknown as ReturnType<
      typeof createRealClient
    >;
  }

  return createRealClient();
}
