# ADR 0001: retain the dependency-free PWA shell

Status: accepted for this product slice.

The repo already deployed as a static PWA. A full framework migration would add cost without improving the delivered mobile interaction prototype. Mica therefore retains standards-based HTML/CSS/ES modules and adds clean production seams: pure business functions, typed provider contracts, normalized Supabase schema, service worker, and test/build scripts.

Provider secrets and trusted mutations are not moved into the browser. Production adds authenticated Supabase functions behind the same contracts. Revisit a framework migration only when server-rendered marketing/SEO, route complexity, team conventions, or measured maintenance needs justify it.

