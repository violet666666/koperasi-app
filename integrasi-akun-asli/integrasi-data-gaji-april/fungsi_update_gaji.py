import pandas as pd
import os

def process_excel_for_system_update(file_path, output_csv_path):
    """
    Fungsi untuk membersihkan file Excel Gaji dan menyiapkannya untuk update sistem.
    
    Step:
    1. Membaca file Excel (xls/xlsx).
    2. Mencari dan memetakan kolom: NOMOR, PANGKAT, NAMA, NRP, JUMLAH GAJI DITERIMA.
    3. Membersihkan data dari baris kosong atau header palsu.
    4. Mengonversi data ke format CSV.
    """
    try:
        # 1. LOAD DATA
        # Menggunakan header=1 karena biasanya baris pertama pada file ini adalah judul besar/kosong
        df = pd.read_excel(file_path, sheet_name='POT GAJI', header=1)

        # 2. LOGIKA PEMETAAN KOLOM (DYNAMIC MAPPING)
        # Kita mendefinisikan kata kunci agar sistem tetap menemukan kolom meski namanya sedikit berbeda
        column_definitions = {
            'NOMOR': ['NO', 'NOMOR', 'Unnamed: 0'],
            'PANGKAT': ['PANGKAT', 'Unnamed: 1', 'ANAK/PANGKAT'],
            'NAMA': ['NAMA', 'Unnamed: 2'],
            'NRP': ['NRP', 'NOMOR POKOK'],
            'JUMLAH GAJI DITERIMA': ['DITERIMA', 'JUMLAH GAJI DITERIMA(AK)', 'TOTAL']
        }

        target_mapping = {}
        for standard_name, keywords in column_definitions.items():
            for col in df.columns:
                if any(key.upper() in str(col).upper() for key in keywords):
                    target_mapping[col] = standard_name
                    break

        # 3. EXTRACTION
        # Hanya ambil kolom yang berhasil dipetakan
        df_extracted = df[list(target_mapping.keys())].rename(columns=target_mapping)

        # 4. DATA CLEANING
        # Hapus baris jika kolom NAMA atau NRP kosong
        df_extracted = df_extracted.dropna(subset=['NAMA'])
        
        # Filter: Pastikan data bukan merupakan teks header yang berulang (contoh: NAMA berisi kata 'NAMA')
        df_extracted = df_extracted[df_extracted['NAMA'].astype(str).str.upper() != 'NAMA']
        
        # Filter: Hapus angka residu (seperti angka '3' yang sering muncul di baris awal file anda)
        df_extracted = df_extracted[~df_extracted['NAMA'].astype(str).str.isnumeric()]

        # 5. CONVERT TO CSV
        # CSV disimpan untuk proses batch update pada database sistem
        df_extracted.to_csv(output_csv_path, index=False)

        print(f"SUCCESS: File {os.path.basename(file_path)} berhasil diproses.")
        print(f"Output tersedia di: {output_csv_path}")
        return df_extracted

    except Exception as e:
        print(f"ERROR: Gagal memproses file. Detail: {str(e)}")
        return None

# --- CONTOH IMPLEMENTASI ---
# File yang diupload user
input_user = '/content/4. GAJI APRIL 2026 POLRES.xls'
# Lokasi penyimpanan sementara untuk sistem
csv_system = '/content/import_ready_data.csv'

final_data = process_excel_for_system_update(input_user, csv_system)

if final_data is not None:
    print("\nPreview Data untuk Update Sistem:")
    display(final_data.head())