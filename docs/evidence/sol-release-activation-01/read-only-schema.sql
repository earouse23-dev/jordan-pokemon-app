select jsonb_build_object(
  'columns',(select md5(string_agg(row(c.table_schema,c.table_name,c.column_name,c.data_type,c.is_nullable,c.column_default)::text,E'\n' order by c.table_schema,c.table_name,c.ordinal_position)) from information_schema.columns c where c.table_schema in ('public','grading_private')),
  'constraints',(select md5(string_agg(n.nspname||'.'||c.relname||':'||x.conname||':'||pg_get_constraintdef(x.oid),E'\n' order by n.nspname,c.relname,x.conname)) from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','grading_private')),
  'policies',(select md5(string_agg(row(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check)::text,E'\n' order by schemaname,tablename,policyname)) from pg_policies where schemaname in ('public','grading_private','storage')),
  'functions',(select md5(string_agg(pg_get_functiondef(p.oid),E'\n' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','grading_private') and p.prokind='f'),
  'grants',(select md5(string_agg(row(table_schema,table_name,column_name,grantee,privilege_type)::text,E'\n' order by table_schema,table_name,column_name,grantee,privilege_type)) from information_schema.column_privileges where table_schema in ('public','grading_private','auth','storage') and grantee in ('anon','authenticated','service_role')),
  'history',(select md5(string_agg(to_jsonb(m)::text,E'\n' order by version)) from supabase_migrations.schema_migrations m),
  'indexes',(select md5(string_agg(indexdef,E'\n' order by schemaname,tablename,indexname)) from pg_indexes where schemaname in ('public','grading_private')),
  'triggers',(select md5(string_agg(pg_get_triggerdef(t.oid),E'\n' order by n.nspname,c.relname,t.tgname)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','grading_private') and not t.tgisinternal),
  'buckets',(select md5(string_agg(to_jsonb(b)::text,E'\n' order by id)) from storage.buckets b)
) as schema_fingerprints;
