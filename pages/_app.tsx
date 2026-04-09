import type { AppProps } from "next/app";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/styles/dashboard.css";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const navItems = [
    { href: "/", label: "Ecom" },
    { href: "/campaigns", label: "Rendimiento de Campañas" },
    { href: "/clients", label: "Clientes" },
  ];

  return (
    <>
      <nav className="top-navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <img src="/logo.png" height={32} alt="Xclusive Leads" />
            <span className="navbar-title">Xclusive Leads</span>
          </div>
          <div className="navbar-links">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`navbar-link ${router.pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <Component {...pageProps} />
    </>
  );
}
