import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

// Server component with an inline server action — safe to drop into any guarded page.
export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <Button type="submit" variant="ghost">
        Sign out
      </Button>
    </form>
  );
}
