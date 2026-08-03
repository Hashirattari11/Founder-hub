-- FounderHub AI — Phase 1 seed data
-- Run AFTER: create_profiles.sql + phase1_schema.sql
-- Requires: 5 users already signed up via the app (auth.users rows exist).
-- Run in: Supabase Dashboard → SQL Editor

-- ============================================================
-- 1) SAMPLE PROFILES (lookup auth.users by email; skip if missing)
--    Sign up these emails in the app first: /register
-- ============================================================
insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select
  u.id,
  'Aarav Mehta',
  'aaravmehta',
  'Building the future of logistics automation. Always looking for sharp minds.',
  'founder',
  array['product','strategy','fundraising'],
  'India', 'Bengaluru', 8, true
from auth.users u
where u.email = 'aarav@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select
  u.id,
  'Priya Sharma',
  'priyadev',
  'Full-stack engineer. React, Python, and systems that scale.',
  'developer',
  array['react','typescript','python','fastapi'],
  'India', 'Mumbai', 5, true
from auth.users u
where u.email = 'priya@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select
  u.id,
  'Rohan Verma',
  'rohanbuilds',
  'Backend engineer specializing in distributed systems and DevOps.',
  'developer',
  array['go','kubernetes','aws','postgres'],
  'India', 'Pune', 6, true
from auth.users u
where u.email = 'rohan@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select
  u.id,
  'Sara Khan',
  'saraoui',
  'Product designer crafting delightful, accessible interfaces.',
  'designer',
  array['figma','ui','ux','design-systems'],
  'India', 'Delhi', 4, true
from auth.users u
where u.email = 'sara@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select
  u.id,
  'Vikram Nair',
  'vikramvc',
  'Angel investor focused on AI, SaaS, and deep tech.',
  'investor',
  array['diligence','ai','saas','deep-tech'],
  'India', 'Bengaluru', 12, true
from auth.users u
where u.email = 'vikram@founderhub.app'
on conflict (id) do nothing;

-- ============================================================
-- 2) SAMPLE STARTUPS (founder_id looked up by username)
-- ============================================================
insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select
  '10000000-0000-0000-0000-000000000001',
  p.id,
  'ShipSwift',
  'Logistics automation for modern D2C brands',
  'ShipSwift gives D2C brands a single dashboard to manage carriers, returns, and live tracking across 40+ couriers.',
  'logistics',
  'mvp',
  '$100K-$500K',
  10.00,
  true,
  'Bengaluru, India',
  'https://shipswift.in',
  array['react','python','postgres','aws'],
  array['Full-Stack Developer','Product Designer'],
  true
from public.profiles p
where p.username = 'aaravmehta'
on conflict (id) do nothing;

insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select
  '10000000-0000-0000-0000-000000000002',
  p.id,
  'MediTrack AI',
  'AI triage for rural clinics',
  'MediTrack uses lightweight on-device AI to help rural health workers triage patients and surface high-risk cases first.',
  'healthtech',
  'idea',
  '$500K+',
  12.00,
  true,
  'Mumbai, India',
  'https://meditrack.ai',
  array['flutter','tensorflow','fastapi','postgres'],
  array['Backend Engineer','ML Engineer'],
  true
from public.profiles p
where p.username = 'aaravmehta'
on conflict (id) do nothing;

insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select
  '10000000-0000-0000-0000-000000000003',
  p.id,
  'GreenGrid',
  'Peer-to-peer solar energy trading',
  'GreenGrid lets households with solar panels sell surplus energy to neighbours over a blockchain-verified microgrid.',
  'cleantech',
  'mvp',
  '$500K+',
  15.00,
  false,
  'Delhi, India',
  'https://greengrid.energy',
  array['solidity','react','node','postgres'],
  array['Blockchain Engineer','Full-Stack Developer'],
  true
from public.profiles p
where p.username = 'aaravmehta'
on conflict (id) do nothing;

-- ============================================================
-- 3) SAMPLE APPLICATIONS
-- ============================================================
insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  p.id,
  'Full-Stack Developer',
  'I have built logistics dashboards at scale and would love to own ShipSwift''s product surface.',
  'pending'
from public.profiles p
where p.username = 'priyadev'
on conflict (startup_id, applicant_id) do nothing;

insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  p.id,
  'Backend Engineer',
  'Distributed systems are my bread and butter. Happy to help ShipSwift scale its carrier integrations.',
  'shortlisted'
from public.profiles p
where p.username = 'rohanbuilds'
on conflict (startup_id, applicant_id) do nothing;

insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  p.id,
  'Product Designer',
  'I design health products with empathy. Would love to shape MediTrack''s clinical workflows.',
  'pending'
from public.profiles p
where p.username = 'saraoui'
on conflict (startup_id, applicant_id) do nothing;
