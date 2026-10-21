import { type NextRequest } from "next/server";
import { proxy, config as proxyConfig } from "./proxy";

export async function middleware(request: NextRequest) {
  return await proxy(request);
}

export const config = proxyConfig;
