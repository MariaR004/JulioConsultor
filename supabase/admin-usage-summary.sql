create or replace function public.admin_usage_summary()
returns table (
  database_used_bytes bigint,
  database_limit_bytes bigint,
  bucket_used_bytes bigint,
  bucket_limit_bytes bigint,
  bucket_file_count bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  free_database_limit_bytes constant bigint := 524288000;
  free_bucket_limit_bytes constant bigint := 1073741824;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with bucket_usage as (
    select
      count(*)::bigint as file_count,
      coalesce(sum(
        case
          when metadata ? 'size' and (metadata ->> 'size') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint
          else 0
        end
      ), 0)::bigint as used_bytes
    from storage.objects
    where bucket_id = 'property-photos'
  )
  select
    pg_database_size(current_database())::bigint,
    free_database_limit_bytes,
    bucket_usage.used_bytes,
    free_bucket_limit_bytes,
    bucket_usage.file_count
  from bucket_usage;
end;
$$;

revoke all on function public.admin_usage_summary() from public;
grant execute on function public.admin_usage_summary() to authenticated;
