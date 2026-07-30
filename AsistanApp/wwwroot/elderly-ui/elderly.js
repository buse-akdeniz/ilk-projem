/* ===========================
   YAŞLI ASISTANI - GENEL JS
   ===========================
*/

// =================== EKRAN YÖNETIMI ===================

const RAILWAY_API_BASE = 'https://safeguardian-elderly-safety-emergency-support-ap-production.up.railway.app';
const DEFAULT_API_BASE = (
    window.API_BASE?.trim?.()
    || ((/^https?:\/\//i.test(window.location?.origin || '')) ? window.location.origin : RAILWAY_API_BASE)
);
const FALLBACK_API_BASE = (window.API_FALLBACK_BASE?.trim?.() || RAILWAY_API_BASE);
const IOS_SIMULATOR_API_BASE = FALLBACK_API_BASE;
const DEMO_OFFLINE_TOKEN = 'demo-offline-token';
const PRODUCT_LOAD_TIMEOUT_MS = 12000;
const PURCHASE_TIMEOUT_MS = 90000;
let isFamilyPurchaseInProgress = false;
let storeKitPluginCache = null;
const IS_CAPACITOR_IOS = (() => {
    const cap = window.Capacitor;
    if (!cap) return false;

    const platform = cap.getPlatform?.();
    if (platform) return platform === 'ios';

    const ua = navigator.userAgent || '';
    const isiPhoneLike = /iPhone|iPad|iPod/i.test(ua);
    const isDesktopModeiPad = navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
    return isiPhoneLike || isDesktopModeiPad;
})();
const API_TIMEOUT_MS = 12000;

// --- TTS ENGINE TEMPORARILY DISABLED ---
// SpeechSynthesis/TextToSpeech blocks are intentionally disabled until app stability is restored.

// --- WebProcess crash prevention ---
// Uncaught promise rejections crash Capacitor iOS WebView; absorb them here.
window.addEventListener('unhandledrejection', (event) => {
    console.warn('[SafeGuardian] Unhandled promise rejection caught (prevented crash):', event.reason);
    event.preventDefault();
});
window.addEventListener('error', (event) => {
    console.warn('[SafeGuardian] Global JS error caught:', event.message, event.filename, event.lineno);
    // Do not re-throw; let the app keep running.
    return true;
});

// --- Backend reachability tracking ---
let _backendUnreachableCount = 0;
const BACKEND_FAIL_THRESHOLD = 2;

function isProductionApp() {
    return window.SafeGuardianProd?.isProductionApp?.() === true;
}

function escapeHtml(value) {
    if (window.SafeGuardianProd?.escapeHtml) {
        return window.SafeGuardianProd.escapeHtml(value);
    }
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clearLocalTestData() {
    [
        'localMedications',
        'localMoodRecords',
        'localHealthRecords',
        'localFamilyMembers',
    ].forEach((key) => localStorage.removeItem(key));
}

function applyProductionUi() {
    window.SafeGuardianProd?.hideDevOnlyUi?.();
    const testHint = document.getElementById('testHint');
    if (testHint && (isProductionApp() || !shouldShowDemoHint())) {
        testHint.hidden = true;
        testHint.style.display = 'none';
    }
}

function _onBackendFail() {
    _backendUnreachableCount++;
    const banner = document.getElementById('offlineBanner');
    if (_backendUnreachableCount >= BACKEND_FAIL_THRESHOLD && banner) {
        banner.style.display = 'block';
        banner.textContent = isProductionApp()
            ? (t('connErrorBanner') || 'İnternet bağlantınızı kontrol edin.')
            : 'Sunucuya bağlanılamıyor — Çevrimdışı modda çalışılıyor.';
    }
    if (isProductionApp()) {
        return;
    }
    if (_backendUnreachableCount >= BACKEND_FAIL_THRESHOLD && !isOfflineDemoModeEnabled()) {
        sessionStorage.setItem('offlineDemoMode', 'true');
        console.warn('[SafeGuardian] Backend unreachable threshold reached → offline demo mode activated');
    }
}
function _onBackendSuccess() {
    _backendUnreachableCount = 0;
}

// =================== DİL / I18N ===================
const TRANSLATIONS = {
    tr: {
        emailLabel: 'E-POSTA', passwordLabel: 'ŞİFRE', rememberMeLabel: 'BENİ HATIRLA',
        loginBtn: 'GİRİŞ YAP', registerBtn: 'KAYIT OL', forgotBtn: 'ŞİFREMİ UNUTTUM',
        appleSignIn: 'Sign in with Apple', biometricLoginBtn: 'Face ID ile Giriş',
        registerTitle: 'KAYIT OL', backBtn: '← GERİ', fullNameLabel: 'AD SOYAD',
        phoneLabel: 'TELEFON', birthDateLabel: 'DOĞUM TARİHİ', completeRegBtn: 'KAYDI TAMAMLA',
        logoutBtn: 'ÇIKIŞ', medicationsLabel: 'İlaçlarım', familyLabel: 'Ailem', helpLabel: 'Yardım',
        emergencyBtn: 'ACİL YARDIM', howAreYou: 'NASILSIN?',
        moodGood: 'İYİYİM', moodOk: 'İDARE EDER', moodBad: 'İYİ DEĞİLİM',
        moodLabel: 'Ruh hali', cameraLabel: 'Kamera', healthLabel: 'Sağlığım',
        doctorBtn: 'DOKTORA GÖSTER', voiceBtn: 'DİNLE / SESİ TEKRARLA',
        moodScreenTitle: 'RUH HALİ TAKIBI', healthScreenTitle: 'SAĞLIK KAYITLARI',
        medicationsTitle: 'İLAÇLARIM', addMedBtn: 'YENİ İLAÇ EKLE',
        addMedTitle: 'YENİ İLAÇ EKLE', medNameLabel: 'İLAÇ ADI', medNotesLabel: 'NOTLAR',
        timesLabel: 'SAATLER', saveBtn: 'KAYDET',
        familyTitle: 'AİLE ÜYELERİ', addFamilyBtn: 'AİLE ÜYESİ EKLE',
        addFamilyTitle: 'AİLE ÜYESİ EKLE', nameLabel: 'AD', relationLabel: 'İLİŞKİ',
        helpTitle: 'YARDIM', understoodBtn: 'ANLADIM',
        emergencyModalTitle: 'Acil yardım',
        emergencyModalDesc: 'Konumunuz alınıyor ve ailenize haber verilecek',
        confirmBtn: 'ŞİMDİ GÖNDER', cancelBtn: 'İPTAL ET',
        locationOn: 'Konum açık',
        emergencyResultTitle: 'Yardım durumu',
        checkLocation: 'Konum alındı',
        checkNotify: 'Aileye bildirim gönderildi',
        checkSms: 'SMS gönderildi',
        callFamilyBtn: 'AİLEMİ ARA',
        backHomeLink: 'Ana sayfaya dön',
        homeAllGood: 'Her şey yolunda',
        howToUseLabel: 'Nasıl Kullanılır',
        navHome: 'Ana Sayfa', navFamily: 'Aile', navProfile: 'Profil',
        morningHi: 'Günaydın', afternoonHi: 'İyi günler', eveningHi: 'İyi akşamlar',
        voiceOnboardingTitle: 'Sesli Asistanı Başlat',
        voiceOnboardingDesc: 'Mikrofona dokun ve konuş. İstersen "İlaçlarım", "Aile", "Yardım" diyebilirsin.',
        voiceStartBtn: 'Sesli komut', voiceSkipBtn: 'ŞİMDİ DEĞİL',
        settingsBtn: 'AYARLAR', apiLabel: 'API ADRESİ',
        apiSaveBtn: 'KAYDET', apiClearBtn: 'SIFIRLA',
        largeTextOn: 'YAZIYI BÜYÜT', largeTextOff: 'YAZIYI KÜÇÜLT',
        contrastOn: 'KONTRASTI ARTIR', contrastOff: 'KONTRASTI AZALT',
        simpleModeOn: 'BASİT MOD', simpleModeOff: 'BASİT MOD KAPAT',
        resetViewBtnLabel: 'GÖRÜNÜMÜ SIFIRLA', langLabel: 'DİL',
        sessionExpired: 'Oturum Süresi Doldu', sessionExpiredMsg: 'Lütfen tekrar giriş yapın.',
        connError: 'Bağlantı hatası. API adresini kontrol edin.',
        connErrorBanner: 'İnternet bağlantınızı kontrol edin.',
        loginFailed: 'Giriş başarısız. E-posta veya şifre hatalı.',
        errorTitle: 'Hata', successTitle: 'Başarılı',
        welcomeMsg: 'Hoş geldiniz',
        homeGuidance: '',
        medicationGuidance: 'İlaçlarım sayfasındasınız. Aldığınız ilaçlar burada listelenir. Yeni ilaç eklemek için aşağıdaki butona basın.',
        addMedGuidance: 'Yeni ilaç ekle formunda bulunuyorsunuz. İlaç adını ve saatlerini girin.',
        familyGuidance: 'Aile üyeleri sayfasına hoş geldiniz. Sizinle iletişim kuran aile üyeleri burada listelenir.',
        helpGuidance: 'Yardım sayfasında bulunuyorsunuz. Tüm özellikleri burada açıklıyoruz.',
        loginGuidance: '',
        simpleBannerText: 'Basit mod açık: Ek özellikler gizlendi.',
        apiSaved: 'Kaydedildi', apiSavedMsg: 'API adresi güncellendi',
        apiReset: 'Sıfırlandı', apiResetMsg: 'API adresi temizlendi',
        supportHint: 'Yardım: support@vitaguard.app',
        relationSelect: 'Seçin...',
        relationChild: 'Çocuk', relationGrandchild: 'Torun', relationSpouse: 'Eş',
        relationSibling: 'Kardeş', relationOther: 'Diğer',
        accountBtn: 'HESAP',
        profileTitle: 'HESAP',
        subscriptionTitle: 'ABONELİK',
        profileCardTitle: 'HESAP BİLGİLERİ',
        userFullName: 'AD SOYAD', userEmail: 'E-POSTA',
        subscriptionStatus: 'ABONE DURUMU', daysRemaining: 'KALAN GÜN',
        premiumPlan: 'PREMIUM', standardPlan: 'STANDART',
        upgradePremium: 'Aile Paketine Geç', subscriptionButton: 'Abonelik',
        editProfileBtn: 'Bilgi güncelle', logoutBtn: 'Çıkış yap',
        editLogoutBtn: 'Çıkış yap',
        privacyPolicyBtn: 'Gizlilik',
        termsOfUseBtn: 'Kullanım koşulları',
        deleteAccountBtn: 'Hesabı kalıcı sil',
        buyFamilyPackageBtn: 'Aile Paketine Geç',
        restorePurchasesBtn: 'Satın almaları geri yükle',
        termsPrivacyBtn: 'Şartlar ve gizlilik',
        cancelSubscriptionBtn: 'Aboneliği iptal et',
        manageSubscriptionsBtn: 'Apple’da yönet',
        subscriptionPrivacyBtn: 'Gizlilik',
        subscriptionTermsBtn: 'Kullanım koşulları',
        watchAdUnlockBtn: 'Reklam izle (12 saat)',
        closeBtn: 'Kapat',
        settingsCloseBtn: 'Kapat',
        subscriptionLegalNote: 'Otomatik yenilemeli aboneliklerde iOS Ayarlar > Apple Kimliği > Abonelikler ekranından yönetim yapılabilir.',
        autoRenewDisclosure: 'Satın alma işlemini onayladığınızda ödeme Apple hesabınızdan tahsil edilir. Abonelik, mevcut dönem bitmeden en az 24 saat önce iptal edilmediği sürece otomatik yenilenir.',
        subscriptionDisclosureTitle: 'Abonelik detayları',
        subscriptionMonthlyLine: 'SafeGuardian Premium Aylık — 1 ay —',
        subscriptionYearlyLine: '',
        subscriptionPriceNote: 'Fiyat App Store ülkenize göre gösterilir; ödeme Apple hesabınızdan alınır.',
        privacyPolicyLinkLabel: 'Gizlilik Politikası',
        termsOfUseLinkLabel: 'Kullanım Koşulları',
        purchaseStarted: 'Satın alma başlatıldı',
        purchaseStartedMsg: 'Apple güvenli ödeme penceresi açılıyor.',
        purchaseSuccess: 'Satın alma başarılı',
        purchaseSuccessMsg: 'Aile paketi aktif edildi.',
        purchaseNotAvailable: 'Satın alma hazır değil',
        subscriptionComingSoonTitle: 'Aile Paketi',
        subscriptionComingSoonMsg: 'Aile paketi satın almak için iOS uygulamasını kullanın veya 12 saat tam erişim için reklam izleyin.',
        purchaseNotAvailableMsg: 'Satın alma şu anda başlatılamadı. Lütfen internet bağlantınızı ve App Store hesabınızı kontrol edip tekrar deneyin.',
        purchaseProductUnavailableMsg: 'Ürün App Store Connect Sandbox ortamında bulunamadı. Lütfen ürün kimliğini ve sözleşmeleri kontrol edin.',
        purchaseTechnicalErrorMsg: 'Satın alma sırasında bir hata oluştu. Lütfen tekrar deneyin veya Satın Almaları Geri Yükle seçeneğini kullanın.',
        appleUnavailable: 'Apple girişi bu cihazda kullanılamıyor.',
        appleLoginFailed: 'Apple girişi başarısız oldu.',
        biometricUnavailable: 'Face ID / biyometrik doğrulama desteklenmiyor.',
        biometricNoSession: 'Önce normal giriş yapın. Sonra Face ID ile hızlı giriş kullanabilirsiniz.',
        biometricFailed: 'Biyometrik doğrulama başarısız.',
        biometricPromptReason: 'SafeGuardian hesabınıza giriş yapın',
        subscriptionCancelSuccess: 'Apple abonelik ayarları açıldı. İptal işlemini Ayarlar > Apple Hesabı > Abonelikler bölümünden yapın.',
        subscriptionCancelFailed: 'Abonelik ayarları açılamadı. Ayarlar > Apple Hesabı > Abonelikler yolunu kullanın.',
        packageInfo: 'Paket bilgileri', currentPackage: 'Mevcut paket',
        endDate: 'Bitiş tarihi', features: 'Özellikler',
        basicFeature1: 'Temel ilaç yönetimi',
        basicFeature2: 'Aile üyeleri',
        basicFeature3: 'Sesli asistan',
        basicFeatures: 'Temel İlaç Yönetimi\nAile Üyeleri\nSesli Asistan',
        premiumFeatures: 'Video Doktor Konsültasyonu\nİnsan Asistanı (24/7)\nRuh Hali Analizi (AI)\nSağlık Trendleri',
        profileUpdated: 'Adınız güncellendi',
        profileUpdateMsg: 'İsminiz başarıyla güncellendi.',
        premiumAlready: 'Premium Aktif',
        premiumAlreadyMsg: 'Zaten premium aboneniz!',
        premiumSelected: 'Premium Başarılı',
        premiumSelectedMsg: 'Tekrardan hoş geldiniz!',
        restoreSuccess: 'Satın Alımlar Geri Yüklendi',
        restoreSuccessMsg: 'Abonelik bilgileriniz güncellendi.',
        restoreFailed: 'Geri Yükleme Başarısız',
        restoreFailedMsg: 'Abonelik bilgileri alınamadı. Lütfen tekrar deneyin.',
        deleteAccountTitle: 'Hesap Silme',
        deleteAccountConfirmMsg: 'Bu işlem hesabınızı ve tüm verileri kalıcı olarak siler. Devam etmek istiyor musunuz?',
        deleteAccountPasswordPrompt: 'Güvenlik için şifrenizi girin:',
        deleteAccountCanceled: 'İptal Edildi',
        deleteAccountCanceledMsg: 'Hesap silme işlemi iptal edildi.',
        deleteAccountNeedPassword: 'Şifre Gerekli',
        deleteAccountNeedPasswordMsg: 'Hesabınızı silmek için şifre girmeniz gerekiyor.',
        deleteAccountFinalPrompt: 'Son onay için SIL yazın:',
        deleteAccountFinalMismatch: 'Onay Eksik',
        deleteAccountFinalMismatchMsg: 'Hesap silme onayı verilmedi.',
        deleteAccountSuccess: 'Hesap Silindi',
        deleteAccountSuccessMsg: 'Hesabınız ve ilişkili veriler kalıcı olarak silindi.',
        deleteAccountFailed: 'Hesap Silinemedi',
        deleteAccountFailedMsg: 'Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
        medNamePlaceholder: 'Örn: Aspirin',
        medNotesPlaceholder: 'Yemekten sonra alınız',
        presetBp: 'TANSİYON', presetSugar: 'ŞEKER', presetChol: 'KOLESTEROL',
        helpMedTitle: 'İLAÇLARIM',
        helpMedDesc: 'Günlük ilacınızı alıp almadığınızı takip etmek için bu sayfayı kullanın. İlacınızı aldığınız zaman "ALDI" butonuna basın.',
        helpFamilyTitle: 'AİLE',
        helpFamilyDesc: 'Çocuklarınız ve torununuz uzaktan bilgi almak için bu sayfada sizinle bağlanabilir.',
        helpVoiceTitle: 'SES KOMUTU',
        helpVoiceDesc: 'Mikrofona konuşarak "İlaç ekle" veya "Ana sayfa" diyerek komut verebilirsiniz.',
        helpEmergencyTitle: 'ACİL DURUMDA',
        helpEmergencyDesc: 'Yardım almak için YARDIM butonuna basın ve aile üyeleriniz bilgilendirilecektir.',
        medsEmpty: 'Henüz ilaç eklenmedi',
        voiceHeard: 'Komut alındı',
        voiceUnknown: 'Komutu anlayamadım. Lütfen tekrar edin.',
        loginWelcome: 'Tekrar hoş geldiniz',
        loginSub: 'Hızlı ve güvenli giriş yapın',
        medsTimeLabel: 'Saatler', medsUnspecified: 'Belirtilmedi', medsRemaining: 'Kalan', medsTakenBtn: 'İLACIMI İÇTİM',
        familyMemberDefault: 'Aile Üyesi',
        moodThanksTitle: 'Teşekkürler', moodSavedMsg: 'Ruh haliniz kaydedildi', moodSaveError: 'Ruh hali kaydedilemedi',
        moodAverageLabel: 'Ortalama', moodTrendLabel: 'Eğilim', moodTrendImproving: 'İyileşiyor', moodTrendDeclining: 'Kötüleşiyor', moodTrendStable: 'Sabit',
        moodLastFiveDays: 'Son 5 Günün Ruh Hali', moodInfoTitle: 'Bilgi:',
        moodNoRecords: 'Henüz kayıt yok',
        moodInfoText: 'Ruh haliniz sistem tarafından günlük sohbetleriniz analiz edilerek izleniyor. Anormal bir değişim varsa, aile üyeleriniz otomatik olarak bilgilendirilecektir.',
        healthRecordsTitle: 'SAĞLIK KAYITLARI', noRecordsYet: 'Henüz kayıt bulunmamaktadır.',
        healthCritical: 'KRİTİK', healthWarning: 'UYARI', healthNormal: 'NORMAL', healthLastLabel: 'Son', healthLastFiveLabel: 'Son 5 kayıt', addNewRecordBtn: 'YENİ KAYIT',
        emailPlaceholder: 'ornek@mail.com',
        passwordPlaceholder: 'Şifrenizi girin',
        legalPrivacyLink: 'Gizlilik',
        legalTermsLink: 'Kullanım Koşulları',
        fullNamePlaceholder: 'Ad Soyad',
        phonePlaceholder: '05xx xxx xx xx',
        modalOk: 'Tamam',
        modalCancel: 'İptal',
        loadingText: 'Yükleniyor...',
        subscriptionRequiredTitle: 'Abonelik Gerekli',
        subscriptionRequiredMsg: '{feature} için abonelik gerekir. 12 saatlik tam erişim için abonelik ekranından reklam izleyebilirsiniz.',
        medAddedTitle: 'Başarılı',
        medAddedMsg: 'İlaç eklendi',
        medSavedLocalTitle: 'Başarılı',
        medSavedLocalMsg: 'İlaç yerel olarak kaydedildi',
        medTakenTitle: 'Başarılı',
        medTakenMsg: 'İlaç kaydedildi',
        medLowStockTitle: 'Uyarı',
        medLowStockMsg: 'İlaç kutusu bitti',
        medReminderTitle: 'İlaç Hatırlatma',
        medReminderMsg: '{name} ilacını alma zamanı.',
        medTimeRequiredTitle: 'Uyarı',
        medTimeRequiredMsg: 'En az bir saat seçin',
        medNotConfirmedTitle: 'Uyarı',
        medNotConfirmedMsg: 'İlaç onayı alınmadı',
        medUrgentTitle: 'Acil',
        medUrgentMsg: 'İlaç hala onaylanmadı',
        medDeleteBtn: 'İLACI SİL',
        medDeletedTitle: 'Silindi',
        medDeletedMsg: 'İlaç listeden kaldırıldı',
        medDeleteFailedTitle: 'Hata',
        medDeleteFailedMsg: 'İlaç silinemedi',
        familyEmpty: 'Henüz aile üyesi eklenmedi',
        familyAddedTitle: 'Başarılı',
        familyAddedMsg: 'Aile üyesi eklendi',
        familyAddFailedTitle: 'Hata',
        familyAddFailedMsg: 'Aile üyesi eklenemedi',
        regCompleteTitle: 'Başarılı',
        regCompleteMsg: 'Kayıt tamamlandı',
        tempPasswordTitle: 'Geçici Şifre',
        forgotEmailPrompt: 'E-posta adresinizi girin:',
        forgotSuccessTitle: 'Başarılı',
        forgotSuccessMsg: 'Geçici şifre oluşturuldu',
        forgotFailedTitle: 'Hata',
        forgotFailedMsg: 'İşlem başarısız',
        regFailedTitle: 'Hata',
        regFailedMsg: 'Kayıt başarısız',
        connErrorTitle: 'Hata',
        genericErrorTitle: 'Hata',
        genericErrorMsg: 'Bir sorun oluştu',
        emergencySentTitle: 'Gönderildi',
        emergencySentMsg: 'Acil yardım çağrısı gönderildi',
        emergencyFailedTitle: 'Hata',
        emergencyFailedMsg: 'Acil çağrı gönderilemedi',
        emergencyCancelTitle: 'İptal',
        emergencyCancelMsg: 'Acil çağrı iptal edildi',
        moodPromptTitle: 'Ruh Hali',
        moodPromptMsg: 'Sesli komut kullanın: "Ruh halim 7"',
        healthPromptTitle: 'Sağlık Kontrolü',
        healthRecordSavedTitle: 'Başarılı',
        healthRecordSavedMsg: 'Sağlık kaydı kaydedildi',
        confirmCancelSubTitle: 'Abonelik İptali',
        confirmCancelSubMsg: 'Abonelik iptali Apple tarafından yönetilir. Apple abonelik ayarlarını açmak ister misiniz?',
        adUnlockSuccessTitle: 'Başarılı',
        adUnlockSuccessMsg: 'Tüm özellikler 12 saatliğine açıldı.',
        adNotAvailableTitle: 'Reklam Kullanılamıyor',
        adNotAvailableMsg: 'Bu cihazda ödüllü reklam başlatılamadı.',
        adRewardNotEarnedTitle: 'Ödül Alınamadı',
        adRewardNotEarnedMsg: 'Ödül için reklamı sonuna kadar izlemelisiniz.',
        adRewardUpdateFailedTitle: 'Hata',
        adRewardUpdateFailedMsg: 'Ödül alındı ancak erişim güncellenemedi. Tekrar deneyin.',
        watchAdUnlockBtn: 'REKLAM İZLE — 12 SAAT TÜM ÖZELLİKLER',
        watchAdPremiumActive: 'PREMIUM AKTİF',
        watchAdTrialActive: 'ÜCRETSİZ DENEME AKTİF',
        watchAdRewardActive: 'REKLAM ÖDÜLÜ AKTİF',
        entitlementTrialEnded: 'Ücretsiz deneme bitti. Abone olun veya reklam izleyin.',
        entitlementComingSoon: 'Aile paketi için iOS uygulamasını kullanın veya reklam izleyerek 12 saat tam erişim alın.',
        editProfileNamePrompt: 'Ad soyadınız:',
        editProfileEmailPrompt: 'E-posta adresiniz:',
        editProfilePhonePrompt: 'Telefon numaranız:',
        editProfileSaved: 'Profil bilgileriniz güncellendi',
        voiceCommandReadyTitle: 'Sesli Komut Hazır',
        voiceCommandReadyMsg: 'Acil komut alındı. Lütfen giriş yapın, ardından otomatik çalıştırılacak.',
        voiceEmergencyDetectedTitle: 'Sesli Komut',
        voiceEmergencyDetectedMsg: '{source} üzerinden ACİL komutu algılandı. Onay ekranı açılıyor.',
        tempPasswordMsg: 'Şifreniz: {password}',
        noPhoneTitle: 'Uyarı',
        noPhoneMsg: 'Kayıtlı telefon bulunamadı',
        voiceOnboardingSpeak: 'Sesli asistanı başlatmak için dinlemeyi başlat düğmesine dokunun.',
        voiceOnboardingStarted: 'Dinleme açık. Şimdi konuşabilirsiniz.',
        voiceOnboardingSkipped: 'Dilediğiniz zaman Dinle düğmesine dokunabilirsiniz.',
        voiceListening: 'Dinleniyor...',
        settingsBtn: 'AYARLAR',
        accountBtn: 'HESAP',
    },
    en: {
        emailLabel: 'EMAIL', passwordLabel: 'PASSWORD', rememberMeLabel: 'REMEMBER ME',
        loginBtn: 'SIGN IN', registerBtn: 'REGISTER', forgotBtn: 'FORGOT PASSWORD',
        appleSignIn: 'Sign in with Apple', biometricLoginBtn: 'Sign in with Face ID',
        registerTitle: 'REGISTER', backBtn: '← BACK', fullNameLabel: 'FULL NAME',
        phoneLabel: 'PHONE', birthDateLabel: 'DATE OF BIRTH', completeRegBtn: 'COMPLETE REGISTRATION',
        logoutBtn: 'LOGOUT', medicationsLabel: 'My medications', familyLabel: 'My family', helpLabel: 'Help',
        emergencyBtn: 'EMERGENCY HELP', howAreYou: 'HOW ARE YOU?',
        moodGood: 'FEELING GOOD', moodOk: 'SO SO', moodBad: 'NOT FEELING WELL',
        moodLabel: 'Mood', cameraLabel: 'Camera', healthLabel: 'My health',
        doctorBtn: 'SHOW DOCTOR', voiceBtn: 'LISTEN / REPEAT',
        moodScreenTitle: 'MOOD TRACKING', healthScreenTitle: 'HEALTH RECORDS',
        medicationsTitle: 'MY MEDICATIONS', addMedBtn: 'ADD MEDICATION',
        addMedTitle: 'ADD MEDICATION', medNameLabel: 'MEDICATION NAME', medNotesLabel: 'NOTES',
        timesLabel: 'TIMES', saveBtn: 'SAVE',
        familyTitle: 'FAMILY MEMBERS', addFamilyBtn: 'ADD FAMILY MEMBER',
        addFamilyTitle: 'ADD FAMILY MEMBER', nameLabel: 'NAME', relationLabel: 'RELATION',
        helpTitle: 'HELP', understoodBtn: 'GOT IT',
        emergencyModalTitle: 'Emergency help',
        emergencyModalDesc: 'Getting your location and notifying your family',
        confirmBtn: 'SEND NOW', cancelBtn: 'CANCEL',
        locationOn: 'Location on',
        emergencyResultTitle: 'Help status',
        checkLocation: 'Location saved',
        checkNotify: 'Family notified',
        checkSms: 'SMS sent',
        callFamilyBtn: 'CALL MY FAMILY',
        backHomeLink: 'Back to home',
        homeAllGood: 'Everything is okay',
        howToUseLabel: 'How to use',
        navHome: 'Home', navFamily: 'Family', navProfile: 'Profile',
        morningHi: 'Good morning', afternoonHi: 'Good afternoon', eveningHi: 'Good evening',
        voiceOnboardingTitle: 'Start Voice Assistant',
        voiceOnboardingDesc: 'Tap the microphone and speak. You can say "Medications", "Family", "Help".',
        voiceStartBtn: 'Voice command', voiceSkipBtn: 'NOT NOW',
        settingsBtn: 'SETTINGS', apiLabel: 'API ADDRESS',
        apiSaveBtn: 'SAVE', apiClearBtn: 'RESET',
        largeTextOn: 'INCREASE TEXT SIZE', largeTextOff: 'DECREASE TEXT SIZE',
        contrastOn: 'INCREASE CONTRAST', contrastOff: 'DECREASE CONTRAST',
        simpleModeOn: 'SIMPLE MODE', simpleModeOff: 'SIMPLE MODE OFF',
        resetViewBtnLabel: 'RESET DISPLAY', langLabel: 'LANGUAGE',
        sessionExpired: 'Session Expired', sessionExpiredMsg: 'Please login again.',
        connError: 'Connection error. Please check API address.',
        connErrorBanner: 'Check your internet connection.',
        loginFailed: 'Login failed. Please check your email and password.',
        errorTitle: 'Error', successTitle: 'Success',
        welcomeMsg: 'Welcome',
        homeGuidance: '',
        medicationGuidance: 'You are on the Medications page. Your medications are listed here.',
        addMedGuidance: 'You are on the Add Medication form. Enter the medication name and times.',
        familyGuidance: 'Welcome to the Family Members page.',
        helpGuidance: 'You are on the Help page.',
        loginGuidance: '',
        simpleBannerText: 'Simple mode on: Extra features hidden.',
        apiSaved: 'Saved', apiSavedMsg: 'API address updated',
        apiReset: 'Reset', apiResetMsg: 'API address cleared',
        supportHint: 'Support: support@vitaguard.app',
        relationSelect: 'Select...',
        relationChild: 'Child', relationGrandchild: 'Grandchild', relationSpouse: 'Spouse',
        relationSibling: 'Sibling', relationOther: 'Other',
        accountBtn: 'ACCOUNT',
        profileTitle: 'ACCOUNT',
        subscriptionTitle: 'SUBSCRIPTION',
        profileCardTitle: 'ACCOUNT DETAILS',
        userFullName: 'FULL NAME', userEmail: 'EMAIL',
        subscriptionStatus: 'SUBSCRIPTION STATUS', daysRemaining: 'DAYS LEFT',
        premiumPlan: 'PREMIUM', standardPlan: 'STANDARD',
        upgradePremium: 'UPGRADE TO FAMILY PLAN', subscriptionButton: 'SUBSCRIPTION',
        editProfileBtn: 'UPDATE INFO', logoutBtn: 'LOGOUT',
        editLogoutBtn: 'LOGOUT',
        privacyPolicyBtn: 'PRIVACY POLICY',
        termsOfUseBtn: 'TERMS OF USE',
        deleteAccountBtn: 'DELETE ACCOUNT',
        buyFamilyPackageBtn: 'UPGRADE TO FAMILY PLAN',
        restorePurchasesBtn: 'RESTORE PURCHASES',
        termsPrivacyBtn: 'TERMS & PRIVACY',
        cancelSubscriptionBtn: 'Cancel subscription',
        manageSubscriptionsBtn: 'Manage in Apple',
        watchAdUnlockBtn: 'Watch ad (12 hours)',
        closeBtn: 'Close',
        settingsCloseBtn: 'Close',
        editProfileBtn: 'Update info',
        privacyPolicyBtn: 'Privacy',
        editLogoutBtn: 'Log out',
        upgradePremium: 'Upgrade to Family',
        subscriptionButton: 'Subscription',
        buyFamilyPackageBtn: 'Upgrade to Family',
        restorePurchasesBtn: 'Restore purchases',
        subscriptionPrivacyBtn: 'Privacy',
        subscriptionTermsBtn: 'Terms of use',
        subscriptionLegalNote: 'For auto-renewable subscriptions, you can manage billing in iOS Settings > Apple ID > Subscriptions.',
        autoRenewDisclosure: 'Payment will be charged to your Apple account at confirmation of purchase. The subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel your subscription in Settings > Apple ID > Subscriptions.',
        subscriptionPrivacyBtn: 'PRIVACY POLICY',
        subscriptionTermsBtn: 'TERMS OF USE (EULA)',
        subscriptionDisclosureTitle: 'SUBSCRIPTION DETAILS',
        subscriptionMonthlyLine: 'SafeGuardian Premium Monthly — 1 month —',
        subscriptionYearlyLine: '',
        privacyPolicyLinkLabel: 'Privacy Policy',
        termsOfUseLinkLabel: 'Terms of Use (EULA)',
        subscriptionPriceLoading: 'Loading App Store price',
        subscriptionPriceNote: 'Price and currency are shown for your App Store country and charged to your Apple account.',
        purchaseStarted: 'Purchase started',
        purchaseStartedMsg: 'Opening Apple secure payment sheet.',
        purchaseSuccess: 'Purchase successful',
        purchaseSuccessMsg: 'Family plan is now active.',
        purchaseNotAvailable: 'Purchase unavailable',
        subscriptionComingSoonTitle: 'Family Plan',
        subscriptionComingSoonMsg: 'Use the iOS app to purchase the Family Plan, or watch an ad for 12-hour full access.',
        purchaseNotAvailableMsg: 'Purchase could not be started right now. Please check your internet connection and App Store account, then try again.',
        purchaseProductUnavailableMsg: 'The product was not found in App Store Connect Sandbox. Please verify product identifiers and agreements.',
        purchaseTechnicalErrorMsg: 'A purchase error occurred. Please try again or use Restore Purchases.',
        appleUnavailable: 'Apple sign-in is not available on this device.',
        appleLoginFailed: 'Apple sign-in failed.',
        biometricUnavailable: 'Face ID / biometric authentication is unavailable.',
        biometricNoSession: 'Please sign in once with email/password first, then use Face ID quick sign-in.',
        biometricFailed: 'Biometric authentication failed.',
        biometricPromptReason: 'Sign in to your SafeGuardian account',
        subscriptionCancelSuccess: 'Apple subscription settings opened. Cancel under Settings > Apple Account > Subscriptions.',
        subscriptionCancelFailed: 'Could not open subscription settings. Use Settings > Apple Account > Subscriptions.',
        packageInfo: 'PACKAGE INFO', currentPackage: 'CURRENT PLAN',
        endDate: 'END DATE', features: 'FEATURES',
        basicFeature1: 'Basic Medication Management',
        basicFeature2: 'Family Members',
        basicFeature3: 'Voice Assistant',
        closeBtn: '← CLOSE',
        basicFeatures: 'Basic Medication Management\nFamily Members\nVoice Assistant',
        premiumFeatures: 'Video Doctor Consultation\nHuman Assistant (24/7)\nAI Mood Analysis\nHealth Trends',
        profileUpdated: 'Name Updated',
        profileUpdateMsg: 'Your name was successfully updated.',
        premiumAlready: 'Premium Active',
        premiumAlreadyMsg: 'You are already a premium subscriber!',
        premiumSelected: 'Premium Successful',
        premiumSelectedMsg: 'Welcome back!',
        restoreSuccess: 'Purchases Restored',
        restoreSuccessMsg: 'Your subscription details were refreshed.',
        restoreFailed: 'Restore Failed',
        restoreFailedMsg: 'Subscription details could not be loaded. Please try again.',
        deleteAccountTitle: 'Delete Account',
        deleteAccountConfirmMsg: 'This action permanently deletes your account and all data. Do you want to continue?',
        deleteAccountPasswordPrompt: 'For security, enter your password:',
        deleteAccountCanceled: 'Cancelled',
        deleteAccountCanceledMsg: 'Account deletion was cancelled.',
        deleteAccountNeedPassword: 'Password Required',
        deleteAccountNeedPasswordMsg: 'You must enter your password to delete your account.',
        deleteAccountFinalPrompt: 'Type DELETE for final confirmation:',
        deleteAccountFinalMismatch: 'Confirmation Missing',
        deleteAccountFinalMismatchMsg: 'Account deletion confirmation not provided.',
        deleteAccountSuccess: 'Account Deleted',
        deleteAccountSuccessMsg: 'Your account and related data were permanently deleted.',
        deleteAccountFailed: 'Delete Failed',
        deleteAccountFailedMsg: 'Please verify your information and try again.',
        medNamePlaceholder: 'e.g. Aspirin',
        medNotesPlaceholder: 'Take after meal',
        presetBp: 'BLOOD PRESSURE', presetSugar: 'BLOOD SUGAR', presetChol: 'CHOLESTEROL',
        helpMedTitle: 'MY MEDICATIONS',
        helpMedDesc: 'Use this page to track daily medicines. Tap "TAKEN" when you take your medicine.',
        helpFamilyTitle: 'FAMILY',
        helpFamilyDesc: 'Your family can connect and follow your status from this page.',
        helpVoiceTitle: 'VOICE COMMAND',
        helpVoiceDesc: 'You can say commands like "Add medication" or "Home screen".',
        helpEmergencyTitle: 'IN EMERGENCY',
        helpEmergencyDesc: 'Press HELP button to alert your family members.',
        medsEmpty: 'No medications added yet',
        voiceHeard: 'Command received',
        voiceUnknown: 'I could not understand the command. Please repeat.',
        loginWelcome: 'Welcome back',
        loginSub: 'Sign in quickly and securely',
        medsTimeLabel: 'Times', medsUnspecified: 'Not specified', medsRemaining: 'Remaining', medsTakenBtn: 'MARK AS TAKEN',
        familyMemberDefault: 'Family Member',
        moodThanksTitle: 'Thank You', moodSavedMsg: 'Your mood has been saved', moodSaveError: 'Mood could not be saved',
        moodAverageLabel: 'Average', moodTrendLabel: 'Trend', moodTrendImproving: 'Improving', moodTrendDeclining: 'Declining', moodTrendStable: 'Stable',
        moodLastFiveDays: 'Last 5 Days Mood', moodInfoTitle: 'Info:',
        moodNoRecords: 'No records yet',
        moodInfoText: 'Your mood is monitored by analyzing daily conversations. If an abnormal change is detected, your family members are automatically informed.',
        healthRecordsTitle: 'HEALTH RECORDS', noRecordsYet: 'No records yet.',
        healthCritical: 'CRITICAL', healthWarning: 'WARNING', healthNormal: 'NORMAL', healthLastLabel: 'Last', healthLastFiveLabel: 'Last 5 records', addNewRecordBtn: 'NEW RECORD',
        emailPlaceholder: 'example@mail.com',
        passwordPlaceholder: 'Enter your password',
        legalPrivacyLink: 'Privacy',
        legalTermsLink: 'Terms of Use',
        fullNamePlaceholder: 'Full name',
        phonePlaceholder: 'Phone number',
        modalOk: 'OK',
        modalCancel: 'Cancel',
        loadingText: 'Loading...',
        subscriptionRequiredTitle: 'Subscription Required',
        subscriptionRequiredMsg: '{feature} requires a subscription. Watch an ad on the subscription screen for 12-hour full access.',
        medAddedTitle: 'Success',
        medAddedMsg: 'Medication added',
        medSavedLocalTitle: 'Success',
        medSavedLocalMsg: 'Medication saved locally',
        medTakenTitle: 'Success',
        medTakenMsg: 'Medication recorded',
        medLowStockTitle: 'Warning',
        medLowStockMsg: 'Medication supply is low',
        medReminderTitle: 'Medication Reminder',
        medReminderMsg: 'Time to take {name}.',
        medTimeRequiredTitle: 'Warning',
        medTimeRequiredMsg: 'Select at least one time',
        medNotConfirmedTitle: 'Warning',
        medNotConfirmedMsg: 'Medication was not confirmed',
        medUrgentTitle: 'Urgent',
        medUrgentMsg: 'Medication still not confirmed',
        medDeleteBtn: 'DELETE MEDICATION',
        medDeletedTitle: 'Deleted',
        medDeletedMsg: 'Medication removed from your list',
        medDeleteFailedTitle: 'Error',
        medDeleteFailedMsg: 'Could not delete medication',
        familyEmpty: 'No family members added yet',
        familyAddedTitle: 'Success',
        familyAddedMsg: 'Family member added',
        familyAddFailedTitle: 'Error',
        familyAddFailedMsg: 'Could not add family member',
        regCompleteTitle: 'Success',
        regCompleteMsg: 'Registration completed',
        tempPasswordTitle: 'Temporary Password',
        forgotEmailPrompt: 'Enter your email address:',
        forgotSuccessTitle: 'Success',
        forgotSuccessMsg: 'A temporary password was created',
        forgotFailedTitle: 'Error',
        forgotFailedMsg: 'Request failed',
        regFailedTitle: 'Error',
        regFailedMsg: 'Registration failed',
        connErrorTitle: 'Error',
        genericErrorTitle: 'Error',
        genericErrorMsg: 'Something went wrong',
        emergencySentTitle: 'Sent',
        emergencySentMsg: 'Emergency alert was sent',
        emergencyFailedTitle: 'Error',
        emergencyFailedMsg: 'Emergency alert could not be sent',
        emergencyCancelTitle: 'Cancelled',
        emergencyCancelMsg: 'Emergency alert cancelled',
        moodPromptTitle: 'Mood',
        moodPromptMsg: 'Use a voice command: "My mood is 7"',
        healthPromptTitle: 'Health Check',
        healthRecordSavedTitle: 'Success',
        healthRecordSavedMsg: 'Health record saved',
        confirmCancelSubTitle: 'Cancel Subscription',
        confirmCancelSubMsg: 'Apple manages subscription cancellation. Open Apple subscription settings now?',
        adUnlockSuccessTitle: 'Success',
        adUnlockSuccessMsg: 'All features unlocked for 12 hours.',
        adNotAvailableTitle: 'Ad Not Available',
        adNotAvailableMsg: 'Rewarded ad could not be started on this device.',
        adRewardNotEarnedTitle: 'Reward Not Earned',
        adRewardNotEarnedMsg: 'Watch the ad until the end to unlock features.',
        adRewardUpdateFailedTitle: 'Error',
        adRewardUpdateFailedMsg: 'Reward received but entitlement could not be updated. Please retry.',
        watchAdUnlockBtn: 'WATCH AD — UNLOCK ALL FEATURES FOR 12 HOURS',
        watchAdPremiumActive: 'PREMIUM ACTIVE',
        watchAdTrialActive: 'FREE TRIAL ACTIVE',
        watchAdRewardActive: 'AD REWARD ACTIVE',
        entitlementTrialEnded: 'Free trial ended. Subscribe or watch an ad for 12-hour access.',
        entitlementComingSoon: 'Use the iOS app for the Family Plan, or watch an ad for 12-hour full access.',
        editProfileNamePrompt: 'Your full name:',
        editProfileEmailPrompt: 'Your email:',
        editProfilePhonePrompt: 'Your phone number:',
        editProfileSaved: 'Your profile has been updated',
        voiceCommandReadyTitle: 'Voice Command Ready',
        voiceCommandReadyMsg: 'Emergency command received. Please sign in — it will run automatically.',
        voiceEmergencyDetectedTitle: 'Voice Command',
        voiceEmergencyDetectedMsg: 'EMERGENCY command detected via {source}. Opening confirmation.',
        tempPasswordMsg: 'Your password: {password}',
        noPhoneTitle: 'Warning',
        noPhoneMsg: 'No phone number on file',
        voiceOnboardingSpeak: 'Tap Start Listening to enable the voice assistant.',
        voiceOnboardingStarted: 'Listening is on. You can speak now.',
        voiceOnboardingSkipped: 'You can tap Listen anytime.',
        voiceListening: 'Listening...',
        settingsBtn: 'SETTINGS',
        accountBtn: 'ACCOUNT',
    }
};

function detectPreferredLanguage() {
    const savedLang = localStorage.getItem('appLang');
    if (savedLang && TRANSLATIONS[savedLang]) {
        return savedLang;
    }

    // Capacitor iOS simulator always reports 'en' browser lang regardless of device locale.
    // Default to Turkish so the app launches in TR unless the user explicitly changes it.
    if (IS_CAPACITOR_IOS) return 'tr';

    const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || navigator.userLanguage || 'tr'];

    for (const language of browserLanguages) {
        const normalized = String(language || '').toLowerCase();
        if (normalized.startsWith('tr')) return 'tr';
        if (normalized.startsWith('en')) return 'en';
    }

    return 'tr';
}

let currentLang = detectPreferredLanguage();

function t(key) {
    const dictionary = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
        return dictionary[key];
    }
    return key;
}

function notifyI18n(titleKey, messageKey, type = 'success', vars = {}) {
    let title = t(titleKey);
    let message = t(messageKey);
    Object.entries(vars).forEach(([name, value]) => {
        title = title.replace(`{${name}}`, value);
        message = message.replace(`{${name}}`, value);
    });
    showNotification(title, message, type);
}

function showAppConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('sgModal');
        const titleEl = document.getElementById('sgModalTitle');
        const messageEl = document.getElementById('sgModalMessage');
        const inputEl = document.getElementById('sgModalInput');
        const actionsEl = document.getElementById('sgModalActions');
        if (!modal || !titleEl || !messageEl || !actionsEl) {
            resolve(window.confirm(`${title}\n\n${message}`));
            return;
        }
        titleEl.textContent = title;
        messageEl.textContent = message;
        if (inputEl) inputEl.hidden = true;
        actionsEl.innerHTML = '';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-small btn-gray';
        cancelBtn.textContent = t('modalCancel');
        cancelBtn.onclick = () => {
            modal.classList.remove('show');
            modal.hidden = true;
            resolve(false);
        };
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn-small btn-blue';
        okBtn.textContent = t('modalOk');
        okBtn.onclick = () => {
            modal.classList.remove('show');
            modal.hidden = true;
            resolve(true);
        };
        actionsEl.append(cancelBtn, okBtn);
        modal.hidden = false;
        modal.classList.add('show');
    });
}

function showAppPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('sgModal');
        const titleEl = document.getElementById('sgModalTitle');
        const messageEl = document.getElementById('sgModalMessage');
        const inputEl = document.getElementById('sgModalInput');
        const actionsEl = document.getElementById('sgModalActions');
        if (!modal || !titleEl || !messageEl || !inputEl || !actionsEl) {
            resolve(window.prompt(message, defaultValue));
            return;
        }
        titleEl.textContent = title;
        messageEl.textContent = message;
        inputEl.hidden = false;
        inputEl.removeAttribute('hidden');
        inputEl.style.display = 'block';
        inputEl.value = defaultValue || '';
        actionsEl.innerHTML = '';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-small btn-gray';
        cancelBtn.textContent = t('modalCancel');
        cancelBtn.onclick = () => {
            modal.classList.remove('show');
            modal.hidden = true;
            inputEl.setAttribute('hidden', '');
            inputEl.style.display = 'none';
            resolve(null);
        };
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn-small btn-blue';
        okBtn.textContent = t('modalOk');
        okBtn.onclick = () => {
            const value = inputEl.value;
            modal.classList.remove('show');
            modal.hidden = true;
            inputEl.setAttribute('hidden', '');
            inputEl.style.display = 'none';
            resolve(value);
        };
        actionsEl.append(cancelBtn, okBtn);
        modal.hidden = false;
        modal.removeAttribute('hidden');
        modal.classList.add('show');
        setTimeout(() => {
            try { inputEl.focus(); inputEl.select?.(); } catch (_) { /* ignore */ }
        }, 80);
    });
}

function updateA11yControlsVisibility(screenId) {
    const controls = document.querySelector('.a11y-controls');
    if (!controls) return;
    const hideOn = new Set(['loginScreen', 'registerScreen']);
    controls.classList.toggle('is-hidden', hideOn.has(screenId));
}

function getApiBase() {
    const rawStored = localStorage.getItem('apiBaseUrl')?.trim();
    const configured = window.API_BASE?.trim?.();
    const origin = window.location?.origin || '';
    const protocol = window.location?.protocol || '';
    const userAgent = navigator.userAgent || '';
    const isHttpOrigin = /^https?:\/\//i.test(origin);
    const isCapacitorRuntime = Boolean(window.Capacitor);
    const isIosSimulator = /iPhone Simulator|iPad Simulator|Simulator/i.test(userAgent);
    const isCapacitorLocalhost = /^capacitor:\/\/localhost/i.test(origin) || /^capacitor:/i.test(protocol);
    const stored = rawStored && /:3000\b/.test(rawStored)
        ? ''
        : rawStored;

    if (rawStored && !stored) {
        localStorage.removeItem('apiBaseUrl');
    }

    let candidate = stored || configured || (isHttpOrigin ? origin : '');

    // Hosted web'de farklı domain'e yanlış/stale API yazıldıysa (ör. vitaguard.app)
    // CORS + 503'e düşmemek için aynı origin/configured API'ye geri dön.
    // Not: Bazı web ortamlarda window.Capacitor nesnesi tanımlı olabilir; bu yüzden
    // burada sadece origin/protocol'e bakarak güvenli davranıyoruz.
    if (isHttpOrigin && stored) {
        try {
            const storedOrigin = new URL(/^https?:\/\//i.test(stored) ? stored : `https://${stored}`).origin;
            const sameOrigin = storedOrigin === origin;
            const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/i.test(storedOrigin);
            if (!sameOrigin && !isLocalDev) {
                localStorage.removeItem('apiBaseUrl');
                candidate = configured || origin;
            }
        } catch {
            localStorage.removeItem('apiBaseUrl');
            candidate = configured || origin;
        }
    }

    if (!stored && isCapacitorRuntime && isCapacitorLocalhost) {
        candidate = IOS_SIMULATOR_API_BASE;
    }

    if (!candidate && isCapacitorRuntime) {
        candidate = isIosSimulator ? IOS_SIMULATOR_API_BASE : DEFAULT_API_BASE;
    }

    if (isCapacitorRuntime && (isIosSimulator || isCapacitorLocalhost) && /vitaguard\.app/i.test(candidate || '')) {
        candidate = IOS_SIMULATOR_API_BASE;
    }

    if (candidate && !/^https?:\/\//i.test(candidate)) {
        candidate = `http://${candidate}`;
    }

    try {
        return new URL(candidate).origin;
    } catch {
        return (isIosSimulator || isCapacitorLocalhost) ? IOS_SIMULATOR_API_BASE : DEFAULT_API_BASE;
    }
}

const API_BASE = getApiBase();
const PreferencesPlugin = window.Capacitor?.Plugins?.Preferences;
const GeolocationPlugin = window.Capacitor?.Plugins?.Geolocation;
// Must match App Store Connect product ID exactly (SG Premium Family Access V2).
const FAMILY_PLAN_PRODUCT_ID = 'com.buseakdeniz.safeguardian.sub_family_monthly_v2';
const FAMILY_PLAN_PRODUCT_ID_CANDIDATES = [
    FAMILY_PLAN_PRODUCT_ID
];
const ALL_FAMILY_PLAN_PRODUCT_IDS = Array.from(new Set(FAMILY_PLAN_PRODUCT_ID_CANDIDATES));
// App Review requires the full purchase/renewal flow to be accessible (Guideline 2.1).
const STOREKIT_PURCHASES_ENABLED = (() => {
    try {
        return window.SafeGuardianRevenueCat?.isNativeSupported?.() === true;
    } catch {
        return false;
    }
})();

let lastGuidanceText = '';
let emergencyTimer = null;
let ignoreNextA11yClose = false;
try { window.ignoreNextA11yClose = false; } catch (_) { /* ignore */ }
let isEmergencyModalOpen = false;
var speechRecognition = null;
var isListening = false;
let lastVoiceCommand = '';
let lastVoiceCommandAt = 0;
const MEDICATION_CONFIRM_WARNING_MS = 15 * 60 * 1000;
const MEDICATION_CONFIRM_CRITICAL_MS = 30 * 60 * 1000;
const medicationConfirmTimers = new Map();
const medicationReminderState = new Map();
let subscriptionCache = null;
let subscriptionProductCache = null;
let subscriptionProductLoadAttempted = false;
let selectedFamilyPlanProductId = FAMILY_PLAN_PRODUCT_ID;
let currentMedicationsCache = [];
let careRoutineStarted = false;
let authTokenCache = null;
let userHasInteracted = !IS_CAPACITOR_IOS;
let lastSpokenText = '';
let lastSpokenAt = 0;

const PUBLIC_SCREENS = new Set(['loginScreen', 'registerScreen', 'helpScreen', 'homeScreen']);

function isDemoOfflineToken(value) {
    return String(value || '').trim() === DEMO_OFFLINE_TOKEN;
}

function withTimeout(promise, ms, label = 'operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
        })
    ]);
}

function isOfflineDemoModeEnabled() {
    return sessionStorage.getItem('offlineDemoMode') === 'true';
}

function clearOfflineDemoMode() {
    sessionStorage.removeItem('offlineDemoMode');
}

async function getStoredToken() {
    if (authTokenCache) return authTokenCache;

    if (PreferencesPlugin) {
        try {
            const result = await PreferencesPlugin.get({ key: 'token' });
            const token = result?.value || '';
            // NOTE: Demo REVIEW token must remain usable for App Review flows.
            // Only the offline demo token should not persist as a real session.
            if (isDemoOfflineToken(token)) {
                await PreferencesPlugin.remove({ key: 'token' });
                authTokenCache = null;
                return '';
            }
            if (token) {
                authTokenCache = token;
                return token;
            }
        } catch (error) {
            console.warn('Preferences token okuma hatası:', error);
        }
    }

    const webToken = localStorage.getItem('token') || '';
    if (isDemoOfflineToken(webToken)) {
        localStorage.removeItem('token');
        authTokenCache = null;
        return '';
    }
    if (webToken && PreferencesPlugin) {
        try {
            await PreferencesPlugin.set({ key: 'token', value: webToken });
        } catch (error) {
            console.warn('Preferences token taşıma hatası:', error);
        }
    }

    authTokenCache = webToken || null;
    return webToken;
}

async function setStoredToken(value) {
    const tokenValue = String(value || '');
    authTokenCache = tokenValue || null;
    localStorage.setItem('token', tokenValue);
    if (!PreferencesPlugin) return;
    try {
        await PreferencesPlugin.set({ key: 'token', value: tokenValue });
    } catch (error) {
        console.warn('Preferences token yazma hatası:', error);
    }
}

async function removeStoredToken() {
    authTokenCache = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiresAt');
    sessionStorage.removeItem('refreshToken');
    clearOfflineDemoMode();
    if (!PreferencesPlugin) return;
    try {
        await PreferencesPlugin.remove({ key: 'token' });
    } catch (error) {
        console.warn('Preferences token silme hatası:', error);
    }
}

async function validateStoredSessionToken(token) {
    const value = String(token || '').trim();
    if (!value || isDemoOfflineToken(value) || isOfflineDemoModeEnabled()) {
        if (isDemoOfflineToken(value)) {
            await removeStoredToken();
            return false;
        }
        return Boolean(value) && !isDemoOfflineToken(value);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2200) : null;

    try {
        const response = await fetch(`${API_BASE}/api/me`, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${value}` },
            signal: controller?.signal
        });

        if (response.status === 401) {
            await removeStoredToken();
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('rememberMe');
            return false;
        }

        return true;
    } catch {
        // Network hatasında kullanıcıyı zorla logout etmeyiz.
        return true;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

function hasAuthTokenSync() {
    return Boolean(authTokenCache || localStorage.getItem('token') || isOfflineDemoModeEnabled());
}

function requireAuthToken() {
    if (isOfflineDemoModeEnabled()) {
        return DEMO_OFFLINE_TOKEN;
    }
    const token = authTokenCache || localStorage.getItem('token');
    if (!token) {
        showScreen('loginScreen');
        return null;
    }
    return token;
}

async function requireAuthTokenAsync() {
    if (isOfflineDemoModeEnabled()) {
        return DEMO_OFFLINE_TOKEN;
    }
    const token = await getStoredToken();
    if (!token) {
        showScreen('loginScreen');
        return null;
    }
    return token;
}

function handleAuthExpired() {
    removeStoredToken();
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('rememberMe');
    showNotification(t('sessionExpired'), t('sessionExpiredMsg'), 'error');
    showScreen('loginScreen');
}

function forceCloseLoadingAndRecover() {
    try {
        const loadingLike = ['loadingScreen', 'globalLoading', 'spinnerOverlay', 'overlayLoading'];
        loadingLike.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('active');
            el.style.display = 'none';
            el.setAttribute('hidden', '');
        });
        document.querySelectorAll('[data-loading="true"], .loading, .loading-overlay, .spinner, .spinner-overlay').forEach((el) => {
            el.classList.remove('active');
            el.style.display = 'none';
            el.setAttribute('hidden', '');
        });
    } catch (_) { }

    if (hasAuthTokenSync()) {
        showScreen('homeScreen');
    } else {
        showScreen('loginScreen');
    }
}

let tokenRefreshPromise = null;
async function refreshAccessToken() {
    if (tokenRefreshPromise) return tokenRefreshPromise;
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    tokenRefreshPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data?.token || !data?.refreshToken) return null;
            await setStoredToken(data.token);
            if (localStorage.getItem('refreshToken')) localStorage.setItem('refreshToken', data.refreshToken);
            else sessionStorage.setItem('refreshToken', data.refreshToken);
            if (data.expiresAt) localStorage.setItem('tokenExpiresAt', data.expiresAt);
            return data.token;
        } catch {
            return null;
        } finally {
            tokenRefreshPromise = null;
        }
    })();
    return tokenRefreshPromise;
}

async function safeFetch(url, options, fetchOpts = {}) {
    let finalUrl = url;
    let extractedToken = null;
    let parsedUrl = null;
    try {
        const parsed = new URL(url, API_BASE);
        parsedUrl = parsed;
        extractedToken = parsed.searchParams.get('token');
        if (extractedToken) {
            parsed.searchParams.delete('token');
        }
        finalUrl = parsed.toString();
    } catch (error) {
        console.error('Geçersiz API adresi:', { url, apiBase: API_BASE, error });
        if (!fetchOpts.silent) showNotification(t('errorTitle'), 'API adresi geçersiz. Lütfen ayarlardan güncelleyin.', 'error');
        return null;
    }

    const requestOptionsBase = { ...(options || {}) };
    const headers = new Headers(requestOptionsBase.headers || {});
    const fallbackToken = authTokenCache || localStorage.getItem('token');
    const bearer = extractedToken || fallbackToken;
    if (isDemoOfflineToken(bearer)) {
        return null;
    }
    if (bearer && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${bearer}`);
    }
    requestOptionsBase.headers = headers;

    const retryTargets = [finalUrl];
    if (!fetchOpts.disableFallbackRetry && parsedUrl) {
        try {
            const defaultUrl = new URL(`${parsedUrl.pathname}${parsedUrl.search}`, DEFAULT_API_BASE).toString();
            const webOrigin = window.location?.origin || '';
            const isHostedWeb = /^https?:\/\//i.test(webOrigin);
            const canUseDefault = !isHostedWeb || (new URL(defaultUrl).origin === webOrigin);
            if (canUseDefault && !retryTargets.includes(defaultUrl)) {
                retryTargets.push(defaultUrl);
            }

            const secondaryUrl = new URL(`${parsedUrl.pathname}${parsedUrl.search}`, FALLBACK_API_BASE).toString();
            const canUseSecondary = !isHostedWeb || (new URL(secondaryUrl).origin === webOrigin);
            if (canUseSecondary && !retryTargets.includes(secondaryUrl)) {
                retryTargets.push(secondaryUrl);
            }
        } catch {
            // ignore fallback URL generation failures
        }
    }

    let lastError = null;
    for (let i = 0; i < retryTargets.length; i++) {
        const targetUrl = retryTargets[i];
        const requestOptions = { ...requestOptionsBase };
        const timeoutMs = Number(fetchOpts.timeoutMs || (i === 0 ? API_TIMEOUT_MS : API_TIMEOUT_MS + 6000));
        let timeoutId = null;

        try {
            if (typeof AbortController !== 'undefined' && !requestOptions.signal) {
                const controller = new AbortController();
                requestOptions.signal = controller.signal;
                timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            }

            const doRequest = window.SafeGuardianFetch?.request || fetch;
            const response = await doRequest(targetUrl, requestOptions, timeoutMs);
            if (timeoutId) clearTimeout(timeoutId);

            if (response.status === 401) {
                if (!fetchOpts.skipRefresh) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        headers.set('Authorization', `Bearer ${refreshed}`);
                        requestOptionsBase.headers = headers;
                        fetchOpts = { ...fetchOpts, skipRefresh: true };
                        i -= 1;
                        continue;
                    }
                }
                handleAuthExpired();
                return null;
            }

            if (response.status === 403) {
                const isLast = i === retryTargets.length - 1;
                if (!isLast) {
                    console.warn('403 alındı, alternatif API deneniyor:', { from: targetUrl, to: retryTargets[i + 1] });
                    continue;
                }
            }

            // Fallback URL başarıyla kullanıldıysa eski API override'ı temizle
            if (i > 0) {
                localStorage.removeItem('apiBaseUrl');
            }

            _onBackendSuccess();
            return response;
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            lastError = error;
            const isLast = i === retryTargets.length - 1;
            if (!isLast) {
                console.warn('İstek başarısız, alternatif API deneniyor:', { from: targetUrl, to: retryTargets[i + 1] });
                continue;
            }
        }
    }

    if (lastError?.name === 'AbortError') {
        console.warn('İstek zaman aşımına uğradı:', finalUrl);
        _onBackendFail();
        forceCloseLoadingAndRecover();
        if (!fetchOpts.silent) {
            showNotification(t('errorTitle'), currentLang === 'en' ? 'Request timed out.' : 'İstek zaman aşımına uğradı.', 'error');
        }
        return null;
    }

    console.warn('Bağlantı hatası:', { finalUrl });
    _onBackendFail();
    if (!fetchOpts.silent) showNotification(t('errorTitle'), t('connError'), 'error');
    return null;
}

async function safeReadJson(response, fallbackValue) {
    if (!response) return fallbackValue;
    try {
        const rawText = await response.text();
        if (!rawText) return fallbackValue;
        let data = JSON.parse(rawText);
        if (!Array.isArray(data) && data?.items) data = data.items;
        return data ?? fallbackValue;
    } catch (error) {
        console.warn('JSON parse hatası:', error);
        return fallbackValue;
    }
}

function readLocalList(key, fallback = []) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function writeLocalList(key, list) {
    try {
        localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
    } catch {
        // ignore storage errors
    }
}

function isPremiumPlan(planValue) {
    const normalized = String(planValue || '').trim().toLowerCase();
    return normalized === 'premium';
}

function getLocalEntitlementState() {
    const now = new Date();
    const planRaw = localStorage.getItem('userPlan') || 'standard';
    const trialEndsAtRaw = localStorage.getItem('trialEndsAt') || '';
    const adUnlockUntilRaw = localStorage.getItem('adUnlockUntil') || '';
    const subEndRaw = localStorage.getItem('subscriptionEnd') || '';

    const trialEndsAt = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null;
    const adUnlockUntil = adUnlockUntilRaw ? new Date(adUnlockUntilRaw) : null;
    const subEnd = subEndRaw ? new Date(subEndRaw) : null;

    const isTrialActive = Boolean(trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt > now);
    const isAdUnlockActive = Boolean(adUnlockUntil && !Number.isNaN(adUnlockUntil.getTime()) && adUnlockUntil > now);
    const isPremiumActive = isPremiumPlan(planRaw) && Boolean(subEnd && !Number.isNaN(subEnd.getTime()) && subEnd > now);

    return {
        plan: isPremiumActive ? 'premium' : 'standard',
        isTrialActive,
        trialEndsAt,
        isAdUnlockActive,
        adUnlockUntil,
        hasFullAccess: isPremiumActive || isTrialActive || isAdUnlockActive,
        requiresSubscription: !(isPremiumActive || isTrialActive || isAdUnlockActive)
    };
}

function hasActiveLocalPremium() {
    const local = getLocalEntitlementState();
    return local.plan === 'premium' && local.hasFullAccess;
}

function applyEntitlementFromSubscription(subscription, options = {}) {
    const preserveLocalPremium = options.preserveLocalPremium !== false;
    if (preserveLocalPremium && hasActiveLocalPremium()) {
        const serverPlan = String(subscription?.plan || subscription?.Plan || 'standard').toLowerCase();
        if (serverPlan !== 'premium') {
            return getLocalEntitlementState();
        }
    }

    const now = new Date();
    const planRaw = String(subscription?.plan || subscription?.Plan || 'standard').toLowerCase();
    const isActive = subscription?.isActive ?? subscription?.IsActive ?? false;
    const expiresAtRaw = subscription?.expiresAt || subscription?.ExpiresAt || '';
    const trialEndsAtRaw = subscription?.trialEndsAt || subscription?.TrialEndsAt || '';
    const adUnlockUntilRaw = subscription?.adUnlockUntil || subscription?.AdUnlockUntil || '';
    const isTrialActiveServer = subscription?.isTrialActive ?? subscription?.IsTrialActive;
    const isAdUnlockActiveServer = subscription?.isAdUnlockActive ?? subscription?.IsAdUnlockActive;

    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const trialEndsAt = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null;
    const adUnlockUntil = adUnlockUntilRaw ? new Date(adUnlockUntilRaw) : null;

    const isPremiumActive = planRaw === 'premium' && isActive && Boolean(expiresAt && expiresAt > now);
    const isTrialActive = typeof isTrialActiveServer === 'boolean'
        ? isTrialActiveServer
        : Boolean(trialEndsAt && trialEndsAt > now);
    const isAdUnlockActive = typeof isAdUnlockActiveServer === 'boolean'
        ? isAdUnlockActiveServer
        : Boolean(adUnlockUntil && adUnlockUntil > now);

    localStorage.setItem('userPlan', isPremiumActive ? 'premium' : 'standard');
    if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
        localStorage.setItem('subscriptionEnd', expiresAt.toISOString().split('T')[0]);
    }
    if (trialEndsAt && !Number.isNaN(trialEndsAt.getTime())) {
        localStorage.setItem('trialEndsAt', trialEndsAt.toISOString());
    }
    if (adUnlockUntil && !Number.isNaN(adUnlockUntil.getTime())) {
        localStorage.setItem('adUnlockUntil', adUnlockUntil.toISOString());
    }

    return {
        plan: isPremiumActive ? 'premium' : 'standard',
        isTrialActive,
        trialEndsAt,
        isAdUnlockActive,
        adUnlockUntil,
        hasFullAccess: isPremiumActive || isTrialActive || isAdUnlockActive,
        requiresSubscription: !(isPremiumActive || isTrialActive || isAdUnlockActive)
    };
}

async function fetchEntitlementState(forceRefresh = false) {
    const localBefore = getLocalEntitlementState();

    if (!forceRefresh && subscriptionCache) {
        return applyEntitlementFromSubscription(subscriptionCache);
    }

    const token = requireAuthToken();
    if (!token) return localBefore;

    const response = await safeFetch(`${API_BASE}/api/subscription?token=${token}`);
    if (!response || !response.ok) return localBefore;

    const payload = await safeReadJson(response, null);
    if (!payload) return localBefore;

    subscriptionCache = payload;
    const serverState = applyEntitlementFromSubscription(payload);

    if (localBefore.plan === 'premium' && serverState.plan !== 'premium') {
        const localSubEnd = localStorage.getItem('subscriptionEnd');
        const localEnd = localSubEnd ? new Date(localSubEnd) : null;
        if (localEnd && !Number.isNaN(localEnd.getTime()) && localEnd > new Date()) {
            return localBefore;
        }
    }

    return serverState;
}

async function ensurePremiumAccess(featureName) {
    const token = requireAuthToken();
    if (!token) return false;

    const entitlement = await fetchEntitlementState(true);
    if (entitlement.hasFullAccess) return true;

    const featureLabel = featureName || (currentLang === 'en' ? 'This feature' : 'Bu özellik');
    sessionStorage.setItem('pendingFeatureAfterUnlock', featureName === 'Aile' || featureName === 'Family' ? 'family' : '');

    speak(currentLang === 'en'
        ? 'Subscription required. You can watch an ad for temporary full access.'
        : 'Abonelik gerekli. Geçici tam erişim için reklam izleyebilirsiniz.');
    notifyI18n('subscriptionRequiredTitle', 'subscriptionRequiredMsg', 'error', { feature: featureLabel });
    showScreen('subscriptionScreen');
    updateSubscriptionScreen();
    return false;
}



function showScreen(screenId) {
    if (!PUBLIC_SCREENS.has(screenId) && !hasAuthTokenSync()) {
        screenId = 'loginScreen';
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (!targetScreen) {
        console.warn('Ekran bulunamadı:', screenId);
        const fallback = document.getElementById('homeScreen') || document.getElementById('loginScreen');
        if (!fallback) return;
        fallback.classList.add('active');
        triggerVoiceGuidance(fallback.id);
        return;
    }
    targetScreen.classList.add('active');
    updateA11yControlsVisibility(screenId);
    if (window.SafeGuardianAds?.updateByElderlyScreen) {
        window.SafeGuardianAds.updateByElderlyScreen(screenId);
    }

    // Her ekrana giriş yapılırken otomatik sesli rehberlik
    triggerVoiceGuidance(screenId);
}

function triggerVoiceGuidance(screenId) {
    // Never show guidance text on home screen — it creates unwanted green text overlay.
    // On Capacitor iOS, never auto-speak (causes SSML errors and AVAudioBuffer noise).
    if (screenId === 'homeScreen') {
        updateGuidanceText('');
        return;
    }
    if (IS_CAPACITOR_IOS) return;

    const guidance = {
        'medicationScreen': t('medicationGuidance'),
        'addMedicationScreen': t('addMedGuidance'),
        'familyScreen': t('familyGuidance'),
        'helpScreen': t('helpGuidance'),
        'loginScreen': t('loginGuidance'),
    };

    if (guidance[screenId]) {
        lastGuidanceText = guidance[screenId];
        updateGuidanceText(guidance[screenId]);
        speak(guidance[screenId]);
    }
}

function updateGuidanceText(text) {
    const guidanceEl = document.getElementById('voiceGuidance');
    if (guidanceEl) {
        guidanceEl.textContent = text || '';
        // Hide the element entirely when empty to avoid empty green box
        guidanceEl.style.display = text ? '' : 'none';
    }
}

function toggleA11yMenu(event) {
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }
    const a11yMenuBtn = document.getElementById('a11yMenuBtn');
    const a11yMenu = document.getElementById('a11yMenu');
    if (!a11yMenuBtn || !a11yMenu) return;
    const isOpen = !a11yMenu.hasAttribute('hidden');
    if (isOpen) {
        a11yMenu.setAttribute('hidden', '');
        a11yMenuBtn.setAttribute('aria-expanded', 'false');
    } else {
        a11yMenu.removeAttribute('hidden');
        a11yMenuBtn.setAttribute('aria-expanded', 'true');
        ignoreNextA11yClose = true;
        try { window.ignoreNextA11yClose = true; } catch (_) { /* ignore */ }
    }
}

// Debug: force menu open if still blocked
function applyTranslations() {
    const tr = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (tr[key] !== undefined) el.textContent = tr[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (tr[key] !== undefined) el.setAttribute('placeholder', tr[key]);
    });

    // Dil butonlarının aktif/pasif durumunu güncelle (login + ayarlar menüsü)
    ['tr', 'en'].forEach(lang => {
        document.querySelectorAll(`[data-lang-btn="${lang}"]`).forEach(btn => {
            btn.classList.toggle('active', lang === currentLang);
        });
    });

    // Dinamik toggle butonlarını güncelle
    const a11yToggle = document.getElementById('a11yToggle');
    if (a11yToggle) {
        const isLarge = document.body.classList.contains('large-text');
        a11yToggle.textContent = isLarge ? tr.largeTextOff : tr.largeTextOn;
    }
    const contrastToggle = document.getElementById('contrastToggle');
    if (contrastToggle) {
        const isHighContrast = document.body.classList.contains('high-contrast');
        contrastToggle.textContent = isHighContrast ? tr.contrastOff : tr.contrastOn;
    }
    const simpleHomeToggle = document.getElementById('simpleHomeToggle');
    if (simpleHomeToggle) {
        const isSimple = document.body.classList.contains('simple-home');
        simpleHomeToggle.textContent = isSimple ? tr.simpleModeOff : tr.simpleModeOn;
    }

    // HTML lang attribute
    document.documentElement.lang = currentLang;
    updateSubscriptionDisclosurePrices();
    if (window.SGShell?.ensureCloseButton) {
        window.SGShell.ensureCloseButton();
    }
    updatePurchaseButtonLabel();
    updateGreeting();

    const autoRenew = document.getElementById('autoRenewDisclosure');
    if (autoRenew && tr.autoRenewDisclosure) autoRenew.textContent = tr.autoRenewDisclosure;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    if (speechRecognition) {
        speechRecognition.lang = currentLang === 'en' ? 'en-US' : 'tr-TR';
    }
    applyTranslations();
    updateProfileScreen();
    updateSubscriptionScreen();
    updateBiometricLoginButton();
    if (document.getElementById('moodScreen')?.classList.contains('active')) {
        loadMoodAnalysis();
    }
    if (document.getElementById('subscriptionScreen')?.classList.contains('active')) {
        updateSubscriptionScreen();
    }
    if (isListening) {
        updateVoiceStatus(t('voiceListening'));
    }
}

// Inline onclick çağrıları için global erişim — bindGlobals() dosya sonunda çağrılır
window.setLanguage = setLanguage;
window.applyTranslations = applyTranslations;
window.t = t;

// iPad event handling: Add touchend fallback for Doktora Göster button
document.addEventListener('DOMContentLoaded', () => {
    const shareDoctorBtn = document.getElementById('shareDoctorReportBtn');
    if (shareDoctorBtn && !shareDoctorBtn.__touchHandlerAdded) {
        shareDoctorBtn.__touchHandlerAdded = true;
        shareDoctorBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[iPad Fix] touchend on shareDoctorReportBtn, calling shareDoctorReport');
            shareDoctorReport();
        }, { passive: false });
    }

    bindPurchaseButton();
});

function getPublicWebBaseUrl() {
    const stored = String(localStorage.getItem('apiBaseUrl') || '').trim();
    if (stored && /^https?:\/\//i.test(stored)) {
        return stored.replace(/\/$/, '');
    }
    if (/^https?:\/\//i.test(DEFAULT_API_BASE)) {
        return DEFAULT_API_BASE.replace(/\/$/, '');
    }
    return RAILWAY_API_BASE.replace(/\/$/, '');
}

function buildDoctorReportUrl(token) {
    return `${getPublicWebBaseUrl()}/doctor-report.html#token=${encodeURIComponent(token)}`;
}

function openExternalUrl(url) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) return;

    const origin = window.location?.origin || '';
    let resolvedUrl = targetUrl;
    let isHttpOrHttps = /^https?:\/\//i.test(targetUrl);
    try {
        resolvedUrl = new URL(targetUrl, origin || undefined).href;
        isHttpOrHttps = /^https?:\/\//i.test(resolvedUrl);
    } catch {
        // Geçersiz URL ise mevcut davranışla dene
    }

    // Capacitor Browser eklentisi `capacitor://localhost/...` gibi local URL'leri açamaz.
    // Yerel/same-origin sayfaları uygulama içinde normal navigation ile aç.
    const isSameOrigin = Boolean(origin) && resolvedUrl.startsWith(origin);
    const isRelativePath = !/^([a-z][a-z\d+\-.]*:)?\/\//i.test(targetUrl) && targetUrl.startsWith('/');
    if (isSameOrigin || isRelativePath || !isHttpOrHttps) {
        window.location.href = resolvedUrl;
        return;
    }

    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (browserPlugin?.open) {
        browserPlugin.open({ url: resolvedUrl }).catch(() => {
            const opened = window.open(resolvedUrl, '_blank');
            if (!opened) {
                window.location.href = resolvedUrl;
            }
        });
        return;
    }

    const opened = window.open(resolvedUrl, '_blank');
    if (!opened) {
        window.location.href = resolvedUrl;
    }
}

function openPrivacyPolicy() {
    openExternalUrl('/privacy-policy.html');
}

function openTermsOfUse() {
    openExternalUrl('/terms-of-use.html');
}

function openLegalDocs() {
    openTermsOfUse();
}

function getStoreKitPlugin() {
    if (storeKitPluginCache) return storeKitPluginCache;

    const capacitor = window.Capacitor;
    if (!capacitor) return null;

    const plugins = capacitor.Plugins;
    if (plugins) {
        const detected = plugins.StoreKit2
            || plugins.StoreKit2Plugin;
        if (detected) {
            storeKitPluginCache = detected;
            return detected;
        }
    }

    // Only register on native iOS — avoid phantom web stubs that silently no-op.
    if (IS_CAPACITOR_IOS && typeof capacitor.registerPlugin === 'function') {
        try {
            storeKitPluginCache = capacitor.registerPlugin('StoreKit2');
            return storeKitPluginCache;
        } catch { }
    }

    return null;
}

function bindPurchaseButton() {
    const buyBtn = document.getElementById('buyFamilyPackageButton');
    if (!buyBtn || buyBtn.dataset.storeKitBound === 'true') return;

    buyBtn.dataset.storeKitBound = 'true';
    buyBtn.type = 'button';
    buyBtn.style.touchAction = 'manipulation';
    buyBtn.style.cursor = 'pointer';
    buyBtn.style.position = 'relative';
    buyBtn.style.zIndex = '2';

    const triggerPurchase = (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        startFamilyPackagePurchase(event);
    };

    buyBtn.addEventListener('click', triggerPurchase, { passive: false });
    buyBtn.addEventListener('touchend', (event) => {
        // iPad Safari/WKWebView: ensure tap registers even when scroll momentum is active.
        if (isFamilyPurchaseInProgress) return;
        event.preventDefault();
        triggerPurchase(event);
    }, { passive: false });
}

async function loadStoreProduct() {
    console.log('[StoreKit] loadStoreProduct called');
    const store = getStoreKitPlugin();
    if (!store?.getProducts) {
        console.warn('[StoreKit] No getProducts method available');
        subscriptionProductLoadAttempted = true;
        updateSubscriptionDisclosurePrices();
        return null;
    }

    try {
        console.log('[StoreKit] Fetching products:', ALL_FAMILY_PLAN_PRODUCT_IDS);
        const result = await withTimeout(
            store.getProducts({ productIds: ALL_FAMILY_PLAN_PRODUCT_IDS }),
            PRODUCT_LOAD_TIMEOUT_MS,
            'product_load'
        );
        console.log('[StoreKit] Got result:', result);
        const products = Array.isArray(result?.products) ? result.products : [];
        console.log('[StoreKit] Products array count:', products.length);
        
        const monthlyPriority = [...FAMILY_PLAN_PRODUCT_ID_CANDIDATES, ...ALL_FAMILY_PLAN_PRODUCT_IDS];

        subscriptionProductCache = monthlyPriority
            .map(id => products.find(p => p?.id === id))
            .find(Boolean)
            || products[0]
            || null;

        console.log('[StoreKit] Selected subscription product:', subscriptionProductCache);

        if (!subscriptionProductCache) {
            // Products returned empty – product IDs not found in App Store Connect Sandbox.
            // This typically means Paid Apps Agreement is not accepted, or products are not Active.
            console.warn('[StoreKit] getProducts returned 0 results for IDs:', ALL_FAMILY_PLAN_PRODUCT_IDS,
                '– Verify: 1) Paid Apps Agreement accepted in App Store Connect > Business > Agreements, 2) Products are Active/Ready to Submit.');
        }

        selectedFamilyPlanProductId = subscriptionProductCache?.id || FAMILY_PLAN_PRODUCT_ID;
        updateSubscriptionDisclosurePrices();
        return subscriptionProductCache;
    } catch (error) {
        console.error('[StoreKit] Product fetch error:', error);
        if (String(error?.message || '').includes('product_load_TIMEOUT')) {
            console.warn('[StoreKit] Product load timed out after', PRODUCT_LOAD_TIMEOUT_MS, 'ms');
        }
        console.error('[StoreKit] Error details:', {
            message: error?.message,
            name: error?.name,
            code: error?.code,
            stack: error?.stack
        });
        updateSubscriptionDisclosurePrices();
        return null;
    } finally {
        subscriptionProductLoadAttempted = true;
        console.log('[StoreKit] loadStoreProduct finished, attempted=true');
        updateSubscriptionDisclosurePrices();
    }
}

async function syncStoreCatalog() {
    const store = getStoreKitPlugin();
    if (!store) return false;

    try {
        if (typeof store.syncStore === 'function') {
            await withTimeout(store.syncStore(), 15000, 'store_sync');
            return true;
        }
        if (typeof store.restorePurchases === 'function') {
            await withTimeout(store.restorePurchases(), 15000, 'store_sync');
            return true;
        }
    } catch (error) {
        console.warn('[StoreKit] Store sync failed:', error);
    }
    return false;
}

async function ensureSubscriptionProductReady() {
    if (subscriptionProductCache?.id) {
        return subscriptionProductCache;
    }

    let product = await loadStoreProduct();
    if (product?.id) {
        return product;
    }

    await syncStoreCatalog();
    product = await loadStoreProduct();
    if (product?.id) {
        return product;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
    return loadStoreProduct();
}

function isStoreKitRetryablePurchaseError(errorOrMessage) {
    const msg = String(
        typeof errorOrMessage === 'string'
            ? errorOrMessage
            : (errorOrMessage?.message || errorOrMessage?.code || errorOrMessage || '')
    );
    return /unable to complete|complete request|PRODUCT_NOT_FOUND|product.*not found|identifier|404|sandbox|storekit|network|timed out|timeout/i.test(msg);
}

async function purchaseFamilyPlanProduct(store, productId) {
    return withTimeout(
        store.purchaseProduct({ productId }),
        PURCHASE_TIMEOUT_MS,
        'purchase'
    );
}

async function purchaseFamilyPlanWithRecovery(store, initialProductId) {
    const candidateIds = Array.from(new Set([
        initialProductId,
        subscriptionProductCache?.id,
        selectedFamilyPlanProductId,
        ...FAMILY_PLAN_PRODUCT_ID_CANDIDATES
    ].filter(Boolean)));

    let lastError = null;
    for (let attempt = 0; attempt < candidateIds.length; attempt += 1) {
        const productId = candidateIds[attempt];
        try {
            if (attempt > 0) {
                await syncStoreCatalog();
                await loadStoreProduct();
            }
            return await purchaseFamilyPlanProduct(store, productId);
        } catch (error) {
            lastError = error;
            console.warn('[StoreKit] Purchase attempt failed for', productId, error);
            if (!isStoreKitRetryablePurchaseError(error) || attempt === candidateIds.length - 1) {
                throw error;
            }
        }
    }

    throw lastError || new Error('PURCHASE_FAILED');
}

function stripDisplayEmoji(value) {
    return String(value || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function getLocalizedSubscriptionPrice() {
    return subscriptionProductCache?.displayPrice || '';
}

function updateSubscriptionDisclosurePrices() {
    const monthlyPriceEl = document.getElementById('subscriptionMonthlyPrice');
    if (!monthlyPriceEl) return;
    monthlyPriceEl.textContent = getLocalizedSubscriptionPrice() || t('subscriptionPriceLoading');
}

function applyStoreKitPurchaseUiVisibility() {
    const enabled = STOREKIT_PURCHASES_ENABLED;
    const buyBtn = document.getElementById('buyFamilyPackageButton');
    const autoRenew = document.getElementById('autoRenewDisclosure');
    const restoreBtn = document.querySelector('#subscriptionScreen button[onclick="restorePurchases()"]');
    const cancelBtn = document.querySelector('#subscriptionScreen button[onclick="cancelSubscriptionFlow()"]');
    const manageBtn = document.querySelector('#subscriptionScreen button[onclick="openSubscriptionManagement()"]');
    const priceEl = document.getElementById('subscriptionMonthlyPrice');

    if (buyBtn) buyBtn.style.display = enabled ? '' : 'none';
    if (autoRenew) autoRenew.style.display = enabled ? '' : 'none';
    if (restoreBtn) restoreBtn.style.display = enabled ? '' : 'none';
    if (cancelBtn) cancelBtn.style.display = enabled ? '' : 'none';
    if (manageBtn) manageBtn.style.display = enabled ? '' : 'none';

    if (!enabled && priceEl) {
        priceEl.textContent = getLocalizedSubscriptionPrice() || (currentLang === 'en' ? 'Family Plan' : 'Aile Paketi');
    }
}

function updatePurchaseButtonLabel() {
    if (!STOREKIT_PURCHASES_ENABLED) {
        applyStoreKitPurchaseUiVisibility();
        return;
    }
    updateSubscriptionDisclosurePrices();
    const label = document.querySelector('#buyFamilyPackageButton [data-i18n="buyFamilyPackageBtn"]');
    if (!label) return;

    const price = getLocalizedSubscriptionPrice();
    if (price) {
        label.textContent = currentLang === 'en'
            ? `UPGRADE TO FAMILY PLAN — ${price}`
            : `AİLE PAKETİNE GEÇ — ${price}`;
        return;
    }

    label.textContent = t('buyFamilyPackageBtn');
}

function resolvePremiumExpirationDate(purchase) {
    const now = new Date();
    const expRaw = String(purchase?.expirationDate || '').trim();
    if (expRaw) {
        const parsed = new Date(expRaw);
        if (!Number.isNaN(parsed.getTime()) && parsed > now) {
            return parsed;
        }
    }

    const fallback = new Date(now);
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback;
}

function applyPremiumFromApplePurchase(purchase) {
    const expiresAt = resolvePremiumExpirationDate(purchase);
    const transactionId = String(purchase?.transactionId || purchase?.originalTransactionId || '').trim();

    localStorage.setItem('userPlan', 'premium');
    localStorage.setItem('subscriptionEnd', expiresAt.toISOString().split('T')[0]);
    if (transactionId) {
        localStorage.setItem('applePremiumTransactionId', transactionId);
    }

    subscriptionCache = {
        plan: 'premium',
        isActive: true,
        expiresAt: expiresAt.toISOString(),
        hasFullAccess: true,
        requiresSubscription: false
    };

    updateProfileScreen();
    updateSubscriptionScreen();
    return subscriptionCache;
}

function markPremiumLocally(purchase) {
    applyPremiumFromApplePurchase(purchase || {});
}

async function confirmApplePurchaseWithServer(token, purchase) {
    if (!token) return false;

    const payload = {
        productId: String(purchase?.productId || selectedFamilyPlanProductId || FAMILY_PLAN_PRODUCT_ID),
        transactionId: String(purchase?.transactionId || purchase?.originalTransactionId || ''),
        expirationDate: String(purchase?.expirationDate || '')
    };

    if (!payload.transactionId) {
        console.warn('Apple purchase confirm skipped: missing transactionId');
        return false;
    }

    const response = await safeFetch(`${API_BASE}/api/subscription/apple/confirm?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response) return false;

    const data = await safeReadJson(response, null);
    if (!response.ok || !data?.success) {
        console.warn('Apple purchase confirm failed:', data);
        return false;
    }

    subscriptionCache = data.subscription || data || null;
    if (subscriptionCache) {
        applyEntitlementFromSubscription(subscriptionCache);
    }

    return true;
}

async function startFamilyPackagePurchase(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!STOREKIT_PURCHASES_ENABLED) {
        showNotification(t('subscriptionComingSoonTitle'), t('subscriptionComingSoonMsg'));
        return;
    }

    if (isFamilyPurchaseInProgress) {
        showNotification(
            t('purchaseStarted'),
            currentLang === 'en' ? 'Purchase is already in progress.' : 'Satın alma işlemi zaten devam ediyor.'
        );
        return;
    }

    const store = getStoreKitPlugin();
    const fallbackProductId = selectedFamilyPlanProductId || FAMILY_PLAN_PRODUCT_ID;
    let attemptedProductId = fallbackProductId;
    const buyBtn = document.getElementById('buyFamilyPackageButton');

    if (!store && IS_CAPACITOR_IOS) {
        const noPluginMsg = currentLang === 'en'
            ? 'StoreKit plugin not found. Rebuild the app with the StoreKit2Plugin registered in capacitor.config.json.'
            : 'StoreKit eklentisi bulunamadı. Uygulamayı capacitor.config.json\'da StoreKit2Plugin kayıtlı şekilde yeniden oluşturun.';
        showNotification(t('purchaseNotAvailable'), noPluginMsg, 'error');
        return;
    }

    isFamilyPurchaseInProgress = true;
    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.setAttribute('aria-busy', 'true');
    }

    try {
        if (store?.isAvailable) {
            const availability = await withTimeout(
                store.isAvailable(),
                5000,
                'availability'
            ).catch(() => ({ available: true }));
            if (availability?.available === false) {
                showNotification(t('purchaseNotAvailable'), t('purchaseNotAvailableMsg'), 'error');
                return;
            }
        }

        // Apple requires the payment sheet on button tap — but product must be loaded first.
        showNotification(
            t('purchaseStarted'),
            currentLang === 'en' ? 'Loading subscription product…' : 'Abonelik ürünü yükleniyor…'
        );

        const readyProduct = await ensureSubscriptionProductReady();
        if (!readyProduct?.id) {
            const unavailableMsg = currentLang === 'en'
                ? `Subscription product not found in App Store Sandbox. Verify product ID "${FAMILY_PLAN_PRODUCT_ID}" is Active in App Store Connect and Paid Apps Agreement is accepted.`
                : `Abonelik ürünü App Store Sandbox'ta bulunamadı. "${FAMILY_PLAN_PRODUCT_ID}" ürün kimliğinin App Store Connect'te Aktif olduğunu ve Ücretli Uygulamalar Sözleşmesinin kabul edildiğini kontrol edin.`;
            showNotification(t('purchaseNotAvailable'), unavailableMsg, 'error');
            return;
        }

        const productId = readyProduct.id;
        attemptedProductId = productId;

        if (!store?.purchaseProduct) {
            const pluginMissingMsg = currentLang === 'en'
                ? 'In-App Purchase is not available on this device.'
                : 'Bu cihazda uygulama içi satın alma kullanılamıyor.';
            showNotification(t('purchaseNotAvailable'), pluginMissingMsg, 'error');
            return;
        }

        console.log('[StoreKit] Starting purchase for product:', productId);
        showNotification(t('purchaseStarted'), t('purchaseStartedMsg'));

        const result = await purchaseFamilyPlanWithRecovery(store, productId);

        if (result?.success) {
            const purchasePayload = {
                productId: result.productId || productId,
                transactionId: result.transactionId || '',
                expirationDate: result.expirationDate || ''
            };
            applyPremiumFromApplePurchase(purchasePayload);

            const token = await getStoredToken();
            if (token && !isDemoOfflineToken(token)) {
                await confirmApplePurchaseWithServer(token, purchasePayload).catch((error) => {
                    console.warn('Apple purchase confirmed locally; server sync deferred:', error);
                });
            }

            await fetchEntitlementState(true).catch(() => { });
            updateProfileScreen();
            updateSubscriptionScreen();
            showNotification(t('purchaseSuccess'), t('purchaseSuccessMsg'));
            return;
        }
        if (result?.cancelled) return;
        if (result?.pending) {
            showNotification(t('purchaseStarted'), currentLang === 'en' ? 'Purchase is pending approval.' : 'Satın alma onay bekliyor.');
            return;
        }
        if (result?.productNotFound || result?.error) {
            const errMsg = currentLang === 'en'
                ? `Product "${productId}" not found in App Store Sandbox. Ensure: 1) Product is Active in App Store Connect, 2) Paid Apps Agreement is accepted under Business > Agreements.`
                : `"${productId}" ürünü App Store Sandbox'ta bulunamadı. Kontrol: 1) Ürün App Store Connect'te Aktif, 2) İşletme > Sözleşmeler bölümünde Ücretli Uygulamalar Sözleşmesi kabul edildi.`;
            showNotification(t('purchaseNotAvailable'), errMsg, 'error');
            return;
        }

        if (store?.purchase) {
            const legacyResult = await withTimeout(
                store.purchase({ productId }),
                PURCHASE_TIMEOUT_MS,
                'purchase'
            );
            if (legacyResult?.success || legacyResult?.purchased || legacyResult?.productId) {
                const purchasePayload = {
                    productId: legacyResult.productId || productId,
                    transactionId: legacyResult.transactionId || legacyResult.originalTransactionId || '',
                    expirationDate: legacyResult.expirationDate || ''
                };
                applyPremiumFromApplePurchase(purchasePayload);
                const token = await getStoredToken();
                if (token && !isDemoOfflineToken(token)) {
                    await confirmApplePurchaseWithServer(token, purchasePayload).catch((error) => {
                        console.warn('Apple purchase confirmed locally; server sync deferred:', error);
                    });
                }
                await fetchEntitlementState(true).catch(() => { });
                updateProfileScreen();
                updateSubscriptionScreen();
                showNotification(t('purchaseSuccess'), t('purchaseSuccessMsg'));
            }
            return;
        }

        const pluginMissingMsg = currentLang === 'en'
            ? 'In-App Purchase is not available on this device.'
            : 'Bu cihazda uygulama içi satın alma kullanılamıyor.';
        showNotification(t('purchaseNotAvailable'), pluginMissingMsg, 'error');
    } catch (error) {
        console.warn('StoreKit purchase error:', error);
        const msg = String(error?.message || error?.code || error || '');
        const isProductNotFound = /PRODUCT_NOT_FOUND|product|not found|identifier|404|sandbox/i.test(msg);
        const isPaymentNotAllowed = /paymentNotAllowed|not authorized|cannot make|parental/i.test(msg);
        const isPurchaseTimeout = /purchase_TIMEOUT/i.test(msg);
        const isUnableToComplete = /unable to complete|complete request/i.test(msg);

        let errorDetail;
        if (isPurchaseTimeout) {
            errorDetail = currentLang === 'en'
                ? 'Purchase timed out. If Apple payment sheet is open, complete it or try again.'
                : 'Satın alma zaman aşımına uğradı. Apple ödeme penceresi açıksa işlemi tamamlayın veya tekrar deneyin.';
        } else if (isProductNotFound) {
            errorDetail = currentLang === 'en'
                ? `Product "${attemptedProductId}" not found in App Store Sandbox. Check: 1) Product ID is Active in App Store Connect, 2) Paid Apps Agreement accepted (Business > Agreements), 3) Bundle ID is com.buse.safeguardian.`
                : `"${attemptedProductId}" App Store Sandbox'ta bulunamadı. Kontrol: 1) Ürün kimliği App Store Connect'te Aktif, 2) Ücretli Uygulamalar Sözleşmesi kabul edildi (İşletme > Sözleşmeler), 3) Bundle ID: com.buse.safeguardian.`;
        } else if (isPaymentNotAllowed) {
            errorDetail = currentLang === 'en'
                ? 'Purchases are not allowed on this device. Check Screen Time / parental controls.'
                : 'Bu cihazda satın alma yapılamıyor. Ekran Süresi / ebeveyn denetimlerini kontrol edin.';
        } else if (isUnableToComplete) {
            errorDetail = currentLang === 'en'
                ? 'Apple could not complete the purchase request. Please check your Sandbox Apple ID, internet connection, and try again in a few seconds.'
                : 'Apple satın alma isteğini tamamlayamadı. Sandbox Apple ID’nizi ve internet bağlantınızı kontrol edip birkaç saniye sonra tekrar deneyin.';
        } else {
            errorDetail = msg || (currentLang === 'en'
                ? 'An unexpected error occurred. Please try again.'
                : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
        }

        showNotification(t('purchaseNotAvailable'), errorDetail, 'error');
    } finally {
        isFamilyPurchaseInProgress = false;
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.removeAttribute('aria-busy');
        }
    }
}

async function openAppleSubscriptionSettings() {
    const settingsUrls = [
        'itms-apps://apps.apple.com/account/subscriptions',
        'https://apps.apple.com/account/subscriptions'
    ];

    const store = getStoreKitPlugin();
    if (IS_CAPACITOR_IOS && store?.openSubscriptionManagement) {
        try {
            const result = await store.openSubscriptionManagement();
            if (result?.opened !== false) {
                return true;
            }
        } catch (error) {
            console.warn('Native subscription settings open failed:', error);
        }
    }

    const appPlugin = window.Capacitor?.Plugins?.App;
    for (const url of settingsUrls) {
        try {
            if (appPlugin?.openUrl) {
                await appPlugin.openUrl({ url });
                return true;
            }
        } catch (error) {
            console.warn('App.openUrl failed for', url, error);
        }
        try {
            openExternalUrl(url);
            return true;
        } catch (error) {
            console.warn('openExternalUrl failed for', url, error);
        }
    }
    return false;
}

function openSubscriptionManagement() {
    openAppleSubscriptionSettings()
        .then((opened) => {
            if (!opened) {
                showNotification(
                    t('errorTitle'),
                    t('subscriptionCancelFailed'),
                    'error'
                );
                return;
            }
            showNotification(
                currentLang === 'en' ? 'Subscription Management' : 'Abonelik Yönetimi',
                currentLang === 'en'
                    ? 'Opening Apple subscription settings.'
                    : 'Apple abonelik ayarları açılıyor.',
                'success'
            );
        })
        .catch(() => {
            showNotification(t('errorTitle'), t('subscriptionCancelFailed'), 'error');
        });
}

async function cancelSubscriptionFlow() {
    const token = await requireAuthTokenAsync();
    if (!token) return;

    const confirmed = await showAppConfirm(t('confirmCancelSubTitle'), t('confirmCancelSubMsg'));
    if (!confirmed) return;

    try {
        const opened = await openAppleSubscriptionSettings();
        if (opened) {
            showNotification(t('successTitle'), t('subscriptionCancelSuccess'), 'success');
            return;
        }
        showNotification(t('errorTitle'), t('subscriptionCancelFailed'), 'error');
    } catch (error) {
        console.warn('Subscription settings open failed:', error);
        showNotification(t('errorTitle'), t('subscriptionCancelFailed'), 'error');
    }
}

async function handleAppleSignIn() {
    const errorCode = 'APPLE_AUTH_UNAVAILABLE';
    console.warn(`[${errorCode}] Sign in with Apple is not enabled in this build.`);
    showNotification(
        currentLang === 'en' ? 'Apple Sign-In' : 'Apple Girişi',
        currentLang === 'en'
            ? 'Sign in with Apple is temporarily unavailable in this version. Please sign in with email and password.'
            : 'Sign in with Apple bu sürümde geçici olarak kapalı. Lütfen e-posta ve şifre ile giriş yapın.',
        'error'
    );
}

function forceOpenA11yMenu() {
    const a11yMenuBtn = document.getElementById('a11yMenuBtn');
    const a11yMenu = document.getElementById('a11yMenu');
    if (!a11yMenuBtn || !a11yMenu) return;
    a11yMenu.removeAttribute('hidden');
    a11yMenuBtn.setAttribute('aria-expanded', 'true');
}

function repeatGuidance() {
    if (lastGuidanceText) {
        speak(lastGuidanceText);
    }
}

function getNativeSpeechPlugin() {
    return window.Capacitor?.Plugins?.SpeechRecognition
        || window.Capacitor?.Plugins?.SpeechRecognitionPlugin
        || null;
}

function initSpeechRecognition() {
    if (speechRecognition) return speechRecognition;

    const native = getNativeSpeechPlugin();
    if (native && typeof native.start === 'function') {
        const bridge = {
            lang: currentLang === 'en' ? 'en-US' : 'tr-TR',
            continuous: true,
            async start() {
                try {
                    if (typeof native.requestPermissions === 'function') {
                        await native.requestPermissions();
                    } else if (typeof native.checkPermissions === 'function') {
                        const perms = await native.checkPermissions();
                        if (perms?.speechRecognition !== 'granted' && typeof native.requestPermissions === 'function') {
                            await native.requestPermissions();
                        }
                    }
                    if (typeof native.addListener === 'function' && !bridge.__listenerBound) {
                        bridge.__listenerBound = true;
                        native.addListener('partialResults', (event) => {
                            const matches = event?.matches || event?.value || [];
                            const transcript = Array.isArray(matches) ? matches[0] : matches;
                            if (transcript && typeof handleVoiceCommand === 'function') {
                                handleVoiceCommand(String(transcript));
                            }
                        });
                    }
                    await native.start({
                        language: bridge.lang,
                        maxResults: 3,
                        prompt: currentLang === 'en' ? 'Listening…' : 'Dinleniyor…',
                        partialResults: true,
                        popup: false
                    });
                    isListening = true;
                    updateVoiceStatus(t('voiceListening'));
                } catch (error) {
                    console.warn('Native speech start failed:', error);
                    isListening = false;
                    updateVoiceStatus('');
                    showNotification(
                        currentLang === 'en' ? 'Voice' : 'Ses',
                        currentLang === 'en'
                            ? 'Microphone permission or speech recognition is unavailable.'
                            : 'Mikrofon izni veya ses tanıma kullanılamıyor.',
                        'error'
                    );
                }
            },
            async stop() {
                try {
                    if (typeof native.stop === 'function') await native.stop();
                } catch (_) { /* ignore */ }
                isListening = false;
                updateVoiceStatus('');
            }
        };
        speechRecognition = bridge;
        return speechRecognition;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Tarayıcı konuşma tanımayı desteklemiyor.');
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'en' ? 'en-US' : 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        updateVoiceStatus(t('voiceListening'));
    };

    recognition.onend = () => {
        isListening = false;
        updateVoiceStatus('');
    };

    recognition.onerror = (event) => {
        console.warn('Konuşma tanıma hatası:', event?.error || event);
        isListening = false;
        updateVoiceStatus('');
    };

    recognition.onresult = (event) => {
        const transcript = event?.results?.[event.resultIndex]?.[0]?.transcript || '';
        const command = transcript.toLowerCase().trim();
        if (!command) return;

        // Aynı komutun kısa sürede tekrar gelmesini engelle (iOS'da spam log azaltma)
        const now = Date.now();
        if (command === lastVoiceCommand && (now - lastVoiceCommandAt) < 1200) {
            return;
        }
        lastVoiceCommand = command;
        lastVoiceCommandAt = now;

        handleVoiceCommand(command);
    };

    speechRecognition = recognition;
    return recognition;
}

function updateVoiceStatus(text) {
    const statusEl = document.getElementById('voiceStatus');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

function startVoiceCommand() {
    const recognition = initSpeechRecognition();
    if (!recognition) {
        if (typeof window.voiceAssistantStart === 'function') {
            window.voiceAssistantStart();
            return;
        }
        showNotification(
            currentLang === 'en' ? 'Warning' : 'Uyarı',
            currentLang === 'en' ? 'Voice recognition is not supported on this device.' : 'Bu cihazda ses tanıma desteklenmiyor',
            'error'
        );
        return;
    }
    if (isListening) return;
    try {
        const started = recognition.start();
        if (started && typeof started.then === 'function') {
            started.catch((error) => console.warn('Konuşma tanıma başlatılamadı:', error));
        }
    } catch (error) {
        console.warn('Konuşma tanıma başlatılamadı:', error);
    }
}

function stopVoiceCommand() {
    if (speechRecognition && isListening) {
        try {
            speechRecognition.stop();
        } catch (error) {
            console.warn('Konuşma tanıma durdurulamadı:', error);
        }
    }
}

function toggleListening() {
    repeatGuidance();
    if (isListening) {
        stopVoiceCommand();
    } else {
        startVoiceCommand();
    }
}

async function shareDoctorReport() {
    console.log('[iPad Fix] shareDoctorReport called');
    const token = await requireAuthTokenAsync();
    if (!token) {
        console.log('[iPad Fix] No token available');
        showNotification(
            currentLang === 'en' ? 'Sign in required' : 'Giriş gerekli',
            currentLang === 'en' ? 'Please sign in to share your doctor report.' : 'Doktor raporunu paylaşmak için giriş yapın.',
            'error'
        );
        return;
    }

    const url = buildDoctorReportUrl(token);
    const shareTitle = currentLang === 'en' ? 'Doctor Report' : 'Doktor Raporu';
    const shareText = currentLang === 'en' ? 'Doctor report link' : 'Doktor raporu bağlantısı';
    console.log('[iPad Fix] Doctor report URL built');

    if (navigator.share) {
        try {
            console.log('[iPad Fix] Attempting native share');
            await navigator.share({ title: shareTitle, text: shareText, url });
            showNotification(
                currentLang === 'en' ? 'Shared' : 'Paylaşıldı',
                currentLang === 'en' ? 'Doctor report link sent.' : 'Doktor raporu gönderildi.',
                'success'
            );
            return;
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.log('[iPad Fix] Share aborted by user');
                return;
            }
            console.warn('[iPad Fix] Share error:', error);
        }
    }

    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (browserPlugin?.open) {
        try {
            console.log('[iPad Fix] Attempting Capacitor Browser.open');
            await browserPlugin.open({ url });
            showNotification(
                currentLang === 'en' ? 'Opened' : 'Açıldı',
                currentLang === 'en' ? 'Doctor report opened in browser.' : 'Doktor raporu tarayıcıda açıldı.',
                'success'
            );
            return;
        } catch (error) {
            console.warn('Browser open failed:', error);
        }
    }

    try {
        await navigator.clipboard.writeText(url);
        showNotification(
            currentLang === 'en' ? 'Copied' : 'Kopyalandı',
            currentLang === 'en' ? 'Doctor report link copied.' : 'Doktor raporu bağlantısı kopyalandı.',
            'success'
        );
    } catch (error) {
        console.error('Kopyalama hatası:', error);
        showNotification(
            currentLang === 'en' ? 'Error' : 'Hata',
            currentLang === 'en' ? 'Could not share or copy the report link.' : 'Rapor bağlantısı paylaşılamadı veya kopyalanamadı.',
            'error'
        );
    }
}

function extractVoiceNumber(commandText) {
    const normalized = String(commandText || '').replace(',', '.');
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const value = Number.parseFloat(match[1]);
    return Number.isFinite(value) ? value : null;
}

async function handleVoiceCommand(command) {
    const cmd = String(command || '').toLowerCase().trim();
    if (!cmd) {
        speak(t('voiceUnknown'));
        return;
    }

    const numericValue = extractVoiceNumber(cmd);

    if ((cmd.includes('ruh hali') || cmd.includes('mood')) && numericValue !== null) {
        const score = Math.round(numericValue);
        if (score >= 1 && score <= 10) {
            await submitMood(score);
            speak(currentLang === 'en' ? `Mood score saved: ${score}` : `Ruh hali puanı kaydedildi: ${score}`);
            return;
        }
    }

    if ((cmd.includes('tansiyon') || cmd.includes('blood pressure')) && numericValue !== null) {
        await addHealthRecord('tansiyon', numericValue, 'mmHg');
        speak(currentLang === 'en' ? 'Blood pressure saved.' : 'Tansiyon kaydedildi.');
        return;
    }

    if ((cmd.includes('şeker') || cmd.includes('seker') || cmd.includes('sugar') || cmd.includes('glucose')) && numericValue !== null) {
        await addHealthRecord('şeker', numericValue, 'mg/dL');
        speak(currentLang === 'en' ? 'Blood sugar saved.' : 'Kan şekeri kaydedildi.');
        return;
    }

    if (cmd.includes('ilaç') || cmd.includes('ilac') || cmd.includes('medicine') || cmd.includes('medication') || cmd.includes('drug') || cmd.includes('pill')) {
        speak(t('voiceHeard'));
        goToMedications();
        return;
    }

    if (cmd.includes('aile') || cmd.includes('family') || cmd.includes('daughter') || cmd.includes('son') || cmd.includes('call my daughter') || cmd.includes('call my son') || cmd.includes('kızımı') || cmd.includes('oğlumu') || cmd.includes('kızımı ara') || cmd.includes('oğlumu ara')) {
        speak(t('voiceHeard'));
        goToFamily();
        return;
    }

    if (cmd.includes('yardım') || cmd.includes('yardim') || cmd.includes('acil') || cmd.includes('help') || cmd.includes('emergency') || cmd.includes('sos')) {
        speak(t('voiceHeard'));
        showEmergencyConfirm();
        return;
    }

    if (cmd.includes('ana sayfa') || cmd.includes('anasayfa') || cmd.includes('ev') || cmd.includes('home')) {
        speak(t('voiceHeard'));
        goHome();
        return;
    }

    if (cmd.includes('ruh hali') || cmd.includes('mod') || cmd.includes('mood')) {
        speak(t('voiceHeard'));
        goToMoodDashboard();
        return;
    }

    if (cmd.includes('sağlık') || cmd.includes('saglik') || cmd.includes('health')) {
        speak(t('voiceHeard'));
        goToHealthRecords();
        return;
    }

    if (cmd.includes('kayıt ol') || cmd.includes('kayit ol') || cmd.includes('register') || cmd.includes('sign up')) {
        speak(t('voiceHeard'));
        goToRegister();
        return;
    }

    if (cmd.includes('çıkış') || cmd.includes('cikis') || cmd.includes('logout') || cmd.includes('log out') || cmd.includes('sign out')) {
        speak(t('voiceHeard'));
        logout();
        return;
    }

    speak(t('voiceUnknown'));
}

function readAssistantIntentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw =
        params.get('assistant') ||
        params.get('intent') ||
        params.get('voice') ||
        params.get('command') ||
        '';
    return String(raw).toLowerCase().trim();
}

function triggerAssistantEmergencyIntent(source = 'assistant') {
    const token = authTokenCache || localStorage.getItem('token');
    if (!token) {
        localStorage.setItem('pendingAssistantIntent', 'emergency');
        notifyI18n('voiceCommandReadyTitle', 'voiceCommandReadyMsg', 'success');
        return;
    }

    showScreen('homeScreen');
    setTimeout(() => {
        notifyI18n('voiceEmergencyDetectedTitle', 'voiceEmergencyDetectedMsg', 'success', { source });
        showEmergencyConfirm();
    }, 300);
}

function handleAssistantIntentFromUrl() {
    const intent = readAssistantIntentFromUrl();
    if (!intent) return;

    if (intent.includes('emergency') || intent.includes('sos') || intent.includes('acil') || intent.includes('yardim') || intent.includes('yardım')) {
        triggerAssistantEmergencyIntent('Siri/Assistant');
    }

    // URL'i temiz tutalım
    if (window.history && window.history.replaceState) {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

function runPendingAssistantIntentIfAny() {
    const pending = localStorage.getItem('pendingAssistantIntent');
    if (pending === 'emergency') {
        localStorage.removeItem('pendingAssistantIntent');
        triggerAssistantEmergencyIntent('Bekleyen Sesli Komut');
    }
}

function goHome() {
    if (!requireAuthToken()) return;
    showScreen('homeScreen');
}

function goToMedications() {
    if (!requireAuthToken()) return;
    showScreen('medicationScreen');
    loadMedications();
}

function goToAddMedication() {
    showScreen('addMedicationScreen');
}

function goToFamily() {
    if (!requireAuthToken()) return;
    ensurePremiumAccess(currentLang === 'en' ? 'Family' : 'Aile').then(hasAccess => {
        if (!hasAccess) return;
        showScreen('familyScreen');
        loadFamilyMembers();
    });
}

function goToMoodDashboard() {
    if (!requireAuthToken()) return;
    showScreen('moodScreen');
    loadMoodAnalysis();
}

function goToMedicationVision() {
    const target = new URL('medication-vision.html?returnTo=medicationScreen', window.location.href).href;
    window.location.href = target;
}

function goToHealthRecords() {
    if (!requireAuthToken()) return;
    showScreen('healthRecordsScreen');
    loadHealthRecords();
}

function goToAddFamily() {
    showScreen('addFamilyScreen');
}

function goToRegister() {
    showScreen('registerScreen');
}

function showHelp() {
    showScreen('helpScreen');
}

async function logout() {
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    if (refreshToken) {
        await safeFetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        }, { silent: true, skipRefresh: true }).catch(() => null);
    }
    window.SafeGuardianRevenueCat?.logOut?.().catch((error) => {
        console.warn('[RevenueCat] Logout failed:', error);
    });
    await clearPrivateLocalData();
    subscriptionCache = null;
    showScreen('loginScreen');
    updateBiometricLoginButton();
}

// =================== HESAP / PROFİL YÖNETIMI ===================

function updateProfileScreen() {
    const userId = localStorage.getItem('userId') || 'elderly-001';
    const userName = localStorage.getItem('userName') || (currentLang === 'en' ? 'User' : 'Kullanıcı');
    const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('rememberedEmail') || '-';
    const userPhone = localStorage.getItem('userPhone') || '-';
    const userPlanRaw = localStorage.getItem('userPlan') || 'Standart';
    const subscriptionEnd = localStorage.getItem('subscriptionEnd') || '2025-12-31';
    const registrationDate = localStorage.getItem('registrationDate') || new Date().toLocaleDateString(currentLang === 'en' ? 'en-US' : 'tr-TR');
    const normalizedPlan = String(userPlanRaw).toLowerCase().includes('premium') ? 'premium' : 'standard';

    // Kalan günleri hesapla
    const endDate = new Date(subscriptionEnd);
    const today = new Date();
    const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    const daysLeftText = daysLeft > 0
        ? (currentLang === 'en' ? `${daysLeft} DAYS` : `${daysLeft} GÜN`)
        : (currentLang === 'en' ? 'EXPIRED' : 'SÜRESİ DOLDU');

    document.getElementById('profileName').textContent = userName;
    document.getElementById('profileEmail').textContent = userEmail;
    const profilePhoneEl = document.getElementById('profilePhone');
    if (profilePhoneEl) profilePhoneEl.textContent = userPhone;
    document.getElementById('profilePlan').textContent = normalizedPlan === 'premium'
        ? 'PREMIUM'
        : (currentLang === 'en' ? 'STANDARD' : 'STANDART');
    document.getElementById('profileDaysLeft').textContent = daysLeftText;
}

function updateSubscriptionScreen() {
    const subscriptionEnd = localStorage.getItem('subscriptionEnd') || '-';
    const entitlement = getLocalEntitlementState();
    const isPremium = entitlement.plan === 'premium';
    
    // Check if subscription is expired (requiresSubscription = true and no trial/ad unlock active)
    const isExpired = entitlement.requiresSubscription && !entitlement.isTrialActive && !entitlement.isAdUnlockActive;

    document.getElementById('subCurrentPlan').textContent = isExpired
        ? (currentLang === 'en' ? 'EXPIRED' : 'SÜRESİ DOLDU')
        : isPremium
        ? (currentLang === 'en' ? 'PREMIUM (All Features)' : 'PREMIUM (Tüm Özellikler)')
        : (currentLang === 'en' ? 'STANDARD' : 'STANDART');
    document.getElementById('subEndDate').textContent = subscriptionEnd;

    const entitlementInfo = document.getElementById('entitlementInfo');
    if (entitlementInfo) {
        if (isExpired) {
            entitlementInfo.textContent = currentLang === 'en'
                ? 'Subscription expired. Renew to continue access.'
                : 'Aboneliğinizin süresi dolmuş. Erişim devam ettirmek için yenileyin.';
        } else if (entitlement.isTrialActive && entitlement.trialEndsAt) {
            entitlementInfo.textContent = currentLang === 'en'
                ? `Free trial active until ${entitlement.trialEndsAt.toLocaleString('en-US')}.`
                : `Ücretsiz deneme ${entitlement.trialEndsAt.toLocaleString('tr-TR')} tarihine kadar aktif.`;
        } else if (entitlement.isAdUnlockActive && entitlement.adUnlockUntil) {
            entitlementInfo.textContent = currentLang === 'en'
                ? `Ad reward active until ${entitlement.adUnlockUntil.toLocaleString('en-US')}.`
                : `Reklam ödülü ${entitlement.adUnlockUntil.toLocaleString('tr-TR')} tarihine kadar aktif.`;
        } else if (isPremium) {
            entitlementInfo.textContent = currentLang === 'en'
                ? 'Premium access is active.'
                : 'Premium erişim aktif.';
        } else if (!STOREKIT_PURCHASES_ENABLED) {
            entitlementInfo.textContent = t('entitlementComingSoon');
        } else {
            entitlementInfo.textContent = t('entitlementTrialEnded');
        }
    }

    const watchAdButton = document.getElementById('watchAdUnlockButton');
    if (watchAdButton) {
        watchAdButton.disabled = isPremium || entitlement.isTrialActive || entitlement.isAdUnlockActive;
        if (isPremium) {
            watchAdButton.textContent = t('watchAdPremiumActive');
        } else if (entitlement.isTrialActive) {
            watchAdButton.textContent = t('watchAdTrialActive');
        } else if (entitlement.isAdUnlockActive) {
            watchAdButton.textContent = t('watchAdRewardActive');
        } else {
            watchAdButton.textContent = t('watchAdUnlockBtn');
        }
    }

    const premiumFeaturesEl = document.getElementById('premiumFeatures');
    if (!premiumFeaturesEl) return;

    if (isPremium && currentLang === 'en') {
        premiumFeaturesEl.innerHTML = `
            <div>+ Video Doctor Consultation</div>
            <div>+ Human Assistant (24/7)</div>
            <div>+ Mood Analysis (AI)</div>
            <div>+ Health Trends</div>
        `;
        updatePurchaseButtonLabel();
        return;
    }

    if (isPremium) {
        premiumFeaturesEl.innerHTML = `
            <div>+ Video Doktor Konsültasyonu</div>
            <div>+ İnsan Asistanı (24/7)</div>
            <div>+ Ruh Hali Analizi (AI)</div>
            <div>+ Sağlık Trendleri</div>
        `;
        updatePurchaseButtonLabel();
        return;
    }

    premiumFeaturesEl.innerHTML = '';
    updatePurchaseButtonLabel();
    applyStoreKitPurchaseUiVisibility();
}

async function watchAdFor12HourAccess() {
    const token = await requireAuthTokenAsync();
    if (!token) return;

    const result = await window.SafeGuardianAds?.showRewardedAdUnlock?.();
    if (!result || !result.ok) {
        notifyI18n('adNotAvailableTitle', 'adNotAvailableMsg', 'error');
        return;
    }

    if (!result.rewarded) {
        notifyI18n('adRewardNotEarnedTitle', 'adRewardNotEarnedMsg', 'error');
        return;
    }

    // AdMob grants the reward through the signed server-side verification
    // callback. Poll the authoritative subscription endpoint while it arrives.
    let verifiedEntitlement = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await safeFetch(`${API_BASE}/api/subscription?token=${token}`, {
            method: 'GET'
        }, { silent: true });
        const data = response?.ok ? await safeReadJson(response, null) : null;
        if (data?.isAdUnlockActive && data?.hasFullAccess) {
            verifiedEntitlement = data;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!verifiedEntitlement) {
        notifyI18n('adRewardUpdateFailedTitle', 'adRewardUpdateFailedMsg', 'error');
        return;
    }

    subscriptionCache = verifiedEntitlement;
    applyEntitlementFromSubscription(verifiedEntitlement);

    updateProfileScreen();
    updateSubscriptionScreen();
    window.SafeGuardianAds?.updateByElderlyScreen?.('subscriptionScreen');
    notifyI18n('adUnlockSuccessTitle', 'adUnlockSuccessMsg', 'success');

    const pending = sessionStorage.getItem('pendingFeatureAfterUnlock');
    sessionStorage.removeItem('pendingFeatureAfterUnlock');
    if (pending === 'family') {
        setTimeout(() => {
            showScreen('familyScreen');
            loadFamilyMembers();
        }, 400);
    }
}

async function editProfile() {
    const newName = await showAppPrompt(
        t('editProfileBtn'),
        t('editProfileNamePrompt'),
        localStorage.getItem('userName') || ''
    );
    if (!newName || !newName.trim()) return;

    const currentEmail = localStorage.getItem('userEmail') || localStorage.getItem('rememberedEmail') || '';
    const currentPhone = localStorage.getItem('userPhone') || '';
    const newEmail = await showAppPrompt(
        t('userEmail'),
        t('editProfileEmailPrompt'),
        currentEmail
    );
    const newPhone = await showAppPrompt(
        t('phoneLabel'),
        t('editProfilePhonePrompt'),
        currentPhone
    );

    localStorage.setItem('userName', newName.trim());
    if (newEmail && newEmail.trim()) localStorage.setItem('userEmail', newEmail.trim());
    if (newPhone && newPhone.trim()) localStorage.setItem('userPhone', newPhone.trim());
    updateProfileScreen();
    speak(t('editProfileSaved'), currentLang === 'en' ? 'en-US' : 'tr-TR');
}

function goToSubscription() {
    updateSubscriptionScreen();
    showScreen('subscriptionScreen');
    applyStoreKitPurchaseUiVisibility();
    bindPurchaseButton();
    if (STOREKIT_PURCHASES_ENABLED) {
        syncAppleEntitlementsFromStore()
            .then(() => fetchEntitlementState(true))
            .then(() => {
                updateProfileScreen();
                updateSubscriptionScreen();
            })
            .catch(() => { });
        loadStoreProduct().then(() => updatePurchaseButtonLabel());
    } else {
        fetchEntitlementState(true)
            .then(() => {
                updateProfileScreen();
                updateSubscriptionScreen();
            })
            .catch(() => { });
    }
    speak(currentLang === 'en' ? 'You are on the subscription page.' : 'Abone durumu sayfasında bulunuyorsunuz', currentLang === 'en' ? 'en-US' : 'tr-TR');
}

async function syncAppleEntitlementsFromStore() {
    if (!STOREKIT_PURCHASES_ENABLED) return null;
    if (!IS_CAPACITOR_IOS) return null;

    const store = getStoreKitPlugin();
    if (!store) return null;

    let purchases = [];
    try {
        if (store.getEntitlements) {
            const entitlements = await store.getEntitlements();
            purchases = Array.isArray(entitlements?.purchases) ? entitlements.purchases : [];
        } else if (store.restorePurchases) {
            const nativeRestore = await store.restorePurchases();
            purchases = Array.isArray(nativeRestore?.purchases) ? nativeRestore.purchases : [];
        } else if (store.restoreTransactions) {
            await store.restoreTransactions();
        } else if (store.sync) {
            await store.sync();
        }
    } catch (error) {
        console.warn('Native entitlement sync failed:', error);
        return null;
    }

    const matchedPurchase = purchases.find(item => ALL_FAMILY_PLAN_PRODUCT_IDS.includes(String(item?.productId || '')));
    if (!matchedPurchase) return null;

    applyPremiumFromApplePurchase(matchedPurchase);

    const token = await getStoredToken();
    if (token && !isDemoOfflineToken(token)) {
        await confirmApplePurchaseWithServer(token, {
            productId: matchedPurchase.productId,
            transactionId: matchedPurchase.transactionId,
            expirationDate: matchedPurchase.expirationDate
        }).catch((error) => {
            console.warn('Restore confirmed locally; server sync deferred:', error);
        });
    }

    return matchedPurchase;
}

async function restorePurchases() {
    const token = await requireAuthTokenAsync();
    if (!token) return;

    if (!STOREKIT_PURCHASES_ENABLED) {
        showNotification(t('subscriptionComingSoonTitle'), t('subscriptionComingSoonMsg'));
        await fetchEntitlementState(true).catch(() => { });
        updateProfileScreen();
        updateSubscriptionScreen();
        return;
    }

    try {
        await syncAppleEntitlementsFromStore();
    } catch (error) {
        console.warn('Native restore failed, backend fallback will continue:', error);
    }

    const response = await safeFetch(`${API_BASE}/api/subscription?token=${token}`, {
        method: 'GET'
    });
    if (!response) {
        updateProfileScreen();
        updateSubscriptionScreen();
        showNotification(t('restoreSuccess'), t('restoreSuccessMsg'));
        return;
    }

    const data = await safeReadJson(response, null);
    if (!response.ok || !data) {
        showNotification(t('restoreFailed'), t('restoreFailedMsg'), 'error');
        return;
    }

    const subscription = data.subscription || data;
    subscriptionCache = subscription;
    const entitlement = applyEntitlementFromSubscription(subscription, { preserveLocalPremium: true });
    updateProfileScreen();
    updateSubscriptionScreen();
    if (entitlement.plan !== 'premium') {
        showNotification(
            t('restoreSuccess'),
            currentLang === 'en'
                ? 'No active purchase found. Plan refreshed as Standard.'
                : 'Aktif satın alma bulunamadı. Paket Standart olarak güncellendi.',
            'error'
        );
        return;
    }

    showNotification(t('restoreSuccess'), t('restoreSuccessMsg'));
}

// =================== REVENUECAT PURCHASES ===================
// These declarations intentionally replace the legacy StoreKit bridge functions
// above while preserving the existing UI entry points.
function applyRevenueCatCustomerInfo(customerInfo) {
    const revenueCat = window.SafeGuardianRevenueCat;
    const entitlement = revenueCat?.entitlementFrom?.(customerInfo);
    if (!entitlement?.isActive) {
        localStorage.setItem('userPlan', 'standard');
        localStorage.removeItem('subscriptionEnd');
        subscriptionCache = {
            plan: 'free',
            isActive: false,
            hasFullAccess: false,
            requiresSubscription: true
        };
        return false;
    }

    const expiresAt = entitlement.expirationDate
        ? new Date(entitlement.expirationDate)
        : null;
    localStorage.setItem('userPlan', 'premium');
    if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
        localStorage.setItem('subscriptionEnd', expiresAt.toISOString());
    } else {
        localStorage.removeItem('subscriptionEnd');
    }
    subscriptionCache = {
        plan: 'premium',
        isActive: true,
        expiresAt: entitlement.expirationDate || null,
        willRenew: entitlement.willRenew === true,
        productId: entitlement.productIdentifier,
        hasFullAccess: true,
        requiresSubscription: false
    };
    return true;
}

async function identifyRevenueCatUser() {
    const userId = String(localStorage.getItem('userId') || '').trim();
    if (!userId || userId === 'demo-user') return false;
    try {
        await window.SafeGuardianRevenueCat?.identify?.(userId);
        const customerInfo = await window.SafeGuardianRevenueCat?.refreshCustomerInfo?.();
        if (customerInfo) applyRevenueCatCustomerInfo(customerInfo);
        return true;
    } catch (error) {
        console.warn('[RevenueCat] User identification failed:', error);
        return false;
    }
}

async function loadStoreProduct() {
    subscriptionProductLoadAttempted = true;
    try {
        await identifyRevenueCatUser();
        const selectedPackage = await window.SafeGuardianRevenueCat?.loadOffering?.();
        subscriptionProductCache = selectedPackage?.product
            ? {
                id: selectedPackage.product.identifier,
                displayPrice: selectedPackage.product.priceString,
                title: selectedPackage.product.title,
                package: selectedPackage
            }
            : null;
        selectedFamilyPlanProductId = subscriptionProductCache?.id || FAMILY_PLAN_PRODUCT_ID;
        updateSubscriptionDisclosurePrices();
        return subscriptionProductCache;
    } catch (error) {
        console.warn('[RevenueCat] Offering load failed:', error);
        subscriptionProductCache = null;
        updateSubscriptionDisclosurePrices();
        return null;
    }
}

function getLocalizedSubscriptionPrice() {
    return window.SafeGuardianRevenueCat?.localizedPrice?.()
        || subscriptionProductCache?.displayPrice
        || '';
}

function updateSubscriptionDisclosurePrices() {
    const monthlyPriceEl = document.getElementById('subscriptionMonthlyPrice');
    if (!monthlyPriceEl) return;
    const price = getLocalizedSubscriptionPrice();
    monthlyPriceEl.textContent = price || t('subscriptionPriceLoading');
}

async function syncAppleEntitlementsFromStore() {
    try {
        await identifyRevenueCatUser();
        const customerInfo = await window.SafeGuardianRevenueCat?.refreshCustomerInfo?.();
        if (!customerInfo) return null;
        return applyRevenueCatCustomerInfo(customerInfo) ? customerInfo : null;
    } catch (error) {
        console.warn('[RevenueCat] Entitlement refresh failed:', error);
        return null;
    }
}

async function startFamilyPackagePurchase(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (isFamilyPurchaseInProgress) return;

    const token = await requireAuthTokenAsync();
    if (!token) return;
    if (!STOREKIT_PURCHASES_ENABLED) {
        showNotification(t('purchaseNotAvailable'), t('purchaseNotAvailableMsg'), 'error');
        return;
    }

    const buyBtn = document.getElementById('buyFamilyPackageButton');
    isFamilyPurchaseInProgress = true;
    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.setAttribute('aria-busy', 'true');
    }

    try {
        await identifyRevenueCatUser();
        const product = await loadStoreProduct();
        if (!product) throw new Error('REVENUECAT_PACKAGE_NOT_FOUND');

        showNotification(t('purchaseStarted'), t('purchaseStartedMsg'));
        const result = await window.SafeGuardianRevenueCat.purchase();
        if (!result?.hasPremium) throw new Error('PREMIUM_ENTITLEMENT_NOT_GRANTED');

        applyRevenueCatCustomerInfo(result.customerInfo);
        await new Promise(resolve => setTimeout(resolve, 900));
        await fetchEntitlementState(true).catch(() => { });
        updateProfileScreen();
        updateSubscriptionScreen();
        window.SafeGuardianAds?.updateByElderlyScreen?.('subscriptionScreen');
        showNotification(t('purchaseSuccess'), t('purchaseSuccessMsg'));
    } catch (error) {
        if (error?.userCancelled || error?.code === '1') return;
        console.warn('[RevenueCat] Purchase failed:', error);
        const detail = currentLang === 'en'
            ? 'The App Store purchase could not be completed. Check the subscription configuration and try again.'
            : 'App Store satın alma işlemi tamamlanamadı. Abonelik yapılandırmasını kontrol edip tekrar deneyin.';
        showNotification(t('purchaseNotAvailable'), detail, 'error');
    } finally {
        isFamilyPurchaseInProgress = false;
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.removeAttribute('aria-busy');
        }
    }
}

async function restorePurchases() {
    const token = await requireAuthTokenAsync();
    if (!token) return;
    if (!STOREKIT_PURCHASES_ENABLED) {
        showNotification(t('purchaseNotAvailable'), t('purchaseNotAvailableMsg'), 'error');
        return;
    }

    try {
        await identifyRevenueCatUser();
        const result = await window.SafeGuardianRevenueCat.restore();
        const restored = Boolean(result?.hasPremium)
            && applyRevenueCatCustomerInfo(result.customerInfo);

        await new Promise(resolve => setTimeout(resolve, 900));
        await fetchEntitlementState(true).catch(() => { });
        updateProfileScreen();
        updateSubscriptionScreen();
        window.SafeGuardianAds?.updateByElderlyScreen?.('subscriptionScreen');

        if (!restored) {
            showNotification(
                t('restoreFailed'),
                currentLang === 'en'
                    ? 'No active Premium subscription was found for this App Store account.'
                    : 'Bu App Store hesabında aktif Premium abonelik bulunamadı.',
                'error'
            );
            return;
        }
        showNotification(t('restoreSuccess'), t('restoreSuccessMsg'));
    } catch (error) {
        console.warn('[RevenueCat] Restore failed:', error);
        showNotification(t('restoreFailed'), t('restoreFailedMsg'), 'error');
    }
}

window.addEventListener('safeguardian:customer-info', (event) => {
    applyRevenueCatCustomerInfo(event.detail?.customerInfo);
    updateProfileScreen();
    updateSubscriptionScreen();
});

async function clearPrivateLocalData() {
    await removeStoredToken();
    const keys = [
        'userId', 'userName', 'userEmail', 'userPhone', 'userPlan',
        'subscriptionEnd', 'rememberMe', 'rememberedEmail', 'registrationDate',
        'localMedications', 'localMoodRecords', 'localHealthRecords',
        'localFamilyMembers', 'adUnlockUntil', 'trialEndsAt'
    ];
    keys.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    if (window.indexedDB) {
        try { indexedDB.deleteDatabase('SafeGuardianOffline'); } catch { }
    }
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PRIVATE_DATA' });
    }
    if (window.caches) {
        try {
            const names = await caches.keys();
            await Promise.all(names.filter(name => name.startsWith('safeguardian-')).map(name => caches.delete(name)));
        } catch { }
    }
}

async function deleteAccountFlow() {
    const token = await requireAuthTokenAsync();
    if (!token) return;

    const confirmed = await showAppConfirm(t('deleteAccountTitle'), t('deleteAccountConfirmMsg'));
    if (!confirmed) {
        showNotification(t('deleteAccountCanceled'), t('deleteAccountCanceledMsg'), 'error');
        return;
    }

    const passwordInput = await showAppPrompt(t('deleteAccountTitle'), t('deleteAccountPasswordPrompt'));
    if (passwordInput === null) {
        showNotification(t('deleteAccountCanceled'), t('deleteAccountCanceledMsg'), 'error');
        return;
    }

    const password = String(passwordInput || '').trim();
    if (!password) {
        showNotification(t('deleteAccountNeedPassword'), t('deleteAccountNeedPasswordMsg'), 'error');
        return;
    }

    const finalText = await showAppPrompt(t('deleteAccountTitle'), t('deleteAccountFinalPrompt'));
    const expectedFinalText = currentLang === 'en' ? 'DELETE' : 'SIL';
    if ((finalText || '').trim().toUpperCase() !== expectedFinalText) {
        showNotification(t('deleteAccountFinalMismatch'), t('deleteAccountFinalMismatchMsg'), 'error');
        return;
    }

    const response = await safeFetch(`${API_BASE}/api/elderly/account?token=${token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    if (!response) {
        showNotification(t('deleteAccountFailed'), t('connError'), 'error');
        return;
    }

    const payload = await safeReadJson(response, {});
    if (!response.ok || !payload?.success) {
        showNotification(t('deleteAccountFailed'), payload?.message || t('deleteAccountFailedMsg'), 'error');
        return;
    }

    await window.SafeGuardianRevenueCat?.logOut?.().catch(() => { });
    await clearPrivateLocalData();
    subscriptionCache = null;

    showNotification(t('deleteAccountSuccess'), t('deleteAccountSuccessMsg'));
    showScreen('loginScreen');
}

function goToPremium() {
    const isPremium = hasActiveLocalPremium();
    if (isPremium) {
        showNotification(t('premiumAlready'), t('premiumAlreadyMsg'));
    } else {
        const title = currentLang === 'en' ? 'Subscription Required' : 'Abonelik Gerekli';
        const message = currentLang === 'en'
            ? 'Opening subscription screen. Apple account page opens only if you tap Manage Subscriptions.'
            : 'Abonelik ekranı açılıyor. Apple hesabı sadece siz "Abonelikleri Yönet" derseniz açılır.';
        showNotification(title, message);
        goToSubscription();
    }
}

function shouldShowDemoHint() {
    if (isProductionApp()) return false;
    const params = new URLSearchParams(window.location.search || '');
    return params.get('demo') === '1' || localStorage.getItem('showDemoHint') === 'true';
}

// =================== BİLDİRİM ===================

function showNotification(title, message, type = 'success') {
    const activeScreenId = document.querySelector('.screen.active')?.id || '';
    if (type === 'success' && activeScreenId === 'homeScreen') {
        return;
    }

    provideFeedback(`${title}. ${message}`, type === 'error' ? [80, 40, 80] : [40]);

    let host = document.getElementById('sgToastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'sgToastHost';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
    }

    const toastType = type === 'error' ? 'error' : (type === 'info' ? 'info' : 'success');
    const notification = document.createElement('div');
    notification.className = `sg-toast sg-toast--${toastType}`;
    notification.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
    host.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add('is-visible'));

    setTimeout(() => {
        notification.classList.remove('is-visible');
        setTimeout(() => notification.remove(), 280);
    }, 3500);
}

function showGracefulOfflineState(message, type = 'offline') {
    const existing = document.getElementById('gracefulOfflineState');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'gracefulOfflineState';
    const isSuccess = type === 'success';
    banner.style.cssText = `
        position: fixed;
        left: 50%;
        top: 22px;
        transform: translateX(-50%);
        z-index: 10001;
        width: min(92vw, 920px);
        background: ${isSuccess ? '#2e7d32' : '#ffeb3b'};
        color: ${isSuccess ? '#ffffff' : '#222222'};
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.28);
        padding: 18px 22px;
        font-size: 30px;
        line-height: 1.35;
        font-weight: 800;
        text-align: center;
    `;
    banner.textContent = message;
    document.body.appendChild(banner);

    if (!IS_CAPACITOR_IOS && navigator.vibrate) {
        try { navigator.vibrate(isSuccess ? [50, 40, 50] : [120, 80, 120]); } catch { }
    }

    setTimeout(() => {
        if (banner && banner.parentNode) banner.remove();
    }, isSuccess ? 5000 : 8000);
}

function initOfflineResilienceBridge() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker kaydı başarısız:', err);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'OFFLINE_DATA_QUEUED') {
            const msg = data.message || 'İnternet yok ama merak etme, verini kaydettim. İnternet gelince otomatik göndereceğim.';
            showGracefulOfflineState(msg, 'offline');
            speak(msg);
        }
        if (data.type === 'OFFLINE_SYNC_COMPLETED') {
            const msg = data.message || 'Çevrimdışı kaydedilen veriler başarıyla sunucuya gönderildi.';
            showGracefulOfflineState(`${msg}`, 'success');
            speak(msg);
        }
    });

    window.addEventListener('offline', () => {
        showGracefulOfflineState('İnternet yok. Merak etme, ölçümlerini cihazda güvenle saklıyorum.', 'offline');
    });

    window.addEventListener('online', () => {
        showGracefulOfflineState('İnternet geri geldi. Kayıtlı verileri arka planda sunucuya gönderiyorum.', 'success');
    });
}

function provideFeedback(message, pattern = [30]) {
    if (!IS_CAPACITOR_IOS && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch {
            // ignore
        }
    }
    if (message && (!IS_CAPACITOR_IOS || userHasInteracted)) {
        speak(message);
    }
}

// =================== FORM IŞLEYENLER ===================

document.addEventListener('DOMContentLoaded', async function () {
    const markInteraction = () => {
        userHasInteracted = true;
    };
    document.addEventListener('pointerdown', markInteraction, { passive: true, once: true });
    document.addEventListener('touchstart', markInteraction, { passive: true, once: true });
    document.addEventListener('keydown', markInteraction, { passive: true, once: true });

    handleAssistantIntentFromUrl();

    initOfflineResilienceBridge();

    const testHint = document.getElementById('testHint');
    if (testHint && !shouldShowDemoHint()) {
        testHint.style.display = 'none';
    }
    applyProductionUi();

    const a11yMenuBtn = document.getElementById('a11yMenuBtn');
    const a11yMenu = document.getElementById('a11yMenu');
    if (a11yMenuBtn && a11yMenu) {
        a11yMenu.addEventListener('touchstart', (event) => {
            event.stopPropagation();
        }, { passive: true });

        a11yMenu.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.addEventListener('focusin', (event) => {
            const target = event.target;
            if (a11yMenu.contains(target)) {
                return;
            }
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (ignoreNextA11yClose || window.ignoreNextA11yClose) {
                ignoreNextA11yClose = false;
                try { window.ignoreNextA11yClose = false; } catch (_) { /* ignore */ }
                return;
            }
            const menuBtn = document.getElementById('sgMenuBtn');
            const settingsBtn = document.getElementById('sgSettingsBtn');
            const wrap = document.getElementById('a11yControls');
            if (
                (menuBtn && (menuBtn === target || menuBtn.contains(target)))
                || (settingsBtn && (settingsBtn === target || settingsBtn.contains(target)))
                || (a11yMenuBtn && (a11yMenuBtn === target || a11yMenuBtn.contains(target)))
                || (a11yMenu && a11yMenu.contains(target))
            ) {
                return;
            }
            if (window.SGShell?.closeSettings) {
                window.SGShell.closeSettings();
                return;
            }
            if (wrap) wrap.classList.remove('is-open');
            if (!a11yMenu.hasAttribute('hidden')) {
                a11yMenu.setAttribute('hidden', '');
                a11yMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const apiBaseInput = document.getElementById('apiBaseInput');
    const apiBaseSave = document.getElementById('apiBaseSave');
    const apiBaseClear = document.getElementById('apiBaseClear');
    if (apiBaseInput) {
        const stored = localStorage.getItem('apiBaseUrl');
        apiBaseInput.value = stored || '';
    }
    if (apiBaseSave && apiBaseInput) {
        apiBaseSave.addEventListener('click', () => {
            const value = apiBaseInput.value.trim();
            if (!value) return;
            localStorage.setItem('apiBaseUrl', value);
            showNotification(t('apiSaved'), t('apiSavedMsg'), 'success');
        });
    }
    if (apiBaseClear && apiBaseInput) {
        apiBaseClear.addEventListener('click', () => {
            localStorage.removeItem('apiBaseUrl');
            apiBaseInput.value = '';
            showNotification(t('apiReset'), t('apiResetMsg'), 'success');
        });
    }

    const a11yToggle = document.getElementById('a11yToggle');
    if (a11yToggle) {
        const isLarge = localStorage.getItem('largeText') === 'true';
        document.body.classList.toggle('large-text', isLarge);
        a11yToggle.setAttribute('aria-pressed', String(isLarge));
        a11yToggle.textContent = isLarge ? t('largeTextOff') : t('largeTextOn');
        a11yToggle.addEventListener('click', () => toggleLargeText(a11yToggle));
        a11yToggle.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            toggleLargeText(a11yToggle);
        }, { passive: true });
    }

    const contrastToggle = document.getElementById('contrastToggle');
    if (contrastToggle) {
        const isHighContrast = localStorage.getItem('highContrast') === 'true';
        document.body.classList.toggle('high-contrast', isHighContrast);
        contrastToggle.setAttribute('aria-pressed', String(isHighContrast));
        contrastToggle.textContent = isHighContrast ? t('contrastOff') : t('contrastOn');
        contrastToggle.addEventListener('click', () => toggleHighContrast(contrastToggle));
        contrastToggle.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            toggleHighContrast(contrastToggle);
        }, { passive: true });
    }

    const simpleHomeToggle = document.getElementById('simpleHomeToggle');
    if (simpleHomeToggle) {
        const isSimpleHome = localStorage.getItem('simpleHome') === 'true';
        document.body.classList.toggle('simple-home', isSimpleHome);
        simpleHomeToggle.setAttribute('aria-pressed', String(isSimpleHome));
        simpleHomeToggle.textContent = isSimpleHome ? t('simpleModeOff') : t('simpleModeOn');
        simpleHomeToggle.addEventListener('click', () => toggleSimpleHome(simpleHomeToggle));
        simpleHomeToggle.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            toggleSimpleHome(simpleHomeToggle);
        }, { passive: true });
    }

    const resetViewBtn = document.getElementById('resetViewBtn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', resetViewSettings);
        resetViewBtn.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            resetViewSettings();
        }, { passive: true });
    }

    // Giriş Formu
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    bindPurchaseButton();

    // İlaç Ekleme Formu
    const addMedForm = document.getElementById('addMedicationForm');
    if (addMedForm) {
        addMedForm.addEventListener('submit', handleAddMedication);
    }

    // Aile Üyesi Ekleme Formu
    const addFamilyForm = document.getElementById('addFamilyForm');
    if (addFamilyForm) {
        addFamilyForm.addEventListener('submit', handleAddFamily);
    }

    // Kayıt Formu
    const registerFormElement = document.getElementById('registerForm');
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', handleRegister);
    }

    // Dil ve çevirileri her açılışta uygula
    currentLang = detectPreferredLanguage();
    applyTranslations();
    updateBiometricLoginButton();

    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
        if (btn.dataset.sgLangBound) return;
        btn.dataset.sgLangBound = '1';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const lang = btn.getAttribute('data-lang-btn');
            if (lang) setLanguage(lang);
        });
    });

    // Otomatik giriş (Beni Hatırla)
    const remember = localStorage.getItem('rememberMe') !== 'false';
    const rememberCheckbox = document.getElementById('rememberMe');
    const tokenPromise = Promise.race([
        getStoredToken(),
        new Promise((resolve) => setTimeout(() => resolve(''), 3000))
    ]);
    const localTokenSnapshot = authTokenCache || localStorage.getItem('token');

    if (rememberCheckbox && localStorage.getItem('rememberMe') === null) {
        rememberCheckbox.checked = true;
    }

    if (remember && localTokenSnapshot) {
        showScreen('homeScreen');
        updateGreeting();
        runPendingAssistantIntentIfAny();

        const savedEmail = localStorage.getItem('rememberedEmail');
        const emailInput = document.getElementById('email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    }

    const token = await tokenPromise;
    if (remember && token && !localTokenSnapshot) {
        showScreen('homeScreen');
        updateGreeting();
        runPendingAssistantIntentIfAny();

        const savedEmail = localStorage.getItem('rememberedEmail');
        const emailInput = document.getElementById('email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    }

    if (remember && token) {
        validateStoredSessionToken(token).then((tokenValid) => {
            if (!tokenValid) {
                showScreen('loginScreen');
            }
        }).catch(() => {
            // Ağ/timeout hatasında kullanıcıyı ekrandan düşürmeyiz.
        });
    }

    if (rememberCheckbox && remember) {
        const savedEmail = localStorage.getItem('rememberedEmail');
        const emailInput = document.getElementById('email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            rememberCheckbox.checked = true;
        }
    }

    if (isOfflineDemoModeEnabled()) {
        showScreen('homeScreen');
        updateGreeting();
        showGracefulOfflineState('Demo çevrimdışı mod açık. Sunucuya bağlanmadan temel ekran gösteriliyor.', 'offline');
    }

    // Capacitor iOS: if the backend is not reachable on startup, don't hang on loading screens.
    // Proactively test connectivity and immediately enable offline mode if unreachable.
    if (IS_CAPACITOR_IOS && hasAuthTokenSync() && !isOfflineDemoModeEnabled()) {
        syncAppleEntitlementsFromStore()
            .then(() => {
                updateProfileScreen();
                updateSubscriptionScreen();
            })
            .catch(() => { });
        if (STOREKIT_PURCHASES_ENABLED) {
            loadStoreProduct()
                .then(() => updatePurchaseButtonLabel())
                .catch(() => { });
        }
    }

    if (IS_CAPACITOR_IOS && !isOfflineDemoModeEnabled()) {
        (async () => {
            try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
                await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal, method: 'HEAD' }).catch(() => {
                    forceCloseLoadingAndRecover();
                });
                clearTimeout(tid);
            } catch (_) { /* absorbed */ } finally {
                // _onBackendFail will activate offline mode if needed after 2 fails;
                // call it once here for the startup probe.
                if (_backendUnreachableCount === 0) {
                    // if we reach here without error, backend responded — all good.
                }
            }
        })();
    }

    // Butonlara sesli geri bildirim
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            provideFeedback('', [20]);
        });
    });

    // Sesli asistan onboarding (ilk kullanım)
    const voiceOnboarding = document.getElementById('voiceOnboarding');
    const voiceOnboardingStart = document.getElementById('voiceOnboardingStart');
    const voiceOnboardingSkip = document.getElementById('voiceOnboardingSkip');
    if (voiceOnboarding && voiceOnboardingStart && voiceOnboardingSkip) {
        const isDone = localStorage.getItem('voiceOnboardingDone') === 'true';
        const maybeShowVoiceOnboarding = () => {
            const active = document.querySelector('.screen.active');
            if (!active || active.id !== 'homeScreen' || isDone) {
                voiceOnboarding.classList.remove('active');
                return;
            }
            voiceOnboarding.classList.add('active');
            if (!IS_CAPACITOR_IOS) {
                speak(t('voiceOnboardingSpeak'));
            }
        };
        setTimeout(maybeShowVoiceOnboarding, 600);

        voiceOnboardingStart.addEventListener('click', () => {
            localStorage.setItem('voiceOnboardingDone', 'true');
            voiceOnboarding.classList.remove('active');
            startVoiceCommand();
            updateGuidanceText(t('voiceOnboardingStarted'));
            speak(t('voiceOnboardingStarted'));
        });

        voiceOnboardingSkip.addEventListener('click', () => {
            localStorage.setItem('voiceOnboardingDone', 'true');
            voiceOnboarding.classList.remove('active');
            speak(t('voiceOnboardingSkipped'));
        });
    }
});

function handleReturnToScreen() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const returnTo = params.get('returnTo');
        if (!returnTo || !document.getElementById(returnTo)) return;
        showScreen(returnTo);
        if (returnTo === 'homeScreen') updateGreeting();
        if (returnTo === 'medicationScreen' && typeof loadMedications === 'function') {
            loadMedications();
        }
        const cleanUrl = `${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
        console.warn('returnTo navigation failed:', error);
    }
}

window.addEventListener('load', async () => {
    handleReturnToScreen();
    const token = await getStoredToken();
    const path = window.location.pathname || '';
    if ((token || isOfflineDemoModeEnabled()) && (path.includes('login') || path === '/' || path.endsWith('/index.html'))) {
        showScreen('homeScreen');
        updateGreeting();
    }
    if (STOREKIT_PURCHASES_ENABLED && token && !isDemoOfflineToken(token)) {
        syncAppleEntitlementsFromStore()
            .then(() => {
                updateProfileScreen();
                updateSubscriptionScreen();
            })
            .catch(() => { });
        if (STOREKIT_PURCHASES_ENABLED) {
            loadStoreProduct()
                .then(() => updatePurchaseButtonLabel())
                .catch(() => { });
        }
    }
    const activeScreen = document.querySelector('.screen.active')?.id || 'loginScreen';
    if (window.SafeGuardianAds?.updateByElderlyScreen) {
        window.SafeGuardianAds.updateByElderlyScreen(activeScreen);
    }
    startCareRoutine();
});

function toggleLargeText(buttonEl) {
    const isLarge = document.body.classList.toggle('large-text');
    localStorage.setItem('largeText', String(isLarge));
    if (buttonEl) buttonEl.setAttribute('aria-pressed', String(isLarge));
    applyTranslations();
}

function toggleHighContrast(buttonEl) {
    const isHighContrast = document.body.classList.toggle('high-contrast');
    localStorage.setItem('highContrast', String(isHighContrast));
    if (buttonEl) buttonEl.setAttribute('aria-pressed', String(isHighContrast));
    applyTranslations();
}

function resetViewSettings() {
    localStorage.removeItem('largeText');
    localStorage.removeItem('highContrast');
    localStorage.removeItem('simpleHome');
    document.body.classList.remove('large-text', 'high-contrast', 'simple-home');
    location.reload();
}

function toggleSimpleHome(buttonEl) {
    const isSimpleHome = document.body.classList.toggle('simple-home');
    localStorage.setItem('simpleHome', String(isSimpleHome));
    if (buttonEl) buttonEl.setAttribute('aria-pressed', String(isSimpleHome));
    applyTranslations();
}

function startCareRoutine() {
    if (careRoutineStarted) return;
    careRoutineStarted = true;
    setTimeout(() => {
        maybeRunCareRoutine();
    }, 2000);
    setInterval(() => {
        maybeRunCareRoutine();
    }, 60000);
}

function getDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function withinHours(now, startHour, endHour) {
    const h = now.getHours();
    return h >= startHour && h < endHour;
}

async function maybeRunCareRoutine() {
    const token = await getStoredToken();
    if (isOfflineDemoModeEnabled() || isDemoOfflineToken(token)) return;
    if (!token) return;
    const now = new Date();
    const dateKey = getDateKey(now);

    await maybePromptMood(dateKey, now);
    await maybePromptHealth(dateKey, now, 'tansiyon', 'mmHg', 9, 12, 'Tansiyonunu ölçtün mü?');
    await maybePromptHealth(dateKey, now, 'şeker', 'mg/dL', 13, 18, 'Şekerini ölçtün mü?');
    await maybeRemindMedications(dateKey, now);
    await maybeNotifyFamilyIfNoContact(dateKey);
}

async function maybePromptMood(dateKey, now) {
    const key = `moodAsked:${dateKey}`;
    if (localStorage.getItem(key) === 'true') return;
    if (!withinHours(now, 9, 21)) return;

    localStorage.setItem(key, 'true');
    speak(t('moodPromptMsg'));
    notifyI18n('moodPromptTitle', 'moodPromptMsg', 'info');
}

async function maybePromptHealth(dateKey, now, recordType, unit, startHour, endHour, question) {
    const key = `${recordType}Asked:${dateKey}`;
    if (localStorage.getItem(key) === 'true') return;
    if (!withinHours(now, startHour, endHour)) return;

    localStorage.setItem(key, 'true');
    const commandHint = recordType === 'tansiyon'
        ? (currentLang === 'en' ? 'Voice command: "Blood pressure 120"' : 'Sesli komut: "Tansiyon 120"')
        : (currentLang === 'en' ? 'Voice command: "Sugar 110"' : 'Sesli komut: "Şeker 110"');
    const localizedQuestion = currentLang === 'en'
        ? (recordType === 'tansiyon' ? 'Did you measure your blood pressure?' : 'Did you measure your blood sugar?')
        : (recordType === 'tansiyon' ? 'Tansiyonunu ölçtün mü?' : 'Şekerini ölçtün mü?');
    speak(`${localizedQuestion} ${commandHint}`);
    showNotification(t('healthPromptTitle'), commandHint, 'info');
}

async function maybeRemindMedications(dateKey, now) {
    if (!currentMedicationsCache.length) return;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const med of currentMedicationsCache) {
        const times = Array.isArray(med.scheduleTimes) ? med.scheduleTimes : [];
        for (const time of times) {
            const [h, m] = String(time).split(':').map(v => Number.parseInt(v, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) continue;
            const targetMinutes = h * 60 + m;
            const diff = Math.abs(targetMinutes - currentMinutes);
            const remindKey = `medReminder:${dateKey}:${med.id}:${time}`;
            if (diff <= 5 && localStorage.getItem(remindKey) !== 'true') {
                localStorage.setItem(remindKey, 'true');
                const message = t('medReminderMsg').replace('{name}', med.name);
                speak(message);
                notifyI18n('medReminderTitle', 'medReminderMsg', 'normal', { name: med.name });
            }
        }
    }
}

async function maybeNotifyFamilyIfNoContact(dateKey) {
    const key = `familyContactReminder:${dateKey}`;
    if (localStorage.getItem(key) === 'true') return;

    try {
        const token = requireAuthToken();
        if (!token) return;
        const response = await safeFetch(`${API_BASE}/api/family/last-contact?token=${token}`);
        if (!response) return;
        if (!response.ok) return;
        const data = await safeReadJson(response, null);
        const hoursSince = data?.hoursSince ?? null;
        if (hoursSince !== null && hoursSince >= 24) {
            localStorage.setItem(key, 'true');
            await sendFamilyNotification('family_contact_missing', 'Uzun süredir aileden arama yok. Lütfen kullanıcıyla iletişim kurun.', 'normal');
        }
    } catch (error) {
        console.warn('Aile iletişim kontrolü başarısız:', error);
    }
}

function getBiometricPlugin() {
    return window.Capacitor?.Plugins?.BiometricAuthNative || null;
}

async function checkBiometricAvailability() {
    const plugin = getBiometricPlugin();
    if (!plugin?.checkBiometry) return { available: false, reason: 'no-plugin' };
    try {
        const info = await plugin.checkBiometry();
        return { available: Boolean(info?.isAvailable), info };
    } catch {
        return { available: false, reason: 'check-failed' };
    }
}

async function updateBiometricLoginButton() {
    const btn = document.getElementById('biometricLoginBtn');
    if (!btn) return;

    const token = await getStoredToken();
    const remembered = localStorage.getItem('rememberMe') !== 'false';
    const { available } = await checkBiometricAvailability();
    const show = IS_CAPACITOR_IOS && available && remembered && Boolean(token);
    btn.hidden = !show;
    btn.style.display = show ? '' : 'none';
}

async function completeLoginSession(data, email, remember) {
    clearLocalTestData();
    clearOfflineDemoMode();
    _backendUnreachableCount = 0;
    const offlineBanner = document.getElementById('offlineBanner');
    if (offlineBanner) offlineBanner.style.display = 'none';
    await setStoredToken(data.token);
    if (data.refreshToken) {
        if (remember) localStorage.setItem('refreshToken', data.refreshToken);
        else sessionStorage.setItem('refreshToken', data.refreshToken);
    }
    if (data.expiresAt) localStorage.setItem('tokenExpiresAt', data.expiresAt);
    localStorage.setItem('userId', data.userId || '');
    localStorage.setItem('userName', data.name || email);
    localStorage.setItem('rememberMe', remember ? 'true' : 'false');
    if (remember) localStorage.setItem('rememberedEmail', email);
    subscriptionCache = null;
    const syncEntitlements = STOREKIT_PURCHASES_ENABLED
        ? syncAppleEntitlementsFromStore().catch(() => null)
        : Promise.resolve(null);
    syncEntitlements
        .then(() => safeFetch(`${API_BASE}/api/subscription?token=${data.token}`))
        .then(res => res ? safeReadJson(res, null) : null)
        .then(sub => {
            if (!sub) return;
            subscriptionCache = sub;
            applyEntitlementFromSubscription(sub, { preserveLocalPremium: false });
            updateProfileScreen();
            updateSubscriptionScreen();
        })
        .catch(() => { });
    showScreen('homeScreen');
    updateGreeting();
    speak(`${t('welcomeMsg')} ${data.name || ''}`);
    runPendingAssistantIntentIfAny();
    updateBiometricLoginButton();
}

async function handleBiometricLogin() {
    if (!IS_CAPACITOR_IOS) {
        notifyI18n('biometricUnavailable', 'biometricNoSession', 'error');
        return;
    }

    const plugin = getBiometricPlugin();
    if (!plugin?.authenticate) {
        notifyI18n('biometricUnavailable', 'biometricNoSession', 'error');
        return;
    }

    const token = await getStoredToken();
    const remembered = localStorage.getItem('rememberMe') !== 'false';
    if (!remembered || !token) {
        notifyI18n('biometricUnavailable', 'biometricNoSession', 'error');
        return;
    }

    const { available } = await checkBiometricAvailability();
    if (!available) {
        notifyI18n('biometricUnavailable', 'biometricNoSession', 'error');
        return;
    }

    try {
        await plugin.authenticate({
            reason: t('biometricPromptReason'),
            cancelTitle: t('modalCancel'),
            allowDeviceCredential: true,
            iosFallbackTitle: currentLang === 'en' ? 'Use Passcode' : 'Parola Kullan',
            androidTitle: 'SafeGuardian',
            androidSubtitle: t('biometricPromptReason'),
        });
    } catch {
        notifyI18n('biometricFailed', 'biometricFailed', 'error');
        return;
    }

    const tokenValid = await validateStoredSessionToken(token);
    if (!tokenValid) {
        notifyI18n('sessionExpired', 'sessionExpiredMsg', 'error');
        showScreen('loginScreen');
        updateBiometricLoginButton();
        return;
    }

    showScreen('homeScreen');
    updateGreeting();
    runPendingAssistantIntentIfAny();
    notifyI18n('successTitle', 'welcomeMsg', 'success');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const remember = document.getElementById('rememberMe')?.checked ?? true;
    
    // Get login button and show loading state
    const loginBtn = e.target.querySelector('button[type="submit"]');
    const originalText = loginBtn?.textContent;
    
    // Disable button and show loading indicator
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = (t('loginBtn') || 'GİRİŞ YAP') + '...';
        loginBtn.style.opacity = '0.6';
    }
    
    // Helper function to re-enable button
    const reEnableButton = () => {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
            loginBtn.style.opacity = '1';
        }
    };

    try {
        // Sunucuya bağlanmayı dene (sessiz hata modunda)
        const response = await safeFetch(`${API_BASE}/api/elderly/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        }, { silent: true, timeoutMs: API_TIMEOUT_MS, disableFallbackRetry: true });

        if (response) {
            const rawText = await response.text();
            let data = null;
            try { data = rawText ? JSON.parse(rawText) : null; } catch { }

            if (response.ok && data?.token) {
                await completeLoginSession(data, email, remember);
                return;
            }
            // Sunucu hata döndürdü (yanlış şifre vs.)
            const message = data?.message || t('loginFailed');
            showNotification(t('errorTitle'), message, 'error');
            return;
        }
        // Response is null (timeout or connection error)
        showNotification(t('errorTitle'), t('connError'), 'error');
        return;
    } catch (error) {
        console.error('Login error:', { error, apiBase: API_BASE, email });
    } finally {
        reEnableButton();
    }

    // Controlled Offline Mode (only if explicitly enabled for local QA)
    const allowOfflineDemo = localStorage.getItem('allowOfflineDemo') === 'true';
    if (allowOfflineDemo) {
        await removeStoredToken();
        sessionStorage.setItem('offlineDemoMode', 'true');
        localStorage.setItem('userId', 'demo-user');
        localStorage.setItem('userName', currentLang === 'en' ? 'Demo User' : 'Demo Kullanıcı');
        localStorage.setItem('rememberMe', remember ? 'true' : 'false');
        if (remember) localStorage.setItem('rememberedEmail', email);
        subscriptionCache = null;
        showScreen('homeScreen');
        updateGreeting();
        showGracefulOfflineState('Demo çevrimdışı mod açık. Sunucuya bağlanmadan temel ekran gösteriliyor.', 'offline');
        runPendingAssistantIntentIfAny();
        return;
    }
}

async function handleForgotPassword() {
    const email = await showAppPrompt(t('forgotBtn'), t('forgotEmailPrompt'));
    if (!email) return;

    try {
        const response = await safeFetch(`${API_BASE}/api/elderly/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }, { timeoutMs: API_TIMEOUT_MS });

        if (!response) {
            forceCloseLoadingAndRecover();
            return;
        }

        if (response.ok) {
            let message = t('forgotSuccessMsg');
            try {
                const data = await response.json();
                if (data?.message) message = data.message;
            } catch {
                // JSON değilse geç
            }
            showNotification(t('forgotSuccessTitle'), message, 'success');
        } else {
            let errorMessage = t('forgotFailedMsg');
            try {
                const data = await response.json();
                if (data?.message) errorMessage = data.message;
            } catch {
                // JSON değilse geç
            }
            showNotification(t('forgotFailedTitle'), errorMessage, 'error');
        }
    } catch (error) {
        console.error('Şifre sıfırlama hatası:', error);
        notifyI18n('connErrorTitle', 'connError', 'error');
    }
}

function setMedicationPreset(name) {
    const medNameInput = document.getElementById('medName');
    if (!medNameInput) return;
    medNameInput.value = name;
    medNameInput.focus();
    speak(`${name}`);
}

async function handleAddMedication(e) {
    e.preventDefault();
    const name = document.getElementById('medName').value;
    const notes = document.getElementById('medNotes').value;
    const times = Array.from(document.querySelectorAll('.med-time'))
        .filter(input => input.value)
        .map(input => input.value);

    if (times.length === 0) {
        notifyI18n('medTimeRequiredTitle', 'medTimeRequiredMsg', 'error');
        return;
    }

    try {
        const token = await requireAuthTokenAsync();
        if (!token) return;
        const response = await safeFetch(`${API_BASE}/api/medications?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, notes, scheduleTimes: times })
        });

        if (response?.ok) {
            notifyI18n('medAddedTitle', 'medAddedMsg', 'success');
            document.getElementById('addMedicationForm').reset();
            await sendFamilyNotification('medication_added', `Yeni ilaç eklendi: ${name}`, 'normal');
            setTimeout(() => goToMedications(), 1000);
            return;
        }

        if (isProductionApp()) {
            showNotification(t('errorTitle'), t('connError'), 'error');
            return;
        }

        const localMeds = readLocalList('localMedications');
        localMeds.push({ id: Date.now(), name, notes, scheduleTimes: times, createdAt: new Date().toISOString() });
        writeLocalList('localMedications', localMeds);
        notifyI18n('medSavedLocalTitle', 'medSavedLocalMsg', 'success');
        document.getElementById('addMedicationForm').reset();
        setTimeout(() => goToMedications(), 600);
    } catch (error) {
        console.error('İlaç ekleme hatası:', error);
        if (isProductionApp()) {
            showNotification(t('errorTitle'), t('connError'), 'error');
            return;
        }
        const localMeds = readLocalList('localMedications');
        localMeds.push({ id: Date.now(), name, notes, scheduleTimes: times, createdAt: new Date().toISOString() });
        writeLocalList('localMedications', localMeds);
        notifyI18n('medSavedLocalTitle', 'medSavedLocalMsg', 'success');
    }
}

async function handleAppleSignInPreview() {
    return handleAppleSignIn();
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const birthDate = document.getElementById('regBirthDate').value;
    if (password !== passwordConfirm) {
        showNotification(t('errorTitle'), currentLang === 'en' ? 'Passwords do not match.' : 'Şifreler eşleşmiyor.', 'error');
        return;
    }

    try {
        const response = await safeFetch(`${API_BASE}/api/elderly-self-enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: crypto?.randomUUID?.() || undefined,
                fullName,
                phone,
                email,
                password,
                birthDate,
                plan: 'standard'
            })
        }, { timeoutMs: API_TIMEOUT_MS });

        if (!response) {
            forceCloseLoadingAndRecover();
            return;
        }

        if (response.ok) {
            let token = null;
            let userId = null;
            let name = fullName;
            try {
                const data = await response.json();
                token = data?.token || null;
                if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                if (data?.expiresAt) localStorage.setItem('tokenExpiresAt', data.expiresAt);
                userId = data?.userId || null;
                name = data?.name || fullName;
            } catch {
                // JSON değilse geç
            }
            clearLocalTestData();
            if (token) {
                await setStoredToken(token);
                localStorage.setItem('userId', String(userId || ''));
                localStorage.setItem('userName', name);
                localStorage.setItem('userEmail', email);
                if (phone) localStorage.setItem('userPhone', phone);
                showScreen('homeScreen');
                updateGreeting();
                showNotification(t('successTitle'), t('welcomeMsg'), 'success');
                return;
            }
            notifyI18n('regCompleteTitle', 'regCompleteMsg', 'success');
            showScreen('loginScreen');
        } else {
            let errorMessage = t('regFailedMsg');
            try {
                const data = await response.json();
                if (data?.message) {
                    errorMessage = data.message;
                }
            } catch {
                // JSON değilse varsayılan mesajı kullan
            }
            showNotification(t('regFailedTitle'), errorMessage, 'error');
        }
    } catch (error) {
        console.error('Kayıt hatası:', error);
        notifyI18n('connErrorTitle', 'connError', 'error');
    }
}

async function loadMedications() {
    const token = requireAuthToken();
    const container = document.getElementById('medicationsList');
    const emptyHtml = (msg) => `<div class="sg-empty-state">${escapeHtml(msg)}</div>`;
    if (!token) {
        if (container) container.innerHTML = emptyHtml(t('medsEmpty'));
        return;
    }
    try {
        const response = await safeFetch(`${API_BASE}/api/medications?token=${token}`, {}, { silent: true });
        if (!response) {
            if (isProductionApp()) {
                if (container) container.innerHTML = emptyHtml(t('connErrorBanner'));
                return;
            }
            const medications = readLocalList('localMedications');
            currentMedicationsCache = medications;
            if (container && medications.length === 0) {
                container.innerHTML = emptyHtml(t('medsEmpty'));
            }
            if (container && medications.length > 0) {
                container.innerHTML = medications.map(med => `
                    <div class="sg-med-card">
                        <div class="sg-med-card-title">${escapeHtml(med.name || '')}</div>
                        <div class="sg-med-card-line">${t('medsTimeLabel')}: ${escapeHtml((med.scheduleTimes || []).join(', ') || t('medsUnspecified'))}</div>
                        ${med.notes ? `<div class="sg-med-card-note">${escapeHtml(med.notes)}</div>` : ''}
                    </div>
                `).join('');
            }
            return;
        }
        if (response.ok) {
            const payload = await safeReadJson(response, []);
            const medications = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload?.medications) ? payload.medications : []));
            currentMedicationsCache = medications;
            if (!container) return;
            if (!medications.length) {
                container.innerHTML = emptyHtml(t('medsEmpty'));
                return;
            }
            container.innerHTML = medications.map(med => {
                const medName = escapeHtml(med.name || med.medicationName || med.notes || t('medNameLabel'));
                const medId = Number(med.id) || 0;
                return `
                <div class="sg-med-card">
                    <div class="sg-med-card-title">${medName}</div>
                    <div class="sg-med-card-line">${t('medsTimeLabel')}: ${escapeHtml((med.scheduleTimes || []).join(', ') || t('medsUnspecified'))}</div>
                    ${med.notes ? `<div class="sg-med-card-note">${escapeHtml(med.notes)}</div>` : ''}
                    ${typeof med.stockCount === 'number' ? `<div class="sg-med-card-stock">${t('medsRemaining')}: ${med.stockCount}</div>` : ''}
                    <div class="sg-med-card-actions">
                        <button class="btn-giant btn-green" type="button" onclick="takeMedication(${medId})">${t('medsTakenBtn')}</button>
                        <button class="btn-giant btn-delete" type="button" onclick="deleteMedication(${medId})">${t('medDeleteBtn')}</button>
                    </div>
                </div>
            `;
            }).join('');
            refreshMedicationConfirmTimers(medications);
            scheduleMedicationReminders();
        }
    } catch (error) {
        console.warn('İlaç yükleme hatası:', error);
        if (container) container.innerHTML = emptyHtml(t('connErrorBanner'));
    }
}

async function takeMedication(medicationId) {
    const token = requireAuthToken();
    if (!token) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/medications/${medicationId}/taken?token=${token}`, {
            method: 'POST'
        });
        if (!response) return;
        if (response.ok) {
            const payload = await response.json().catch(() => null);
            clearMedicationConfirmTimer(medicationId);
            notifyI18n('medTakenTitle', 'medTakenMsg', 'success');
            const medName = payload?.medication?.name || `ID: ${medicationId}`;
            await sendFamilyNotification('medication_taken', `İlaç alındı: ${medName}`, 'normal');
            if (payload?.stockCount === 0) {
                notifyI18n('medLowStockTitle', 'medLowStockMsg', 'error');
                await sendFamilyNotification('medication_stock_empty', 'İlaç kutusu bitti', 'high');
            }
            loadMedications();
        }
    } catch (error) {
        console.error('İlaç alma hatası:', error);
        notifyI18n('genericErrorTitle', 'genericErrorMsg', 'error');
    }
}

async function deleteMedication(medicationId) {
    const token = requireAuthToken();
    const id = Number(medicationId);
    if (!token || !Number.isFinite(id) || id <= 0) {
        notifyI18n('medDeleteFailedTitle', 'medDeleteFailedMsg', 'error');
        return;
    }
    const confirmed = await showAppConfirm(
        t('medDeleteBtn'),
        currentLang === 'en' ? 'Delete this medication?' : 'Bu ilacı silmek istiyor musunuz?'
    );
    if (!confirmed) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/medications/${id}?token=${token}`, {
            method: 'DELETE'
        });
        if (!response) return;
        if (response.ok) {
            clearMedicationConfirmTimer(id);
            notifyI18n('medDeletedTitle', 'medDeletedMsg', 'success');
            loadMedications();
            return;
        }
        notifyI18n('medDeleteFailedTitle', 'medDeleteFailedMsg', 'error');
    } catch (error) {
        console.error('İlaç silme hatası:', error);
        notifyI18n('medDeleteFailedTitle', 'medDeleteFailedMsg', 'error');
    }
}

function scheduleMedicationReminders() {
    if (medicationReminderState.has('initialized')) return;
    medicationReminderState.set('initialized', true);
    setTimeout(() => {
        maybeRemindMedications(getDateKey(), new Date());
    }, 2000);
}

function refreshMedicationConfirmTimers(medications) {
    const ids = new Set(medications.map(m => m.id));
    for (const [id, timer] of medicationConfirmTimers.entries()) {
        if (!ids.has(id)) {
            clearTimeout(timer.warningId);
            clearTimeout(timer.criticalId);
            medicationConfirmTimers.delete(id);
        }
    }
    medications.forEach(med => scheduleMedicationConfirmTimer(med));
}

function scheduleMedicationConfirmTimer(med) {
    if (!med?.id) return;
    if (medicationConfirmTimers.has(med.id)) return;

    const lastTaken = med.lastTakenAt ? new Date(med.lastTakenAt) : null;
    const elapsed = lastTaken ? Date.now() - lastTaken.getTime() : Number.MAX_SAFE_INTEGER;
    if (elapsed < MEDICATION_CONFIRM_WARNING_MS) return;

    const warningId = setTimeout(async () => {
        await sendFamilyNotification('medication_unconfirmed', `İlaç onayı gelmedi: ${med.name}`, 'normal');
        notifyI18n('medNotConfirmedTitle', 'medNotConfirmedMsg', 'error');
    }, MEDICATION_CONFIRM_WARNING_MS);

    const criticalId = setTimeout(async () => {
        medicationConfirmTimers.delete(med.id);
        await sendFamilyNotification('medication_unconfirmed_critical', `İlaç hala onaylanmadı: ${med.name}`, 'high');
        notifyI18n('medUrgentTitle', 'medUrgentMsg', 'error');
    }, MEDICATION_CONFIRM_CRITICAL_MS);

    medicationConfirmTimers.set(med.id, { warningId, criticalId });
}

function clearMedicationConfirmTimer(medicationId) {
    const timers = medicationConfirmTimers.get(medicationId);
    if (timers) {
        clearTimeout(timers.warningId);
        clearTimeout(timers.criticalId);
        medicationConfirmTimers.delete(medicationId);
    }
}

async function loadFamilyMembers() {
    const token = requireAuthToken();
    if (!token) return;
    const container = document.getElementById('familyList');
    if (!container) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/family-members?token=${token}`);
        if (!response) return;
        if (response.ok) {
            const payload = await safeReadJson(response, { members: [] });
            const members = Array.isArray(payload) ? payload : (payload.members || []);
            if (!members.length) {
                container.innerHTML = `<div class="sg-family-empty">${escapeHtml(t('familyEmpty'))}</div>`;
                return;
            }
            container.innerHTML = members.map(member => `
                <div class="sg-family-card">
                    <div class="sg-family-card-name">${escapeHtml(member.name || t('familyMemberDefault'))}</div>
                    <div class="sg-family-card-line">${escapeHtml(member.relationship || member.relation || t('familyMemberDefault'))}</div>
                    <div class="sg-family-card-line">${escapeHtml(member.email || '')}</div>
                    ${member.phoneNumber ? `<div class="sg-family-card-line">${escapeHtml(member.phoneNumber)}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Aile yükleme hatası:', error);
    }
}

async function handleAddFamily(e) {
    e.preventDefault();
    const name = document.getElementById('familyName').value.trim();
    const phoneNumber = document.getElementById('familyPhone')?.value?.trim() || '';
    const email = document.getElementById('familyEmail').value.trim();
    const relationship = document.getElementById('familyRelation').value;

    if (!name || !email) {
        notifyI18n('familyAddFailedTitle', 'familyAddFailedMsg', 'error');
        return;
    }

    try {
        const hasAccess = await ensurePremiumAccess(currentLang === 'en' ? 'Family' : 'Aile');
        if (!hasAccess) return;
        const token = requireAuthToken();
        if (!token) return;
        const response = await safeFetch(`${API_BASE}/api/family-members?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, relationship, phoneNumber })
        });
        if (!response) return;

        if (response.ok) {
            notifyI18n('familyAddedTitle', 'familyAddedMsg', 'success');
            document.getElementById('addFamilyForm').reset();
            await loadFamilyMembers();
            setTimeout(() => goToFamily(), 600);
            return;
        }

        let errorMessage = t('familyAddFailedMsg');
        try {
            const data = await response.json();
            if (data?.message) errorMessage = data.message;
        } catch {
            // keep default
        }
        showNotification(t('familyAddFailedTitle'), errorMessage, 'error');
    } catch (error) {
        console.error('Aile ekleme hatası:', error);
        notifyI18n('familyAddFailedTitle', 'familyAddFailedMsg', 'error');
    }
}

function showEmergencyResultScreen(status) {
    const setCheck = (id, ok) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('is-ok', Boolean(ok));
        el.classList.toggle('is-fail', !ok);
        const ico = el.querySelector('.check-ico');
        if (ico) ico.textContent = ok ? '✓' : '!';
    };
    setCheck('checkLocation', status.locationOk);
    setCheck('checkNotify', status.notifyOk);
    setCheck('checkSms', status.smsOk);

    const mapLabel = document.getElementById('emergencyMapLabel');
    if (mapLabel) {
        mapLabel.textContent = status.locationLabel || status.mapsUrl || t('checkLocation');
    }
    const mapCard = document.getElementById('emergencyMapCard');
    if (mapCard && status.mapsUrl) {
        mapCard.onclick = () => openExternalUrl(status.mapsUrl);
    }
    showScreen('emergencyResultScreen');
    applyTranslations();
}

function getGreetingFirstName() {
    const raw = String(localStorage.getItem('userName') || '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const isBad = (word) => /^(app|user|demo|test|null|undefined|kullanıcı|user)$/i.test(word || '');

    let first = parts[0] || '';
    if (parts.length >= 2 && isBad(first)) {
        first = parts[1];
    }
    if (!first || isBad(first)) {
        const email = localStorage.getItem('userEmail')
            || localStorage.getItem('rememberedEmail')
            || '';
        if (email.includes('@')) {
            const local = email.split('@')[0]
                .replace(/[._-]+/g, ' ')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
            first = local.find((w) => !isBad(w)) || local[0] || '';
        }
    }
    if (!first || isBad(first)) return '';
    return first.charAt(0).toUpperCase() + first.slice(1);
}

function updateGreeting() {
    const name = getGreetingFirstName();
    const hour = new Date().getHours();
    let hello = t('morningHi');
    if (hour >= 12 && hour < 18) hello = t('afternoonHi');
    if (hour >= 18 || hour < 5) hello = t('eveningHi');
    const greeting = document.getElementById('greeting');
    if (greeting) {
        greeting.textContent = name ? `${hello}, ${name}` : hello;
    }
}

function pickPreferredVoice(langCode) {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    if (langCode === 'en-GB' || langCode === 'en-US' || String(langCode || '').startsWith('en')) {
        return voices.find(v => /^en-GB$/i.test(v.lang))
            || voices.find(v => /^en-US$/i.test(v.lang))
            || voices.find(v => /^en-/i.test(v.lang) && /google|samantha|serena|daniel|karen/i.test(v.name))
            || voices.find(v => /^en-/i.test(v.lang))
            || null;
    }
    return voices.find(v => /^tr-TR$/i.test(v.lang))
        || voices.find(v => /^tr/i.test(v.lang))
        || null;
}

function speak(text, langOverride) {
    if (!text || typeof text !== 'string') return;
    const langCode = langOverride
        || (currentLang === 'en' ? 'en-US' : 'tr-TR');
    try {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.92;
        const voice = pickPreferredVoice(langCode);
        if (voice) utterance.voice = voice;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.warn('TTS failed:', error);
    }
}

async function triggerEmergencyCall() {
    const token = requireAuthToken();
    if (!token) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/family-members?token=${token}`);
        if (!response) return;
        if (response.ok) {
            const payload = await response.json();
            const members = Array.isArray(payload) ? payload : (payload.members || []);
            const phone = members.find(m => m.phoneNumber)?.phoneNumber || '';
            if (phone) {
                provideFeedback('Aile üyeniz aranıyor. Lütfen sakin olun.', [100, 50, 100]);
                window.location.href = `tel:${phone}`;
            } else {
                notifyI18n('noPhoneTitle', 'noPhoneMsg', 'error');
            }
        }
    } catch (error) {
        console.error('Aile telefonu alınamadı:', error);
    }
}

function showEmergencyConfirm() {
    if (isEmergencyModalOpen) return;
    isEmergencyModalOpen = true;

    const token = requireAuthToken();
    if (!token) {
        isEmergencyModalOpen = false;
        return;
    }

    const modal = document.getElementById('emergencyModal');
    const countdownEl = document.getElementById('emergencyCountdown');
    if (modal) {
        modal.classList.add('show');
        speak(currentLang === 'en'
            ? 'Emergency confirmation. Location will be shared with family. Press cancel to stop.'
            : 'Acil yardım onayı. Konumunuz ailenize gönderilecek. İptal için iptal butonuna basın.');
        if (emergencyTimer) {
            clearTimeout(emergencyTimer);
            emergencyTimer = null;
        }
        let remaining = 5;
        if (countdownEl) countdownEl.textContent = String(remaining);
        const tick = setInterval(() => {
            remaining -= 1;
            if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
            if (remaining <= 0) clearInterval(tick);
        }, 1000);
        emergencyTimer = setTimeout(() => {
            clearInterval(tick);
            if (isEmergencyModalOpen) {
                confirmEmergency();
            }
        }, 5000);
    }
}

function cancelEmergency() {
    if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
    }
    const modal = document.getElementById('emergencyModal');
    if (modal) {
        modal.classList.remove('show');
    }
    isEmergencyModalOpen = false;
    notifyI18n('emergencyCancelTitle', 'emergencyCancelMsg', 'success');
}

async function confirmEmergency() {
    if (!isEmergencyModalOpen) return;
    isEmergencyModalOpen = false;

    if (emergencyTimer) {
        clearTimeout(emergencyTimer);
        emergencyTimer = null;
    }
    const modal = document.getElementById('emergencyModal');
    if (modal) {
        modal.classList.remove('show');
    }
    const token = requireAuthToken();
    if (!token) return;
    try {
        speak(currentLang === 'en'
            ? 'Sending emergency alert with your location to family.'
            : 'Konumunuz alınıyor ve ailenize haber veriliyor.');
        const location = await getCurrentLocation();
        const response = await safeFetch(`${API_BASE}/api/emergency-alert?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'emergency',
                message: location?.label
                    ? `Acil yardım çağrısı. Konum: ${location.label}`
                    : 'Acil yardım çağrısı. Konum alınamadı.',
                location: {
                    label: location?.label || '',
                    mapsUrl: location?.mapsUrl || '',
                    latitude: location?.coords?.latitude ?? null,
                    longitude: location?.coords?.longitude ?? null,
                    accuracy: location?.coords?.accuracy ?? null
                },
                coords: location?.coords || null
            })
        });
        if (!response) {
            notifyI18n('emergencyFailedTitle', 'emergencyFailedMsg', 'error');
            return;
        }

        const result = await safeReadJson(response, {});
        if (!response.ok) {
            notifyI18n('emergencyFailedTitle', 'emergencyFailedMsg', 'error');
            return;
        }

        const locationOk = Boolean(result.locationSaved);
        const smsOk = Number(result.smsDispatched || 0) > 0;
        const realtimeOk = Boolean(result.realtimeBroadcasted);
        const pushOk = Number(result.pushSent || 0) > 0;
        const familyReached = Boolean(result.familyReached) || smsOk || realtimeOk || pushOk;

        showEmergencyResultScreen({
            locationOk,
            notifyOk: realtimeOk || pushOk,
            smsOk,
            mapsUrl: result.mapsUrl || location?.mapsUrl || '',
            locationLabel: result.location || location?.label || ''
        });

        if (familyReached) {
            // Call is optional from result screen button
        } else {
            showNotification(
                currentLang === 'en' ? 'Alert saved — delivery incomplete' : 'Kayıt alındı — iletim eksik',
                result.smsError || (currentLang === 'en' ? 'Family could not be reached yet.' : 'Aileye henüz ulaşılamadı.'),
                'error'
            );
        }
    } catch (error) {
        console.error('Acil çağrı hatası:', error);
        notifyI18n('connErrorTitle', 'connError', 'error');
    }
}

async function sendEmergencySmsToFamily(location) {
    const token = requireAuthToken();
    if (!token) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/family-members?token=${token}`, {}, { silent: true });
        if (!response?.ok) return;
        const payload = await safeReadJson(response, { members: [] });
        const members = Array.isArray(payload) ? payload : (payload.members || []);
        const phones = members
            .map(m => String(m.phoneNumber || '').trim())
            .filter(Boolean);
        if (!phones.length) return;

        const loc = location?.mapsUrl || location?.label || '';
        const msg = loc
            ? `ACIL DURUM! Yardım çağrısı yapıldı. Konum: ${loc}`
            : 'ACIL DURUM! Yardım çağrısı yapıldı. Konum alınamadı.';

        await safeFetch(`${API_BASE}/api/emergency-sms/dispatch?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumbers: phones,
                message: msg,
                location: loc
            })
        }, { silent: true });
    } catch (error) {
        console.warn('Acil SMS gönderimi başarısız:', error);
    }
}

async function getCurrentLocation() {
    if (GeolocationPlugin && typeof GeolocationPlugin.getCurrentPosition === 'function') {
        try {
            if (typeof GeolocationPlugin.requestPermissions === 'function') {
                await GeolocationPlugin.requestPermissions();
            }
            const position = await GeolocationPlugin.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
            });
            const { latitude, longitude, accuracy } = position.coords;
            return {
                label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
                mapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
                coords: { latitude, longitude, accuracy }
            };
        } catch (error) {
            console.warn('Capacitor geolocation alınamadı, web fallback kullanılacak:', error);
        }
    }

    if (!('geolocation' in navigator)) {
        return null;
    }

    const isSecure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!isSecure) {
        return null;
    }

    return new Promise(resolve => {
        const timeoutId = setTimeout(() => resolve(null), 4000);
        navigator.geolocation.getCurrentPosition(
            position => {
                clearTimeout(timeoutId);
                const { latitude, longitude, accuracy } = position.coords;
                resolve({
                    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
                    mapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
                    coords: { latitude, longitude, accuracy }
                });
            },
            () => {
                clearTimeout(timeoutId);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
        );
    });
}

function buildEmergencyPayload(location) {
    const coords = location?.coords || null;
    return {
        location: coords
            ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
                mapsUrl: location?.mapsUrl || null
            }
            : (location?.mapsUrl || location?.label || 'Unknown')
    };
}

async function sendEmergencyNotification(location) {
    const token = requireAuthToken();
    if (!token) return;
    const message = location?.label
        ? `Acil yardım çağrısı. Konum: ${location.label}`
        : 'Acil yardım çağrısı. Konum alınamadı.';
    try {
        const response = await safeFetch(`${API_BASE}/api/send-notification?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'emergency_alert',
                message,
                severity: 'high',
                location: location?.mapsUrl || location?.label || 'Unknown'
            })
        });
        if (!response) return;
    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
    }
}

async function sendEmergencyBroadcast(payload) {
    const token = requireAuthToken();
    if (!token) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/emergency-broadcast?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });
        if (!response) return;
    } catch (error) {
        console.error('Acil yayın hatası:', error);
    }
}

async function sendFamilyNotification(type, message, severity = 'normal') {
    const token = requireAuthToken();
    if (!token) return;
    const location = await getCurrentLocation();
    const payload = {
        type,
        message,
        severity,
        location: location?.label || 'Unknown',
        recipient: 'all'
    };
    try {
        const response = await safeFetch(`${API_BASE}/api/send-notification?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response) return;
    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
    }
}

// Stil kuralları
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// =================== AI SOHBET ===================

async function chat(userMessage) {
    const token = requireAuthToken();
    if (!token) return null;
    try {
        const response = await safeFetch(`${API_BASE}/api/chat?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage })
        });
        if (!response) return null;

        if (response.ok) {
            const data = await response.json();
            return data.response;
        }
    } catch (error) {
        console.error('Chat hatası:', error);
    }
    return null;
}

async function startSmartDialog() {
    const name = localStorage.getItem('userName') || 'Arkadaş';
    const hour = new Date().getHours();

    let greeting = '';
    if (hour < 12) {
        greeting = `Günaydın ${name}! Bugün nasılsın?`;
    } else if (hour < 18) {
        greeting = `İyi öğlenler ${name}! Bugün nasıl gidiyor?`;
    } else {
        greeting = `İyi akşamlar ${name}! Günün nasıl geçti?`;
    }

    speak(greeting);

    // Voice cevapı dinle ve AI'ye gönder
    setTimeout(() => startVoiceCommand(), 2000);
}

// =================== BİLDİRİM ALMETTAMLARI ===================

async function loadNotifications() {
    const token = requireAuthToken();
    if (!token) return [];
    try {
        const response = await safeFetch(`${API_BASE}/api/notifications?token=${token}`);
        if (!response) return [];
        if (response.ok) {
            const notifs = await response.json();
            return notifs;
        }
    } catch (error) {
        console.error('Bildirim yükleme hatası:', error);
    }
    return [];
}

// =================== RUH HALİ ANALİZİ ===================

async function loadMoodAnalysis() {
    const token = requireAuthToken();
    if (!token) {
        renderMoodDashboard({ averageMood: 0, trend: 'stable', recentMoods: [] });
        return;
    }
    try {
        const response = await safeFetch(`${API_BASE}/api/mood-analysis?token=${token}`, {}, { silent: true });
        if (!response) {
            const localMoods = readLocalList('localMoodRecords');
            const recent = localMoods.slice(-5).reverse();
            const average = recent.length ? Math.round(recent.reduce((a, b) => a + (b.moodScore || 0), 0) / recent.length) : 0;
            renderMoodDashboard({ averageMood: average, trend: 'stable', recentMoods: recent });
            return;
        }
        if (response.ok) {
            const data = await safeReadJson(response, { averageMood: 0, trend: 'stable', recentMoods: [] });
            document.body.classList.toggle('mood-declining', data.trend === 'declining');
            renderMoodDashboard(data);
        } else {
            renderMoodDashboard({ averageMood: 0, trend: 'stable', recentMoods: [] });
        }
    } catch (error) {
        console.warn('Ruh hali yükleme hatası:', error);
        renderMoodDashboard({ averageMood: 0, trend: 'stable', recentMoods: [] });
    }
}

async function submitMood(score) {
    const token = requireAuthToken();
    if (!token) return;
    try {
        const response = await safeFetch(`${API_BASE}/api/mood?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moodScore: score })
        });
        if (!response) {
            const localMoods = readLocalList('localMoodRecords');
            localMoods.push({ moodScore: score, timestamp: new Date().toISOString() });
            writeLocalList('localMoodRecords', localMoods);
            showNotification(t('moodThanksTitle'), t('moodSavedMsg'), 'success');
            loadMoodAnalysis();
            return;
        }
        if (response.ok) {
            showNotification(t('moodThanksTitle'), t('moodSavedMsg'), 'success');
            const severity = score <= 3 ? 'high' : 'normal';
            const moodMessage = score <= 3
                ? `Ruh hali düşük: ${score}/10. Kullanıcı kendini iyi hissetmiyor olabilir.`
                : `Ruh hali bildirimi: ${score}/10`;
            await sendFamilyNotification('mood_update', moodMessage, severity);
            loadMoodAnalysis();
        } else {
            const localMoods = readLocalList('localMoodRecords');
            localMoods.push({ moodScore: score, timestamp: new Date().toISOString() });
            writeLocalList('localMoodRecords', localMoods);
            showNotification(t('moodThanksTitle'), t('moodSavedMsg'), 'success');
            loadMoodAnalysis();
        }
    } catch (error) {
        console.error('Ruh hali kaydı hatası:', error);
    }
}

function renderMoodDashboard(data) {
    const dashboard = document.getElementById('moodDashboard');
    const savedLang = String(localStorage.getItem('appLang') || currentLang || 'tr').toLowerCase();
    const locale = savedLang.startsWith('en') ? 'en-US' : 'tr-TR';
    const moodColor = data.averageMood > 7 ? '#22c55e' : data.averageMood > 4 ? '#eab308' : '#ef4444';
    const trendLabel = data.trend === 'improving'
        ? t('moodTrendImproving')
        : data.trend === 'declining'
            ? t('moodTrendDeclining')
            : t('moodTrendStable');

    dashboard.innerHTML = `
        <div class="sg-mood-summary">
            <div class="sg-mood-score" style="color: ${moodColor};">
                ${t('moodAverageLabel')}: ${data.averageMood}/10
            </div>
            <div class="sg-mood-trend">
                ${t('moodTrendLabel')}: ${trendLabel}
            </div>
        </div>
        
        <div class="sg-mood-history">
            <h3>${t('moodLastFiveDays')}</h3>
            <div class="sg-mood-list">
                ${(data.recentMoods || []).map((mood) => `
                    <div class="sg-mood-row">
                        <div class="sg-mood-row-score">${mood.moodScore}/10</div>
                        <div class="sg-mood-row-date">
                            ${new Date(mood.timestamp).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                `).join('') || `<p class="sg-mood-empty">${t('moodNoRecords')}</p>`}
            </div>
        </div>
        
        <div class="sg-mood-info">
            <strong>${t('moodInfoTitle')}</strong> ${t('moodInfoText')}
        </div>
    `;
}

// ================= HEALTH RECORDS (Sağlık Kayıtları) =================
async function loadHealthRecords() {
    const token = requireAuthToken();
    if (!token) {
        renderHealthRecords([]);
        return;
    }
    try {
        const response = await safeFetch(`${API_BASE}/api/health-records?token=${token}`, {}, { silent: true });
        if (!response) {
            renderHealthRecords(readLocalList('localHealthRecords'));
            return;
        }
        if (response.ok) {
            const data = await safeReadJson(response, []);
            renderHealthRecords(data);
        } else {
            renderHealthRecords(readLocalList('localHealthRecords'));
        }
    } catch (error) {
        console.warn('Sağlık kayıtları yükleme hatası:', error);
        renderHealthRecords(readLocalList('localHealthRecords'));
    }
}

function renderHealthRecords(records) {
    const healthDiv = document.getElementById('healthRecordsContent') || document.getElementById('healthRecordsScreen');
    if (!healthDiv) return;
    const list = Array.isArray(records) ? records : [];

    let html = '<div class="sg-health-wrap">';

    if (list.length === 0) {
        html += `<p class="sg-empty-state">${t('noRecordsYet')}</p>`;
    } else {
        const byType = {};
        list.forEach(r => {
            const key = r.recordType || r.metricType || 'other';
            if (!byType[key]) byType[key] = [];
            byType[key].push(r);
        });

        Object.keys(byType).forEach(type => {
            const typeRecords = byType[type];
            const latest = typeRecords[0];
            const alertLevel = latest.alertLevel || latest.healthStatus || 'normal';
            const alertColor = alertLevel === 'critical' ? '#e11d48' : alertLevel === 'warning' ? '#d97706' : '#1f9d55';
            const statusLabel = alertLevel === 'critical'
                ? t('healthCritical')
                : alertLevel === 'warning'
                    ? t('healthWarning')
                    : t('healthNormal');
            const value = latest.value ?? latest.systolic ?? latest.glucose ?? '-';
            const unit = latest.unit || '';
            const when = latest.timestamp || latest.recordedAt;

            html += `<div class="sg-health-card" style="border-left-color:${alertColor}">
                <div class="sg-health-card-title">${escapeHtml(String(type))}: ${escapeHtml(String(value))} ${escapeHtml(String(unit))}</div>
                <div class="sg-health-card-status" style="color:${alertColor}">${statusLabel}</div>
                <div class="sg-health-card-meta">${t('healthLastLabel')}: ${when ? new Date(when).toLocaleString(currentLang === 'en' ? 'en-US' : 'tr-TR') : '-'}</div>
            </div>`;
        });
    }

    html += `
      <div class="sg-health-add-panel">
        <p class="sg-health-add-title">${t('addNewRecordBtn')}</p>
        <div class="btn-stack">
          <button type="button" class="btn-giant btn-blue" onclick="addHealthRecordQuick('1')">${currentLang === 'en' ? 'Blood pressure' : 'Tansiyon'}</button>
          <button type="button" class="btn-giant btn-blue" onclick="addHealthRecordQuick('2')">${currentLang === 'en' ? 'Blood sugar' : 'Kan şekeri'}</button>
          <button type="button" class="btn-giant btn-blue" onclick="addHealthRecordQuick('3')">${currentLang === 'en' ? 'Cholesterol' : 'Kolesterol'}</button>
        </div>
      </div>`;
    html += '</div>';

    healthDiv.innerHTML = html;
}

async function addHealthRecordQuick(typeCode) {
    const recordType = typeCode === '1' ? 'tansiyon' : typeCode === '2' ? 'şeker' : typeCode === '3' ? 'kolesterol' : null;
    if (!recordType) return;
    const recordTypeLabel = typeCode === '1'
        ? (currentLang === 'en' ? 'blood pressure' : 'tansiyon')
        : typeCode === '2'
            ? (currentLang === 'en' ? 'blood sugar' : 'şeker')
            : (currentLang === 'en' ? 'cholesterol' : 'kolesterol');
    const unit = typeCode === '1' ? 'mmHg' : 'mg/dL';
    const value = await showAppPrompt(
        t('addNewRecordBtn'),
        currentLang === 'en'
            ? `Enter ${recordTypeLabel} value (${unit}):`
            : `${recordTypeLabel} değerini girin (${unit}):`
    );
    if (!value) return;
    await saveHealthRecordValue(recordType, value, unit);
}

async function showAddHealthRecord() {
    // Kept for compatibility; UI now uses quick buttons on the health screen.
}

async function saveHealthRecordValue(recordType, value, unit) {
    await addHealthRecord(recordType, value, unit);
}

async function addHealthRecord(recordType, value, unit) {
    const token = requireAuthToken();
    if (!token) return;
    const numericValue = Number.parseFloat(String(value).replace(',', '.'));
    let localSeverity = 'normal';
    if (recordType === 'tansiyon') {
        if (numericValue >= 180) localSeverity = 'high';
        else if (numericValue >= 140) localSeverity = 'warning';
    }
    if (recordType === 'şeker') {
        if (numericValue >= 200) localSeverity = 'high';
        else if (numericValue >= 140) localSeverity = 'warning';
    }
    const body = JSON.stringify({
        recordType: recordType,
        value: numericValue,
        unit: unit
    });

    try {
        const response = await safeFetch(`${API_BASE}/api/health-records?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        if (!response) {
            const localHealth = readLocalList('localHealthRecords');
            localHealth.unshift({
                recordType,
                value: numericValue,
                unit,
                alertLevel: localSeverity === 'high' ? 'critical' : localSeverity,
                timestamp: new Date().toISOString()
            });
            writeLocalList('localHealthRecords', localHealth);
            notifyI18n('healthRecordSavedTitle', 'healthRecordSavedMsg', 'success');
            loadHealthRecords();
            return;
        }

        if (response.ok) {
            const result = await safeReadJson(response, {});

            if (result?.queued === true || response.status === 202) {
                const queuedMessage = 'İnternet yok ama merak etme, verini kaydettim. İnternet gelince doktora ve aileye göndereceğim.';
                showGracefulOfflineState(`${queuedMessage}`, 'offline');
                speak(queuedMessage);
                return;
            }

            speak(`Sağlık kaydı başarıyla eklendi. ${recordType}: ${value} ${unit}`);
            loadHealthRecords();

            const severity = localSeverity === 'high' || result.healthStatus === 'critical' ? 'high' : (localSeverity === 'warning' ? 'normal' : 'normal');
            await sendFamilyNotification('health_record', `Sağlık kaydı: ${recordType} ${value} ${unit}`, severity);

            // If critical alert
            if (localSeverity === 'high' || result.alertLevel === 'critical' || result.healthStatus === 'critical') {
                speak("DİKKAT! Kritik seviye. Aile üyeleri uyarıldı. Doktor'a başvurun!");
                await sendEmergencyBroadcast({
                    location: (await getCurrentLocation())?.label || 'Unknown',
                    notes: `Kritik sağlık verisi: ${recordType} ${value} ${unit}`
                });
            }
        } else {
            const localHealth = readLocalList('localHealthRecords');
            localHealth.unshift({
                recordType,
                value: numericValue,
                unit,
                alertLevel: localSeverity === 'high' ? 'critical' : localSeverity,
                timestamp: new Date().toISOString()
            });
            writeLocalList('localHealthRecords', localHealth);
            notifyI18n('healthRecordSavedTitle', 'healthRecordSavedMsg', 'success');
            loadHealthRecords();
        }
    } catch (error) {
        console.error('Sağlık kaydı ekleme hatası:', error);
        const localHealth = readLocalList('localHealthRecords');
        localHealth.unshift({
            recordType,
            value: numericValue,
            unit,
            alertLevel: localSeverity === 'high' ? 'critical' : localSeverity,
            timestamp: new Date().toISOString()
        });
        writeLocalList('localHealthRecords', localHealth);
        notifyI18n('healthRecordSavedTitle', 'healthRecordSavedMsg', 'success');
        loadHealthRecords();
    }
}

const currentScreen = document.querySelector('.screen.active');
if (currentScreen && currentScreen.id === 'homeScreen' && typeof startSmartDialog === 'function') {
    setTimeout(() => startSmartDialog(), 500);
}

function bindGlobals() {
    const exports = {
        handleAppleSignIn,
        handleBiometricLogin,
        handleForgotPassword,
        goToRegister,
        logout,
        showScreen,
        shareDoctorReport,
        startFamilyPackagePurchase,
        goToMedications,
        goToFamily,
        showHelp,
        goToMoodDashboard,
        goToMedicationVision,
        goToHealthRecords,
        goToAddFamily,
        goToAddMedication,
        goToPremium,
        goToSubscription,
        editProfile,
        watchAdFor12HourAccess,
        restorePurchases,
        cancelSubscriptionFlow,
        openSubscriptionManagement,
        openPrivacyPolicy,
        openTermsOfUse,
        showEmergencyConfirm,
        showEmergencyResultScreen,
        triggerEmergencyCall,
        confirmEmergency,
        cancelEmergency,
        submitMood,
        goHome,
        toggleA11yMenu,
        toggleLargeText,
        toggleHighContrast,
        toggleSimpleHome,
        resetViewSettings,
        setMedicationPreset,
        takeMedication,
        deleteMedication,
        addHealthRecordQuick,
        showAddHealthRecord,
        updateA11yControlsVisibility,
    };
    Object.entries(exports).forEach(([name, fn]) => {
        if (typeof fn === 'function') window[name] = fn;
    });
}

bindGlobals();
