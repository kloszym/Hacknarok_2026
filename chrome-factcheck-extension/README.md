# FactCheck AI - Chrome Extension

Wtyczka do przeglądarki Google Chrome umożliwiająca weryfikację prawdziwości zaznaczonego tekstu przy użyciu Google Fact Check Tools API. Wyniki wyświetlane są w **bocznym panelu** przeglądarki.

## Funkcje

- ✅ Zaznaczenie tekstu w przeglądarce
- ✅ Menu kontekstowe (prawy przycisk myszy) z opcją "Sprawdź prawdziwość"
- ✅ Wielojęzyczne wsparcie (Polski, Angielski, Niemiecki, Francuski, Hiszpański)
- ✅ Integracja z Google Fact Check Tools API
- ✅ Wyświetlanie wyników w bocznym panelu Chrome
- ✅ Ocena prawdziwości (Prawda/Fałsz/Częściowo prawda/Wymaga kontekstu)
- ✅ Linki do źródeł fact-checkingowych

## Wymagania

1. **Google Cloud API Key** z włączonym Fact Check Tools API
   - Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
   - Utwórz nowy projekt lub wybierz istniejący
   - Włącz **Fact Check Tools API**
   - Utwórz klucz API w sekcji "Credentials"

## Instalacja w Google Chrome

### Krok 1: Pobierz wtyczkę
Sklonuj lub pobierz ten folder na swój komputer.

### Krok 2: Otwórz Chrome Extensions
1. Otwórz Google Chrome
2. Wpisz w pasku adresu: `chrome://extensions/`
3. Naciśnij Enter

### Krok 3: Włącz tryb dewelopera
1. W prawym górnym rogu znajdź przełącznik **"Developer mode"** (Tryb dewelopera)
2. Włącz go (przełącznik powinien być niebieski)

### Krok 4: Załaduj wtyczkę
1. Kliknij przycisk **"Load unpacked"** (Załaduj rozpakowane)
2. Wybierz folder `chrome-factcheck-extension` (ten folder)
3. Kliknij **"Select"** lub **"Wybierz"**

### Krok 5: Potwierdź instalację
Wtyczka powinna pojawić się na liście zainstalowanych rozszerzeń z ikoną 🔍 i nazwą "FactCheck AI".

## Konfiguracja

### Dodanie klucza API

1. Kliknij ikonę wtyczki 🔍 w pasku narzędzi Chrome (prawy górny róg)
2. Wprowadź swój **Google API Key** w pole tekstowe
3. Kliknij **"Save"** (Zapisz)
4. Klucz zostanie zapisany i będzie używany do wszystkich zapytań

## Użycie

### Sprawdzanie prawdziwości tekstu

1. **Zaznacz tekst** na dowolnej stronie internetowej
2. **Kliknij prawym przyciskiem myszy** na zaznaczonym tekście
3. Wybierz opcję **"Sprawdź prawdziwość"** (lub odpowiednik w innym języku)
4. **Boczny panel** otworzy się automatycznie z wynikami fact-checkingu

### Interpretacja wyników

Wtyczka wyświetli w bocznym panelu:
- **Ocenę prawdziwości**: ✓ TRUE, ✗ FALSE, ◐ PARTIALLY TRUE, ⚠ NEEDS CONTEXT, ? UNKNOWN
- **Analizę**: Podsumowanie wyników z różnych źródeł fact-checkingowych
- **Źródła**: Linki do artykułów fact-checkingowych z oceną każdego źródła

### Zalety bocznego panelu

- 📌 Panel pozostaje otwarty podczas przeglądania
- 🔄 Możesz sprawdzać wiele twierdzeń bez zamykania panelu
- 📱 Nie zasłania treści strony
- ⚡ Szybki dostęp do wyników

## Obsługiwane języki

Wtyczka automatycznie dostosowuje się do języka przeglądarki:
- 🇵🇱 Polski - "Sprawdź prawdziwość"
- 🇬🇧 English - "Check truthfulness"
- 🇩🇪 Deutsch - "Wahrheit überprüfen"
- 🇫🇷 Français - "Vérifier la véracité"
- 🇪🇸 Español - "Verificar veracidad"

## Struktura projektu

```
chrome-factcheck-extension/
├── manifest.json           # Konfiguracja wtyczki (z side panel)
├── popup.html             # Interfejs do wprowadzania API key
├── popup.js               # Logika popup
├── background.js          # Service worker (menu kontekstowe, API)
├── content.js             # Skrypt działający na stronach
├── factcheck.html         # Panel boczny z wynikami
├── factcheck.js           # Logika wyświetlania wyników
├── icons/                 # Ikony wtyczki
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── _locales/              # Tłumaczenia
    ├── en/messages.json
    ├── pl/messages.json
    ├── de/messages.json
    ├── fr/messages.json
    └── es/messages.json
```

## API - Google Fact Check Tools

Wtyczka używa [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search) do wyszukiwania fact-checków.

### Limity API
- Darmowy tier: 10,000 zapytań dziennie
- Sprawdź aktualne limity w [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)

## Rozwiązywanie problemów

### Wtyczka nie działa
1. Sprawdź czy tryb dewelopera jest włączony
2. **Usuń wtyczkę całkowicie** i załaduj ponownie
3. Sprawdź konsolę błędów (kliknij "Errors" przy wtyczce)
4. Sprawdź logi service workera (kliknij "Service worker" → "Inspect")

### Nie widzę opcji "Sprawdź prawdziwość"
1. Przeładuj wtyczkę w `chrome://extensions/` (ikona 🔄)
2. Odśwież stronę, na której testujesz
3. Sprawdź czy tekst jest zaznaczony
4. Sprawdź logi w konsoli service workera

### Boczny panel się nie otwiera
1. Sprawdź czy Chrome wspiera side panel (wymaga Chrome 114+)
2. Sprawdź logi w konsoli service workera
3. Spróbuj ręcznie otworzyć panel: kliknij prawym na ikonę wtyczki → "Open side panel"

### Brak wyników fact-checkingu
1. Sprawdź czy klucz API jest poprawny
2. Sprawdź czy Fact Check Tools API jest włączone w Google Cloud
3. Sprawdź limity API w Google Cloud Console
4. Nie wszystkie twierdzenia mają fact-checki - to normalne

### Błąd API
- Sprawdź czy klucz API ma odpowiednie uprawnienia
- Sprawdź czy nie przekroczyłeś limitów API
- Sprawdź logi w konsoli przeglądarki (F12 → Console)

## Bezpieczeństwo

- Klucz API jest przechowywany lokalnie w przeglądarce (chrome.storage.sync)
- Nie jest wysyłany do żadnych serwerów poza Google API
- Zalecamy ograniczenie klucza API tylko do Fact Check Tools API

## Wymagania systemowe

- Google Chrome 114 lub nowszy (dla wsparcia side panel)
- Połączenie z internetem
- Klucz API Google Cloud

## Licencja

Ten projekt jest dostępny jako open source.

## Autor

Projekt stworzony na Hacknarok 2026

## Wsparcie

W razie problemów:
1. Sprawdź sekcję "Rozwiązywanie problemów"
2. Sprawdź dokumentację [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api)
3. Sprawdź logi w konsoli service workera
4. Sprawdź czy Chrome jest zaktualizowany do wersji 114+