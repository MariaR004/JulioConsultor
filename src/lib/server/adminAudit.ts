import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAdminEvent(
  serviceClient: SupabaseClient,
  options: {
    action: string;
    actorUserId: string | null;
    entityId?: string | null;
    entityType: string;
    metadata?: Record<string, unknown>;
  }
) {
  const metadata = options.metadata || {};
  const { error } = await serviceClient.from("admin_audit_events").insert({
    action: options.action,
    actor_user_id: options.actorUserId,
    entity_id: options.entityId || null,
    entity_type: options.entityType,
    metadata
  });

  if (error) {
    console.warn("Admin audit event was not recorded:", error.message);
  }
}
