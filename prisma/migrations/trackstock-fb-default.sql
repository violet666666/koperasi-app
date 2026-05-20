-- Migration: Set trackStock=false for existing F&B products
-- Date: 2026-05-21
-- Context: Management doesn't use automatic recipe/ingredient tracking.
--          F&B products should not have stock deducted on checkout.
--          Only retail goods (canned drinks, cigarettes) need trackStock=true.

-- Step 1: Count affected products before migration
SELECT unitType, trackStock, count(*) as total
FROM "StoreProduct"
WHERE unitType IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "deletedAt" IS NULL
  AND "isActive" = true
GROUP BY unitType, trackStock;

-- Step 2: Update all finished F&B products to trackStock=false
UPDATE "StoreProduct"
SET "trackStock" = false
WHERE "unitType" IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "productType" = 'finished'
  AND "trackStock" = true;

-- Step 3: Verify after migration
SELECT unitType, trackStock, count(*) as total
FROM "StoreProduct"
WHERE unitType IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "deletedAt" IS NULL
  AND "isActive" = true
GROUP BY unitType, trackStock;

-- NOTE: If any retail goods (canned drinks, etc.) need stock tracking,
-- admin should manually set trackStock=true for those specific products
-- via Manajemen Menu after running this migration.
