-- Adminer 4.17.1 PostgreSQL 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1) dump

DROP TABLE IF EXISTS "cart_items";
CREATE TABLE "public"."cart_items" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "cart_id" uuid NOT NULL,
    "product_id" uuid NOT NULL,
    "quantity" integer NOT NULL,
    "reservationId" uuid,
    "reservedUntil" timestamptz,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

CREATE INDEX "idx_cartitem_reservation" ON "public"."cart_items" USING btree ("reservationId");

INSERT INTO "cart_items" ("id", "cart_id", "product_id", "quantity", "reservationId", "reservedUntil", "createdAt", "updatedAt") VALUES
('4038ffd7-f11b-4bbc-adc4-e9d2b22ff8cb',	'1b284f6e-1c7b-4b4e-b013-cd8bb2c23876',	'fcacd358-3aaf-4cfa-8432-e266c2732a69',	10,	NULL,	NULL,	'2026-08-18 05:23:54.507129',	'2026-08-18 05:23:54.507129');

DROP TABLE IF EXISTS "carts";
CREATE TABLE "public"."carts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "status" carts_status_enum DEFAULT 'ACTIVE' NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

CREATE INDEX "idx_carts_user" ON "public"."carts" USING btree ("user_id");

INSERT INTO "carts" ("id", "user_id", "status", "createdAt", "updatedAt") VALUES
('1b284f6e-1c7b-4b4e-b013-cd8bb2c23876',	'286d5077-0935-4c2e-9bfb-7229666fa36d',	'ACTIVE',	'2026-08-18 05:22:39.367667',	'2026-08-18 05:22:39.367667');

DROP TABLE IF EXISTS "orders";
CREATE TABLE "public"."orders" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "product_id" uuid NOT NULL,
    "quantity" integer NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "status" orders_status_enum DEFAULT 'PENDING' NOT NULL,
    "idempotencyKey" character varying(100) NOT NULL,
    "reservationId" uuid,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_orders_idempotency_key" UNIQUE ("idempotencyKey")
) WITH (oids = false);

CREATE INDEX "idx_order_user_status" ON "public"."orders" USING btree ("user_id", "status");

CREATE INDEX "idx_orders_user" ON "public"."orders" USING btree ("user_id");

INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "totalAmount", "status", "idempotencyKey", "reservationId", "createdAt", "updatedAt") VALUES
('4eb11d71-c02a-45e6-9843-f756cb343116',	'286d5077-0935-4c2e-9bfb-7229666fa36d',	'fcacd358-3aaf-4cfa-8432-e266c2732a69',	5,	750000.00,	'PENDING',	'a',	NULL,	'2026-08-18 05:22:19.4675',	'2026-08-18 05:22:19.4675');

DROP TABLE IF EXISTS "products";
CREATE TABLE "public"."products" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" character varying(255) NOT NULL,
    "stock" integer DEFAULT '0' NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "saleStartAt" timestamptz,
    "saleEndAt" timestamptz,
    "version" integer DEFAULT '1' NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

CREATE INDEX "idx_product_sale_window" ON "public"."products" USING btree ("isActive", "saleStartAt");

INSERT INTO "products" ("id", "name", "stock", "price", "isActive", "saleStartAt", "saleEndAt", "version", "createdAt", "updatedAt") VALUES
('fcacd358-3aaf-4cfa-8432-e266c2732a69',	'Vaani',	10,	150000.00,	't',	'2026-08-18 05:18:40.071694+00',	'2026-09-18 05:18:40.071694+00',	1,	'2026-08-18 05:18:40.071694',	'2026-08-18 05:18:40.071694');

DROP TABLE IF EXISTS "users";
CREATE TABLE "public"."users" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(120) NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "uq_users_email" UNIQUE ("email"),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

INSERT INTO "users" ("id", "email", "name", "createdAt", "updatedAt") VALUES
('286d5077-0935-4c2e-9bfb-7229666fa36d',	'yugalkishor.saini@gmail.com',	'Yugal kishor saini',	'2026-08-18 05:16:05.08782',	'2026-08-18 05:16:05.08782');

ALTER TABLE ONLY "public"."cart_items" ADD CONSTRAINT "fk_cartitems_cart" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."cart_items" ADD CONSTRAINT "fk_cartitems_product" FOREIGN KEY (product_id) REFERENCES products(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."carts" ADD CONSTRAINT "fk_carts_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT DEFERRABLE;

ALTER TABLE ONLY "public"."orders" ADD CONSTRAINT "fk_orders_product" FOREIGN KEY (product_id) REFERENCES products(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY (user_id) REFERENCES users(id) NOT DEFERRABLE;

-- 2026-08-18 05:24:39.291197+00
