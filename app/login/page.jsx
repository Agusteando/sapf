
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import ToastViewport from "@/components/toast-viewport";
import { toastError } from "@/lib/notify";

const GSI_CLIENT_ID = process.env.NEXT_PUBLIC_GSI_CLIENT_ID;

export default function LoginPage() {
  const gsiInitialized = useRef(false);

  useEffect(() => {
    function handleCredentialResponse(response) {
      if (!response || !response.credential) {
        toastError("No se recibió credencial de Google, intenta de nuevo.");
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
            toastError(data.error || "Acceso denegado");
            return;
          }
          window.location.replace("/");
        })
        .catch(() => {
          toastError("Error de red");
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
          theme: "outline",
          text: "signin_with",
          size: "large",
          logo_alignment: "left",
          width: 380,
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
    <div className="min-h-screen relative overflow-hidden">
      <ToastViewport />

      {/* Brand background */}
      <div className="absolute inset-0 bg-brand-gradient opacity-90" />
      <div className="absolute -top-32 -right-24 w-[60vw] h-[60vw] rounded-full bg-sun-gradient blur-3xl opacity-40 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-[55vw] h-[55vw] rounded-full bg-[#6DA544] blur-3xl opacity-30 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#cde6eb]">
          <div className="p-8 sm:p-12">
            {/* Logos */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-80 h-20 sm:w-96 sm:h-24">
                <Image
                  src="/sapf-h.png"
                  alt="SAPF"
                  fill
                  priority
                  className="object-contain"
                />
              </div>
              <div className="text-center">
                <div className="font-title text-2xl sm:text-3xl text-[#004E66]">
                  Bienvenido(a)
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Accede con tu correo institucional de Google
                </div>
              </div>
            </div>

            {/* Google Sign-in */}
            <div className="mt-8 flex flex-col items-center">
              <div className="w-full flex flex-col items-center gap-4">
                <div
                  id="g_id_signin"
                  className="w-full flex flex-col items-center"
                  aria-label="Botón de inicio de sesión con Google"
                />
              </div>
            </div>

            {/* Footer note with vertical logo */}
            <div className="mt-10 flex items-center justify-center gap-3 text-xs text-gray-600">
              <div className="relative w-10 h-10">
                <Image
                  src="/sapf.png"
                  alt="Logo SAPF"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <ShieldCheck className="inline w-4 h-4 text-[#018B9C] mr-1" />
                Acceso seguro con Google • Plataforma oficial SAPF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
