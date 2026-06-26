-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "purchasedSeats" INTEGER NOT NULL DEFAULT 1;

-- SP-5.4: backfill the authorized capacity from the old seatCount (which previously held purchased seats).
UPDATE "subscriptions" SET "purchasedSeats" = "seatCount";
