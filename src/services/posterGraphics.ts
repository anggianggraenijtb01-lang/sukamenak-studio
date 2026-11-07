/**
 * SVG Poster and Feature Graphics Generator for Sukamenak Studio
 * Produces crisp, beautiful vector-graphic posters and professional feature preview illustrations.
 */

export function getPosterSvg(type: 'keripik' | 'pengajian' | 'bazar' | 'kopi' | 'kriya'): string {
  if (type === 'keripik') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
      <defs>
        <linearGradient id="kg1" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="60%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#1E40AF"/>
        </linearGradient>
        <radialGradient id="kgGlow" cx="200" cy="230" r="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EA580C" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0F172A" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="500" rx="16" fill="url(#kg1)"/>
      <circle cx="200" cy="230" r="140" fill="url(#kgGlow)"/>

      <!-- Badge Header -->
      <rect x="24" y="24" width="160" height="28" rx="14" fill="#0284C7"/>
      <text x="104" y="42" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800" letter-spacing="0.5">UMKM KULINER RW 15</text>
      <rect x="314" y="24" width="62" height="28" rx="14" fill="#FFFFFF" fill-opacity="0.15"/>
      <text x="345" y="42" text-anchor="middle" fill="#93C5FD" font-family="monospace" font-size="11" font-weight="700">4:5 HD</text>

      <!-- Center Food Plate Illustration -->
      <circle cx="200" cy="225" r="95" fill="#FFFFFF" fill-opacity="0.08" stroke="#38BDF8" stroke-width="2"/>
      <circle cx="200" cy="225" r="78" fill="#FFF7ED" stroke="#FED7AA" stroke-width="3"/>
      <!-- Crisps -->
      <ellipse cx="178" cy="208" rx="28" ry="18" transform="rotate(-20 178 208)" fill="#EA580C"/>
      <ellipse cx="178" cy="208" rx="24" ry="14" transform="rotate(-20 178 208)" fill="#F97316"/>
      <ellipse cx="224" cy="214" rx="30" ry="19" transform="rotate(16 224 214)" fill="#C2410C"/>
      <ellipse cx="224" cy="214" rx="26" ry="15" transform="rotate(16 224 214)" fill="#EA580C"/>
      <ellipse cx="195" cy="242" rx="32" ry="20" transform="rotate(-4 195 242)" fill="#FB923C"/>
      <ellipse cx="218" cy="236" rx="24" ry="16" transform="rotate(-15 218 236)" fill="#F97316"/>
      <!-- Herb garnish -->
      <circle cx="195" cy="215" r="6" fill="#0284C7"/>
      <!-- Crispy Tag -->
      <rect x="250" y="150" width="68" height="26" rx="13" fill="#EA580C"/>
      <text x="284" y="167" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="900">RENYAH!</text>

      <!-- Bottom Headline Card -->
      <rect x="24" y="356" width="352" height="120" rx="16" fill="#FFFFFF"/>
      <rect x="38" y="372" width="6" height="88" rx="3" fill="#EA580C"/>
      <text x="56" y="396" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="900">KERIPIK TEMPE GURIH</text>
      <text x="56" y="418" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">Gurih Renyah • Daun Jeruk • Tanpa Pengawet</text>
      <rect x="56" y="432" width="130" height="24" rx="6" fill="#EFF6FF"/>
      <text x="121" y="448" text-anchor="middle" fill="#1E40AF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">Kemasan 250gr</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'pengajian') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
      <defs>
        <linearGradient id="pg1" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="60%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <rect width="400" height="500" rx="16" fill="url(#pg1)"/>

      <!-- Islamic Geometric Arch -->
      <path d="M120 280 L120 180 Q200 90 280 180 L280 280 Z" fill="#FFFFFF" fill-opacity="0.08" stroke="#38BDF8" stroke-width="2"/>
      <circle cx="200" cy="180" r="45" fill="#1E40AF" stroke="#60A5FA" stroke-width="2"/>
      <!-- Crescent & Star -->
      <path d="M210 160 A22 22 0 1 0 210 200 A16 16 0 1 1 210 160 Z" fill="#F8FAFC"/>
      <polygon points="214,174 216,180 222,180 217,184 219,190 214,186 209,190 211,184 206,180 212,180" fill="#EA580C"/>

      <!-- Badge Header -->
      <rect x="24" y="24" width="168" height="28" rx="14" fill="#1E40AF"/>
      <text x="108" y="42" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">PENGUMUMAN RW 15</text>
      <rect x="314" y="24" width="62" height="28" rx="14" fill="#FFFFFF" fill-opacity="0.15"/>
      <text x="345" y="42" text-anchor="middle" fill="#93C5FD" font-family="monospace" font-size="11" font-weight="700">4:5 HD</text>

      <!-- Center Mosque Dome Lines -->
      <path d="M150 280 L250 280 M165 260 L235 260" stroke="#93C5FD" stroke-width="2" stroke-linecap="round"/>

      <!-- Bottom Headline Card -->
      <rect x="24" y="340" width="352" height="136" rx="16" fill="#FFFFFF"/>
      <rect x="38" y="356" width="6" height="104" rx="3" fill="#0284C7"/>
      <text x="56" y="380" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="900">PENGAJIAN RUTIN WARGA</text>
      <text x="56" y="402" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">Kajian Kitab &amp; Silaturahmi Bulanan RW 15</text>
      <rect x="56" y="416" width="190" height="24" rx="6" fill="#EFF6FF"/>
      <text x="151" y="432" text-anchor="middle" fill="#1E40AF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">Minggu Pagi, 08.00 WIB</text>
      <text x="56" y="460" fill="#64748B" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">Tempat: Masjid Jami' Al-Ikhlas RW 15</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'bazar') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
      <defs>
        <linearGradient id="bz1" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0369A1"/>
          <stop offset="60%" stop-color="#1E40AF"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
      </defs>
      <rect width="400" height="500" rx="16" fill="url(#bz1)"/>

      <!-- Festive Bunting Flags -->
      <polygon points="40,90 70,90 55,120" fill="#EA580C"/>
      <polygon points="80,90 110,90 95,120" fill="#38BDF8"/>
      <polygon points="120,90 150,90 135,120" fill="#FFFFFF"/>
      <polygon points="160,90 190,90 175,120" fill="#EA580C"/>
      <polygon points="200,90 230,90 215,120" fill="#60A5FA"/>
      <polygon points="240,90 270,90 255,120" fill="#FFFFFF"/>
      <polygon points="280,90 310,90 295,120" fill="#EA580C"/>
      <polygon points="320,90 350,90 335,120" fill="#38BDF8"/>
      <path d="M30 90 Q200 105 370 90" stroke="#FFFFFF" stroke-width="2" fill="none"/>

      <!-- Shopping Bag Illustration -->
      <rect x="145" y="180" width="110" height="110" rx="18" fill="#FFFFFF" fill-opacity="0.12" stroke="#60A5FA" stroke-width="3"/>
      <path d="M175 180 C175 150, 225 150, 225 180" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round"/>
      <rect x="170" y="210" width="60" height="40" rx="8" fill="#EA580C"/>
      <text x="200" y="235" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="900">DISKON</text>

      <!-- Badge Header -->
      <rect x="24" y="24" width="150" height="28" rx="14" fill="#0284C7"/>
      <text x="99" y="42" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">KEGIATAN WARGA</text>

      <!-- Bottom Headline Card -->
      <rect x="24" y="340" width="352" height="136" rx="16" fill="#FFFFFF"/>
      <rect x="38" y="356" width="6" height="104" rx="3" fill="#EA580C"/>
      <text x="56" y="380" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="900">BAZAR MURAH RT &amp; UMKM</text>
      <text x="56" y="402" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">Sembako Murah • Kuliner Lokal • Aneka Kriya</text>
      <rect x="56" y="416" width="170" height="24" rx="6" fill="#FFF7ED"/>
      <text x="141" y="432" text-anchor="middle" fill="#EA580C" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">Sabtu - Minggu Ini</text>
      <text x="56" y="460" fill="#64748B" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">Lapangan Utama RW 15 • Terbuka Umum</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'kopi') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
      <defs>
        <linearGradient id="kp1" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="50%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#0369A1"/>
        </linearGradient>
      </defs>
      <rect width="400" height="500" rx="16" fill="url(#kp1)"/>

      <!-- Coffee Pouch Illustration -->
      <rect x="145" y="145" width="110" height="160" rx="16" fill="#FFFFFF" stroke="#FED7AA" stroke-width="3"/>
      <rect x="160" y="135" width="80" height="14" rx="4" fill="#0284C7"/>
      <rect x="155" y="170" width="90" height="80" rx="10" fill="#0F172A"/>
      <text x="200" y="205" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="900">KOPI DESA</text>
      <text x="200" y="222" text-anchor="middle" fill="#FED7AA" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700">SUKAMENAK</text>
      <rect x="165" y="265" width="70" height="22" rx="6" fill="#EA580C"/>
      <text x="200" y="280" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="900">ROBUSTA ASLI</text>

      <!-- Badge Header -->
      <rect x="24" y="24" width="168" height="28" rx="14" fill="#1E40AF"/>
      <text x="108" y="42" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">PRODUK UNGGULAN</text>

      <!-- Bottom Headline Card -->
      <rect x="24" y="340" width="352" height="136" rx="16" fill="#FFFFFF"/>
      <rect x="38" y="356" width="6" height="104" rx="3" fill="#1E40AF"/>
      <text x="56" y="380" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="900">KOPI ROBUSTA SUKAMENAK</text>
      <text x="56" y="402" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">Sangrai Tradisional • Aroma Khas Pegunungan</text>
      <rect x="56" y="416" width="130" height="24" rx="6" fill="#EFF6FF"/>
      <text x="121" y="432" text-anchor="middle" fill="#1E40AF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">Kemasan 200gr</text>
      <text x="56" y="460" fill="#64748B" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">Bisa Pesan Kirim se-Indonesia</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // kriya
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
    <defs>
      <linearGradient id="kr1" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#1E3A8A"/>
        <stop offset="60%" stop-color="#0284C7"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </linearGradient>
    </defs>
    <rect width="400" height="500" rx="16" fill="url(#kr1)"/>

    <!-- Handbag / Craft Illustration -->
    <rect x="135" y="165" width="130" height="135" rx="22" fill="#F0F9FF" stroke="#38BDF8" stroke-width="4"/>
    <path d="M170 165 C170 135, 230 135, 230 165" stroke="#FFFFFF" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="155" y="195" width="90" height="80" rx="14" fill="#1E40AF"/>
    <path d="M165 215 L235 215 M165 235 L235 235 M165 255 L235 255" stroke="#BAE6FD" stroke-width="3" stroke-dasharray="6 4"/>
    <circle cx="200" cy="235" r="12" fill="#EA580C"/>

    <!-- Badge Header -->
    <rect x="24" y="24" width="168" height="28" rx="14" fill="#0284C7"/>
    <text x="108" y="42" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">KRIYA &amp; FASHION</text>

    <!-- Bottom Headline Card -->
    <rect x="24" y="340" width="352" height="136" rx="16" fill="#FFFFFF"/>
    <rect x="38" y="356" width="6" height="104" rx="3" fill="#0284C7"/>
    <text x="56" y="380" fill="#0F172A" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="900">TAS RAJUT &amp; BATIK PKK</text>
    <text x="56" y="402" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">Karya Asli Warga RW 15 • Jahitan Halus &amp; Kuat</text>
    <rect x="56" y="416" width="150" height="24" rx="6" fill="#EFF6FF"/>
    <text x="131" y="432" text-anchor="middle" fill="#1E40AF" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">Bisa Pesan Custom</text>
    <text x="56" y="460" fill="#64748B" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">Pemberdayaan Ibu PKK Desa Sukamenak</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Aesthetic 100% Light Mode Feature Preview Illustrations
 * Specially crafted for the 3-column white feature cards on Soft Slate canvas.
 */
export function getLightFeatureIllustration(type: 'templates' | 'camera' | 'web'): string {
  if (type === 'templates') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" fill="none">
      <defs>
        <linearGradient id="ltBg" x1="0" y1="0" x2="480" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EFF6FF"/>
          <stop offset="100%" stop-color="#DBEAFE"/>
        </linearGradient>
        <filter id="shadowL" x="-10%" y="-10%" width="125%" height="130%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.08"/>
        </filter>
        <filter id="shadowFront" x="-15%" y="-15%" width="135%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#1E40AF" flood-opacity="0.14"/>
        </filter>
      </defs>

      <rect width="480" height="240" rx="20" fill="url(#ltBg)"/>

      <!-- Blueprint Dot Matrix Grid -->
      <g opacity="0.25">
        <circle cx="40" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="80" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="120" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="160" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="200" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="240" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="280" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="320" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="360" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="400" cy="30" r="1.5" fill="#1E40AF"/>
        <circle cx="440" cy="30" r="1.5" fill="#1E40AF"/>

        <circle cx="40" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="80" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="120" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="160" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="200" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="240" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="280" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="320" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="360" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="400" cy="80" r="1.5" fill="#1E40AF"/>
        <circle cx="440" cy="80" r="1.5" fill="#1E40AF"/>

        <circle cx="40" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="80" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="120" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="160" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="200" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="240" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="280" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="320" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="360" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="400" cy="130" r="1.5" fill="#1E40AF"/>
        <circle cx="440" cy="130" r="1.5" fill="#1E40AF"/>

        <circle cx="40" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="80" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="120" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="160" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="200" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="240" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="280" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="320" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="360" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="400" cy="180" r="1.5" fill="#1E40AF"/>
        <circle cx="440" cy="180" r="1.5" fill="#1E40AF"/>
      </g>

      <!-- Soft Radial Light Behind Front Card -->
      <circle cx="240" cy="120" r="90" fill="#FFFFFF" opacity="0.6"/>

      <!-- Left Cascading Card (Tilted -9deg) -->
      <g transform="translate(75, 30) rotate(-9)" filter="url(#shadowL)">
        <rect width="135" height="185" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <rect x="12" y="12" width="65" height="14" rx="7" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1"/>
        <rect x="18" y="16" width="30" height="6" rx="3" fill="#EA580C"/>
        <!-- Food Photo Placeholder -->
        <rect x="12" y="34" width="111" height="74" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
        <circle cx="67" cy="71" r="24" fill="#FED7AA" opacity="0.5"/>
        <circle cx="67" cy="71" r="18" fill="#EA580C" opacity="0.8"/>
        <!-- Text Lines -->
        <rect x="12" y="118" width="80" height="9" rx="3" fill="#0F172A"/>
        <rect x="12" y="132" width="105" height="6" rx="2" fill="#94A3B8"/>
        <rect x="12" y="142" width="70" height="6" rx="2" fill="#CBD5E1"/>
        <rect x="12" y="156" width="50" height="14" rx="5" fill="#EA580C"/>
      </g>

      <!-- Right Cascading Card (Tilted 9deg) -->
      <g transform="translate(270, 32) rotate(9)" filter="url(#shadowL)">
        <rect width="135" height="185" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <rect x="12" y="12" width="65" height="14" rx="7" fill="#F0F9FF" stroke="#BAE6FD" stroke-width="1"/>
        <rect x="18" y="16" width="35" height="6" rx="3" fill="#0284C7"/>
        <!-- Event Graphic Placeholder -->
        <rect x="12" y="34" width="111" height="74" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
        <polygon points="25,50 45,50 35,66" fill="#EA580C" opacity="0.8"/>
        <polygon points="50,50 70,50 60,66" fill="#0284C7" opacity="0.8"/>
        <polygon points="75,50 95,50 85,66" fill="#1E40AF" opacity="0.8"/>
        <path d="M20,50 Q60,60 100,50" stroke="#94A3B8" stroke-width="1.5" fill="none"/>
        <!-- Text Lines -->
        <rect x="12" y="118" width="85" height="9" rx="3" fill="#0F172A"/>
        <rect x="12" y="132" width="105" height="6" rx="2" fill="#94A3B8"/>
        <rect x="12" y="142" width="65" height="6" rx="2" fill="#CBD5E1"/>
        <rect x="12" y="156" width="55" height="14" rx="5" fill="#0284C7"/>
      </g>

      <!-- Center Front Card (Elevated & Crisp) -->
      <g transform="translate(165, 14)" filter="url(#shadowFront)">
        <rect width="150" height="208" rx="16" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="2"/>
        <!-- Card Top Badge -->
        <rect x="14" y="14" width="76" height="16" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
        <circle cx="23" cy="22" r="3.5" fill="#1E40AF"/>
        <rect x="31" y="19" width="46" height="6" rx="2" fill="#1E40AF"/>
        <!-- High-res Poster Visual Area -->
        <rect x="14" y="38" width="122" height="84" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
        <rect x="14" y="38" width="122" height="84" rx="10" fill="#1E3A8A" opacity="0.06"/>
        <!-- Mountain/Graphic Silhouette -->
        <path d="M20 105 L55 65 L78 90 L100 55 L130 105 Z" fill="#1E40AF" opacity="0.2"/>
        <path d="M60 105 L85 75 L110 105 Z" fill="#0284C7" opacity="0.3"/>
        <circle cx="112" cy="56" r="10" fill="#EA580C" opacity="0.4"/>
        <!-- Poster Typography -->
        <rect x="14" y="130" width="95" height="10" rx="3" fill="#0F172A"/>
        <rect x="14" y="146" width="122" height="6" rx="2" fill="#64748B"/>
        <rect x="14" y="156" width="85" height="6" rx="2" fill="#94A3B8"/>
        <!-- Action Button -->
        <rect x="14" y="172" width="122" height="24" rx="8" fill="#1E40AF"/>
        <rect x="44" y="181" width="62" height="6" rx="3" fill="#FFFFFF"/>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'camera') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" fill="none">
      <defs>
        <linearGradient id="camBg" x1="0" y1="0" x2="480" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFF7ED"/>
          <stop offset="100%" stop-color="#FFEDD5"/>
        </linearGradient>
        <filter id="shadowCam" x="-10%" y="-10%" width="125%" height="130%">
          <feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#EA580C" flood-opacity="0.12"/>
        </filter>
        <filter id="shadowLens" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#EA580C" flood-opacity="0.2"/>
        </filter>
      </defs>

      <rect width="480" height="240" rx="20" fill="url(#camBg)"/>

      <!-- Ambient Grid Pattern -->
      <g stroke="#FED7AA" stroke-width="1" opacity="0.4">
        <line x1="40" y1="30" x2="440" y2="30"/>
        <line x1="40" y1="80" x2="440" y2="80"/>
        <line x1="40" y1="130" x2="440" y2="130"/>
        <line x1="40" y1="180" x2="440" y2="180"/>
        <line x1="100" y1="20" x2="100" y2="220"/>
        <line x1="200" y1="20" x2="200" y2="220"/>
        <line x1="300" y1="20" x2="300" y2="220"/>
        <line x1="400" y1="20" x2="400" y2="220"/>
      </g>

      <!-- Center Smartphone / Studio Viewfinder Frame -->
      <g transform="translate(115, 20)" filter="url(#shadowCam)">
        <!-- Viewfinder Body -->
        <rect width="250" height="200" rx="16" fill="#FFFFFF" stroke="#FED7AA" stroke-width="2"/>

        <!-- Photo Canvas Surface Inside -->
        <rect x="12" y="12" width="226" height="176" rx="12" fill="#F8FAFC"/>
        <circle cx="125" cy="100" r="75" fill="#FFF7ED"/>

        <!-- Gourmet Plate / Food Silhouette in Frame -->
        <circle cx="125" cy="100" r="54" fill="#FFFFFF" stroke="#FED7AA" stroke-width="2.5"/>
        <circle cx="125" cy="100" r="44" fill="#FFEDD5"/>
        <!-- Crisp Chips/Product elements -->
        <ellipse cx="112" cy="92" rx="18" ry="12" transform="rotate(-18 112 92)" fill="#EA580C"/>
        <ellipse cx="138" cy="95" rx="19" ry="12" transform="rotate(15 138 95)" fill="#C2410C"/>
        <ellipse cx="125" cy="112" rx="20" ry="13" fill="#F97316"/>
        <circle cx="125" cy="98" r="4" fill="#0284C7"/>

        <!-- Viewfinder Corner Brackets (Precision Camera Framing) -->
        <path d="M22 22 L36 22 M22 22 L22 36" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M228 22 L214 22 M228 22 L228 36" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M22 178 L36 178 M22 178 L22 164" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M228 178 L214 178 M228 178 L228 164" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Central Autofocus Reticle Ring -->
        <circle cx="125" cy="100" r="28" stroke="#EA580C" stroke-width="1.5" stroke-dasharray="4 4" fill="none"/>
        <circle cx="125" cy="100" r="5" fill="#EA580C"/>

        <!-- Top Camera Header (Exposure Indicator) -->
        <rect x="90" y="20" width="70" height="16" rx="8" fill="#FFFFFF" stroke="#FED7AA" stroke-width="1"/>
        <circle cx="100" cy="28" r="3" fill="#EA580C"/>
        <rect x="108" y="26" width="42" height="4" rx="2" fill="#0F172A"/>

        <!-- Bottom Enhancement Slider Pill -->
        <g transform="translate(55, 155)">
          <rect width="140" height="24" rx="12" fill="#FFFFFF" stroke="#FED7AA" stroke-width="1.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))"/>
          <circle cx="20" cy="12" r="5" fill="#EA580C"/>
          <rect x="34" y="10" width="85" height="4" rx="2" fill="#E2E8F0"/>
          <rect x="34" y="10" width="55" height="4" rx="2" fill="#EA580C"/>
          <circle cx="89" cy="12" r="6" fill="#EA580C" stroke="#FFFFFF" stroke-width="2"/>
        </g>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // type === 'web'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" fill="none">
    <defs>
      <linearGradient id="wbBg" x1="0" y1="0" x2="480" y2="240" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#F0F9FF"/>
        <stop offset="100%" stop-color="#E0F2FE"/>
      </linearGradient>
      <filter id="shadowBrowser" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#0284C7" flood-opacity="0.12"/>
      </filter>
      <filter id="shadowPhone" x="-15%" y="-15%" width="135%" height="140%">
        <feDropShadow dx="4" dy="16" stdDeviation="12" flood-color="#0F172A" flood-opacity="0.15"/>
      </filter>
    </defs>

    <rect width="480" height="240" rx="20" fill="url(#wbBg)"/>

    <!-- Subtle Connection Lines -->
    <g stroke="#BAE6FD" stroke-width="1" opacity="0.5">
      <line x1="30" y1="40" x2="450" y2="40"/>
      <line x1="30" y1="90" x2="450" y2="90"/>
      <line x1="30" y1="140" x2="450" y2="140"/>
      <line x1="30" y1="190" x2="450" y2="190"/>
      <line x1="120" y1="20" x2="120" y2="220"/>
      <line x1="240" y1="20" x2="240" y2="220"/>
      <line x1="360" y1="20" x2="360" y2="220"/>
    </g>

    <!-- Desktop Browser Window Frame -->
    <g transform="translate(55, 20)" filter="url(#shadowBrowser)">
      <rect width="280" height="195" rx="14" fill="#FFFFFF" stroke="#BAE6FD" stroke-width="2"/>
      
      <!-- Top Window Header Bar -->
      <rect width="280" height="30" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <!-- Window Controls -->
      <circle cx="16" cy="15" r="3.5" fill="#EF4444"/>
      <circle cx="28" cy="15" r="3.5" fill="#F59E0B"/>
      <circle cx="40" cy="15" r="3.5" fill="#0284C7"/>

      <!-- URL Address Bar with Padlock -->
      <rect x="60" y="7" width="160" height="16" rx="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
      <circle cx="70" cy="15" r="2.5" fill="#0284C7"/>
      <rect x="78" y="12" width="75" height="5" rx="2.5" fill="#64748B"/>

      <!-- Inner Web Studio Canvas -->
      <!-- Left mini sidebar -->
      <rect x="12" y="40" width="60" height="142" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="18" y="48" width="48" height="10" rx="3" fill="#1E40AF"/>
      <rect x="18" y="64" width="48" height="6" rx="2" fill="#CBD5E1"/>
      <rect x="18" y="76" width="48" height="6" rx="2" fill="#E2E8F0"/>
      <rect x="18" y="88" width="48" height="6" rx="2" fill="#E2E8F0"/>
      <rect x="18" y="152" width="48" height="18" rx="5" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>

      <!-- Main workspace -->
      <rect x="80" y="40" width="188" height="142" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="90" y="50" width="90" height="14" rx="4" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="90" y="70" width="90" height="14" rx="4" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="90" y="94" width="90" height="20" rx="10" fill="#EA580C"/>
      <rect x="110" y="101" width="50" height="6" rx="3" fill="#FFFFFF"/>

      <!-- Mini Poster in Browser -->
      <rect x="190" y="50" width="68" height="96" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
      <rect x="195" y="54" width="58" height="42" rx="4" fill="#1E3A8A"/>
      <circle cx="224" cy="75" r="10" fill="#EA580C"/>
      <rect x="195" y="102" width="45" height="5" rx="2" fill="#0F172A"/>
      <rect x="195" y="111" width="58" height="4" rx="2" fill="#94A3B8"/>
      <rect x="195" y="122" width="58" height="16" rx="4" fill="#1E40AF"/>
    </g>

    <!-- Modern Smartphone Mockup Overlapping Right Side -->
    <g transform="translate(310, 40)" filter="url(#shadowPhone)">
      <rect width="105" height="180" rx="18" fill="#FFFFFF" stroke="#BAE6FD" stroke-width="2.5"/>
      <!-- Notch / Dynamic Speaker -->
      <rect x="36" y="6" width="32" height="5" rx="2.5" fill="#0F172A"/>
      <!-- Screen Area -->
      <rect x="6" y="16" width="93" height="152" rx="12" fill="#F8FAFC"/>
      <!-- Mobile Header -->
      <rect x="12" y="24" width="81" height="14" rx="4" fill="#1E40AF"/>
      <rect x="18" y="28" width="40" height="5" rx="2" fill="#FFFFFF"/>
      <!-- Mobile Poster Card -->
      <rect x="12" y="44" width="81" height="90" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="16" y="48" width="73" height="40" rx="4" fill="#1E3A8A"/>
      <circle cx="52" cy="68" r="10" fill="#EA580C"/>
      <rect x="16" y="94" width="50" height="5" rx="2" fill="#0F172A"/>
      <rect x="16" y="103" width="73" height="4" rx="2" fill="#94A3B8"/>
      <rect x="12" y="140" width="81" height="20" rx="10" fill="#EA580C"/>
      <rect x="32" y="147" width="40" height="5" rx="2" fill="#FFFFFF"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Professional High-End Feature Preview Mockup Illustrations
 * Crystal-clear, detailed vector illustrations replacing simplistic circle placeholders.
 */
export function getFeatureSvg(type: 'poster-hd' | 'templates' | 'browser'): string {
  if (type === 'poster-hd') {
    // Professional Print & HD Export Studio Mockup (Clean, Bright Studio Aesthetic)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" fill="none">
      <defs>
        <linearGradient id="hdBg" x1="0" y1="0" x2="500" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#070D1F"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
        <linearGradient id="posterPaper" x1="160" y1="30" x2="340" y2="270" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#F8FAFC"/>
        </linearGradient>
      </defs>
      
      <rect width="500" height="320" fill="url(#hdBg)"/>

      <!-- Precision Studio Cutting Mat Grid -->
      <g stroke="#1E293B" stroke-width="1" opacity="0.6">
        <line x1="40" y1="40" x2="460" y2="40"/>
        <line x1="40" y1="90" x2="460" y2="90"/>
        <line x1="40" y1="140" x2="460" y2="140"/>
        <line x1="40" y1="190" x2="460" y2="190"/>
        <line x1="40" y1="240" x2="460" y2="240"/>
        <line x1="40" y1="290" x2="460" y2="290"/>
        <line x1="100" y1="20" x2="100" y2="300"/>
        <line x1="180" y1="20" x2="180" y2="300"/>
        <line x1="250" y1="20" x2="250" y2="300"/>
        <line x1="320" y1="20" x2="320" y2="300"/>
        <line x1="400" y1="20" x2="400" y2="300"/>
      </g>

      <!-- Center Realistic Poster Paper with Drop Shadow -->
      <rect x="156" y="24" width="188" height="252" rx="12" fill="#000000" opacity="0.45" filter="blur(8px)"/>
      <rect x="152" y="20" width="188" height="252" rx="10" fill="url(#posterPaper)" stroke="#E2E8F0" stroke-width="2"/>

      <!-- Poster Visual Content (Photographic Layout) -->
      <!-- Top Image Frame -->
      <rect x="166" y="34" width="160" height="110" rx="8" fill="#1E3A8A"/>
      <!-- Sun/Glow inside poster photo -->
      <circle cx="246" cy="74" r="32" fill="#38BDF8" opacity="0.3"/>
      <!-- Crisp Mountain/Landscape Silhouette inside Poster -->
      <path d="M176 130 L216 88 L246 116 L276 76 L316 130 Z" fill="#0F172A"/>
      <path d="M226 130 L256 98 L286 130 Z" fill="#1E40AF"/>

      <!-- Poster Typography Lines -->
      <rect x="166" y="156" width="120" height="12" rx="3" fill="#0F172A"/>
      <rect x="166" y="174" width="150" height="8" rx="2" fill="#64748B"/>
      <rect x="166" y="188" width="130" height="8" rx="2" fill="#94A3B8"/>
      
      <!-- Poster Color Swatch Bar (Proofing Palette) -->
      <rect x="166" y="208" width="24" height="7" rx="2" fill="#0284C7"/>
      <rect x="194" y="208" width="24" height="7" rx="2" fill="#1E40AF"/>
      <rect x="222" y="208" width="24" height="7" rx="2" fill="#EA580C"/>
      <rect x="250" y="208" width="24" height="7" rx="2" fill="#0F172A"/>

      <!-- Bottom Card Accent -->
      <rect x="166" y="226" width="160" height="32" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
      <rect x="178" y="238" width="90" height="8" rx="4" fill="#1E40AF"/>
      <circle cx="310" cy="242" r="5" fill="#EA580C"/>

      <!-- Professional Crop Marks (Registration Corners) -->
      <path d="M140 20 L148 20 M152 8 L152 16" stroke="#38BDF8" stroke-width="2"/>
      <path d="M352 20 L344 20 M340 8 L340 16" stroke="#38BDF8" stroke-width="2"/>
      <path d="M140 272 L148 272 M152 284 L152 276" stroke="#38BDF8" stroke-width="2"/>
      <path d="M352 272 L344 272 M340 284 L340 276" stroke="#38BDF8" stroke-width="2"/>

      <!-- Magnifier Inspection Tool (Razor Sharpness Lens) -->
      <g transform="translate(310, 115)">
        <circle cx="44" cy="44" r="38" fill="#0B132B" stroke="#0284C7" stroke-width="3" filter="drop-shadow(0 10px 15px rgba(0,0,0,0.5))"/>
        <circle cx="44" cy="44" r="32" fill="#0F172A"/>
        <circle cx="44" cy="44" r="20" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="44" cy="44" r="6" fill="#38BDF8"/>
        <!-- Lens Handle -->
        <rect x="70" y="70" width="10" height="26" rx="5" transform="rotate(-45 70 70)" fill="#0284C7"/>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'templates') {
    // Professional Multi-Template Variety Layout (Without text clutter)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" fill="none">
      <defs>
        <linearGradient id="tplBg" x1="0" y1="0" x2="500" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#070D1F"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
      </defs>
      
      <rect width="500" height="320" fill="url(#tplBg)"/>

      <!-- Ambient Stage Glow -->
      <circle cx="250" cy="160" r="140" fill="#1E40AF" opacity="0.2"/>

      <!-- Template 1: Left Angled Card (Kuliner UMKM) -->
      <g transform="translate(65, 45) rotate(-9)">
        <rect width="135" height="200" rx="12" fill="#0F172A" stroke="#EA580C" stroke-width="2" filter="drop-shadow(0 15px 20px rgba(0,0,0,0.4))"/>
        <!-- Card Header Pill -->
        <rect x="12" y="14" width="60" height="12" rx="6" fill="#EA580C"/>
        <!-- Food Dish Illustration -->
        <circle cx="67" cy="76" r="32" fill="#1E293B" stroke="#FED7AA" stroke-width="2"/>
        <ellipse cx="67" cy="76" rx="18" ry="12" fill="#EA580C"/>
        <!-- Text Lines -->
        <rect x="12" y="126" width="85" height="10" rx="3" fill="#FFFFFF"/>
        <rect x="12" y="142" width="105" height="6" rx="2" fill="#94A3B8"/>
        <rect x="12" y="152" width="75" height="6" rx="2" fill="#64748B"/>
        <rect x="12" y="168" width="55" height="14" rx="4" fill="#EA580C"/>
      </g>

      <!-- Template 3: Right Angled Card (Kegiatan Warga) -->
      <g transform="translate(300, 50) rotate(9)">
        <rect width="135" height="200" rx="12" fill="#0F172A" stroke="#0284C7" stroke-width="2" filter="drop-shadow(0 15px 20px rgba(0,0,0,0.4))"/>
        <!-- Card Header Pill -->
        <rect x="12" y="14" width="60" height="12" rx="6" fill="#0284C7"/>
        <!-- Bunting Flags -->
        <polygon points="20,54 40,54 30,72" fill="#EA580C"/>
        <polygon points="45,54 65,54 55,72" fill="#38BDF8"/>
        <polygon points="70,54 90,54 80,72" fill="#FFFFFF"/>
        <polygon points="95,54 115,54 105,72" fill="#EA580C"/>
        <path d="M15 54 Q67 64 120 54" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>
        <!-- Text Lines -->
        <rect x="12" y="126" width="90" height="10" rx="3" fill="#FFFFFF"/>
        <rect x="12" y="142" width="105" height="6" rx="2" fill="#94A3B8"/>
        <rect x="12" y="152" width="70" height="6" rx="2" fill="#64748B"/>
        <rect x="12" y="168" width="60" height="14" rx="4" fill="#0284C7"/>
      </g>

      <!-- Template 2: Center Front Card (Pengumuman Resmi RW) -->
      <g transform="translate(175, 25)">
        <rect width="150" height="225" rx="14" fill="#0B132B" stroke="#38BDF8" stroke-width="2.5" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
        <!-- Top Badge -->
        <rect x="14" y="14" width="75" height="14" rx="7" fill="#1E40AF"/>
        <!-- Center Mosque Arch & Graphic -->
        <path d="M45 110 L45 75 Q75 40 105 75 L105 110 Z" fill="#1E3A8A" stroke="#60A5FA" stroke-width="1.5"/>
        <circle cx="75" cy="75" r="16" fill="#0F172A"/>
        <path d="M80 69 A9 9 0 1 0 80 81 A7 7 0 1 1 80 69 Z" fill="#F8FAFC"/>
        <!-- Text Lines -->
        <rect x="15" y="136" width="100" height="12" rx="3" fill="#FFFFFF"/>
        <rect x="15" y="154" width="120" height="7" rx="2" fill="#94A3B8"/>
        <rect x="15" y="166" width="95" height="7" rx="2" fill="#64748B"/>
        <!-- Bottom Pill -->
        <rect x="15" y="184" width="120" height="22" rx="6" fill="#1E40AF"/>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // browser: Matches Card 1's clean, bright studio aesthetic (Clean white browser window & matching phone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" fill="none">
    <defs>
      <linearGradient id="webBg" x1="0" y1="0" x2="500" y2="320" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#070D1F"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </linearGradient>
      <linearGradient id="windowPaper" x1="50" y1="30" x2="400" y2="280" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#F8FAFC"/>
      </linearGradient>
    </defs>
    
    <rect width="500" height="320" fill="url(#webBg)"/>

    <!-- Cutting Mat Style Subtle Grid Lines (Same as Card 1) -->
    <g stroke="#1E293B" stroke-width="1" opacity="0.6">
      <line x1="40" y1="40" x2="460" y2="40"/>
      <line x1="40" y1="90" x2="460" y2="90"/>
      <line x1="40" y1="140" x2="460" y2="140"/>
      <line x1="40" y1="190" x2="460" y2="190"/>
      <line x1="40" y1="240" x2="460" y2="240"/>
      <line x1="40" y1="290" x2="460" y2="290"/>
      <line x1="100" y1="20" x2="100" y2="300"/>
      <line x1="200" y1="20" x2="200" y2="300"/>
      <line x1="300" y1="20" x2="300" y2="300"/>
      <line x1="400" y1="20" x2="400" y2="300"/>
    </g>

    <!-- Desktop Browser Window Frame (Clean Bright White - Matches Card 1) -->
    <g transform="translate(42, 28)">
      <!-- Drop Shadow -->
      <rect width="365" height="240" rx="14" fill="#000000" opacity="0.45" filter="blur(8px)"/>
      <rect width="365" height="240" rx="12" fill="url(#windowPaper)" stroke="#E2E8F0" stroke-width="2"/>
      
      <!-- Browser Top Bar (Light Soft Header) -->
      <rect width="365" height="36" rx="12" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
      <!-- Window Controls -->
      <circle cx="20" cy="18" r="4.5" fill="#EF4444"/>
      <circle cx="34" cy="18" r="4.5" fill="#F59E0B"/>
      <circle cx="48" cy="18" r="4.5" fill="#10B981"/>

      <!-- URL Address Bar -->
      <rect x="75" y="9" width="220" height="18" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
      <circle cx="86" cy="18" r="3" fill="#0284C7"/>
      <rect x="96" y="15" width="80" height="6" rx="3" fill="#64748B"/>

      <!-- App Canvas inside Browser -->
      <!-- Left Sidebar Nav -->
      <rect x="14" y="48" width="90" height="178" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="22" y="60" width="74" height="12" rx="4" fill="#1E40AF"/>
      <rect x="22" y="78" width="74" height="9" rx="3" fill="#CBD5E1"/>
      <rect x="22" y="93" width="74" height="9" rx="3" fill="#E2E8F0"/>
      <rect x="22" y="108" width="74" height="9" rx="3" fill="#E2E8F0"/>
      <rect x="22" y="192" width="74" height="22" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
      <rect x="30" y="200" width="58" height="6" rx="3" fill="#1E40AF"/>

      <!-- Right Generator Workspace -->
      <rect x="114" y="48" width="237" height="178" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
      <!-- Input fields -->
      <rect x="126" y="60" width="120" height="20" rx="4" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="126" y="88" width="120" height="20" rx="4" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
      
      <!-- Mini Preview Poster inside browser (Crisp Blue Header + Orange circle, exactly matching Card 1) -->
      <rect x="258" y="60" width="82" height="116" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.05))"/>
      <rect x="264" y="66" width="70" height="50" rx="4" fill="#1E3A8A"/>
      <circle cx="299" cy="91" r="14" fill="#EA580C"/>
      <rect x="264" y="122" width="55" height="6" rx="2" fill="#0F172A"/>
      <rect x="264" y="132" width="70" height="4" rx="2" fill="#94A3B8"/>
      <rect x="264" y="140" width="45" height="4" rx="2" fill="#CBD5E1"/>
      <rect x="264" y="152" width="70" height="16" rx="4" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>

      <!-- Big Generate Button (Orange Accent like Card 1) -->
      <rect x="126" y="150" width="120" height="26" rx="13" fill="#EA580C"/>
      <rect x="156" y="160" width="60" height="6" rx="3" fill="#FFFFFF"/>
    </g>

    <!-- Modern Smartphone Mockup Overlapping Right Side (Clean Bright Finish) -->
    <g transform="translate(352, 65)" filter="drop-shadow(0 20px 25px rgba(0,0,0,0.5))">
      <!-- Phone Body -->
      <rect width="108" height="205" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
      <!-- Notch -->
      <rect x="37" y="6" width="34" height="6" rx="3" fill="#0F172A"/>
      <!-- Screen Area -->
      <rect x="6" y="18" width="96" height="175" rx="12" fill="#F8FAFC"/>
      <!-- Header -->
      <rect x="12" y="26" width="84" height="16" rx="4" fill="#1E40AF"/>
      <!-- Poster preview on phone -->
      <rect x="12" y="48" width="84" height="106" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
      <rect x="18" y="54" width="72" height="46" rx="4" fill="#1E3A8A"/>
      <circle cx="54" cy="77" r="12" fill="#EA580C"/>
      <rect x="18" y="106" width="50" height="6" rx="2" fill="#0F172A"/>
      <rect x="18" y="116" width="72" height="4" rx="2" fill="#94A3B8"/>
      <!-- Action button on phone -->
      <rect x="12" y="160" width="84" height="22" rx="11" fill="#EA580C"/>
      <rect x="36" y="168" width="36" height="6" rx="3" fill="#FFFFFF"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
