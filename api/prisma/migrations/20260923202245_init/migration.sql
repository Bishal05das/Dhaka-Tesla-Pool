-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'RIDE_PAYMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "distance_from_start_m" INTEGER NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'MATCHED',
    "capacity" SMALLINT NOT NULL,
    "seats_occupied" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrived_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passenger_id" UUID NOT NULL,
    "pickup_stop_id" INTEGER NOT NULL,
    "drop_stop_id" INTEGER NOT NULL,
    "seats" SMALLINT NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "payment_method" "PaymentMethod" NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "est_solo_fare_poisha" INTEGER NOT NULL,
    "est_pooled_fare_poisha" INTEGER NOT NULL,
    "base_fare_poisha" INTEGER,
    "distance_charge_poisha" INTEGER,
    "pool_discount_poisha" INTEGER,
    "final_fare_poisha" INTEGER,
    "pooled" BOOLEAN,
    "cancelled_by" UUID,
    "cancel_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pool_id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "seats" SMALLINT NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ride_request_id" UUID,
    "pool_id" UUID,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "actor_user_id" UUID,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "user_id" UUID NOT NULL,
    "balance_poisha" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "amount_poisha" INTEGER NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "ride_request_id" UUID,
    "balance_after_poisha" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ride_request_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_poisha" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "stops_name_key" ON "stops"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stops_sequence_key" ON "stops"("sequence");

-- CreateIndex
CREATE INDEX "pools_vehicle_id_created_at_idx" ON "pools"("vehicle_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_created_at_idx" ON "ride_requests"("passenger_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_status_created_at_idx" ON "ride_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pool_members_ride_request_id_key" ON "pool_members"("ride_request_id");

-- CreateIndex
CREATE INDEX "pool_members_pool_id_idx" ON "pool_members"("pool_id");

-- CreateIndex
CREATE INDEX "ride_status_history_ride_request_id_created_at_idx" ON "ride_status_history"("ride_request_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_status_history_pool_id_created_at_idx" ON "ride_status_history"("pool_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_ride_request_id_key" ON "payments"("ride_request_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_stop_id_fkey" FOREIGN KEY ("pickup_stop_id") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_drop_stop_id_fkey" FOREIGN KEY ("drop_stop_id") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints (Prisma cannot express CHECKs or partial indexes).
-- These are the database's last line of defence for the rules in
-- docs/domain-rules.md, independent of application code.
-- ---------------------------------------------------------------------------

-- users
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"));

-- vehicles: a Tesla has 1-3 seats
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_capacity_chk" CHECK ("capacity" BETWEEN 1 AND 3);

-- stops
ALTER TABLE "stops" ADD CONSTRAINT "stops_sequence_chk" CHECK ("sequence" >= 0);
ALTER TABLE "stops" ADD CONSTRAINT "stops_distance_chk" CHECK ("distance_from_start_m" >= 0);

-- pools: occupied seats can never exceed the pool's capacity
ALTER TABLE "pools" ADD CONSTRAINT "pools_capacity_chk" CHECK ("capacity" BETWEEN 1 AND 3);
ALTER TABLE "pools" ADD CONSTRAINT "pools_seats_chk" CHECK ("seats_occupied" BETWEEN 0 AND "capacity");
-- at most one active pool per Tesla
CREATE UNIQUE INDEX "pools_one_active_per_vehicle_uq" ON "pools"("vehicle_id")
  WHERE "status" IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');

-- ride_requests
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_seats_chk" CHECK ("seats" BETWEEN 1 AND 3);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_stops_chk" CHECK ("pickup_stop_id" <> "drop_stop_id");
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_distance_chk" CHECK ("distance_m" > 0);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_fares_chk" CHECK (
  "est_solo_fare_poisha" > 0 AND "est_pooled_fare_poisha" > 0
  AND ("final_fare_poisha" IS NULL OR "final_fare_poisha" > 0)
  AND ("pool_discount_poisha" IS NULL OR "pool_discount_poisha" >= 0)
);
-- at most one active ride per passenger (also makes "request ride" safe to retry)
CREATE UNIQUE INDEX "ride_requests_one_active_per_passenger_uq" ON "ride_requests"("passenger_id")
  WHERE "status" IN ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED');

-- pool_members
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_seats_chk" CHECK ("seats" BETWEEN 1 AND 3);

-- ride_status_history: every row is about a ride request, a pool, or both
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_subject_chk"
  CHECK ("ride_request_id" IS NOT NULL OR "pool_id" IS NOT NULL);

-- wallets: TeslaPay can never go negative
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_chk" CHECK ("balance_poisha" >= 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_amount_chk" CHECK ("amount_poisha" <> 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_balance_chk" CHECK ("balance_after_poisha" >= 0);

-- payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_chk" CHECK ("amount_poisha" > 0);
