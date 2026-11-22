import React from 'react';

interface CommunityCard {
  id: string;
  step: string;
  audience: string;
  title: string;
  description: string;
  image: string;
  fallbackImage: string;
}

const COMMUNITY_CARDS: CommunityCard[] = [
  {
    id: 'pkk',
    step: '01',
    audience: 'Ibu-Ibu PKK',
    title: 'Katalog Kue & Masakan Rumahan',
    description:
      'Membantu pelaku usaha boga, katering, serta pembuat kue rumahan di Desa Sukamenak menyusun foto menu yang tampak segar dan menggugah selera. Cukup unggah foto masakan dari kamera HP biasa, lalu sistem menata pencahayaan dan latar belakang agar siap dibagikan ke pelanggan maupun katalog usaha.',
    image: '/desa/komunitas-pkk-kue.jpg',
    fallbackImage: '/posters/poster-kue.jpg',
  },
  {
    id: 'karang-taruna',
    step: '02',
    audience: 'Karang Taruna',
    title: 'Poster Acara & Kreativitas Pemuda',
    description:
      'Memudahkan pemuda dan pengurus Karang Taruna membuat poster publikasi untuk turnamen olahraga, peringatan hari besar, hingga bazar desa secara instan. Setiap desain otomatis tertata dengan informasi acara yang jelas sehingga dapat langsung dibagikan ke media sosial dan grup pesan.',
    image: '/desa/komunitas-karang-taruna.jpg',
    fallbackImage: '/posters/poster-bazar.jpg',
  },
  {
    id: 'umkm-warung',
    step: '03',
    audience: 'Pelaku UMKM Desa',
    title: 'Selebaran Promo & Daftar Harga Jual',
    description:
      'Mengubah foto produk dagangan sehari-hari menjadi selebaran promo toko atau warung yang tertata rapi. Pelaku usaha dapat menambahkan nama produk, harga jual, hingga info diskon secara praktis untuk menarik lebih banyak pembeli tanpa perlu keahlian desain grafis.',
    image: '/desa/komunitas-umkm-warung.jpg',
    fallbackImage: '/posters/poster-keripik.jpg',
  },
];

export const DesaSukamenakSection: React.FC = () => {
  return (
    <div id="tentang-desa" className="bg-[#F8FAFC] text-[#0F172A]">
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: MENGENAL DESA SUKAMENAK (Full-Bleed Dark Section, Tanpa Card)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-[#0F172A] via-[#132247] to-[#1E3A8A] text-white py-20 sm:py-28 px-6 overflow-hidden">
        {/* Decorative Blueprint Grid & Vector Shapes on Full Section Background */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#FFFFFF 1px, transparent 1px), linear-gradient(90deg, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
        <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full bg-[#3B82F6]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-28 w-96 h-96 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
        <svg
          className="absolute -bottom-16 -right-12 w-80 h-80 text-sky-400/10 pointer-events-none"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.6,81.2,29.1,72.6,41.9C64,54.7,52.5,65.7,39.1,72.4C25.7,79.1,10.3,81.5,-4.7,79.7C-19.7,77.9,-34.3,71.9,-46.9,63.1C-59.5,54.3,-70.1,42.7,-76.8,29C-83.6,15.3,-86.6,-0.5,-83.8,-15.4C-81,-30.3,-72.4,-44.3,-60.7,-52.7C-49,-61.1,-34.2,-63.9,-20.1,-71.1C-6,-78.3,7.4,-89.9,22.1,-89.6C36.8,-89.3,52.8,-77.1,44.7,-76.4Z"
            transform="translate(100 100)"
          />
        </svg>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left 7 Columns: Text & Story */}
            <div className="lg:col-span-7 space-y-5">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black text-white tracking-tight leading-[1.15]">
                Tumbuh Bersama di
                <span className="block text-[#60A5FA] mt-1">Desa Sukamenak</span>
              </h2>

              <div className="space-y-3.5 text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal max-w-xl text-justify">
                <p>
                  Desa Sukamenak, yang terletak di Kecamatan Margahayu, Kabupaten Bandung, memiliki beragam potensi lokal. Mulai dari usaha kuliner rumahan, kerajinan tangan, hingga berbagai kegiatan kreatif masyarakat dan generasi muda yang terus berkembang.
                </p>
                <p>
                  Melalui Sukamenak Studio, masyarakat dapat mempromosikan produk dan kegiatan usahanya dengan lebih mudah. Buat poster promosi dan daftar produk yang menarik, rapi, serta siap dibagikan untuk memperkenalkan potensi lokal Desa Sukamenak kepada lebih banyak orang.
                </p>
              </div>
            </div>

            {/* Right 5 Columns: Clean Framed Community Photo */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl shadow-black/40 ring-1 ring-blue-400/30 aspect-[4/3] lg:aspect-[5/4] group">
                <img
                  src="/desa/desa-gotong-royong.jpg"
                  alt="Kolaborasi Komunitas dan UMKM Desa Sukamenak, Margahayu"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/posters/poster-bazar.jpg';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: ZIG-ZAG ALTERNATING EDITORIAL CARDS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="pemberdayaan-komunitas" className="relative py-20 sm:py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 space-y-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight leading-tight">
              Untuk Seluruh Penggerak{' '}
              <span className="text-[#1E3A8A]">Ekonomi &amp; Sosial Desa</span>
            </h2>

            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Membantu setiap pelaku usaha, komunitas, dan kegiatan di Desa Sukamenak membuat visual promosi yang menarik.
            </p>
          </div>

          {/* Zig-Zag Alternating Cards (Ukuran Lebih Ringkas & Proporsional) */}
          <div className="space-y-6">
            {COMMUNITY_CARDS.map((card, idx) => {
              // Card 0 (01): Foto Kiri, Teks Kanan
              // Card 1 (02): Teks Kiri, Foto Kanan
              // Card 2 (03): Foto Kiri, Teks Kanan
              const isTextLeft = idx % 2 === 1;

              return (
                <article
                  key={card.id}
                  className="relative rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#132247] to-[#1E3A8A] border border-blue-400/25 hover:border-white/50 shadow-xl shadow-blue-950/15 hover:shadow-blue-900/25 transition-all duration-300 p-4 sm:p-6 lg:p-7 overflow-hidden group text-white"
                >
                  {/* Decorative Vector Shapes & Ambient Glows */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <svg
                      className={`absolute -bottom-12 ${
                        isTextLeft ? '-left-12' : '-right-12'
                      } w-64 h-64 text-sky-400/10 group-hover:scale-110 transition-transform duration-700`}
                      viewBox="0 0 200 200"
                      fill="currentColor"
                    >
                      <path
                        d={
                          idx === 1
                            ? 'M38.1,-63.9C49.9,-58.4,60.2,-48.9,67.8,-37.2C75.4,-25.6,80.3,-11.8,79.6,1.9C78.9,15.6,72.6,29.2,64,40.9C55.4,52.6,44.5,62.4,32,68.2C19.5,74,-4.6,75.8,-21.8,70.6C-39,65.4,-49.3,53.2,-57.8,40.1C-66.3,27,-73,13,-73.4,-1.2C-73.8,-15.4,-67.9,-29.8,-58.6,-40.8C-49.3,-51.8,-36.6,-59.4,-23.6,-64.1C-10.6,-68.8,2.7,-70.6,15.2,-69.4C27.7,-68.2,39.4,-64,38.1,-63.9Z'
                            : 'M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.6,81.2,29.1,72.6,41.9C64,54.7,52.5,65.7,39.1,72.4C25.7,79.1,10.3,81.5,-4.7,79.7C-19.7,77.9,-34.3,71.9,-46.9,63.1C-59.5,54.3,-70.1,42.7,-76.8,29C-83.6,15.3,-86.6,-0.5,-83.8,-15.4C-81,-30.3,-72.4,-44.3,-60.7,-52.7C-49,-61.1,-34.2,-63.9,-20.1,-71.1C-6,-78.3,7.4,-89.9,22.1,-89.6C36.8,-89.3,52.8,-77.1,44.7,-76.4Z'
                        }
                        transform="translate(100 100)"
                      />
                    </svg>
                    <div
                      className={`absolute -top-16 ${
                        isTextLeft ? 'left-10' : 'right-10'
                      } w-56 h-56 rounded-full bg-[#3B82F6]/20 blur-3xl`}
                    />
                  </div>

                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                    {/* IMAGE COLUMN (4 cols on desktop) */}
                    <div
                      className={`lg:col-span-4 order-1 ${
                        isTextLeft ? 'lg:order-2' : 'lg:order-1'
                      }`}
                    >
                      <div className="relative aspect-[4/4.3] max-h-[280px] w-full mx-auto rounded-2xl overflow-hidden border-2 border-white/20 bg-slate-900 shadow-xl shadow-black/35">
                        <img
                          src={card.image}
                          alt={card.title}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = card.fallbackImage;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/75 via-transparent to-transparent pointer-events-none" />

                        {/* Floating Step & Audience Pill */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#0F172A]/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-md">
                            {card.audience}
                          </span>
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-[#2563EB] text-white font-black text-[11px] shadow-md">
                            {card.step}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* TEXT COLUMN (8 cols on desktop) */}
                    <div
                      className={`lg:col-span-8 space-y-3 order-2 ${
                        isTextLeft ? 'lg:order-1' : 'lg:order-2'
                      }`}
                    >
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                        {card.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-normal text-justify">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DesaSukamenakSection;
