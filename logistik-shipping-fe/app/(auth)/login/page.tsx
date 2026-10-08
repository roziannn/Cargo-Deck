"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Anchor, Container, Eye, EyeOff, Radar, Route, ShieldCheck } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api-client";
import { pageAllowed, safeNextPath } from "@/lib/access";
import { extractTokenFromResponse, extractUserProfile, loginSso, saveAuthSession } from "@/lib/api/auth";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [site, setSite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await loginSso({
        username: username.trim(),
        password,
        site: site.trim(),
      });

      const token = extractTokenFromResponse(res);
      const user = extractUserProfile(res, { username: username.trim(), site: site.trim() });

      try {
        (user as { demoMode?: boolean }).demoMode = !!demoMode;
      } catch {
        // ignore
      }

      saveAuthSession({ token, refreshToken: res.refreshToken, user });

      if (typeof window !== "undefined" && !remember) {
        try {
          const tokenKey = "opv_token";
          const refreshTokenKey = "opv_refresh_token";
          const userKey = "opv_user";

          const storedToken = localStorage.getItem(tokenKey);
          const storedRefreshToken = localStorage.getItem(refreshTokenKey);
          const storedUser = localStorage.getItem(userKey);

          if (storedToken) {
            sessionStorage.setItem(tokenKey, storedToken);
            localStorage.removeItem(tokenKey);
          }
          if (storedRefreshToken) {
            sessionStorage.setItem(refreshTokenKey, storedRefreshToken);
            localStorage.removeItem(refreshTokenKey);
          }
          if (storedUser) {
            sessionStorage.setItem(userKey, storedUser);
            localStorage.removeItem(userKey);
          }
        } catch {
          // ignore storage errors
        }
      }

      // the server says which menus this login may open; go to the page asked for if allowed, else the first menu
      const session = res as { menus?: string[]; home?: string };
      const wanted = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      const menus = session.menus ?? [];
      router.push(wanted && pageAllowed(menus, wanted, false) ? wanted : (session.home ?? "/dashboard"));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("Login gagal."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f2f6f7] text-slate-900">
      <div className="absolute right-4 top-4 z-20">
        <LanguageToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(11,116,117,0.16),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(246,173,85,0.16),_transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.03)_0%,transparent_28%,rgba(15,23,42,0.03)_55%,transparent_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid w-full gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[#0b2a38] p-6 text-white shadow-[0_30px_80px_rgba(11,42,56,0.22)] sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(10,66,87,0.96),rgba(6,27,37,0.96))]" />
            <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-cyan-300/12 blur-3xl" />
            <div className="absolute bottom-0 left-12 h-40 w-40 rounded-full bg-amber-300/12 blur-3xl" />

            <div className="relative flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                  <Anchor className="h-7 w-7 text-cyan-200" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">{t("Logistics Command Center")}</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">{t("Shipping Container Simulator")}</h1>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                {t("Platform simulasi untuk memantau pergerakan kontainer, jadwal truck, kepadatan yard, dan keputusan dispatch dalam satu alur operasi yang rapi.")}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
                    <Container className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold">{t("Yard Visibility")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("Pantau inbound, outbound, dan posisi kontainer aktif dari satu tampilan.")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-100">
                    <Route className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold">{t("Dispatch Planning")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("Atur skenario pengiriman, alokasi armada, dan prioritas pengiriman terminal.")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                    <Radar className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold">{t("Realtime Monitoring")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("Simulasi kejadian operasional untuk training, evaluasi, dan eksperimen proses.")}</p>
                </div>
              </div>

              <div className="mt-auto pt-8 text-xs text-slate-300/80">(c) 2026 Firda Rosiana</div>
            </div>
          </section>

          <section className="flex w-full items-center lg:justify-end">
            <Card className="w-full border-0 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:max-w-lg">
              <CardHeader className="space-y-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0e7490]">
                    <Image src="/logo/site_logo.png" alt="Site Logo" width={34} height={34} className="object-contain" priority />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">{t("Masuk ke Simulator")}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-slate-500">
                      {t("Akses dashboard simulasi pengiriman, monitoring yard, dan kontrol pergerakan kontainer.")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-slate-700">{t("Username")}</Label>
                      <Input
                        id="username"
                        placeholder={t("Masukkan username")}
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/80"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password" className="text-slate-700">{t("Password")}</Label>
                      <span className="text-xs text-slate-400">{t("Credential mengikuti akun WD")}</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("Masukkan password")}
                        autoComplete="current-password"
                        required
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/80 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                        aria-label={showPassword ? t("Sembunyikan password") : t("Tampilkan password")}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                  <Button className="h-12 w-full rounded-xl bg-[#0e7490] text-white hover:bg-[#0b6077]" disabled={isSubmitting}>
                    {isSubmitting ? t("Masuk...") : t("Masuk ke Dashboard")}
                  </Button>

                  <p className="text-center text-xs text-slate-500">{t("Jika akses bermasalah, hubungi administrator sistem.")}</p>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
