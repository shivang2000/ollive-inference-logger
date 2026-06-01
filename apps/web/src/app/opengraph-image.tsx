import { ImageResponse } from 'next/og';

// Auto-wired by Next as og:image + twitter:image (1200x630 — the big Twitter card).
export const runtime = 'nodejs';
export const alt = 'OpenChat — Free AI Chat, No API Key';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
          color: 'white',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: '#22c55e',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          FREE · NO API KEY · NO SETUP
        </div>
        <div style={{ fontSize: 130, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 12 }}>
          OpenChat
        </div>
        <div style={{ fontSize: 44, color: '#cbd5e1', marginTop: 8 }}>
          Free OpenRouter models, in your browser.
        </div>
        <div style={{ fontSize: 30, color: '#94a3b8', marginTop: 36 }}>
          GPT-OSS 120B · Llama 3.3 · DeepSeek · Qwen · GPT-4o · Claude
        </div>
        <div style={{ display: 'flex', marginTop: 'auto' }}>
          <div style={{ fontSize: 30, color: '#22c55e' }}>ai-chat.shivangchheda.dev</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
