import { useNavigate } from "react-router-dom";
import { useProfile } from "../hooks/useProfile.js";

export default function TelegramSetupPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();

  const userId = profile?.userId;
  const phone  = profile?.phone;
  const deepLink = userId && phone
    ? `https://t.me/trail_guardbot?start=${userId}_${phone.replace("+", "")}`
    : "https://t.me/trail_guardbot";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-[1]">

      {/* Logo */}
      <div className="flex items-center gap-2 text-[1.1rem] font-bold tracking-[0.12em] uppercase text-primary mb-10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </div>

      <div className="w-full max-w-[400px]">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <span className="text-xs text-muted">Profile</span>
          </div>
          <div className="w-8 h-px bg-line" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/50 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#229ED9]">2</span>
            </div>
            <span className="text-xs text-fg font-semibold">Telegram</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-line rounded-[20px] p-8">

          {/* Telegram icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/20 flex items-center justify-center mb-5 mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#229ED9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2L2 9.3l7.3 2.7 2.7 7.3L21.5 2z"/>
              <path d="M9.3 12l4.5 4.5"/>
            </svg>
          </div>

          <h1 className="text-[1.2rem] font-bold text-fg text-center mb-1">Connect Telegram</h1>
          <p className="text-sm text-muted text-center mb-6">
            Get instant trail hazard and emergency alerts sent directly to your Telegram.
          </p>

          {/* What you'll get */}
          <div className="bg-surface rounded-xl border border-line p-4 mb-6 flex flex-col gap-2.5">
            {[
              "Nearby hiker emergency alerts",
              "Hazard broadcasts on your trail",
              "Real-time safety notifications",
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span className="text-sm text-fg">{item}</span>
              </div>
            ))}
          </div>

          {/* Connect button */}
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setTimeout(() => navigate("/dashboard", { replace: true }), 300)}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 px-4 bg-[#229ED9] text-white rounded-full text-[0.95rem] font-bold no-underline hover:opacity-90 transition-opacity mb-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2L2 9.3l7.3 2.7 2.7 7.3L21.5 2z"/>
              <path d="M9.3 12l4.5 4.5"/>
            </svg>
            Connect Telegram
          </a>

          {userId && phone && (
            <p className="text-[0.72rem] text-muted text-center mb-5">
              Links User #{userId} with {phone} automatically
            </p>
          )}

          {/* Skip */}
          <button
            onClick={() => navigate("/dashboard", { replace: true })}
            className="w-full py-2.5 px-4 bg-transparent border-none text-muted text-sm cursor-pointer hover:text-fg transition-colors"
          >
            Skip for now
          </button>
        </div>

        <p className="text-[0.72rem] text-muted text-center mt-4">
          You can connect Telegram later from your profile settings.
        </p>
      </div>
    </div>
  );
}
