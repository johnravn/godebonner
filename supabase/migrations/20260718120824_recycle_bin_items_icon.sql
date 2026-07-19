-- Allow admins to pick a Win95 icon for each papirkurv item.

alter table public.recycle_bin_items
  add column icon text not null default 'RecycleFile';

comment on column public.recycle_bin_items.icon is
  'React95 icon component name shown for this item (e.g. RecycleFile, FileText).';
