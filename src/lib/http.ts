import { NextResponse } from "next/server";
import { ClaimError } from "./claims";

/** Turns thrown errors into JSON: ClaimError messages go to the buyer, anything else is logged and hidden. */
export function errorResponse(err: unknown) {
  if (err instanceof ClaimError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
