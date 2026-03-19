import { NextRequest } from "next/server";
import { handle } from "../../proxy";

async function route(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return handle(req, {
    params: {
      path: params.path,
    },
  });
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
export const OPTIONS = route;

export const runtime = "edge";
