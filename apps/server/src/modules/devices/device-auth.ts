import type { PrismaClient } from "@prisma/client";
import { verifySecret } from "./device.service";

export function readDeviceTokenHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function authenticateDeviceToken(
  prisma: PrismaClient,
  deviceId: string,
  token: string
) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device?.tokenHash || !verifySecret(device.tokenHash, token)) return null;
  return device;
}
