// Data Wilayah Indonesia - Provinsi dan Kota/Kabupaten
// Digunakan untuk dropdown cascading pada form profil anggota

export interface City {
    name: string;
}

export interface Province {
    name: string;
    cities: City[];
}

export const INDONESIAN_PROVINCES: Province[] = [
    {
        name: "Aceh",
        cities: [
            { name: "Kota Banda Aceh" }, { name: "Kota Sabang" }, { name: "Kota Langsa" },
            { name: "Kota Lhokseumawe" }, { name: "Kota Subulussalam" },
            { name: "Kabupaten Aceh Besar" }, { name: "Kabupaten Pidie" }, { name: "Kabupaten Aceh Utara" },
            { name: "Kabupaten Aceh Timur" }, { name: "Kabupaten Aceh Selatan" },
            { name: "Kabupaten Aceh Barat" }, { name: "Kabupaten Aceh Tengah" },
        ],
    },
    {
        name: "Sumatera Utara",
        cities: [
            { name: "Kota Medan" }, { name: "Kota Binjai" }, { name: "Kota Pematang Siantar" },
            { name: "Kota Tebing Tinggi" }, { name: "Kota Tanjung Balai" }, { name: "Kota Sibolga" },
            { name: "Kota Padang Sidempuan" }, { name: "Kota Gunungsitoli" },
            { name: "Kabupaten Deli Serdang" }, { name: "Kabupaten Langkat" },
            { name: "Kabupaten Karo" }, { name: "Kabupaten Simalungun" },
            { name: "Kabupaten Asahan" }, { name: "Kabupaten Labuhan Batu" },
            { name: "Kabupaten Tapanuli Utara" }, { name: "Kabupaten Tapanuli Selatan" },
            { name: "Kabupaten Nias" }, { name: "Kabupaten Mandailing Natal" },
        ],
    },
    {
        name: "Sumatera Barat",
        cities: [
            { name: "Kota Padang" }, { name: "Kota Bukittinggi" }, { name: "Kota Payakumbuh" },
            { name: "Kota Solok" }, { name: "Kota Sawahlunto" }, { name: "Kota Padang Panjang" },
            { name: "Kota Pariaman" },
            { name: "Kabupaten Agam" }, { name: "Kabupaten Tanah Datar" },
            { name: "Kabupaten Pesisir Selatan" }, { name: "Kabupaten Pasaman" },
            { name: "Kabupaten Limapuluh Kota" }, { name: "Kabupaten Solok" },
        ],
    },
    {
        name: "Riau",
        cities: [
            { name: "Kota Pekanbaru" }, { name: "Kota Dumai" },
            { name: "Kabupaten Kampar" }, { name: "Kabupaten Bengkalis" },
            { name: "Kabupaten Indragiri Hulu" }, { name: "Kabupaten Indragiri Hilir" },
            { name: "Kabupaten Siak" }, { name: "Kabupaten Pelalawan" },
            { name: "Kabupaten Rokan Hilir" }, { name: "Kabupaten Rokan Hulu" },
        ],
    },
    {
        name: "Kepulauan Riau",
        cities: [
            { name: "Kota Batam" }, { name: "Kota Tanjung Pinang" },
            { name: "Kabupaten Bintan" }, { name: "Kabupaten Karimun" },
            { name: "Kabupaten Natuna" }, { name: "Kabupaten Lingga" },
            { name: "Kabupaten Kepulauan Anambas" },
        ],
    },
    {
        name: "Jambi",
        cities: [
            { name: "Kota Jambi" }, { name: "Kota Sungai Penuh" },
            { name: "Kabupaten Batang Hari" }, { name: "Kabupaten Bungo" },
            { name: "Kabupaten Kerinci" }, { name: "Kabupaten Merangin" },
            { name: "Kabupaten Muaro Jambi" }, { name: "Kabupaten Sarolangun" },
            { name: "Kabupaten Tanjung Jabung Barat" }, { name: "Kabupaten Tanjung Jabung Timur" },
            { name: "Kabupaten Tebo" },
        ],
    },
    {
        name: "Sumatera Selatan",
        cities: [
            { name: "Kota Palembang" }, { name: "Kota Prabumulih" },
            { name: "Kota Pagar Alam" }, { name: "Kota Lubuk Linggau" },
            { name: "Kabupaten Ogan Komering Ulu" }, { name: "Kabupaten Ogan Komering Ilir" },
            { name: "Kabupaten Muara Enim" }, { name: "Kabupaten Lahat" },
            { name: "Kabupaten Musi Rawas" }, { name: "Kabupaten Musi Banyuasin" },
            { name: "Kabupaten Banyuasin" }, { name: "Kabupaten Ogan Ilir" },
        ],
    },
    {
        name: "Bangka Belitung",
        cities: [
            { name: "Kota Pangkalpinang" },
            { name: "Kabupaten Bangka" }, { name: "Kabupaten Belitung" },
            { name: "Kabupaten Bangka Barat" }, { name: "Kabupaten Bangka Tengah" },
            { name: "Kabupaten Bangka Selatan" }, { name: "Kabupaten Belitung Timur" },
        ],
    },
    {
        name: "Bengkulu",
        cities: [
            { name: "Kota Bengkulu" },
            { name: "Kabupaten Bengkulu Selatan" }, { name: "Kabupaten Bengkulu Utara" },
            { name: "Kabupaten Rejang Lebong" }, { name: "Kabupaten Lebong" },
            { name: "Kabupaten Kepahiang" }, { name: "Kabupaten Mukomuko" },
            { name: "Kabupaten Seluma" }, { name: "Kabupaten Kaur" },
            { name: "Kabupaten Bengkulu Tengah" },
        ],
    },
    {
        name: "Lampung",
        cities: [
            { name: "Kota Bandar Lampung" }, { name: "Kota Metro" },
            { name: "Kabupaten Lampung Selatan" }, { name: "Kabupaten Lampung Tengah" },
            { name: "Kabupaten Lampung Utara" }, { name: "Kabupaten Lampung Barat" },
            { name: "Kabupaten Lampung Timur" }, { name: "Kabupaten Tanggamus" },
            { name: "Kabupaten Tulang Bawang" }, { name: "Kabupaten Way Kanan" },
            { name: "Kabupaten Pringsewu" }, { name: "Kabupaten Pesawaran" },
            { name: "Kabupaten Mesuji" }, { name: "Kabupaten Pesisir Barat" },
        ],
    },
    {
        name: "DKI Jakarta",
        cities: [
            { name: "Jakarta Pusat" }, { name: "Jakarta Utara" }, { name: "Jakarta Barat" },
            { name: "Jakarta Selatan" }, { name: "Jakarta Timur" },
            { name: "Kepulauan Seribu" },
        ],
    },
    {
        name: "Jawa Barat",
        cities: [
            { name: "Kota Bandung" }, { name: "Kota Bekasi" }, { name: "Kota Bogor" },
            { name: "Kota Cimahi" }, { name: "Kota Cirebon" }, { name: "Kota Depok" },
            { name: "Kota Sukabumi" }, { name: "Kota Tasikmalaya" }, { name: "Kota Banjar" },
            { name: "Kabupaten Bandung" }, { name: "Kabupaten Bandung Barat" },
            { name: "Kabupaten Bekasi" }, { name: "Kabupaten Bogor" },
            { name: "Kabupaten Cianjur" }, { name: "Kabupaten Ciamis" },
            { name: "Kabupaten Cirebon" }, { name: "Kabupaten Garut" },
            { name: "Kabupaten Indramayu" }, { name: "Kabupaten Karawang" },
            { name: "Kabupaten Kuningan" }, { name: "Kabupaten Majalengka" },
            { name: "Kabupaten Pangandaran" }, { name: "Kabupaten Purwakarta" },
            { name: "Kabupaten Subang" }, { name: "Kabupaten Sukabumi" },
            { name: "Kabupaten Sumedang" }, { name: "Kabupaten Tasikmalaya" },
        ],
    },
    {
        name: "Banten",
        cities: [
            { name: "Kota Serang" }, { name: "Kota Tangerang" },
            { name: "Kota Tangerang Selatan" }, { name: "Kota Cilegon" },
            { name: "Kabupaten Serang" }, { name: "Kabupaten Tangerang" },
            { name: "Kabupaten Pandeglang" }, { name: "Kabupaten Lebak" },
        ],
    },
    {
        name: "Jawa Tengah",
        cities: [
            { name: "Kota Semarang" }, { name: "Kota Surakarta" }, { name: "Kota Magelang" },
            { name: "Kota Salatiga" }, { name: "Kota Pekalongan" }, { name: "Kota Tegal" },
            { name: "Kabupaten Banyumas" }, { name: "Kabupaten Cilacap" },
            { name: "Kabupaten Purbalingga" }, { name: "Kabupaten Banjarnegara" },
            { name: "Kabupaten Kebumen" }, { name: "Kabupaten Purworejo" },
            { name: "Kabupaten Wonosobo" }, { name: "Kabupaten Magelang" },
            { name: "Kabupaten Boyolali" }, { name: "Kabupaten Klaten" },
            { name: "Kabupaten Sukoharjo" }, { name: "Kabupaten Wonogiri" },
            { name: "Kabupaten Karanganyar" }, { name: "Kabupaten Sragen" },
            { name: "Kabupaten Grobogan" }, { name: "Kabupaten Blora" },
            { name: "Kabupaten Rembang" }, { name: "Kabupaten Pati" },
            { name: "Kabupaten Kudus" }, { name: "Kabupaten Jepara" },
            { name: "Kabupaten Demak" }, { name: "Kabupaten Semarang" },
            { name: "Kabupaten Temanggung" }, { name: "Kabupaten Kendal" },
            { name: "Kabupaten Batang" }, { name: "Kabupaten Pekalongan" },
            { name: "Kabupaten Pemalang" }, { name: "Kabupaten Tegal" },
            { name: "Kabupaten Brebes" },
        ],
    },
    {
        name: "DI Yogyakarta",
        cities: [
            { name: "Kota Yogyakarta" },
            { name: "Kabupaten Bantul" }, { name: "Kabupaten Sleman" },
            { name: "Kabupaten Gunungkidul" }, { name: "Kabupaten Kulon Progo" },
        ],
    },
    {
        name: "Jawa Timur",
        cities: [
            { name: "Kota Surabaya" }, { name: "Kota Malang" }, { name: "Kota Batu" },
            { name: "Kota Kediri" }, { name: "Kota Blitar" }, { name: "Kota Madiun" },
            { name: "Kota Mojokerto" }, { name: "Kota Pasuruan" }, { name: "Kota Probolinggo" },
            { name: "Kabupaten Gresik" }, { name: "Kabupaten Sidoarjo" },
            { name: "Kabupaten Mojokerto" }, { name: "Kabupaten Jombang" },
            { name: "Kabupaten Lamongan" }, { name: "Kabupaten Tuban" },
            { name: "Kabupaten Bojonegoro" }, { name: "Kabupaten Ngawi" },
            { name: "Kabupaten Magetan" }, { name: "Kabupaten Madiun" },
            { name: "Kabupaten Nganjuk" }, { name: "Kabupaten Kediri" },
            { name: "Kabupaten Tulungagung" }, { name: "Kabupaten Trenggalek" },
            { name: "Kabupaten Blitar" }, { name: "Kabupaten Malang" },
            { name: "Kabupaten Pasuruan" }, { name: "Kabupaten Probolinggo" },
            { name: "Kabupaten Lumajang" }, { name: "Kabupaten Jember" },
            { name: "Kabupaten Bondowoso" }, { name: "Kabupaten Situbondo" },
            { name: "Kabupaten Banyuwangi" }, { name: "Kabupaten Ponorogo" },
            { name: "Kabupaten Pacitan" }, { name: "Kabupaten Sampang" },
            { name: "Kabupaten Bangkalan" }, { name: "Kabupaten Pamekasan" },
            { name: "Kabupaten Sumenep" },
        ],
    },
    {
        name: "Bali",
        cities: [
            { name: "Kota Denpasar" },
            { name: "Kabupaten Badung" }, { name: "Kabupaten Gianyar" },
            { name: "Kabupaten Tabanan" }, { name: "Kabupaten Klungkung" },
            { name: "Kabupaten Bangli" }, { name: "Kabupaten Karangasem" },
            { name: "Kabupaten Buleleng" }, { name: "Kabupaten Jembrana" },
        ],
    },
    {
        name: "Nusa Tenggara Barat",
        cities: [
            { name: "Kota Mataram" }, { name: "Kota Bima" },
            { name: "Kabupaten Lombok Barat" }, { name: "Kabupaten Lombok Tengah" },
            { name: "Kabupaten Lombok Timur" }, { name: "Kabupaten Lombok Utara" },
            { name: "Kabupaten Sumbawa" }, { name: "Kabupaten Sumbawa Barat" },
            { name: "Kabupaten Dompu" }, { name: "Kabupaten Bima" },
        ],
    },
    {
        name: "Nusa Tenggara Timur",
        cities: [
            { name: "Kota Kupang" },
            { name: "Kabupaten Kupang" }, { name: "Kabupaten Timor Tengah Selatan" },
            { name: "Kabupaten Timor Tengah Utara" }, { name: "Kabupaten Belu" },
            { name: "Kabupaten Manggarai" }, { name: "Kabupaten Manggarai Barat" },
            { name: "Kabupaten Ende" }, { name: "Kabupaten Flores Timur" },
            { name: "Kabupaten Sikka" }, { name: "Kabupaten Nagekeo" },
            { name: "Kabupaten Ngada" }, { name: "Kabupaten Sumba Barat" },
            { name: "Kabupaten Sumba Timur" },
        ],
    },
    {
        name: "Kalimantan Barat",
        cities: [
            { name: "Kota Pontianak" }, { name: "Kota Singkawang" },
            { name: "Kabupaten Kubu Raya" }, { name: "Kabupaten Sambas" },
            { name: "Kabupaten Bengkayang" }, { name: "Kabupaten Landak" },
            { name: "Kabupaten Sanggau" }, { name: "Kabupaten Ketapang" },
            { name: "Kabupaten Sintang" }, { name: "Kabupaten Kapuas Hulu" },
            { name: "Kabupaten Sekadau" }, { name: "Kabupaten Melawi" },
            { name: "Kabupaten Kayong Utara" },
        ],
    },
    {
        name: "Kalimantan Tengah",
        cities: [
            { name: "Kota Palangka Raya" },
            { name: "Kabupaten Kotawaringin Barat" }, { name: "Kabupaten Kotawaringin Timur" },
            { name: "Kabupaten Kapuas" }, { name: "Kabupaten Barito Selatan" },
            { name: "Kabupaten Barito Utara" }, { name: "Kabupaten Lamandau" },
            { name: "Kabupaten Sukamara" }, { name: "Kabupaten Seruyan" },
            { name: "Kabupaten Katingan" }, { name: "Kabupaten Pulang Pisau" },
            { name: "Kabupaten Gunung Mas" }, { name: "Kabupaten Barito Timur" },
            { name: "Kabupaten Murung Raya" },
        ],
    },
    {
        name: "Kalimantan Selatan",
        cities: [
            { name: "Kota Banjarmasin" }, { name: "Kota Banjarbaru" },
            { name: "Kabupaten Banjar" }, { name: "Kabupaten Tanah Laut" },
            { name: "Kabupaten Tanah Bumbu" }, { name: "Kabupaten Kotabaru" },
            { name: "Kabupaten Tapin" }, { name: "Kabupaten Hulu Sungai Selatan" },
            { name: "Kabupaten Hulu Sungai Tengah" }, { name: "Kabupaten Hulu Sungai Utara" },
            { name: "Kabupaten Barito Kuala" }, { name: "Kabupaten Balangan" },
        ],
    },
    {
        name: "Kalimantan Timur",
        cities: [
            { name: "Kota Samarinda" }, { name: "Kota Balikpapan" }, { name: "Kota Bontang" },
            { name: "Kabupaten Kutai Kartanegara" }, { name: "Kabupaten Kutai Barat" },
            { name: "Kabupaten Kutai Timur" }, { name: "Kabupaten Berau" },
            { name: "Kabupaten Paser" }, { name: "Kabupaten Penajam Paser Utara" },
            { name: "Kabupaten Mahakam Ulu" },
        ],
    },
    {
        name: "Kalimantan Utara",
        cities: [
            { name: "Kota Tarakan" },
            { name: "Kabupaten Bulungan" }, { name: "Kabupaten Malinau" },
            { name: "Kabupaten Nunukan" }, { name: "Kabupaten Tana Tidung" },
        ],
    },
    {
        name: "Sulawesi Utara",
        cities: [
            { name: "Kota Manado" }, { name: "Kota Bitung" }, { name: "Kota Tomohon" },
            { name: "Kota Kotamobagu" },
            { name: "Kabupaten Minahasa" }, { name: "Kabupaten Minahasa Utara" },
            { name: "Kabupaten Minahasa Selatan" }, { name: "Kabupaten Minahasa Tenggara" },
            { name: "Kabupaten Bolaang Mongondow" }, { name: "Kabupaten Sangihe" },
            { name: "Kabupaten Talaud" }, { name: "Kabupaten Siau Tagulandang Biaro" },
        ],
    },
    {
        name: "Gorontalo",
        cities: [
            { name: "Kota Gorontalo" },
            { name: "Kabupaten Gorontalo" }, { name: "Kabupaten Gorontalo Utara" },
            { name: "Kabupaten Boalemo" }, { name: "Kabupaten Bone Bolango" },
            { name: "Kabupaten Pohuwato" },
        ],
    },
    {
        name: "Sulawesi Tengah",
        cities: [
            { name: "Kota Palu" },
            { name: "Kabupaten Donggala" }, { name: "Kabupaten Poso" },
            { name: "Kabupaten Tolitoli" }, { name: "Kabupaten Buol" },
            { name: "Kabupaten Banggai" }, { name: "Kabupaten Banggai Kepulauan" },
            { name: "Kabupaten Morowali" }, { name: "Kabupaten Parigi Moutong" },
            { name: "Kabupaten Tojo Una-Una" }, { name: "Kabupaten Sigi" },
            { name: "Kabupaten Banggai Laut" }, { name: "Kabupaten Morowali Utara" },
        ],
    },
    {
        name: "Sulawesi Barat",
        cities: [
            { name: "Kabupaten Mamuju" }, { name: "Kabupaten Mamuju Tengah" },
            { name: "Kabupaten Mamasa" }, { name: "Kabupaten Polewali Mandar" },
            { name: "Kabupaten Majene" }, { name: "Kabupaten Pasangkayu" },
        ],
    },
    {
        name: "Sulawesi Selatan",
        cities: [
            { name: "Kota Makassar" }, { name: "Kota Parepare" }, { name: "Kota Palopo" },
            { name: "Kabupaten Gowa" }, { name: "Kabupaten Maros" },
            { name: "Kabupaten Takalar" }, { name: "Kabupaten Jeneponto" },
            { name: "Kabupaten Bantaeng" }, { name: "Kabupaten Bulukumba" },
            { name: "Kabupaten Selayar" }, { name: "Kabupaten Sinjai" },
            { name: "Kabupaten Bone" }, { name: "Kabupaten Wajo" },
            { name: "Kabupaten Soppeng" }, { name: "Kabupaten Barru" },
            { name: "Kabupaten Pangkajene Kepulauan" }, { name: "Kabupaten Pinrang" },
            { name: "Kabupaten Sidenreng Rappang" }, { name: "Kabupaten Enrekang" },
            { name: "Kabupaten Luwu" }, { name: "Kabupaten Luwu Utara" },
            { name: "Kabupaten Luwu Timur" }, { name: "Kabupaten Tana Toraja" },
            { name: "Kabupaten Toraja Utara" },
        ],
    },
    {
        name: "Sulawesi Tenggara",
        cities: [
            { name: "Kota Kendari" }, { name: "Kota Bau-Bau" },
            { name: "Kabupaten Konawe" }, { name: "Kabupaten Konawe Selatan" },
            { name: "Kabupaten Konawe Utara" }, { name: "Kabupaten Kolaka" },
            { name: "Kabupaten Kolaka Utara" }, { name: "Kabupaten Bombana" },
            { name: "Kabupaten Wakatobi" }, { name: "Kabupaten Muna" },
            { name: "Kabupaten Buton" }, { name: "Kabupaten Buton Utara" },
            { name: "Kabupaten Kolaka Timur" }, { name: "Kabupaten Konawe Kepulauan" },
            { name: "Kabupaten Muna Barat" }, { name: "Kabupaten Buton Tengah" },
            { name: "Kabupaten Buton Selatan" },
        ],
    },
    {
        name: "Maluku",
        cities: [
            { name: "Kota Ambon" }, { name: "Kota Tual" },
            { name: "Kabupaten Maluku Tengah" }, { name: "Kabupaten Maluku Tenggara" },
            { name: "Kabupaten Seram Bagian Barat" }, { name: "Kabupaten Seram Bagian Timur" },
            { name: "Kabupaten Buru" }, { name: "Kabupaten Buru Selatan" },
            { name: "Kabupaten Kepulauan Aru" }, { name: "Kabupaten Maluku Barat Daya" },
            { name: "Kabupaten Maluku Tenggara Barat" },
        ],
    },
    {
        name: "Maluku Utara",
        cities: [
            { name: "Kota Ternate" }, { name: "Kota Tidore Kepulauan" },
            { name: "Kabupaten Halmahera Barat" }, { name: "Kabupaten Halmahera Tengah" },
            { name: "Kabupaten Halmahera Utara" }, { name: "Kabupaten Halmahera Selatan" },
            { name: "Kabupaten Halmahera Timur" }, { name: "Kabupaten Kepulauan Sula" },
            { name: "Kabupaten Pulau Morotai" }, { name: "Kabupaten Pulau Taliabu" },
        ],
    },
    {
        name: "Papua",
        cities: [
            { name: "Kota Jayapura" },
            { name: "Kabupaten Jayapura" }, { name: "Kabupaten Keerom" },
            { name: "Kabupaten Sarmi" }, { name: "Kabupaten Mamberamo Raya" },
            { name: "Kabupaten Jayawijaya" }, { name: "Kabupaten Yalimo" },
            { name: "Kabupaten Lanny Jaya" }, { name: "Kabupaten Yahukimo" },
            { name: "Kabupaten Tolikara" }, { name: "Kabupaten Nduga" },
            { name: "Kabupaten Puncak" }, { name: "Kabupaten Puncak Jaya" },
        ],
    },
    {
        name: "Papua Barat",
        cities: [
            { name: "Kota Sorong" },
            { name: "Kabupaten Sorong" }, { name: "Kabupaten Raja Ampat" },
            { name: "Kabupaten Sorong Selatan" }, { name: "Kabupaten Tambrauw" },
            { name: "Kabupaten Maybrat" }, { name: "Kabupaten Manokwari" },
            { name: "Kabupaten Manokwari Selatan" }, { name: "Kabupaten Pegunungan Arfak" },
            { name: "Kabupaten Teluk Bintuni" }, { name: "Kabupaten Teluk Wondama" },
            { name: "Kabupaten Kaimana" }, { name: "Kabupaten Fakfak" },
        ],
    },
    {
        name: "Papua Selatan",
        cities: [
            { name: "Kabupaten Merauke" }, { name: "Kabupaten Boven Digoel" },
            { name: "Kabupaten Mappi" }, { name: "Kabupaten Asmat" },
        ],
    },
    {
        name: "Papua Tengah",
        cities: [
            { name: "Kabupaten Nabire" }, { name: "Kabupaten Paniai" },
            { name: "Kabupaten Deiyai" }, { name: "Kabupaten Intan Jaya" },
            { name: "Kabupaten Dogiyai" }, { name: "Kabupaten Mimika" },
            { name: "Kabupaten Puncak" }, { name: "Kabupaten Puncak Jaya" },
        ],
    },
    {
        name: "Papua Pegunungan",
        cities: [
            { name: "Kabupaten Jayawijaya" }, { name: "Kabupaten Lanny Jaya" },
            { name: "Kabupaten Mamberamo Tengah" }, { name: "Kabupaten Yalimo" },
            { name: "Kabupaten Yahukimo" }, { name: "Kabupaten Tolikara" },
            { name: "Kabupaten Nduga" }, { name: "Kabupaten Pegunungan Bintang" },
        ],
    },
    {
        name: "Papua Barat Daya",
        cities: [
            { name: "Kota Sorong" },
            { name: "Kabupaten Sorong" }, { name: "Kabupaten Raja Ampat" },
            { name: "Kabupaten Tambrauw" }, { name: "Kabupaten Maybrat" },
        ],
    },
];

// Helper: get all province names
export function getProvinceNames(): string[] {
    return INDONESIAN_PROVINCES.map((p) => p.name);
}

// Helper: get cities for a given province name
export function getCitiesByProvince(provinceName: string): string[] {
    const province = INDONESIAN_PROVINCES.find((p) => p.name === provinceName);
    return province ? province.cities.map((c) => c.name) : [];
}
