ALTER TABLE spotlight.products
  ADD COLUMN purchase_fx_rate numeric(18,8),
  ADD COLUMN purchase_fx_source text,
  ADD COLUMN purchase_fx_date date,
  ADD CONSTRAINT purchase_fx_provenance CHECK (
    purchase_fx_rate IS NULL OR
    (purchase_fx_rate > 0 AND purchase_fx_source IS NOT NULL AND length(purchase_fx_source) > 0 AND purchase_fx_date IS NOT NULL)
  );
