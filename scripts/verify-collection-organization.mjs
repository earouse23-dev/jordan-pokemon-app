import { readFile } from "node:fs/promises";

const [domain, data, app, shell, migration, databaseTest, browserTest] =
  await Promise.all([
    readFile(
      new URL("../lib/collection-organization.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/supabase-data.js", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260903065732_organize_collection_depth.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/tests/database/collection_organization.test.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../tests/browser/ui-regression.spec.js", import.meta.url),
      "utf8",
    ),
  ]);

const failures = [];
const requirePattern = (source, pattern, label) => {
  if (!pattern.test(source)) failures.push(label);
};

for (const table of [
  "collection_custom_field_definitions",
  "collection_item_attachments",
  "collection_goals",
  "collection_goal_events",
  "collection_organization_operations",
]) {
  requirePattern(
    migration,
    new RegExp(`create table if not exists public\\.${table}`, "i"),
    `table ${table}`,
  );
  requirePattern(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `RLS ${table}`,
  );
}

for (const rpc of [
  "search_collection_positions",
  "bulk_organize_collection_items_v2",
  "undo_collection_organization_operation",
  "get_collection_goal_progress",
  "get_collection_organization_summary",
  "rollback_collection_import_v2",
])
  requirePattern(
    migration,
    new RegExp(`function public\\.${rpc}`),
    `RPC ${rpc}`,
  );

requirePattern(
  migration,
  /organization_search tsvector generated always[\s\S]+using gin\(organization_search\)/i,
  "indexed server search",
);
requirePattern(
  migration,
  /item_snapshots[\s\S]+undo_collection_organization_operation[\s\S]+edited again/i,
  "recoverable bulk history",
);
requirePattern(
  migration,
  /refresh_goals_from_new_rows[\s\S]+refresh_goals_from_old_rows/i,
  "automatic goal refresh",
);
requirePattern(
  migration,
  /collection-item-files[\s\S]+storage\.foldername\(name\)/i,
  "private attachment storage",
);
requirePattern(
  domain,
  /metadataStatus[\s\S]+unsupported[\s\S]+complete: false/,
  "fail-closed goal metadata",
);
requirePattern(data, /loadCollectionSearchPage/, "server page data contract");
requirePattern(
  data,
  /rollback_collection_import_v2/,
  "organization-safe import rollback",
);
requirePattern(app, /previewBulkOrganization/, "bulk preview UI");
requirePattern(
  app,
  /LARGE_INVENTORY_THRESHOLD[\s\S]+loadCollectionSearchPage/,
  "large inventory server paging",
);
requirePattern(app, /Undo last bulk change/, "bulk undo UI");
requirePattern(app, /collectionAttachmentMarkup/, "attachment UI");
requirePattern(shell, /id="collectionOrganization"/, "organization workspace");
requirePattern(
  databaseTest,
  /cross-owner organization reads are denied/i,
  "database isolation assertion",
);
requirePattern(
  browserTest,
  /collection organization is accessible/i,
  "browser organization coverage",
);

if (failures.length)
  throw new Error(
    `Collection organization verification failed: ${failures.join(", ")}`,
  );

console.info(
  "Verified folders, labels, locations, saved views, goals, private files, indexed paging, atomic previews, and safe undo contracts.",
);
