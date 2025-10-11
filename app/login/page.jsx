
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Shield, LogIn } from "lucide-react";

const GSI_CLIENT_ID = process.env.NEXT_PUBLIC_GSI_CLIENT_ID;

export default function LoginPage() {
  const gsiInitialized = useRef(false);

  useEffect(() => {
    function handleCredentialResponse(response) {
      if (!response || !response.credential) {
        alert("No se recibió credencial de Google, intenta de nuevo.");
        return;
      }
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "Acceso denegado");
            return;
          }
          window.location.replace("/");
        })
        .catch(() => {
          alert("Error de red");
        });
    }

    function initializeGIS() {
      if (!window.google?.accounts?.id || gsiInitialized.current) return;
      window.google.accounts.id.initialize({
        client_id: GSI_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup",
        auto_select: false,
      });
      const el = document.getElementById("g_id_signin");
      if (el) {
        window.google.accounts.id.renderButton(el, {
          type: "standard",
          shape: "pill",
          theme: "filled_blue",
          text: "sign_in_with",
          size: "large",
          logo_alignment: "left",
          width: 280,
          locale: "es",
        });
      }
      gsiInitialized.current = true;
    }

    if (!window.google?.accounts?.id) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=es";
      script.async = true;
      script.defer = true;
      script.onload = initializeGIS;
      document.body.appendChild(script);
    } else {
      initializeGIS();
    }

    return () => {
      gsiInitialized.current = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-fuchsia-50 to-cyan-50 p-4">
      <div className="w-full max-w-md sm:max-w-lg mx-auto bg-white/90 shadow-2xl rounded-3xl px-6 sm:px-10 py-8 sm:py-12 border border-purple-100 backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-2 mb-6 select-none">
          <div className="mb-2 relative w-16 h-16">
            <Image
              src="/IMAGOTIPO-IECS-IEDIS.png"
              alt="IECS-IEDIS"
              fill
              className="object-contain bg-white rounded-xl shadow-sm"
              priority
            />
          </div>
          <span className="font-bold text-lg text-purple-900">IECS-IEDIS</span>
        </div>

        <div className="mx-auto mb-2 text-center inline-flex items-center gap-2 font-bold text-base sm:text-xl text-purple-900">
          <Shield className="w-7 h-7 text-fuchsia-700" />
          Acceso a la Plataforma
        </div>

        <div className="text-slate-600 text-xs sm:text-sm font-semibold text-center mb-7">
          Inicia sesión con tu correo institucional de Google.
        </div>

        <div className="w-full flex flex-col items-center gap-3">
          <div id="g_id_signin" className="mb-2 w-full flex flex-col items-center"></div>
        </div>

        <div className="w-full text-center text-xs mt-6 text-slate-500">
          <LogIn className="w-4 h-4 inline mr-1 mb-0.5 text-fuchsia-600" />
          Se requiere correo institucional. Si tienes problemas para ingresar, contacta a soporte.
        </div>
      </div>
    </div>
  );
}
