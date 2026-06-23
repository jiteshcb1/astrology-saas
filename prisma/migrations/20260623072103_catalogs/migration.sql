-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('theme_color', 'font', 'calendar_provider');

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "type" "CatalogType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_items_type_isActive_idx" ON "catalog_items"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_type_key_key" ON "catalog_items"("type", "key");
