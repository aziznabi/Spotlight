CREATE SCHEMA IF NOT EXISTS spotlight;
SET search_path TO spotlight, public;
CREATE SEQUENCE sku_sequence START 1;
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password_hash text NOT NULL, name text NOT NULL, role text NOT NULL CHECK(role IN ('admin','operator')), disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE login_attempts (key text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text UNIQUE NOT NULL DEFAULT ('SP-' || lpad(nextval('sku_sequence')::text,8,'0')),
 title text NOT NULL, brand text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '', attributes jsonb NOT NULL DEFAULT '{}',
 condition text NOT NULL DEFAULT 'unknown', defects text NOT NULL DEFAULT '', purchase_minor integer CHECK(purchase_minor>=0), purchase_currency text NOT NULL DEFAULT 'EUR', purchased_on date,
 source text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', internal_notes text NOT NULL DEFAULT '',
 price_minor integer CHECK(price_minor>0), currency text NOT NULL DEFAULT 'EUR', description text NOT NULL DEFAULT '', tags jsonb NOT NULL DEFAULT '[]',
 preparation text NOT NULL DEFAULT 'draft' CHECK(preparation IN ('draft','identified','priced','photographed','ready','approved')),
 stock text NOT NULL DEFAULT 'available' CHECK(stock IN ('available','committed','sold','quarantine')),
 stock_order_id text, authenticity jsonb NOT NULL DEFAULT '{"status":"unreviewed","observations":"","certificateUrl":""}',
 approved_by uuid REFERENCES users(id), approved_at timestamptz, revision integer NOT NULL DEFAULT 1, is_demo boolean NOT NULL DEFAULT false,
 shopify_product_id text UNIQUE, shopify_variant_id text UNIQUE, shopify_inventory_id text UNIQUE, shopify_activated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE costs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), kind text NOT NULL, amount_minor integer CHECK(amount_minor>=0), currency text NOT NULL, known boolean NOT NULL DEFAULT false, fx_rate numeric, fx_source text, fx_date date, created_at timestamptz DEFAULT now(), CHECK((known AND amount_minor IS NOT NULL) OR (NOT known AND amount_minor IS NULL)));
CREATE TABLE assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), source_id uuid REFERENCES assets(id), kind text NOT NULL CHECK(kind IN ('original','variant','marketing')),
 storage_key text NOT NULL UNIQUE, sha256 text NOT NULL, mime text NOT NULL, width integer NOT NULL, height integer NOT NULL, bytes integer NOT NULL,
 review text NOT NULL DEFAULT 'pending' CHECK(review IN ('pending','approved','rejected')), selected boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0,
 provider text, operation text, parameters jsonb NOT NULL DEFAULT '{}', public_url text, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT selected OR review='approved'), CHECK(kind <> 'original' OR source_id IS NULL)
);
CREATE FUNCTION immutable_asset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.storage_key<>OLD.storage_key OR NEW.sha256<>OLD.sha256 OR NEW.source_id IS DISTINCT FROM OLD.source_id OR NEW.kind<>OLD.kind OR NEW.product_id<>OLD.product_id THEN RAISE EXCEPTION 'Asset bytes and lineage are immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER protect_assets BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION immutable_asset();
CREATE FUNCTION stable_sku() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.sku<>OLD.sku THEN RAISE EXCEPTION 'SKU is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_sku BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION stable_sku();
CREATE TABLE jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES products(id), kind text NOT NULL CHECK(kind IN ('pricing','studio','identify','publish','withdraw','reconcile')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','cancelled')),
 input jsonb NOT NULL DEFAULT '{}', result jsonb, dedupe_key text NOT NULL UNIQUE, attempts integer NOT NULL DEFAULT 0,
 run_id text, provider_id text, processing_version text NOT NULL DEFAULT 'v1', error text, cost_minor integer, cost_currency text, latency_ms integer,
 lease_until timestamptz, started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_dispatch ON jobs(status,created_at);
CREATE TABLE benchmarks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), job_id uuid UNIQUE REFERENCES jobs(id), fingerprint jsonb NOT NULL, cache_key text NOT NULL, parameters jsonb NOT NULL, result jsonb NOT NULL, provider text NOT NULL, calculation_version text NOT NULL, cost_minor integer, latency_ms integer, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX benchmark_cache ON benchmarks(cache_key,created_at DESC);
CREATE TABLE suggestions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), job_id uuid REFERENCES jobs(id), provider text NOT NULL, model text NOT NULL, evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), channel text NOT NULL CHECK(channel IN ('shopify','vinted','vestiaire')), title text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', price_minor integer, currency text NOT NULL DEFAULT 'EUR', external_url text, external_id text, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawal_pending','withdrawn','sold','error')), confirmed_at timestamptz, last_error text, UNIQUE(product_id,channel));
CREATE TABLE orders (id text PRIMARY KEY, channel text NOT NULL, name text NOT NULL, financial_status text NOT NULL, fulfillment_status text NOT NULL, total_minor integer, currency text NOT NULL, test boolean NOT NULL DEFAULT false, cancelled boolean NOT NULL DEFAULT false, event_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_lines (order_id text NOT NULL REFERENCES orders(id), line_id text NOT NULL, product_id uuid REFERENCES products(id), sku text, quantity integer NOT NULL, price_minor integer, PRIMARY KEY(order_id,line_id));
CREATE TABLE webhook_events (id text PRIMARY KEY, topic text NOT NULL, shop text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', error text, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz);
CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES products(id), kind text NOT NULL, title text NOT NULL, priority integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')), dedupe_key text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, completed_by uuid REFERENCES users(id));
CREATE TABLE audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES users(id), product_id uuid REFERENCES products(id), event text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
