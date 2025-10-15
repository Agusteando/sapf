
"use client";

export default function TopActivityBar({ active }) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-1 ${active ? "opacity-100" : "opacity-0"} transition-opacity`}>
      <div className="h-1 bg-gradient-to-r from-orange-500 via-fuchsia-500 to-emerald-500 animate-[progress_1.2s_linear_infinite]" />
      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
