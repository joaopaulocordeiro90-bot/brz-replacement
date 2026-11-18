PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trades(
 id TEXT PRIMARY KEY,
 trade_date TEXT NOT NULL,
 product TEXT NOT NULL CHECK(product IN ('Soja','Milho','Sorgo','Farelo','Óleo')),
 crop_year TEXT,
 seller TEXT, buyer TEXT,
 volume_t REAL NOT NULL CHECK(volume_t>0),
 price_brl_sc REAL CHECK(price_brl_sc>0),
 delivery_basis TEXT NOT NULL DEFAULT 'FOB',
 origin_name TEXT NOT NULL,
 city TEXT NOT NULL, uf TEXT NOT NULL,
 lat REAL, lng REAL,
 geo_precision TEXT NOT NULL DEFAULT 'municipio_indicativo',
 window_start TEXT, window_end TEXT, payment_date TEXT,
 due TEXT, fethab TEXT, status TEXT NOT NULL DEFAULT 'PENDENTE',
 notes TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_product_date ON trades(product, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_city ON trades(uf, city);
CREATE TABLE IF NOT EXISTS routes(
 id TEXT PRIMARY KEY, origin_city TEXT NOT NULL, origin_uf TEXT NOT NULL,
 destination_port TEXT NOT NULL, terminal TEXT,
 modal TEXT NOT NULL CHECK(modal IN ('Rodoviário','Ferroviário','Rodo + Ferro','Rodo + Barcaça')),
 freight_brl_t REAL NOT NULL CHECK(freight_brl_t>=0),
 distance_km REAL, freight_status TEXT NOT NULL DEFAULT 'INDICATIVO',
 source TEXT NOT NULL,
 valid_from TEXT, valid_to TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes(origin_uf,origin_city,destination_port);
CREATE TABLE IF NOT EXISTS market_refs(
 id TEXT PRIMARY KEY,
 product TEXT NOT NULL,
 port TEXT NOT NULL,
 ship_month TEXT NOT NULL,
 reference_date TEXT NOT NULL,
 cbot_contract TEXT NOT NULL,
 cbot_cbu REAL CHECK(cbot_cbu>0),
 fx_brl_usd REAL CHECK(fx_brl_usd>0),
 fob_basis_cbu REAL,
 fobbins_usd_t REAL CHECK(fobbins_usd_t>=0),
 ocean_usd_t REAL CHECK(ocean_usd_t>=0),
 side TEXT NOT NULL DEFAULT 'Bid',
 source TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_market_match ON market_refs(product,port,ship_month,reference_date DESC);
CREATE TABLE IF NOT EXISTS audit_events(
 id TEXT PRIMARY KEY,
 entity TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 operation TEXT NOT NULL,
 before_json TEXT, after_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity,entity_id,created_at DESC);
