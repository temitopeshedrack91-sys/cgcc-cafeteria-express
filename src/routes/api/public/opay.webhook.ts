import { createFileRoute } from "@tanstack/react-router";

// Fail closed until provider-specific verification and end-to-end tests pass.
export const Route = createFileRoute("/api/public/opay/webhook")({
  server: {
    handlers: {
      POST: async () => new Response("Payment integration is not activated", { status: 503 }),
    },
  },
});
