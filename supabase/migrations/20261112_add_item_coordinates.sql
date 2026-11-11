-- 분실물 위치를 지도 좌표로도 저장 (카카오맵 위치 선택)
alter table public.items
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.items
  add constraint items_lat_range check (lat is null or lat between -90 and 90),
  add constraint items_lng_range check (lng is null or lng between -180 and 180),
  add constraint items_latlng_pair check ((lat is null) = (lng is null));
