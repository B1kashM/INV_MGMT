"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

// Heroicons-style outline paths (24x24)
const ICONS = {
  dashboard:
    "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",

  products:
    "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",

  category:
    "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",

  sales:
    "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",

  returns:
    "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3",

  purchases:
    "M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",

  supplier:
    "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",

  platforms:
    "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",

  collapse:
    "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5",

  expand:
    "M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5",
};

const NAV: NavGroup[] = [
  {
    heading: "Inventory",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: ICONS.dashboard,
      },
      {
        label: "Products",
        href: "/home",
        icon: ICONS.products,
      },
      {
        label: "Category",
        href: "/category",
        icon: ICONS.category,
      },
    ],
  },

  {
    heading: "Transactions",
    items: [
      {
        label: "Sales",
        href: "/sales",
        icon: ICONS.sales,
      },
      {
        label: "Returns",
        href: "/returns",
        icon: ICONS.returns,
      },
      {
        label: "Purchases",
        href: "/purchase",
        icon: ICONS.purchases,
      },
    ],
  },

  {
    heading: "Partners",
    items: [
      {
        label: "Supplier",
        href: "/supplier",
        icon: ICONS.supplier,
      },
      {
        label: "Platforms",
        href: "/platforms",
        icon: ICONS.platforms,
      },
    ],
  },
];

const PANEL = "bg-[#ececf5]";

const ICON_BTN =
  "rounded-lg p-1.5 text-slate-600 hover:bg-[#e2e4f1] hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a63e8]";

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function NavContent({
  pathname,
  onCollapse,
}: {
  pathname: string;
  onCollapse?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between gap-2 px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4a63e8] text-sm font-bold text-white">
            PM
          </span>

          <span className="text-lg font-semibold text-slate-900">
            Pratap Muni
          </span>
        </div>

        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className={ICON_BTN}
          >
            <Icon d={ICONS.collapse} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main"
        className="flex-1 overflow-y-auto px-4 pb-6"
      >
        {NAV.map((group) => (
          <div
            key={group.heading}
            className="mt-5 first:mt-0"
          >
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {group.heading}
            </p>

            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a63e8] ${
                        active
                          ? "bg-[#d8dbee] font-medium text-slate-900"
                          : "text-slate-700 hover:bg-[#e2e4f1] hover:text-slate-900"
                      }`}
                    >
                      <Icon d={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile drawer after navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close mobile drawer using Escape
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* =====================================================
          DESKTOP SIDEBAR
      ====================================================== */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 transition-[width] duration-200 md:flex ${PANEL} ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {collapsed ? (
          /* =================================================
             COLLAPSED SIDEBAR
             Shows all navigation icons
          ================================================== */
          <div className="flex h-full flex-col items-center py-5">
            {/* Expand button */}
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Show sidebar"
              title="Show sidebar"
              className={`${ICON_BTN} mb-6`}
            >
              <Icon d={ICONS.expand} />
            </button>

            {/* Collapsed navigation */}
            <nav
              aria-label="Collapsed navigation"
              className="flex flex-1 flex-col items-center gap-2"
            >
              {NAV.map((group) =>
                group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      title={item.label}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                        active
                          ? "bg-[#d8dbee] text-slate-900"
                          : "text-slate-600 hover:bg-[#e2e4f1] hover:text-slate-900"
                      }`}
                    >
                      <Icon d={item.icon} />
                    </Link>
                  );
                })
              )}
            </nav>
          </div>
        ) : (
          <NavContent
            pathname={pathname}
            onCollapse={() => setCollapsed(true)}
          />
        )}
      </aside>

      {/* =====================================================
          MOBILE TOP BAR
      ====================================================== */}
      <header
        className={`sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 px-4 py-3 md:hidden ${PANEL}`}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className={ICON_BTN}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>

        <span className="text-base font-semibold text-slate-900">
          Pratap Muni
        </span>
      </header>

      {/* =====================================================
          MOBILE DRAWER
      ====================================================== */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside
            className={`absolute inset-y-0 left-0 flex w-64 flex-col shadow-xl ${PANEL}`}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className={`absolute right-3 top-5 ${ICON_BTN}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <NavContent pathname={pathname} />
          </aside>
        </div>
      )}
    </>
  );
}
