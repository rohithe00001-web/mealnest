import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPaymentMode } from "@/lib/payment-mode.functions";

export function usePaymentMode() {
  const fn = useServerFn(getPaymentMode);
  return useQuery({
    queryKey: ["payment-mode"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
