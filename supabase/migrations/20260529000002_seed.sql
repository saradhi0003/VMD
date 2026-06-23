-- Seed data for the Vayumukhi farm.
-- Run AFTER 0001_init.sql. Safe to re-run (idempotent on the farm name).

insert into farms (name, timezone, owner_whatsapp)
values ('Vayumukhi Dairy', 'Asia/Kolkata', '+919876543210')
on conflict do nothing;

with f as (select id from farms where name = 'Vayumukhi Dairy' limit 1)
insert into products (farm_id, slug, name, unit, price_minor)
select f.id, x.slug, x.name, x.unit, x.price_minor
from f cross join (values
  ('milk', 'Fresh Whole Milk', 'litre', 6000),
  ('curd', 'Thick Curd (Dahi)', 'kg',   12000),
  ('ghee', 'Cultured Ghee',    'litre', 120000)
) as x(slug, name, unit, price_minor)
on conflict (farm_id, slug) do nothing;

with f as (select id from farms where name = 'Vayumukhi Dairy' limit 1)
insert into animals (farm_id, tag, name, type, status, health)
select f.id, x.tag, x.name, x.type::animal_type, x.status::animal_status, x.health::health_status
from f cross join (values
  ('VD-C01', 'Ganga',     'cow',     'milking',  'healthy'),
  ('VD-B02', 'Kaveri',    'buffalo', 'milking',  'healthy'),
  ('VD-C03', 'Nandi',     'cow',     'pregnant', 'observation'),
  ('VD-B04', 'Godavari',  'buffalo', 'dry',      'healthy'),
  ('VD-C05', 'Yamuna',    'cow',     'milking',  'healthy'),
  ('VD-C06', 'Krishna',   'calf',    'calf',     'healthy')
) as x(tag, name, type, status, health)
on conflict (farm_id, tag) do nothing;
