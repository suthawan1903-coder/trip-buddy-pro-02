import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const settingsSchema = z.object({
  fuelPrice: z.number().min(0).max(1000),
  fuelEfficiency: z.number().min(0.1).max(100),
  ratePerKm: z.number().min(0).max(1000),
  checkinRadiusKm: z.number().min(0.1).max(200),
  lineToken: z.string().max(4000).optional(),
  lineSecret: z.string().max(500).optional(),
  lineNotifyToken: z.string().max(4000).optional(),
  lineGroupId: z.string().max(200).optional(),
  lineUserId: z.string().max(200).optional(),
});


/** Global settings, readable by every signed-in employee. */
export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select(
        "fuel_price, fuel_efficiency, rate_per_km, checkin_radius_km, line_token, line_secret, line_notify_token, line_group_id, line_user_id",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      fuelPrice: Number(data?.fuel_price ?? 38),
      fuelEfficiency: Number(data?.fuel_efficiency ?? 12),
      ratePerKm: Number(data?.rate_per_km ?? 0),
      checkinRadiusKm: Number(data?.checkin_radius_km ?? 5),
      lineToken: data?.line_token ?? "",
      lineSecret: data?.line_secret ?? "",
      lineNotifyToken: data?.line_notify_token ?? "",
      lineGroupId: data?.line_group_id ?? "",
      lineUserId: data?.line_user_id ?? "",
    };
  });



/** Admin-only write of the global settings. */
export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขการตั้งค่าได้");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({
        fuel_price: data.fuelPrice,
        fuel_efficiency: data.fuelEfficiency,
        rate_per_km: data.ratePerKm,
        checkin_radius_km: data.checkinRadiusKm,
        line_token: data.lineToken ?? "",
        line_secret: data.lineSecret ?? "",
        line_notify_token: data.lineNotifyToken ?? "",
      })

      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
