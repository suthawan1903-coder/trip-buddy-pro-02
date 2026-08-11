import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, "รหัสพนักงานใช้ได้เฉพาะ a-z 0-9 . _ -");

const createSchema = z.object({
  employeeCode: codeSchema,
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional(),
  position: z.string().trim().max(60).optional(),
  password: z.string().min(6).max(72),
  role: z.enum(["admin", "employee"]),
});


/** true when at least one admin exists (used to gate first-time setup) */
export const hasAdminAccount = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { hasAdmin: (count ?? 0) > 0 };
});

/** Resolves an employee code to the internal login email (no data exposed). */
export const codeToEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ employeeCode: codeSchema }).parse(input))
  .handler(async ({ data }) => {
    return { email: `${data.employeeCode.toLowerCase()}@ejh.local` };
  });

/** One-time bootstrap: creates the very first admin when none exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.omit({ role: true }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("มีผู้ดูแลระบบอยู่แล้ว");

    const code = data.employeeCode.toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${code}@ejh.local`,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "สร้างผู้ใช้ไม่สำเร็จ");

    const uid = created.user.id;
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      employee_code: code,
      full_name: data.fullName,
      phone: data.phone || null,
      position: data.position || null,
    });

    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    return { ok: true, email: `${code}@ejh.local` };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, employee_code, full_name, phone, position, active, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);

    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "employee" }));
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.employeeCode.toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${code}@ejh.local`,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "สร้างผู้ใช้ไม่สำเร็จ");

    const uid = created.user.id;
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      employee_code: code,
      full_name: data.fullName,
      phone: data.phone || null,
      position: data.position || null,
    });

    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(pErr.message.includes("duplicate") ? "รหัสพนักงานนี้ถูกใช้แล้ว" : pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    return { ok: true, id: uid };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        fullName: z.string().trim().min(2).max(80).optional(),
        phone: z.string().trim().max(30).optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).max(72).optional(),
        role: z.enum(["admin", "employee"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      full_name?: string;
      phone?: string | null;
      active?: boolean;
    } = {};
    if (data.fullName !== undefined) patch["full_name"] = data.fullName;
    if (data.phone !== undefined) patch["phone"] = data.phone || null;
    if (data.active !== undefined) patch["active"] = data.active;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.id, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.id === context.userId) throw new Error("ลบบัญชีตัวเองไม่ได้");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
