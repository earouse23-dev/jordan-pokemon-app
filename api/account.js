import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "../lib/env.js";

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}

const STORAGE_PAGE_SIZE = 100;
const MAX_STORAGE_OBJECTS_PER_BUCKET = 50_000;
const MAX_STORAGE_PREFIXES_PER_BUCKET = 5_000;

export async function listPrivateBucketPaths(database, userId, bucketName) {
  const bucket = database.storage.from(bucketName);
  const paths = [];
  const prefixes = [userId];
  const visited = new Set();
  while (prefixes.length) {
    if (visited.size >= MAX_STORAGE_PREFIXES_PER_BUCKET)
      throw new Error("storage_prefix_limit_exceeded");
    const prefix = prefixes.shift();
    if (!prefix || visited.has(prefix)) continue;
    visited.add(prefix);
    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      const { data, error } = await bucket.list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      const entries = data || [];
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id) paths.push(path);
        else if (!visited.has(path)) prefixes.push(path);
        if (paths.length + prefixes.length > MAX_STORAGE_OBJECTS_PER_BUCKET)
          throw new Error("storage_object_limit_exceeded");
      }
      if (entries.length < STORAGE_PAGE_SIZE) break;
    }
  }
  return { bucket, paths };
}

async function removePrivateBucketPaths({ bucket, paths }) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await bucket.remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

export default async function handler(request, response) {
  if (request.method !== "DELETE") {
    response.setHeader("Allow", "DELETE");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(response, 503, { error: "Account deletion is not configured" });
  const authorization = String(request.headers.authorization || "");
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!bearerToken)
    return send(response, 401, { error: "Authentication required" });
  const database = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } =
    await database.auth.getUser(bearerToken);
  if (identityError || !identity.user)
    return send(response, 401, { error: "Authentication required" });
  const confirmation = String(request.body?.confirmation || "")
    .trim()
    .toLowerCase();
  if (
    !identity.user.email ||
    confirmation !== identity.user.email.toLowerCase()
  )
    return send(response, 400, { error: "Email confirmation does not match" });
  let inventories;
  try {
    inventories = await Promise.all(
      [
        "grading-research",
        "grading-report-thumbnails",
        "grading-outcome-proofs",
      ].map((bucketName) =>
        listPrivateBucketPaths(database, identity.user.id, bucketName),
      ),
    );
  } catch {
    return send(response, 500, {
      error: "Private grading photos could not be inventoried",
    });
  }
  const { error: withdrawalError } = await database.rpc(
    "grading_withdraw_account_training_service",
    {
      p_owner_id: identity.user.id,
      p_actor_key: "account-deletion-api",
    },
  );
  if (withdrawalError)
    return send(response, 500, {
      error: "Research consent could not be withdrawn",
    });
  try {
    for (const inventory of inventories)
      await removePrivateBucketPaths(inventory);
  } catch {
    return send(response, 500, {
      error: "Private grading photos could not be deleted",
    });
  }
  const { error: signOutError } = await database.auth.admin.signOut(
    bearerToken,
    "global",
  );
  if (signOutError)
    return send(response, 500, {
      error: "Account sessions could not be revoked",
    });
  const { error } = await database.auth.admin.deleteUser(identity.user.id);
  if (error)
    return send(response, 500, { error: "Account could not be deleted" });
  return send(response, 200, { ok: true });
}
