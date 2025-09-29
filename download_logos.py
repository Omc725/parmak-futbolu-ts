import os
import re
import requests
import time
import sys
import unicodedata

# --- AYARLAR ---
API_KEY = "123"
API_WAIT_TIME = 2.1
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CONSTANTS_PATH = os.path.join(PROJECT_DIR, 'constants.ts')
LOGO_BASE_DIR = os.path.join(PROJECT_DIR, 'assets', 'logos')
MANUAL_FILE = os.path.join(PROJECT_DIR, 'eksik_logolar.txt')
API_BASE_URL = f"https://www.thesportsdb.com/api/v1/json/{API_KEY}"
# --- BİTİŞ AYARLAR ---

# En kapsamlı arama listesi
TEAM_NAME_ALIASES = {
    "Brighton & Hove Albion": ["Brighton", "Brighton Albion"],
    "AS Saint-Étienne": ["Saint-Etienne", "St Etienne"],
    "Amedspor": ["Amed SK", "Amed Sportif"],
    "Alagöz Holding Iğdır FK": ["Igdir FK", "Igdirspor"],
    "Operário-PR": ["Operario Ferroviario", "Operario-PR"],
    "Gimnasia (LP)": ["Gimnasia La Plata", "Gimnasia y Esgrima La Plata"],
    "Talleres (C)": ["Talleres Cordoba", "Club Atlético Talleres"],
    "Teksüt Bandırmaspor": ["Bandirmaspor"],
    "Astor Enerji Şanlıurfaspor": ["Sanliurfaspor"],
    "Estrela da Amadora": ["Estrela", "C.F. Estrela da Amadora"],
    "Gimnasia y Esgrima (Jujuy)": ["Gimnasia Jujuy"],
    "Gimnasia y Esgrima (Mendoza)": ["Gimnasia Mendoza"],
    "San Martín (San Juan)": ["San Martin SJ"],
    "San Martín (Tucumán)": ["San Martin Tucuman"],
    "Monterey Bay F.C.": ["Monterey Bay FC"],
}

def extract_teams_line_by_line():
    """ constants.ts dosyasını okur ve tüm takımların listesini döndürür. """
    print("constants.ts dosyasından takım bilgileri okunuyor...")
    # ... (Kodun bu kısmı aynı, kısaltıldı)
    try:
        with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f: lines = f.readlines()
        teams, in_leagues, c_league = [], False, None
        league_pat = re.compile(r'^\s*(\w+):\s*\{\s*$')
        team_pat = re.compile(r"name:\s*'(.*?)',\s*abbr:\s*'(.*?)'")
        for line in lines:
            if 'export const LEAGUES' in line: in_leagues = True
            if not in_leagues: continue
            if line.strip() == '};': break
            l_match = league_pat.match(line)
            if l_match: c_league = l_match.group(1)
            if c_league:
                t_match = team_pat.search(line)
                if t_match:
                    teams.append({"league_id": c_league, "name": t_match.group(1), "abbr": t_match.group(2)})
        print(f"✅ Başarıyla {len(teams)} takım bilgisi bulundu.")
        return teams
    except Exception as e:
        print(f"❌ HATA: constants.ts dosyası işlenirken bir sorun oluştu: {e}")
        return None

def process_manual_overrides(all_teams):
    """ eksik_logolar.txt dosyasını okur ve URL'si girilmiş logoları indirir. """
    if not os.path.exists(MANUAL_FILE):
        return []

    print(f"\n📄 Manuel tamamlama dosyası ({os.path.basename(MANUAL_FILE)}) bulundu. İşleniyor...")
    manually_downloaded_abbrs = []

    with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines:
        if line.strip() and not line.startswith('#'):
            parts = line.strip().split(';')
            if len(parts) == 3 and parts[2].startswith('http'):
                abbr, name, url = parts
                team_info = next((t for t in all_teams if t['abbr'] == abbr), None)
                if team_info:
                    print(f"    manuel olarak 🔽 İndiriliyor: {name}")
                    logo_path = os.path.join(LOGO_BASE_DIR, team_info['league_id'], f"{abbr}.png")
                    if download_image(url, logo_path):
                        manually_downloaded_abbrs.append(abbr)

    if manually_downloaded_abbrs:
        print(f"   ✅ {len(manually_downloaded_abbrs)} logo manuel olarak indirildi.")
    else:
        print("   - Manuel olarak indirilecek yeni logo bulunamadı.")

    return manually_downloaded_abbrs

def find_missing_logos(all_teams, already_downloaded_abbrs):
    """ Mevcut logoları kontrol eder ve eksik olanları listeler. """
    missing_teams = []
    print("\n🔍 Mevcut logolar kontrol ediliyor ve eksikler tespit ediliyor...")
    for team in all_teams:
        if team['abbr'] in already_downloaded_abbrs:
            continue
        logo_path = os.path.join(LOGO_BASE_DIR, team["league_id"], f"{team['abbr']}.png")
        if not os.path.exists(logo_path):
            missing_teams.append(team)
    return missing_teams

def power_search(team_name):
    """ En kapsamlı otomatik arama yöntemlerini dener. """
    # ... (Arama fonksiyonları buraya entegre)
    search_terms = [team_name]
    if team_name in TEAM_NAME_ALIASES:
        search_terms.extend(TEAM_NAME_ALIASES[team_name])

    for term in search_terms:
        result = search_api(term)
        if result:
            logo = result.get('strBadge') or result.get('strTeamLogo')
            if logo: return logo, f"Eşleşme ('{term}')"
    return None, None

def search_api(search_term):
    """ API'ye tek bir arama isteği gönderir. """
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        url = f"{API_BASE_URL}/searchteams.php?t={requests.utils.quote(search_term)}"
        response = requests.get(url, headers=headers, timeout=15)
        time.sleep(API_WAIT_TIME)
        if response.status_code == 200:
            data = response.json()
            if data and data.get('teams'): return data['teams'][0]
    except Exception: return None
    return None

def download_image(url, filepath):
    """ Bir URL'den görsel indirir. """
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url.replace('http://', 'https://'), headers=headers, stream=True, timeout=20)
        if response.status_code == 200:
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(1024): f.write(chunk)
            return True
        else: print(f"     - ⚠️ HTTP Hatası: {response.status_code}"); return False
    except requests.exceptions.RequestException as e:
        print(f"     - 🌐 Ağ Hatası: {e}"); return False

def main():
    print("\n🚀 Python ile Logo Tamamlama Sihirbazı Başlatıldı! 🚀\n")
    all_teams = extract_teams_line_by_line()
    if not all_teams: return
    if not os.path.exists(LOGO_BASE_DIR):
        print(f"📂 Ana logo klasörü oluşturuluyor: {LOGO_BASE_DIR}")
        os.makedirs(LOGO_BASE_DIR)

    manually_downloaded = process_manual_overrides(all_teams)
    teams_to_download = find_missing_logos(all_teams, manually_downloaded)

    if not teams_to_download:
        print("✨ Tüm logolar tamamlanmış görünüyor. Yapılacak bir işlem yok.")
        print("\n🎉 --- İşlem Tamamlandı! --- 🎉")
        return
    else:
        print(f"🎯 {len(teams_to_download)} eksik logo için otomatik arama başlatılacak.")

    found, not_found, not_found_teams = 0, 0, []
    current_league = ""

    for i, team in enumerate(teams_to_download):
        if team["league_id"] != current_league:
            current_league = team["league_id"]
            print(f"\n--- ⚽ Lig İşleniyor: {current_league} ---\n")
            league_dir = os.path.join(LOGO_BASE_DIR, current_league)
            if not os.path.exists(league_dir): os.makedirs(league_dir)

        name, abbr = team["name"], team["abbr"]
        progress = f"[{i+1}/{len(teams_to_download)}]"
        sys.stdout.write(f"\r{progress} 🕵️  Aranıyor: {name.ljust(35)}")
        sys.stdout.flush()

        logo_url, match_type = power_search(name)

        if logo_url:
            logo_path = os.path.join(LOGO_BASE_DIR, current_league, f"{abbr}.png")
            sys.stdout.write(f"\r{progress} ✅ Bulundu ({match_type})! 🔽 İndiriliyor: {name.ljust(35)}\n")
            if download_image(logo_url, logo_path): found += 1
        else:
            sys.stdout.write(f"\r{progress} ❌ Bulunamadı: {name.ljust(35)}\n")
            not_found += 1
            not_found_teams.append(team)

    print("\n\n🎉 --- Otomatik Arama Tamamlandı! --- 🎉\n")
    print(f"📊 Sonuçlar:")
    print(f"   - ✅ {found} yeni logo başarıyla indirildi.")
    print(f"   - ❌ {len(not_found_teams)} takımın logosu otomatik olarak bulunamadı.")

    if not_found_teams:
        print(f"\n✍️  Manuel tamamlama için '{os.path.basename(MANUAL_FILE)}' dosyası oluşturuluyor...")
        with open(MANUAL_FILE, 'w', encoding='utf-8') as f:
            f.write("# Lütfen bu dosyadaki her satır için noktalı virgülden sonra takımın logo URL'sini yapıştırın.\n")
            f.write("# Örnek: BJK;Beşiktaş;https://ornek.com/besiktas-logo.png\n")
            f.write("# Düzenlemeyi bitirdikten sonra betiği tekrar çalıştırın.\n\n")
            for team in not_found_teams:
                f.write(f"{team['abbr']};{team['name']};URL_BURAYA_YAPIŞTIRILACAK\n")
        print(f"   ✅ Dosya oluşturuldu. Lütfen dosyayı düzenleyip betiği tekrar çalıştırın.")

if __name__ == "__main__":
    main()
