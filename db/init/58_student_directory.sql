-- 58_student_directory.sql — Batch 6 rebrand: open to everyone, students identified
-- by a mapped + verified university email. Idempotent.
--
-- Model: anyone joins with any email (their chosen login address). Separately they
-- may add a university email; once they click the emailed verify link it is mapped
-- to their account (student_email + student_email_verified_at) and unlocks student
-- perks (student_only deals). isVerifiedStudent() accepts either this mapped student
-- email OR the legacy path (login email itself on a university domain), and matches
-- subdomains (e.g. g12345@campus.ru.ac.za) as well as the base domain.

ALTER TABLE users ADD COLUMN IF NOT EXISTS student_email             VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_email_verified_at TIMESTAMPTZ;

-- The single-use token table (09) only allowed 'password_reset'/'email_verify'.
-- Widen the column and the CHECK so the student-email verification token is valid.
ALTER TABLE auth_tokens ALTER COLUMN purpose TYPE VARCHAR(40);
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
    CHECK (purpose IN ('password_reset', 'email_verify', 'student_email_verify'));

-- The full allowlist of South African public universities (26) + a few well-known
-- distinct student-email domains. Subdomain matching in code covers students.*/campus.*.
INSERT INTO student_domains (domain, label) VALUES
  ('uct.ac.za',     'University of Cape Town'),
  ('myuct.ac.za',   'University of Cape Town (students)'),
  ('wits.ac.za',    'University of the Witwatersrand'),
  ('sun.ac.za',     'Stellenbosch University'),
  ('up.ac.za',      'University of Pretoria'),
  ('tuks.co.za',    'University of Pretoria (students)'),
  ('ukzn.ac.za',    'University of KwaZulu-Natal'),
  ('ru.ac.za',      'Rhodes University'),
  ('uj.ac.za',      'University of Johannesburg'),
  ('uwc.ac.za',     'University of the Western Cape'),
  ('ufs.ac.za',     'University of the Free State'),
  ('nwu.ac.za',     'North-West University'),
  ('unisa.ac.za',   'University of South Africa'),
  ('mandela.ac.za', 'Nelson Mandela University'),
  ('nmmu.ac.za',    'Nelson Mandela University (legacy)'),
  ('ufh.ac.za',     'University of Fort Hare'),
  ('ul.ac.za',      'University of Limpopo'),
  ('univen.ac.za',  'University of Venda'),
  ('unizulu.ac.za', 'University of Zululand'),
  ('wsu.ac.za',     'Walter Sisulu University'),
  ('ump.ac.za',     'University of Mpumalanga'),
  ('spu.ac.za',     'Sol Plaatje University'),
  ('smu.ac.za',     'Sefako Makgatho Health Sciences University'),
  ('cput.ac.za',    'Cape Peninsula University of Technology'),
  ('dut.ac.za',     'Durban University of Technology'),
  ('tut.ac.za',     'Tshwane University of Technology'),
  ('vut.ac.za',     'Vaal University of Technology'),
  ('cut.ac.za',     'Central University of Technology'),
  ('mut.ac.za',     'Mangosuthu University of Technology')
ON CONFLICT (domain) DO NOTHING;
