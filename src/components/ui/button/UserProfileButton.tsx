import { signOut } from "@/actions/auth";
import useSupabaseUser from "@/hooks/useSupabaseUser";
import { DropdownItemProps } from "@/types/component";
import { Logout, User } from "@/utils/icons";
import { useRouter } from "@bprogress/next/app";
import {
  addToast,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
} from "@heroui/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import NetflixAvatar from "../other/NetflixAvatar";

const UserProfileButton: React.FC = () => {
  const router = useRouter();
  const [logout, setLogout] = useState(false);
  const { data: user } = useSupabaseUser();

  const guest = !user;

  const rawName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "User";

  const displayName = rawName.replace(/_/g, " ").trim();

  const ITEMS: DropdownItemProps[] = useMemo(
    () => [
      ...(guest
        ? [
            {
              label: "Sign In",
              href: "/auth",
              icon: <User />,
            },
          ]
        : [
            {
              label: displayName,
              description: user?.email || undefined,
              icon: <User className="text-zinc-400" />,
              showDivider: true,
              isReadOnly: true,
              className: "font-semibold text-white cursor-default select-none",
            },
            {
              label: "Logout",
              onClick: async () => {
                if (logout) return;
                setLogout(true);
                const { success, message } = await signOut();
                addToast({
                  title: message,
                  color: success ? "primary" : "danger",
                });
                if (!success) {
                  return setLogout(false);
                }
                return router.push("/auth");
              },
              icon: logout ? <Spinner size="sm" color="danger" /> : <Logout />,
              color: "danger" as const,
              className: "text-danger",
            },
          ]),
    ],
    [guest, displayName, user?.email, logout, router],
  );

  const ProfileButton = (
    <Button
      title={user?.username || "Sign In"}
      variant="light"
      isIconOnly
      size="sm"
      className="size-9 min-w-9 p-0 bg-transparent hover:bg-white/10 rounded-full transition-all flex items-center justify-center focus:outline-none cursor-pointer"
      aria-label={user?.username ? `Profile for ${user.username}` : "Sign In"}
    >
      {guest ? (
        <div className="size-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-[#E50914]/70 flex items-center justify-center text-white/90 hover:text-white transition-all shadow-xs">
          <User className="size-3.5" />
        </div>
      ) : (
        <NetflixAvatar
          size={28}
          avatarId={user?.user_metadata?.avatar_id}
          className="size-8 rounded-full ring-1 ring-white/30 hover:ring-[#E50914] hover:scale-105 transition-all shadow-xs"
        />
      )}
    </Button>
  );

  return (
    <Dropdown placement="bottom-end" showArrow closeOnSelect={false}>
      <DropdownTrigger>{ProfileButton}</DropdownTrigger>
      <DropdownMenu
        aria-label="User profile dropdown"
        variant="flat"
        className="min-w-[140px]"
        disabledKeys={logout ? ITEMS.map((i) => i.label) : undefined}
      >
        {ITEMS.map(({ label, icon, href, onClick, ...props }) => (
          <DropdownItem
            key={label}
            startContent={icon}
            as={href ? Link : undefined}
            href={href}
            onPress={onClick}
            {...props}
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default UserProfileButton;
