"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/users", label: "Users", icon: "👥" },
  { href: "/media", label: "AI media", icon: "🖼️" },
  { href: "/votes", label: "Votes & ratings", icon: "🗳️" },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="side-nav">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "side-link active" : "side-link"}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
