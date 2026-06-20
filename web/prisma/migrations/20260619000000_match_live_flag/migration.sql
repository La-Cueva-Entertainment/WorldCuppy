-- AlterTable: add live flag to Match (false = scheduled or finished, true = in progress)
ALTER TABLE "Match" ADD COLUMN "live" BOOLEAN NOT NULL DEFAULT false;
