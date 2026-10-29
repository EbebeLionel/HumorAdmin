"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUPS, RESOURCES } from "@/lib/resources";

export default function SideNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="side-nav">
      <Link href="/" className={isActive("/") ? "side-link active" : "side-link"} aria-current={isActive("/") ? "page" : undefined}>
        <span aria-hidden="true">📊</span>
        Dashboard
      </Link>
      {GROUPS.map((group) => (
        <div key={group} className="side-group">
          <p className="side-group-label">{group}</p>
          {RESOURCES.filter((r) => r.group === group).map((r) => {
            const href = `/${r.key}`;
            return (
              <Link
                key={r.key}
                href={href}
                className={isActive(href) ? "side-link active" : "side-link"}
                aria-current={isActive(href) ? "page" : undefined}
              >
                <span aria-hidden="true">{r.icon}</span>
                {r.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
