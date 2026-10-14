# મારું ઘર — સેટઅપ અને સાચવણી (ફાઇનલ)

## A. GitHub માં શું અપલોડ કરવું (ZIP Extract કરીને બધું, એ જ ફોલ્ડર સ્ટ્રક્ચર સાથે)
- index.html, admin.html, privacy.html, download.html
- firebase-config.js, firestore.rules, firestore.indexes.json
- capacitor.config.json, package.json, manifest.webmanifest, .gitignore
- assets/ ફોલ્ડર (અંદરની બધી ફાઇલો: લોગો, આઇકન, splash, backend.js, extras.js, qr.js)
- .github/workflows/ ફોલ્ડર (deploy-web.yml, build-apk.yml)
- અપલોડ ન કરવી: CHANGES_GUJARATI.md અને SETUP_GUJARATI.md ચાલે તો પણ વાંધો નથી; .jks, keystore-base64.txt, SECRETS_PRIVATE.txt ક્યારેય નહીં.

## B. તમારી પાસે સુરક્ષિત સાચવવાનું (Google Drive + પેનડ્રાઇવ, 2 જગ્યાએ)
1. maru-ghar-release.jks  (APK ની કાયમી ચાવી — ખોવાઈ તો અપડેટ બંધ)
2. SECRETS_PRIVATE.txt (પાસવર્ડ) અને keystore-base64.txt
3. આ ફાઇનલ ZIP (MARU-GHAR-PROJECT.zip)
4. Firebase એડમિન ઇમેઇલ + પાસવર્ડ, Firebase Console લૉગિન, Cloudinary લૉગિન, GitHub લૉગિન (+ 2-step verification ચાલુ)
5. એડમિન UID (firestore.rules માં છે)

## C. ચાલુ કરવાના ક્રમ
1. નવું GitHub ખાતું (નામ વગરનું) → Repository `યુઝરનેમ.github.io` → ફાઇલો અપલોડ
2. Settings → Pages → Source: GitHub Actions
3. Firebase: Authentication → Sign-in method → Anonymous અને Email/Password ચાલુ
4. Firebase: Authentication → Settings → Authorized domains → નવું github.io સરનામું ઉમેરો
5. Firebase: Firestore → Rules → firestore.rules પેસ્ટ → Publish; Indexes → status + createdAt (ascending/descending) બનાવો
6. Cloudinary: preset marughar_images → Unsigned, mp4/webm/mov અને jpg/png/webp મંજૂર, ફાઇલ કદ મર્યાદા મૂકો
7. GitHub Secrets (3): MARU_KEY_ALIAS, MARU_KEYSTORE_PASSWORD, MARU_KEYSTORE_BASE64
8. Actions → Build Maru Ghar Android APK → Run workflow → Releases માંથી APK
9. download.html ખોલીને QR સેવ કરો
10. Firebase અને Google Cloud માં Budget alert મૂકો

## D. આગળ આવી શકતી તકલીફો અને ઉપાય
- Cloudinary ક્રેડિટ પૂરી → વિડિયો/ફોટા ન ખૂલે: વિડિયો 20 MB સુધી, ફોટા નાના; દર અઠવાડિયે Usage જુઓ.
- Firebase મફત મર્યાદા પૂરી → લિસ્ટિંગ લોડ ન થાય: Usage જુઓ; જરૂર પડે Blaze પ્લાન + Budget alert.
- Spam લિસ્ટિંગ: દરરોજ એડમિન પેનલમાં Pending તપાસો; પછી Firebase App Check ચાલુ કરો.
- ચાવી ખોવાઈ: બેકઅપ જરૂરી (B).
- GitHub Actions/Firebase SDK નવા વર્ઝન: વર્ષમાં એક વાર Build ચલાવીને તપાસો.
- Pages સરનામું બદલાય: છાપેલા QR જૂના થાય — ડોમેન લેવું હોય તો છાપતા પહેલાં.
- Cloudinary માં ડિલીટ કરેલી લિસ્ટિંગના ફોટા રહી જાય: ક્યારેક Cloudinary Media Library માં મેન્યુઅલ સફાઈ.
- Play Store: પાછળથી જોઈએ તો Privacy Policy પેજ તૈયાર છે.
