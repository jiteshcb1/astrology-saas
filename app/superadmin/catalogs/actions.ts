"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CatalogType, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import {
  type CatalogFormState,
  type CatalogInput,
  createCatalogItemCore,
  deleteCatalogItemCore,
  setCatalogItemActiveCore,
  updateCatalogItemCore,
} from "@/lib/catalog";

function parseType(raw: string): CatalogType | null {
  return raw === "theme_color" || raw === "font" || raw === "calendar_provider" ? raw : null;
}

function buildValue(type: CatalogType, formData: FormData): Prisma.InputJsonValue {
  if (type === "theme_color") return { hex: String(formData.get("hex") ?? "").trim() };
  if (type === "font")
    return {
      script: String(formData.get("script") ?? "latin"),
      fontFamily: String(formData.get("fontFamily") ?? "").trim(),
    };
  return {};
}

function readInput(formData: FormData): { input?: CatalogInput; error?: string } {
  const type = parseType(String(formData.get("type") ?? ""));
  if (!type) return { error: "Invalid type." };
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));
  if (!Number.isInteger(sortOrder)) return { error: "Sort order must be a whole number." };
  return {
    input: {
      type,
      key: String(formData.get("key") ?? ""),
      label: String(formData.get("label") ?? ""),
      value: buildValue(type, formData),
      sortOrder,
    },
  };
}

export async function createCatalogAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { session } = await requireRole("access:superadmin");
  const { input, error } = readInput(formData);
  if (error || !input) return { error: error ?? "Invalid input." };
  const result = await createCatalogItemCore(input, session.user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/catalogs");
  redirect("/superadmin/catalogs");
}

export async function updateCatalogAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  const { input, error } = readInput(formData);
  if (error || !input) return { error: error ?? "Invalid input." };
  const result = await updateCatalogItemCore(id, input, session.user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/catalogs");
  redirect("/superadmin/catalogs");
}

export async function toggleCatalogAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  await setCatalogItemActiveCore(id, isActive, session.user.id);
  revalidatePath("/superadmin/catalogs");
}

export async function deleteCatalogAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  await deleteCatalogItemCore(id, session.user.id);
  revalidatePath("/superadmin/catalogs");
}
