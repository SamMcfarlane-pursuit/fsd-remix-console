/**
 * MusterCommand Multi-Language Life-Safety & Evacuation Translation Engine
 * 
 * NYC Local Law / OSHA Compliance: Overcomes critical communication barriers 
 * during emergencies by providing instant multi-lingual translations, high-contrast
 * visual pictograms, and native text-to-speech voice readouts for ESL occupants,
 * international visitors, and contractors.
 */

export type EmergencyLanguage = "en" | "es" | "zh" | "ru" | "ht" | "bn";

export interface LanguageMeta {
  code: EmergencyLanguage;
  name: string;
  nativeName: string;
  flag: string;
  speechLang: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", speechLang: "en-US" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", speechLang: "es-US" },
  { code: "zh", name: "Chinese (Mandarin)", nativeName: "中文", flag: "🇨🇳", speechLang: "zh-CN" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", speechLang: "ru-RU" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl", flag: "🇭🇹", speechLang: "fr-FR" }, // fallback speech
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩", speechLang: "bn-IN" },
];

export interface EmergencyTranslations {
  directiveBanner: string;
  immediateEvacuation: string;
  noElevators: string;
  proceedToStairwell: string;
  safeAtAssembly: string;
  btnSafeOutside: string;
  btnNeedHelp: string;
  btnEvacChair: string;
  btnReadAloud: string;
  btnStopAudio: string;
  btnAcknowledge: string;
  acknowledgedNotice: string;
  listenDirective: string;
  sectorLabel: string;
  stairwellLabel: string;
  assemblyLabel: string;
}

export const EMERGENCY_STRINGS: Record<EmergencyLanguage, EmergencyTranslations> = {
  en: {
    directiveBanner: "🚨 EMERGENCY LIFE-SAFETY DIRECTIVE",
    immediateEvacuation: "IMMEDIATE EVACUATION IN PROGRESS",
    noElevators: "DO NOT USE ELEVATORS — USE STAIRWELLS ONLY",
    proceedToStairwell: "Proceed calmly down designated exit stairwell to street level.",
    safeAtAssembly: "Upon reaching outside plaza, report safe immediately.",
    btnSafeOutside: "🟢 I AM SAFE OUTSIDE (CHECK IN)",
    btnNeedHelp: "🆘 I NEED IMMEDIATE HELP (TRAPPED)",
    btnEvacChair: "🛞 REQUEST EVAC CHAIR",
    btnReadAloud: "🔊 Read Aloud (Voice)",
    btnStopAudio: "⏹️ Stop Audio",
    btnAcknowledge: "✓ I Understand & Egressing",
    acknowledgedNotice: "Directive Acknowledged — Proceed via stairwell",
    listenDirective: "Listen to Live Audio Announcement",
    sectorLabel: "Assigned Sector",
    stairwellLabel: "Evac Stairwell",
    assemblyLabel: "Outdoor Muster Point",
  },
  es: {
    directiveBanner: "🚨 DIRECTIVA DE SEGURIDAD Y EMERGENCIA",
    immediateEvacuation: "EVACUACIÓN INMEDIATA EN PROCESO",
    noElevators: "NO USE ELEVADORES — USE SOLO ESCALERAS",
    proceedToStairwell: "Baje con calma por la escalera de emergencia asignada hasta la calle.",
    safeAtAssembly: "Al llegar a la plaza exterior, repórtese a salvo de inmediato.",
    btnSafeOutside: "🟢 ESTOY A SALVO AFUERA (CONFIRMAR)",
    btnNeedHelp: "🆘 NECESITO AYUDA INMEDIATA (ATRAPADO)",
    btnEvacChair: "🛞 SOLICITAR SILLA DE EVACUACIÓN",
    btnReadAloud: "🔊 Escuchar en Español",
    btnStopAudio: "⏹️ Detener Audio",
    btnAcknowledge: "✓ Entendido · Saliendo por Escaleras",
    acknowledgedNotice: "Directiva Confirmada — Diríjase a la escalera",
    listenDirective: "Escuchar Anuncio de Emergencia en Vivo",
    sectorLabel: "Sector Asignado",
    stairwellLabel: "Escalera de Evacuación",
    assemblyLabel: "Punto de Encuentro Exterior",
  },
  zh: {
    directiveBanner: "🚨 紧急生命安全撤离指令",
    immediateEvacuation: "紧急撤离行动正在进行中",
    noElevators: "严禁使用电梯 — 请务必走紧急逃生楼梯",
    proceedToStairwell: "请保持冷静，沿指定逃生楼梯下楼前往地面街道。",
    safeAtAssembly: "到达室外集结广场后，请立即点击报告安全。",
    btnSafeOutside: "🟢 我已在室外安全区域 (签到)",
    btnNeedHelp: "🆘 我需要紧急救援 (受困)",
    btnEvacChair: "🛞 请求撤离轮椅协助",
    btnReadAloud: "🔊 中文语音播报",
    btnStopAudio: "⏹️ 停止语音",
    btnAcknowledge: "✓ 我已知悉 · 正在撤离",
    acknowledgedNotice: "指令已确认 — 请沿楼梯撤离",
    listenDirective: "收听现场广播指令",
    sectorLabel: "所属分区",
    stairwellLabel: "指定逃生楼梯",
    assemblyLabel: "室外避险集结点",
  },
  ru: {
    directiveBanner: "🚨 ЭКСТРЕННАЯ ДИРЕКТИВА ПО ЭВАКУАЦИИ",
    immediateEvacuation: "СРОЧНАЯ ЭВАКУАЦИЯ В ДЕЙСТВИИ",
    noElevators: "НЕ ПОЛЬЗУЙТЕСЬ ЛИФТАМИ — ТОЛЬКО ЛЕСТНИЦЫ",
    proceedToStairwell: "Спокойно спускайтесь по назначенной лестнице на улицу.",
    safeAtAssembly: "По прибытии на улицу немедленно отметьтесь в безопасности.",
    btnSafeOutside: "🟢 Я В БЕЗОПАСНОСТИ НА УЛИЦЕ",
    btnNeedHelp: "🆘 МНЕ НУЖНА СРОЧНАЯ ПОМОЩЬ (ЗАБЛОКИРОВАН)",
    btnEvacChair: "🛞 ТРЕБУЕТСЯ ЭВАКУАЦИОННОЕ КРЕСЛО",
    btnReadAloud: "🔊 Прослушать на Русском",
    btnStopAudio: "⏹️ Остановить звук",
    btnAcknowledge: "✓ Понял · Иду к лестнице",
    acknowledgedNotice: "Директива принята — следуйте к выходу",
    listenDirective: "Слушать экстренное голосовое оповещение",
    sectorLabel: "Сектор",
    stairwellLabel: "Эвакуационная лестница",
    assemblyLabel: "Пункт сбора на улице",
  },
  ht: {
    directiveBanner: "🚨 DIREKTIV SEKIRITE IJANS POU MOUN",
    immediateEvacuation: "EVAKYASYON IMEDYAT AP FÈT",
    noElevators: "PA ITILIZE ASANSÈ — SÈVI AK ECHÈL SÈLMAN",
    proceedToStairwell: "Desann kalm nan eskalye sekirite ki deziyen an pou rive atè.",
    safeAtAssembly: "Kou ou rive nan plas deyò a, rapòte ou an sekirite touswit.",
    btnSafeOutside: "🟢 MWEN AN SEKIRITE DEYÒ (ENFÒME)",
    btnNeedHelp: "🆘 MWEN BEZWEN ÈD IMEDYAT (KRAZE/KAPTE)",
    btnEvacChair: "🛞 MANDE CHÈZ EVAKYASYON",
    btnReadAloud: "🔊 Koute an Kreyòl",
    btnStopAudio: "⏹️ Rete Odyo",
    btnAcknowledge: "✓ Mwen Konprann · Mwen Pral Sòti",
    acknowledgedNotice: "Direktiv Konfime — Ale nan eskalye a",
    listenDirective: "Koute Anons Vwa Ijans la",
    sectorLabel: "Sektè Ou",
    stairwellLabel: "Eskalye Evakyasyon",
    assemblyLabel: "Pwen Rasanbleman Deyò",
  },
  bn: {
    directiveBanner: "🚨 জরুরী জীবন-নিরাপত্তা নির্দেশিকা",
    immediateEvacuation: "অবিলম্বে ভবন খালি করার নির্দেশ",
    noElevators: "লিফট ব্যবহার করবেন না — শুধুমাত্র সিঁড়ি ব্যবহার করুন",
    proceedToStairwell: "শান্তভাবে নির্ধারিত জরুরি সিঁড়ি দিয়ে নিচের রাস্তায় নেমে যান।",
    safeAtAssembly: "বাইরের সমাবেশ স্থানে পৌঁছানোর সাথে সাথে নিরাপদে আছেন নিশ্চিত করুন।",
    btnSafeOutside: "🟢 আমি বাইরে নিরাপদে আছি (চেক-ইন)",
    btnNeedHelp: "🆘 আমার জরুরি সাহায্য দরকার (আটকা পড়েছি)",
    btnEvacChair: "🛞 ইভ্যাক চেয়ার সহায়তা প্রয়োজন",
    btnReadAloud: "🔊 বাংলায় শুনুন",
    btnStopAudio: "⏹️ অডিও বন্ধ করুন",
    btnAcknowledge: "✓ বুঝতে পেরেছি · সিঁড়ির দিকে যাচ্ছি",
    acknowledgedNotice: "নির্দেশ নিশ্চিত হয়েছে — সিঁড়ি দিয়ে বের হন",
    listenDirective: "জরুরী কণ্ঠবার্তা শুনুন",
    sectorLabel: "নির্ধারিত সেক্টর",
    stairwellLabel: "জরুরি সিঁড়ি",
    assemblyLabel: "বাইরের সমাবেশ স্থান",
  },
};

/**
 * Common emergency narrative translation rules to transform custom commander
 * broadcasts into the recipient's chosen language.
 */
export function translateEmergencyNarrative(narrative: string, targetLang: EmergencyLanguage): string {
  if (targetLang === "en") return narrative;

  let text = narrative;

  if (targetLang === "es") {
    text = text
      .replace(/FIRE EMERGENCY — IMMEDIATE EVACUATION/gi, "EMERGENCIA DE INCENDIO — EVACUACIÓN INMEDIATA")
      .replace(/FIRE EMERGENCY DETECTED ON FLOOR 7/gi, "EMERGENCIA DE INCENDIO DETECTADA EN EL PISO 7")
      .replace(/Proceed immediately to nearest stairwell exit/gi, "Diríjase de inmediato a la salida de emergencia más cercana")
      .replace(/DO NOT USE ELEVATORS/gi, "NO USE LOS ELEVADORES")
      .replace(/USE STAIR B/gi, "USE LA ESCALERA B")
      .replace(/Floor wardens report to ARA landings/gi, "Líderes de piso repórtense en los descansos de ARA")
      .replace(/SCHEDULED FIRE DRILL IN PROGRESS/gi, "SIMULACRO PROGRAMADO DE INCENDIO EN PROGRESO")
      .replace(/All floor occupants must mark safe/gi, "Todos los ocupantes del piso deben reportarse a salvo")
      .replace(/Stairwell A/gi, "Escalera A")
      .replace(/Stairwell B/gi, "Escalera B")
      .replace(/Assembly Point A/gi, "Punto de Encuentro A (Park Plaza)")
      .replace(/Union Sq East/gi, "Union Square Este");
  } else if (targetLang === "zh") {
    text = text
      .replace(/FIRE EMERGENCY — IMMEDIATE EVACUATION/gi, "火灾紧急警报 — 立即撤离")
      .replace(/FIRE EMERGENCY DETECTED ON FLOOR 7/gi, "7层探测到火情")
      .replace(/Proceed immediately to nearest stairwell exit/gi, "立即前往最近的安全疏散楼梯")
      .replace(/DO NOT USE ELEVATORS/gi, "严禁使用电梯")
      .replace(/USE STAIR B/gi, "请走 B 号楼梯")
      .replace(/Floor wardens report to ARA landings/gi, "楼层引导员请就位救援等待区")
      .replace(/SCHEDULED FIRE DRILL IN PROGRESS/gi, "预定消防演习正在进行")
      .replace(/All floor occupants must mark safe/gi, "所有人员请在手机或自助机上标记安全")
      .replace(/Stairwell A/gi, "A号逃生梯")
      .replace(/Stairwell B/gi, "B号逃生梯")
      .replace(/Assembly Point A/gi, "A号室外集结点 (Park Plaza)")
      .replace(/Union Sq East/gi, "联合广场东侧");
  } else if (targetLang === "ru") {
    text = text
      .replace(/FIRE EMERGENCY — IMMEDIATE EVACUATION/gi, "ПОЖАРНАЯ ТРЕВОГА — СРОЧНАЯ ЭВАКУАЦИЯ")
      .replace(/FIRE EMERGENCY DETECTED ON FLOOR 7/gi, "ОБНАРУЖЕНО ВОЗГОРАНИЕ НА 7 ЭТАЖЕ")
      .replace(/Proceed immediately to nearest stairwell exit/gi, "Немедленно следуйте к ближайшему выходу на лестницу")
      .replace(/DO NOT USE ELEVATORS/gi, "НЕ ПОЛЬЗУЙТЕСЬ ЛИФТАМИ")
      .replace(/USE STAIR B/gi, "ИСПОЛЬЗУЙТЕ ЛЕСТНИЦУ B")
      .replace(/SCHEDULED FIRE DRILL IN PROGRESS/gi, "ПРОВОДИТСЯ УЧЕБНАЯ ПОЖАРНАЯ ТРЕВОГА")
      .replace(/All floor occupants must mark safe/gi, "Все сотрудники на этаже должны отметиться")
      .replace(/Stairwell A/gi, "Лестница А")
      .replace(/Stairwell B/gi, "Лестница B")
      .replace(/Assembly Point A/gi, "Пункт сбора А");
  } else if (targetLang === "ht") {
    text = text
      .replace(/FIRE EMERGENCY — IMMEDIATE EVACUATION/gi, "IJANS DIFE — EVAKYASYON TOUTSWIT")
      .replace(/FIRE EMERGENCY DETECTED ON FLOOR 7/gi, "GEN DIFE SOU ETAY 7 LA")
      .replace(/Proceed immediately to nearest stairwell exit/gi, "Ale touswit nan eskalye sekirite ki pi pre a")
      .replace(/DO NOT USE ELEVATORS/gi, "PA SÈVI AK ASANSÈ")
      .replace(/SCHEDULED FIRE DRILL IN PROGRESS/gi, "EKZÈSIS POU DIFE AP FÈT KOUNYE A")
      .replace(/Stairwell A/gi, "Eskalye A")
      .replace(/Stairwell B/gi, "Eskalye B")
      .replace(/Assembly Point A/gi, "Pwen Rasanbleman A");
  } else if (targetLang === "bn") {
    text = text
      .replace(/FIRE EMERGENCY — IMMEDIATE EVACUATION/gi, "অগ্নিকাণ্ড জরুরি সতর্কতা — অবিলম্বে ভবন ত্যাগ করুন")
      .replace(/FIRE EMERGENCY DETECTED ON FLOOR 7/gi, "৭ম তলায় আগুন শনাক্ত হয়েছে")
      .replace(/Proceed immediately to nearest stairwell exit/gi, "অবিলম্বে নিকটস্থ সিঁড়ি দিয়ে নিচে নামুন")
      .replace(/DO NOT USE ELEVATORS/gi, "লিফট ব্যবহার করবেন না")
      .replace(/SCHEDULED FIRE DRILL IN PROGRESS/gi, "নির্ধারিত ফায়ার ড্রিল চলছে")
      .replace(/Stairwell A/gi, "সিঁড়ি এ")
      .replace(/Stairwell B/gi, "সিঁড়ি বি")
      .replace(/Assembly Point A/gi, "বাইরের সমাবেশ স্থান এ");
  }

  return text;
}
