import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getWishlistIds, toggleWishlist } from "@/lib/customer.functions";

export function WishlistButton({
  dishId,
  className = "",
  size = "sm",
}: {
  dishId: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toggleFn = useServerFn(toggleWishlist);
  const listFn = useServerFn(getWishlistIds);

  const { data: ids } = useQuery({
    queryKey: ["wishlist-ids"],
    queryFn: () => listFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const wished = !!ids?.includes(dishId);

  const mut = useMutation({
    mutationFn: () => toggleFn({ data: { dishId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(res.wished ? "Added to wishlist" : "Removed from wishlist");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const dim = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          toast.info("Sign in to save favorites");
          navigate({ to: "/auth" });
          return;
        }
        mut.mutate();
      }}
      className={`grid ${dim} place-items-center rounded-full bg-card/90 backdrop-blur shadow-sm hover:bg-card transition-colors ${className}`}
    >
      <Heart
        className={`${icon} ${wished ? "fill-destructive text-destructive" : "text-foreground"}`}
      />
    </button>
  );
}
