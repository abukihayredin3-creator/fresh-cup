"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiOrigin } from "./api-client";
import { useAuth } from "./auth-context";

/** Live order-status updates over /ws/orders — see OrdersGateway. Falls back to whatever the
 * REST query already has if the socket can't connect; nothing here is load-bearing for correctness. */
export function useOrderTracking(orderId: string | undefined): { connected: boolean } {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!orderId || !accessToken) return;

    const socket: Socket = io(`${apiOrigin}/ws/orders`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    function handleUpdate() {
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["order-timeline", orderId] });
    }

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribeOrder", { orderId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("order.created", handleUpdate);
    socket.on("order.status_changed", handleUpdate);

    return () => {
      socket.disconnect();
    };
  }, [orderId, accessToken, queryClient]);

  return { connected };
}
