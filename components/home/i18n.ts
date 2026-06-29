// SP — Celestial homepage copy in all three languages. Every section is translated so the nav language
// toggle works across the whole page. Hindi uses Devanagari (Noto Sans Devanagari). KEEP-section strings are
// ported from docs/mockups/landing-page.html; NEW-section strings are added.

export type Lang = "en" | "hi" | "hinglish";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "hinglish", label: "Hi-En" },
];

export interface Pair { market: string; yours: string }
export interface TwoLine { title: string; body: string }
export interface QA { q: string; a: string }

export interface HomeCopy {
  nav: { howItWorks: string; features: string; pricing: string; forAstrologers: string; signIn: string; startFree: string };
  hero: { eyebrow: string; h1Pre: string; h1Em: string; h1Post: string; sub: string; cta1: string; cta2: string; note: string };
  hero2: {
    tabs: { seeker: string; astro: string };
    seeker: { h1Pre: string; h1Em: string; h1Post: string; sub: string; placeholder: string; button: string; note: string };
    astro: { placeholder: string; button: string };
    demo: string;
    soon: string;
    claim: { caption: string; checking: string; available: string; taken: string };
  };
  orbits: [string, string, string, string];
  money: { eyebrow: string; zeroLabel: string; body: string; gold: string };
  pain: { title: string; colMarket: string; colYours: string; rows: Pair[] };
  how: { eyebrow: string; title: string; lead: string; steps: TwoLine[] };
  features: { eyebrow: string; title: string; lead: string; items: TwoLine[] };
  testi: { eyebrow: string; title: string; footnote: string };
  call: {
    eyebrow: string; title: string; lead: string; points: [string, string, string];
    formTitle: string; formSub: string; name: string; email: string; phone: string; language: string; slot: string;
    submit: string; sending: string; success: string;
  };
  modalities: { eyebrow: string; title: string; items: string[] };
  pricing: { eyebrow: string; title: string; lead: string; seeFull: string; perMonth: string; free: string; contact: string; taglines: [string, string, string, string] };
  demo: { eyebrow: string; title: string; lead: string; btn: string; note: string };
  faq: { title: string; items: QA[] };
  final: { title: string; sub: string; btn: string; micro: string };
  footer: { colProduct: string; colAstro: string; colCompany: string; note: string; getStarted: string; examples: string; support: string; about: string; privacy: string; terms: string };
}

const en: HomeCopy = {
  nav: { howItWorks: "How it works", features: "Features", pricing: "Pricing", forAstrologers: "For Astrologers", signIn: "Sign in", startFree: "Start free →" },
  hero: {
    eyebrow: "✦ For astrologers, palmists & Vedic consultants",
    h1Pre: "Your practice, beautifully ", h1Em: "online", h1Post: ".",
    sub: "A branded booking home for your consultations — schedule calls, take payments your way, and guide your seekers. You keep every rupee; we just power the experience.",
    cta1: "Start free with Google", cta2: "Try the demo dashboard", note: "No commission on your earnings · Set up in minutes",
  },
  hero2: {
    tabs: { seeker: "I'm a Seeker", astro: "I'm an Astrologer" },
    seeker: {
      h1Pre: "Find your guide among the ", h1Em: "stars", h1Post: ".",
      sub: "Book a trusted astrologer for a real consultation — in your language, on your time.",
      placeholder: "Search astrologers, tarot, numerology…", button: "Search",
      note: "Verified consultants · Payments go directly to them",
    },
    astro: { placeholder: "your-name", button: "Start free →" },
    demo: "or try the demo dashboard →",
    soon: "Astrologer search is coming soon",
    claim: { caption: "Claim your jyoti.app address — free, before someone else does.", checking: "Checking availability…", available: "is available", taken: "is already taken" },
  },
  orbits: ["your earnings", "languages & scripts", "double-bookings", "your branding"],
  money: {
    eyebrow: "The honest math",
    zeroLabel: "The commission we take from your consultations.",
    body: "On marketplaces a consultant earning ₹1,00,000/month loses up to ₹30,000. Here you keep all of it.",
    gold: "That's ₹3,60,000 more in your pocket every year.",
  },
  pain: {
    title: "Stop losing your earnings to middlemen.",
    colMarket: "Marketplace apps", colYours: "Your own page",
    rows: [
      { market: "Up to 30% commission on every booking", yours: "0% commission — you keep it all" },
      { market: "One of 50,000 listings", yours: "Your own branded home, found by your name" },
      { market: "They own your clients", yours: "Your clients and records are yours" },
      { market: "A generic, identical profile", yours: "Your photo, colours, font & language" },
      { market: "Payouts on a 30-day cycle", yours: "Money hits your account directly" },
    ],
  },
  how: {
    eyebrow: "The path", title: "Three steps to your own consulting page", lead: "No tech skills needed. Bring your craft; we handle the rest.",
    steps: [
      { title: "Make it yours", body: "Add your photo, story, and experience. Pick your colours, your font, and your language — Hindi, English, or Hinglish." },
      { title: "Set your offerings", body: "Create consultation packages with your own prices and durations. Choose when you're available; we prevent clashes automatically." },
      { title: "Share & consult", body: "Share your link on Instagram or WhatsApp. Seekers book and pay; you get the call link, receipts go out on their own." },
    ],
  },
  features: {
    eyebrow: "Everything in one place", title: "Built for the way you already work", lead: "Tap a capability to see what it does.",
    items: [
      { title: "Smart scheduling", body: "Your availability, buffers and booking limits — all respected automatically, with a Meet link on every call." },
      { title: "Your own payments", body: "UPI QR or your own gateway. Money reaches your account directly — never ours. Receipts under your name and GST." },
      { title: "Bring your team", body: "Add consulting or accounts helpers. Bookings auto-distribute fairly across your team — no manual juggling." },
      { title: "Seeker records", body: "Reading notes and uploaded charts for every client. Share a private link or print a clean PDF." },
    ],
  },
  testi: { eyebrow: "Early members", title: "Early astrologers love it.", footnote: "Illustrative of typical early-member experiences." },
  call: {
    eyebrow: "See it for yourself", title: "Schedule a call with us",
    lead: "Not sure if it fits your practice? Book a free 20-minute walkthrough. We'll show you how astrologers set up their page, take payments, and run consultations.",
    points: ["A live tour of the consultant dashboard", "Help choosing UPI QR vs. your own gateway", "Answers in Hindi, English, or Hinglish"],
    formTitle: "Book your free walkthrough", formSub: "Pick a slot and we'll reach out on WhatsApp.",
    name: "Your name", email: "Email", phone: "WhatsApp number", language: "Preferred language", slot: "Choose a slot",
    submit: "Schedule my call", sending: "Sending…", success: "Booked! We'll reach out on your WhatsApp within 24 hours.",
  },
  modalities: { eyebrow: "Every tradition welcome", title: "For every kind of practice.", items: ["Vedic", "Tarot", "Numerology", "Vastu", "Palmistry", "Prashna"] },
  pricing: {
    eyebrow: "Pricing", title: "Simple pricing. No commission. Ever.", lead: "Start free forever. Upgrade only when you're ready.",
    seeFull: "See full pricing →", perMonth: "/mo", free: "Free", contact: "Contact us",
    taglines: ["For solo astrologers getting started", "For serious, active practitioners", "For growing practices with a team", "For institutes & large practices"],
  },
  demo: {
    eyebrow: "Kick the tyres", title: "Explore the consultant dashboard",
    lead: "Want to look inside before signing up? Open a fully interactive demo dashboard with realistic data — packages, bookings, payments, your team, and seeker records.",
    btn: "Try the demo dashboard →", note: "Quick verify with email & OTP · No commitment",
  },
  faq: {
    title: "Pricing questions",
    items: [
      { q: "Do you take a cut of my consultation fees?", a: "Never. We charge only a flat subscription. Every rupee a seeker pays goes directly to your own UPI ID or Razorpay account — we never touch your money." },
      { q: "How is this different from Topmate or Astrotalk?", a: "They take 10–30% of every booking. We charge a flat subscription regardless of how much you earn — the more you earn, the more you save with us." },
      { q: "Can I start completely free?", a: "Yes. Starter is free forever — no credit card, no expiry. A real branded page with UPI payments and up to 30 bookings/month." },
      { q: "How do clients pay me?", a: "On all plans, UPI QR with proof. On paid plans, connect your own Razorpay for instant confirmation — funds settle straight to your bank." },
      { q: "Can I cancel anytime?", a: "Absolutely. No lock-ins, no cancellation fees — your page just returns to the free Starter limits." },
    ],
  },
  final: { title: "Your stars are aligned. Start your practice today.", sub: "A branded booking home, your own payments, and every rupee you earn.", btn: "Start free →", micro: "Join the founding astrologers · Free forever" },
  footer: { colProduct: "Product", colAstro: "For astrologers", colCompany: "Company", note: "Payments go directly to you — we never hold your money.", getStarted: "Get started", examples: "Examples", support: "Support", about: "About", privacy: "Privacy", terms: "Terms" },
};

const hi: HomeCopy = {
  nav: { howItWorks: "कैसे काम करता है", features: "सुविधाएँ", pricing: "मूल्य", forAstrologers: "ज्योतिषियों के लिए", signIn: "साइन इन", startFree: "निःशुल्क शुरू करें →" },
  hero: {
    eyebrow: "✦ ज्योतिषियों, हस्तरेखा एवं वैदिक सलाहकारों के लिए",
    h1Pre: "आपका कार्य, अब सुंदर रूप में ", h1Em: "ऑनलाइन", h1Post: "।",
    sub: "आपके परामर्श के लिए एक ब्रांडेड बुकिंग पृष्ठ — कॉल शेड्यूल करें, अपने तरीके से भुगतान लें, और जिज्ञासुओं का मार्गदर्शन करें। हर रुपया आपका; हम बस अनुभव को संचालित करते हैं।",
    cta1: "Google से निःशुल्क शुरू करें", cta2: "डेमो डैशबोर्ड आज़माएँ", note: "आपकी कमाई पर कोई कमीशन नहीं · कुछ ही मिनटों में तैयार",
  },
  hero2: {
    tabs: { seeker: "मैं जिज्ञासु हूँ", astro: "मैं ज्योतिषी हूँ" },
    seeker: {
      h1Pre: "सितारों के बीच अपना ", h1Em: "मार्गदर्शक", h1Post: " खोजें।",
      sub: "किसी विश्वसनीय ज्योतिषी से असली परामर्श बुक करें — आपकी भाषा में, आपके समय पर।",
      placeholder: "ज्योतिषी, टैरो, अंकशास्त्र खोजें…", button: "खोजें",
      note: "सत्यापित सलाहकार · भुगतान सीधे उन्हें",
    },
    astro: { placeholder: "your-name", button: "निःशुल्क शुरू करें →" },
    demo: "या डेमो डैशबोर्ड आज़माएँ →",
    soon: "ज्योतिषी खोज जल्द ही आ रही है",
    claim: { caption: "अपना jyoti.app पता पाएँ — मुफ़्त, इससे पहले कोई और ले ले।", checking: "उपलब्धता जाँच रहे हैं…", available: "उपलब्ध है", taken: "पहले से लिया जा चुका है" },
  },
  orbits: ["आपकी कमाई", "भाषाएँ व लिपियाँ", "दोहरी बुकिंग नहीं", "आपकी ब्रांडिंग"],
  money: {
    eyebrow: "सच्चा गणित",
    zeroLabel: "आपके परामर्श पर हम जितना कमीशन लेते हैं।",
    body: "मार्केटप्लेस पर ₹1,00,000/माह कमाने वाला सलाहकार ₹30,000 तक खो देता है। यहाँ वह पूरा आपका रहता है।",
    gold: "यानी हर साल ₹3,60,000 अधिक आपकी जेब में।",
  },
  pain: {
    title: "अपनी कमाई बिचौलियों को देना बंद करें।",
    colMarket: "मार्केटप्लेस ऐप", colYours: "आपका अपना पृष्ठ",
    rows: [
      { market: "हर बुकिंग पर 30% तक कमीशन", yours: "0% कमीशन — पूरा आपका" },
      { market: "50,000 लिस्टिंग में से एक", yours: "आपके नाम से मिलने वाला अपना पृष्ठ" },
      { market: "आपके ग्राहक उनके", yours: "आपके ग्राहक और रिकॉर्ड आपके" },
      { market: "एक जैसा सामान्य प्रोफ़ाइल", yours: "आपकी फ़ोटो, रंग, फ़ॉन्ट व भाषा" },
      { market: "30 दिन के भुगतान चक्र", yours: "पैसा सीधे आपके खाते में" },
    ],
  },
  how: {
    eyebrow: "मार्ग", title: "अपने परामर्श पृष्ठ तक तीन चरण", lead: "किसी तकनीकी ज्ञान की आवश्यकता नहीं। आप अपनी विद्या लाएँ; बाकी हम संभालते हैं।",
    steps: [
      { title: "इसे अपना बनाएँ", body: "अपनी फ़ोटो, कहानी और अनुभव जोड़ें। अपने रंग, फ़ॉन्ट और भाषा चुनें — हिंदी, अंग्रेज़ी या हिंग्लिश।" },
      { title: "अपनी सेवाएँ तय करें", body: "अपनी कीमतों और अवधि के साथ परामर्श पैकेज बनाएँ। तय करें कि आप कब उपलब्ध हैं; टकराव हम स्वयं रोकते हैं।" },
      { title: "साझा करें और परामर्श दें", body: "अपना लिंक इंस्टाग्राम या व्हाट्सएप पर साझा करें। जिज्ञासु बुक करके भुगतान करते हैं; रसीदें स्वयं चली जाती हैं।" },
    ],
  },
  features: {
    eyebrow: "सब कुछ एक जगह", title: "आपके काम करने के तरीके के अनुसार", lead: "देखने के लिए किसी सुविधा पर टैप करें।",
    items: [
      { title: "स्मार्ट शेड्यूलिंग", body: "आपकी उपलब्धता, अंतराल और सीमाएँ — सब स्वतः, हर कॉल पर Meet लिंक के साथ।" },
      { title: "आपका अपना भुगतान", body: "UPI QR या आपका अपना गेटवे। पैसा सीधे आपके खाते में — कभी हमारे नहीं। रसीदें आपके नाम और GST पर।" },
      { title: "अपनी टीम जोड़ें", body: "कॉल लेने या खाते संभालने के लिए सहायक जोड़ें। बुकिंग स्वयं समान रूप से बँटती हैं।" },
      { title: "जिज्ञासु रिकॉर्ड", body: "हर ग्राहक के लिए नोट्स रखें और कुंडली अपलोड करें। निजी लिंक साझा करें या PDF प्रिंट करें।" },
    ],
  },
  testi: { eyebrow: "शुरुआती सदस्य", title: "शुरुआती ज्योतिषियों को यह पसंद है।", footnote: "शुरुआती सदस्यों के सामान्य अनुभव का उदाहरण।" },
  call: {
    eyebrow: "स्वयं देखें", title: "हमारे साथ कॉल शेड्यूल करें",
    lead: "क्या यह आपके कार्य के लिए उपयुक्त है? एक निःशुल्क 20-मिनट का वॉकथ्रू बुक करें। हम दिखाएँगे कि ज्योतिषी अपना पृष्ठ कैसे बनाते हैं।",
    points: ["सलाहकार डैशबोर्ड का लाइव दौरा", "UPI QR बनाम अपना गेटवे चुनने में मदद", "हिंदी, अंग्रेज़ी या हिंग्लिश में उत्तर"],
    formTitle: "अपना निःशुल्क वॉकथ्रू बुक करें", formSub: "एक स्लॉट चुनें और हम व्हाट्सएप पर संपर्क करेंगे।",
    name: "आपका नाम", email: "ईमेल", phone: "व्हाट्सएप नंबर", language: "पसंदीदा भाषा", slot: "स्लॉट चुनें",
    submit: "मेरी कॉल शेड्यूल करें", sending: "भेजा जा रहा है…", success: "बुक हो गया! हम 24 घंटे में आपके व्हाट्सएप पर संपर्क करेंगे।",
  },
  modalities: { eyebrow: "हर परंपरा का स्वागत", title: "हर तरह की विद्या के लिए।", items: ["वैदिक", "टैरो", "अंकशास्त्र", "वास्तु", "हस्तरेखा", "प्रश्न"] },
  pricing: {
    eyebrow: "मूल्य", title: "सरल मूल्य। कोई कमीशन नहीं। कभी नहीं।", lead: "हमेशा के लिए निःशुल्क शुरू करें। तैयार होने पर ही अपग्रेड करें।",
    seeFull: "पूरा मूल्य देखें →", perMonth: "/माह", free: "निःशुल्क", contact: "संपर्क करें",
    taglines: ["शुरुआत करने वाले एकल ज्योतिषियों के लिए", "गंभीर, सक्रिय अभ्यासियों के लिए", "टीम के साथ बढ़ते अभ्यास के लिए", "संस्थानों व बड़े अभ्यास के लिए"],
  },
  demo: {
    eyebrow: "आज़माकर देखें", title: "सलाहकार डैशबोर्ड देखें",
    lead: "साइन अप से पहले अंदर देखना चाहते हैं? वास्तविक डेटा के साथ एक इंटरैक्टिव डेमो डैशबोर्ड खोलें — पैकेज, बुकिंग, भुगतान, टीम और रिकॉर्ड।",
    btn: "डेमो डैशबोर्ड आज़माएँ →", note: "ईमेल और OTP से त्वरित सत्यापन · कोई बाध्यता नहीं",
  },
  faq: {
    title: "मूल्य संबंधी प्रश्न",
    items: [
      { q: "क्या आप मेरी परामर्श फीस में से हिस्सा लेते हैं?", a: "कभी नहीं। हम केवल एक निश्चित सदस्यता शुल्क लेते हैं। हर रुपया सीधे आपके UPI या Razorpay खाते में जाता है — हम आपका पैसा कभी नहीं छूते।" },
      { q: "यह Topmate या Astrotalk से कैसे अलग है?", a: "वे हर बुकिंग पर 10–30% लेते हैं। हम आपकी कमाई चाहे जितनी हो, एक निश्चित शुल्क लेते हैं — जितना अधिक कमाएँ, उतनी अधिक बचत।" },
      { q: "क्या मैं पूरी तरह निःशुल्क शुरू कर सकता हूँ?", a: "हाँ। Starter हमेशा के लिए निःशुल्क है — कोई कार्ड नहीं, कोई समाप्ति नहीं। UPI भुगतान और 30 बुकिंग/माह के साथ असली पृष्ठ।" },
      { q: "ग्राहक मुझे भुगतान कैसे करते हैं?", a: "सभी प्लान पर UPI QR। पेड प्लान पर अपना Razorpay जोड़ें — पैसा सीधे आपके बैंक में।" },
      { q: "क्या मैं कभी भी रद्द कर सकता हूँ?", a: "बिलकुल। कोई लॉक-इन नहीं, कोई शुल्क नहीं — आपका पृष्ठ बस निःशुल्क सीमा पर लौट आता है।" },
    ],
  },
  final: { title: "आपके सितारे अनुकूल हैं। आज ही अपना अभ्यास शुरू करें।", sub: "एक ब्रांडेड बुकिंग पृष्ठ, आपका अपना भुगतान, और हर कमाया रुपया।", btn: "निःशुल्क शुरू करें →", micro: "संस्थापक ज्योतिषियों में शामिल हों · हमेशा के लिए निःशुल्क" },
  footer: { colProduct: "उत्पाद", colAstro: "ज्योतिषियों के लिए", colCompany: "कंपनी", note: "भुगतान सीधे आपको — हम आपका पैसा कभी नहीं रखते।", getStarted: "शुरू करें", examples: "उदाहरण", support: "सहायता", about: "हमारे बारे में", privacy: "गोपनीयता", terms: "शर्तें" },
};

const hinglish: HomeCopy = {
  nav: { howItWorks: "How it works", features: "Features", pricing: "Pricing", forAstrologers: "Astrologers ke liye", signIn: "Sign in", startFree: "Free shuru karein →" },
  hero: {
    eyebrow: "✦ Astrologers, palmists & Vedic consultants ke liye",
    h1Pre: "Aapki practice, ab khoobsurat ", h1Em: "online", h1Post: ".",
    sub: "Aapke consultations ke liye ek branded booking page — calls schedule karein, apne tarike se payment lein, aur seekers ko guide karein. Har rupaya aapka; hum bas experience power karte hain.",
    cta1: "Google se free shuru karein", cta2: "Demo dashboard try karein", note: "Aapki earnings par koi commission nahi · Minutes mein ready",
  },
  hero2: {
    tabs: { seeker: "Main Seeker hoon", astro: "Main Astrologer hoon" },
    seeker: {
      h1Pre: "Sitaron ke beech apna ", h1Em: "guide", h1Post: " khojein.",
      sub: "Kisi trusted astrologer se real consultation book karein — aapki language mein, aapke time par.",
      placeholder: "Astrologers, tarot, numerology search karein…", button: "Search",
      note: "Verified consultants · Payment seedha unhe",
    },
    astro: { placeholder: "your-name", button: "Free shuru karein →" },
    demo: "ya demo dashboard try karein →",
    soon: "Astrologer search jaldi aa rahi hai",
    claim: { caption: "Apna jyoti.app address claim karein — free, koi aur le le usse pehle.", checking: "Availability check kar rahe hain…", available: "available hai", taken: "le liya gaya hai" },
  },
  orbits: ["aapki earnings", "languages & scripts", "double-booking nahi", "aapki branding"],
  money: {
    eyebrow: "Honest math",
    zeroLabel: "Aapke consultations par hum jitna commission lete hain.",
    body: "Marketplaces par ₹1,00,000/month kamane wala consultant ₹30,000 tak khota hai. Yahan woh poora aapka rehta hai.",
    gold: "Matlab har saal ₹3,60,000 zyada aapki jeb mein.",
  },
  pain: {
    title: "Apni earnings middlemen ko dena band karein.",
    colMarket: "Marketplace apps", colYours: "Aapka apna page",
    rows: [
      { market: "Har booking par 30% tak commission", yours: "0% commission — poora aapka" },
      { market: "50,000 listings mein se ek", yours: "Aapke naam se milne wala apna page" },
      { market: "Aapke clients unke", yours: "Aapke clients aur records aapke" },
      { market: "Ek jaisa generic profile", yours: "Aapki photo, colours, font & language" },
      { market: "30-din ke payout cycles", yours: "Paisa seedha aapke account mein" },
    ],
  },
  how: {
    eyebrow: "Raasta", title: "Apne consulting page tak teen steps", lead: "Koi tech knowledge nahi chahiye. Aap apni vidya laayein; baaki hum sambhaalte hain.",
    steps: [
      { title: "Ise apna banayein", body: "Apni photo, story aur experience add karein. Apne colours, font aur language chunein — Hindi, English ya Hinglish." },
      { title: "Apni offerings set karein", body: "Apni prices aur duration ke saath packages banayein. Decide karein kab available hain; clashes hum khud rokte hain." },
      { title: "Share & consult karein", body: "Apna link Instagram ya WhatsApp par share karein. Seekers book karke pay karte hain; receipts khud chali jaati hain." },
    ],
  },
  features: {
    eyebrow: "Sab kuch ek jagah", title: "Aapke kaam ke tarike ke hisaab se", lead: "Dekhne ke liye kisi capability par tap karein.",
    items: [
      { title: "Smart scheduling", body: "Aapki availability, buffers aur limits — sab automatic, har call par Meet link." },
      { title: "Aapka apna payment", body: "UPI QR ya aapka apna gateway. Paisa seedha aapke account mein — kabhi hamare nahi. Receipts aapke naam aur GST par." },
      { title: "Apni team layein", body: "Calls lene ya accounts ke liye helpers add karein. Bookings khud fairly bant-ti hain." },
      { title: "Seeker records", body: "Har client ke liye notes aur kundali. Private link share karein ya PDF print karein." },
    ],
  },
  testi: { eyebrow: "Early members", title: "Early astrologers ko yeh pasand hai.", footnote: "Typical early-member experiences ka illustration." },
  call: {
    eyebrow: "Khud dekhein", title: "Hamare saath call schedule karein",
    lead: "Sure nahi ki practice ke liye fit hai? Free 20-min walkthrough book karein. Hum dikhayenge astrologers page kaise banate hain.",
    points: ["Consultant dashboard ka live tour", "UPI QR vs apna gateway chunne mein madad", "Hindi, English ya Hinglish mein answers"],
    formTitle: "Apna free walkthrough book karein", formSub: "Slot chunein aur hum WhatsApp par reach out karenge.",
    name: "Aapka naam", email: "Email", phone: "WhatsApp number", language: "Preferred language", slot: "Slot chunein",
    submit: "Meri call schedule karein", sending: "Bhej rahe hain…", success: "Ho gaya! Hum 24 ghante mein aapke WhatsApp par reach out karenge.",
  },
  modalities: { eyebrow: "Har tradition welcome", title: "Har tarah ki practice ke liye.", items: ["Vedic", "Tarot", "Numerology", "Vastu", "Palmistry", "Prashna"] },
  pricing: {
    eyebrow: "Pricing", title: "Simple pricing. No commission. Ever.", lead: "Free forever shuru karein. Ready hone par hi upgrade karein.",
    seeFull: "Full pricing dekhein →", perMonth: "/mo", free: "Free", contact: "Contact us",
    taglines: ["Shuru karne wale solo astrologers ke liye", "Serious, active practitioners ke liye", "Team ke saath badhti practice ke liye", "Institutes & badi practice ke liye"],
  },
  demo: {
    eyebrow: "Try karke dekhein", title: "Consultant dashboard explore karein",
    lead: "Sign up se pehle andar dekhna chahte hain? Realistic data ke saath interactive demo dashboard kholein — packages, bookings, payments, team aur records.",
    btn: "Demo dashboard try karein →", note: "Email & OTP se quick verify · Koi commitment nahi",
  },
  faq: {
    title: "Pricing questions",
    items: [
      { q: "Kya aap meri consultation fees mein se cut lete hain?", a: "Kabhi nahi. Hum sirf ek flat subscription lete hain. Har rupaya seedha aapke UPI ya Razorpay account mein — hum aapka paisa kabhi nahi chhute." },
      { q: "Yeh Topmate ya Astrotalk se kaise alag hai?", a: "Woh har booking par 10–30% lete hain. Hum aapki earnings chahe jitni ho, flat subscription lete hain — jitna zyada kamayein, utni zyada bachat." },
      { q: "Kya main poori tarah free shuru kar sakta hoon?", a: "Haan. Starter forever free hai — koi card nahi, koi expiry nahi. UPI payments aur 30 bookings/month ke saath asli page." },
      { q: "Clients mujhe pay kaise karte hain?", a: "Sabhi plans par UPI QR. Paid plans par apna Razorpay connect karein — paisa seedha aapke bank mein." },
      { q: "Kya main kabhi bhi cancel kar sakta hoon?", a: "Bilkul. Koi lock-in nahi, koi fee nahi — aapka page bas free Starter limits par laut aata hai." },
    ],
  },
  final: { title: "Aapke sitare aligned hain. Aaj hi apni practice shuru karein.", sub: "Ek branded booking page, aapka apna payment, aur har kamaya rupaya.", btn: "Free shuru karein →", micro: "Founding astrologers mein shaamil hon · Forever free" },
  footer: { colProduct: "Product", colAstro: "Astrologers ke liye", colCompany: "Company", note: "Payment seedha aapko — hum aapka paisa kabhi nahi rakhte.", getStarted: "Get started", examples: "Examples", support: "Support", about: "About", privacy: "Privacy", terms: "Terms" },
};

export const DICT: Record<Lang, HomeCopy> = { en, hi, hinglish };
