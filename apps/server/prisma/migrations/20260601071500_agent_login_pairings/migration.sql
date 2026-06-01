CREATE TABLE "AgentLoginPairing" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'unknown',
    "userId" TEXT,
    "deviceId" TEXT,
    "deviceToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLoginPairing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentLoginPairing_tokenHash_key" ON "AgentLoginPairing"("tokenHash");
