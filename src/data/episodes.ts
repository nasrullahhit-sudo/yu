import { Episode, VoiceOption } from '../types.ts';

// High-fidelity generated imagery for Episode 1 scenes
export const EPISODE_1_IMAGES = {
  scene1: '/src/assets/images/scene_dawn_meadow_1794241321857.jpg',
  scene2: '/src/assets/images/scene_eden_paradise_1794241321567.jpg',
  scene3: '/src/assets/images/scene_celestial_tree_1794241321470.jpg',
  scene4: '/src/assets/images/scene_dawn_civilization_1794241324244.jpg',
  scene5: '/src/assets/images/scene_starlit_cosmos_1794241322109.jpg',
};

export const INITIAL_EPISODES: Episode[] = [
  {
    id: 'episode-1-adam',
    episodeNumber: 1,
    title: 'পর্ব ১ — মানবজাতির সূচনা ও হযরত আদম (আ.)',
    prophetName: 'হযরত আদম (আ.)',
    duration: '১ মিনিট ২০ সেকেন্ড',
    durationSeconds: 80,
    tone: 'গভীর, ভাবগম্ভীর ও সিনেম্যাটিক',
    bgmDescription: 'মৃদু ও রহস্যময় অ্যাম্বিয়েন্ট সুর, যা ধীরে ধীরে মহিমান্বিত রূপ নেয়',
    outroTeaser: 'আদম (আ.)-এর মাধ্যমে শুরু হওয়া এই আলোর পথ ধরে পরে কে এসেছিলেন? জানতে চোখ রাখুন পরবর্তী পর্বে—যেখানে আমরা জানবো দ্বিতীয় নবী হযরত ইদরিস (আ.)-এর গল্প!',
    scenes: [
      {
        id: 'ep1-sc1',
        startSec: 0,
        endSec: 15,
        timestampLabel: '00:00 – 00:15',
        title: 'আকর্ষণীয় সূচনা (হুক)',
        visualPrompt: 'সম্পূর্ণ অন্ধকার থেকে হঠাৎ ভোরের নরম আলো ছড়িয়ে পড়ছে এক বিস্তীর্ণ সবুজ প্রান্তরে, শিশিরবিন্দু চকচক করছে।',
        imageUrl: EPISODE_1_IMAGES.scene1,
        voiceoverText: 'কখনো কি কল্পনা করেছেন, কেমন ছিল সেই দিনটি—যেদিন এই পৃথিবীতে প্রথমবারের মতো কোনো মানুষের পা পড়েছিল? আজ আমাদের তালিকার প্রথম পর্ব; আজ আমরা জানবো পৃথিবীর প্রথম মানুষ ও প্রথম নবী হযরত আদম (আ.) সম্পর্কে।',
      },
      {
        id: 'ep1-sc2',
        startSec: 15,
        endSec: 35,
        timestampLabel: '00:15 – 00:35',
        title: 'সৃষ্টির রহস্য ও শ্রেষ্ঠত্ব',
        visualPrompt: 'উর্বর কালো মাটি, এরপর আলো ঝলমলে এক স্বর্গীয় বাগান বা জান্নাতের মোহনীয় আবহ।',
        imageUrl: EPISODE_1_IMAGES.scene2,
        voiceoverText: 'মহান আল্লাহ তায়ালা পৃথিবীর বিভিন্ন প্রান্তের খাঁটি মাটি দিয়ে নিজ কুদরতে সৃষ্টি করলেন আদম (আ.)-কে। এরপর ফুঁকে দিলেন রূহ। শুধু তাই নয়, আদমকে তিনি এমন জ্ঞান ও নামসমূহ শিখিয়ে দিলেন, যা ফেরেশতারাও জানতেন না। সৃষ্টির সেরা মর্যাদায় তাঁকে ভূষিত করা হলো।',
      },
      {
        id: 'ep1-sc3',
        startSec: 35,
        endSec: 55,
        timestampLabel: '00:35 – 00:55',
        title: 'পরীক্ষা ও পৃথিবীর মাটিতে আগমন',
        visualPrompt: 'এক বিশাল ছায়াময় বৃক্ষ, জান্নাত থেকে নিচে পৃথিবীর পাহাড়ি উপত্যকার দিকে মেঘ ভেদ করে ক্যামেরা নেমে আসা।',
        imageUrl: EPISODE_1_IMAGES.scene3,
        voiceoverText: 'জান্নাতে তাঁর সঙ্গী হিসেবে সৃষ্টি করা হলো মা হাওয়া (আ.)-কে। তবে একটি নির্দিষ্ট গাছের ফল খাওয়ার মাধ্যমে নেমে এলো কঠিন পরীক্ষা। আল্লাহর নির্ধারিত বিধানে তাঁরা জান্নাত থেকে পদার্পণ করলেন এই পৃথিবীর মাটিতে—শুরু হলো এক দীর্ঘ কান্নাকাটি ও তওবার অধ্যায়।',
      },
      {
        id: 'ep1-sc4',
        startSec: 55,
        endSec: 70,
        timestampLabel: '00:55 – 01:10',
        title: 'তাওহীদের প্রথম ডাক ও মানব সভ্যতার সূচনা',
        visualPrompt: 'পাথুরে গুহার সামনে একটি পরিবার, প্রথম চাষাবাদ ও আগুনের আভা, পিতা সন্তানদের শিক্ষা দিচ্ছেন।',
        imageUrl: EPISODE_1_IMAGES.scene4,
        voiceoverText: 'আল্লাহ তাঁদের ক্ষমা করলেন এবং আদম (আ.)-কে দায়িত্ব দিলেন পৃথিবীর বুকে আল্লাহর একত্ববাদের দাওয়াত ছড়িয়ে দেওয়ার। তিনিই মানুষকে শেখালেন কীভাবে বাঁচতে হয়, কীভাবে চাষাবাদ করতে হয়, আর কীভাবে স্রষ্টার প্রতি কৃতজ্ঞ হতে হয়। তিনি মানবজাতির আদি পিতা, আমাদের সবার শিকড়।',
      },
      {
        id: 'ep1-sc5',
        startSec: 70,
        endSec: 80,
        timestampLabel: '01:10 – 01:20',
        title: 'আউটরো ও পরবর্তী পর্ব',
        visualPrompt: 'রাতের খোলা আকাশের নিচে তারা গুনছে কেউ, প্রাচীন পুথির পাতা ওড়ার দৃশ্য।',
        imageUrl: EPISODE_1_IMAGES.scene5,
        voiceoverText: 'আদম (আ.)-এর মাধ্যমে শুরু হওয়া এই আলোর পথ ধরে পরে কে এসেছিলেন? জানতে চোখ রাখুন পরবর্তী পর্বে—যেখানে আমরা জানবো দ্বিতীয় নবী হযরত ইদরিস (আ.)-এর গল্প!',
      },
    ],
  },
  {
    id: 'episode-2-idris',
    episodeNumber: 2,
    title: 'পর্ব ২ — দ্বিতীয় নবী হযরত ইদরিস (আ.) ও জ্ঞানের উন্মেষ',
    prophetName: 'হযরত ইদরিস (আ.)',
    duration: '১ মিনিট ২০ সেকেন্ড',
    durationSeconds: 80,
    tone: 'রহস্যময়, মহিমান্বিত ও সিনেম্যাটিক',
    bgmDescription: 'ধীর তারকাময় অ্যাম্বিয়েন্ট ও প্রাচীন রহস্যময় সুর যা জ্ঞানের গভীরতা প্রকাশ করে',
    outroTeaser: 'জ্ঞান ও সত্যনিষ্ঠার এই উজ্জ্বল প্রদীপের পর মানবজাতি যখন মহাপ্লাবনের মুখোমুখি হলো, তখন কে হাল ধরেছিলেন? চোখ রাখুন পরবর্তী পর্বে—হযরত নূহ (আ.) ও মহাপ্লাবনের ইতিহাস!',
    scenes: [
      {
        id: 'ep2-sc1',
        startSec: 0,
        endSec: 15,
        timestampLabel: '00:00 – 00:15',
        title: 'সূচনা ও বিস্ময়কর ব্যক্তিত্ব (হুক)',
        visualPrompt: 'মরুভূমির বুকে প্রাচীন পাঠশালা, খোলা নক্ষত্রমণ্ডলির নিচে চামড়ার পুথিতে কলম দিয়ে প্রথম বর্ণমালা আঁকা হচ্ছে।',
        imageUrl: EPISODE_1_IMAGES.scene5,
        voiceoverText: 'কে ছিলেন সেই মহান মহামানব, যিনি এই ধরণীতে সর্বপ্রথম কলম ধরেছিলেন? আকাশের গ্রহ-নক্ষত্রের গতিবিধি পর্যবেক্ষণ করে মানুষকে শিখিয়েছিলেন সময়ের হিসেব? তিনি আল্লাহর দ্বিতীয় নবী—হযরত ইদরিস (আ.)।',
      },
      {
        id: 'ep2-sc2',
        startSec: 15,
        endSec: 35,
        timestampLabel: '00:15 – 00:35',
        title: 'জ্ঞানের আলো ও প্রথম কারিগর',
        visualPrompt: 'সুতো দিয়ে কাপড় বোনার প্রাচীন তাঁত, সুঁই ও সুতোর নিখুঁত কাজ, জ্যোতির্বিদ্যার প্রাচীন মানচিত্রের রেখা।',
        imageUrl: EPISODE_1_IMAGES.scene4,
        voiceoverText: 'আদম (আ.)-এর বহু বছর পর যখন অজ্ঞতার অন্ধকার গ্রাস করছিল, তখন আল্লাহ ইদরিস (আ.)-কে পাঠালেন প্রজ্ঞার মশাল হাতে। তিনিই প্রথম মানুষ যিনি কাপড় সেলাই করে পরিধান করতে শিখিয়েছিলেন এবং মানুষকে লিখনের বিদ্যা দান করেছিলেন।',
      },
      {
        id: 'ep2-sc3',
        startSec: 35,
        endSec: 55,
        timestampLabel: '00:35 – 00:55',
        title: 'আকাশের পানে দৃষ্টি ও গভীর ধ্যান',
        visualPrompt: 'পাহাড়ের চূড়ায় দাঁড়িয়ে মহাবিশ্বের নক্ষত্রমালার দিকে দুহাত তুলে মোনাজাতরত এক মহীয়সী ছায়ামূর্তি, মেঘে চাঁদের স্নিগ্ধ আলো।',
        imageUrl: EPISODE_1_IMAGES.scene3,
        voiceoverText: 'মহান স্রষ্টার সৃষ্টিরহস্য নিয়ে গভীর রাতে গবেষণা করতেন তিনি। আসমানের সৌন্দর্য ও নিয়মে দেখতেন এক আল্লাহর কুদরত। সততা ও আনুগত্যের কারণে পবিত্র কুরআনে তাঁকে ঘোষণা করা হয়েছে পরম সত্যবাদী বা সিদ্দিক হিসেবে।',
      },
      {
        id: 'ep2-sc4',
        startSec: 55,
        endSec: 70,
        timestampLabel: '00:55 – 01:10',
        title: 'উচ্চ মর্যাদায় আরোহণ',
        visualPrompt: 'স্বর্গীয় আলোর সিঁড়ি বেয়ে ঊর্ধ্বে মেঘের ওপারের নীল দিগন্তে মিলিয়ে যাওয়া, নূরের দ্যুতিময় আবহ।',
        imageUrl: EPISODE_1_IMAGES.scene2,
        voiceoverText: 'আল্লাহ তায়ালা তাঁর প্রতিদান হিসেবে তাঁকে উন্নীত করেছিলেন এক অনন্য উচ্চ মর্যাদায়। তিনি ছিলেন জ্ঞানের অগ্রদূত, যার প্রতিটি শিক্ষাই মানবজাতিকে বর্বরতা থেকে সভ্যতার স্বর্ণদ্বারে পৌঁছে দিয়েছিল।',
      },
      {
        id: 'ep2-sc5',
        startSec: 70,
        endSec: 80,
        timestampLabel: '01:10 – 01:20',
        title: 'আউটরো ও তৃতীয় পর্বের বার্তা',
        visualPrompt: 'উত্তাল সাগরের ঢেউ, মেঘলা আকাশ ও পাহাড়ের চূড়ায় বিশাল এক কাঠের জাহাজের কাঠামো গড়ার দৃশ্য।',
        imageUrl: EPISODE_1_IMAGES.scene1,
        voiceoverText: 'ইদরিস (আ.)-এর এই জ্ঞানালোচনার পর যখন এক প্রলয়ংকরী মহাপ্লাবন ঘনিয়ে এলো, তখন মানবজাতিকে কে রক্ষা করেছিল? জানতে চোখ রাখুন পরবর্তী পর্বে—হযরত নূহ (আ.) ও সেই মহাকাব্যিক নৌকার গল্প!',
      },
    ],
  },
];

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'Fenrir',
    name: 'Fenrir (ব্যারিটোন)',
    banglaLabel: 'গম্ভীর ও ভাবগম্ভীর ব্যারিটোন (ডকুমেন্টারি)',
    description: 'গভীর, গম্ভীর ও সিনেম্যাটিক ভাবাবেগের কণ্ঠ — ঐতিহাসিক কাসাসুল আম্বিয়ার জন্য শ্রেষ্ঠ',
    gender: 'male',
  },
  {
    id: 'Charon',
    name: 'Charon (বিজ্ঞ কথক)',
    banglaLabel: 'ধীর ও বিজ্ঞ ঐতিহাসিক কথক',
    description: 'পরিপক্ব, ধীরস্থির ও আধ্যাত্মিক গাম্ভীর্যের ধারাভাষ্য',
    gender: 'male',
  },
  {
    id: 'Kore',
    name: 'Kore (স্নিগ্ধ ও স্পষ্ট)',
    banglaLabel: 'স্নিগ্ধ, মার্জিত ও স্পষ্ট কথন',
    description: 'সুস্পষ্ট উচ্চারণ ও আবেগঘন বর্ণনার জন্য চমৎকার কণ্ঠ',
    gender: 'female',
  },
  {
    id: 'Puck',
    name: 'Puck (গতিশীল)',
    banglaLabel: 'উজ্জ্বল ও গতিশীল কণ্ঠ',
    description: 'উৎসাহব্যঞ্জক ও পরিষ্কার উচ্চারণ',
    gender: 'male',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (শান্ত)',
    banglaLabel: 'শান্ত ও সুরভিত কণ্ঠ',
    description: 'প্রশান্তিময় ও হৃদয়স্পর্শী সুর',
    gender: 'female',
  },
  {
    id: 'Mishti',
    name: 'Mishti (মিষ্টি মেয়ে)',
    banglaLabel: 'মিষ্টি, কোমল ও মধুর মেয়ের কণ্ঠ',
    description: 'নরম, স্নিগ্ধ ও মিষ্টি তরুণীর কণ্ঠ — হৃদয়ছোঁয়া গল্প বলার জন্য দারুণ',
    gender: 'female',
  },
  {
    id: 'BabyGirl',
    name: 'Pari (সত্যিকারের কিউট বাবু মেয়ে)',
    banglaLabel: 'একদম আসল ছোট্ট কিউট বাবু মেয়ের আদুরে ও মিষ্টি কণ্ঠ',
    description: 'AI ভয়েস-অ্যাক্টিংয়ে তৈরি সত্যিকারের ছোট্ট কিউট বাবু মেয়ের মতো নরম, নিষ্পাপ ও মন ভালো করা কণ্ঠ',
    gender: 'female',
  },
  {
    id: 'Thanos',
    name: 'Thanos (ভয়ংকর থ্যানোস)',
    banglaLabel: 'অনেক ভয়ংকর, ভারী ও গায়ে কাঁটা দেওয়া দানবীয় কণ্ঠ',
    description: 'থ্যানোসের মতো অতি গভীর, ভয়াল, গর্জনময় ও আতঙ্ক জাগানো সিনেম্যাটিক ভিলেন কণ্ঠ',
    gender: 'male',
  },
  {
    id: 'Oggy',
    name: 'Oggy (অগি ডাবিং স্টাইল)',
    banglaLabel: 'অগি কার্টুন ডাবিংয়ের মতো নাটকীয় ও মজার ব্যারিটোন',
    description: 'হিন্দি/বাংলা অগি ডাবিং স্টাইলের উষ্ণ, নাটকীয় ও হাস্যরসাত্মক ব্যারিটোন কণ্ঠভঙ্গি (কণ্ঠ ক্লোন নয়)',
    gender: 'male',
  },
  {
    id: 'HorrorGhost',
    name: 'Bhoot (ভৌতিক ফিসফিসানি)',
    banglaLabel: 'গা ছমছমে ভৌতিক ও রহস্যময় ফিসফিসানি কণ্ঠ',
    description: 'রাতের হরর গল্প, জ্বিন-ভূতের নাটক ও থ্রিলারের জন্য ভয়াল ফিসফিসানি ও প্রতিধ্বনিময় কণ্ঠ',
    gender: 'male',
  },
  {
    id: 'Grandfather',
    name: 'Dadu (বয়স্ক দাদু গল্পকার)',
    banglaLabel: 'স্নেহময়, ধীরস্থির ও অভিজ্ঞ বয়স্ক দাদুর কণ্ঠ',
    description: 'রূপকথা, নীতিকথা ও পুরোনো দিনের স্মৃতিচারণের জন্য হৃদয়ছোঁয়া বয়স্ক দাদুর কণ্ঠ',
    gender: 'male',
  },
  {
    id: 'SciFiRobot',
    name: 'CyberBot (সাই-ফাই রোবট)',
    banglaLabel: 'ফিউচারিস্টিক এআই রোবট ও মেটালিক সাই-ফাই কণ্ঠ',
    description: 'সাই-ফাই ভিডিও, টেক রিভিউ ও রোবট চরিত্রের জন্য আধুনিক মেটালিক সাইবার কণ্ঠ',
    gender: 'male',
  },
  {
    id: 'Commentator',
    name: 'CricketPro (ধারাভাষ্যকার)',
    banglaLabel: 'উত্তেজিত ও প্রাণবন্ত স্টেডিয়াম খেলার ধারাভাষ্যকার',
    description: 'ক্রিকেট, ফুটবল ও অ্যাকশন রিলসের জন্য রোমাঞ্চকর ও উচ্চশক্তির ধারাভাষ্য কণ্ঠ',
    gender: 'male',
  },
];

export interface VoiceStylePreset {
  voiceId: import('../types.ts').VoicePersona;
  value: string;
  label: string;
}

export const VOICE_STYLE_PRESETS: VoiceStylePreset[] = [
  {
    voiceId: 'Fenrir',
    value: 'গভীর, ভাবগম্ভীর ও সিনেম্যাটিক',
    label: 'Fenrir · গভীর, ভাবগম্ভীর ও সিনেম্যাটিক (ডকুমেন্টারি)',
  },
  {
    voiceId: 'Charon',
    value: 'ধীর, আধ্যাত্মিক ও বিজ্ঞ ঐতিহাসিক কথন',
    label: 'Charon · ধীর, আধ্যাত্মিক ও বিজ্ঞ ঐতিহাসিক কথন',
  },
  {
    voiceId: 'Kore',
    value: 'স্নিগ্ধ, মার্জিত ও আবেগঘন স্পষ্ট বর্ণনা',
    label: 'Kore · স্নিগ্ধ, মার্জিত ও আবেগঘন স্পষ্ট বর্ণনা',
  },
  {
    voiceId: 'Puck',
    value: 'উজ্জ্বল, উৎসাহব্যঞ্জক ও গতিশীল উপস্থাপনা',
    label: 'Puck · উজ্জ্বল, উৎসাহব্যঞ্জক ও গতিশীল উপস্থাপনা',
  },
  {
    voiceId: 'Zephyr',
    value: 'শান্ত, প্রশান্তিময় ও হৃদয়স্পর্শী সুরভিত বর্ণনা',
    label: 'Zephyr · শান্ত, প্রশান্তিময় ও হৃদয়স্পর্শী সুরভিত বর্ণনা',
  },
  {
    voiceId: 'Mishti',
    value: 'মিষ্টি, কোমল ও মধুর গল্পকথন',
    label: 'Mishti · মিষ্টি, কোমল ও মধুর গল্পকথন',
  },
  {
    voiceId: 'BabyGirl',
    value: 'অনেক কিউট ও আদুরে ছোট্ট বাবুর গল্পকথন',
    label: 'Pari · অনেক কিউট ও আদুরে ছোট্ট বাবুর গল্পকথন',
  },
  {
    voiceId: 'Thanos',
    value: 'ভয়ংকর, ভারী ও গর্জনময় থ্যানোস ভিলেন',
    label: 'Thanos · ভয়ংকর, ভারী ও গর্জনময় থ্যানোস ভিলেন',
  },
  {
    voiceId: 'Oggy',
    value: 'অগি কার্টুন (মজার, নাটকীয় ও প্রাণবন্ত)',
    label: 'Oggy · অগি কার্টুন (মজার, নাটকীয় ও প্রাণবন্ত)',
  },
  {
    voiceId: 'HorrorGhost',
    value: 'গা ছমছমে ভৌতিক, রহস্যময় ও ভয়াল ফিসফিসানি',
    label: 'Bhoot · গা ছমছমে ভৌতিক, রহস্যময় ও ভয়াল ফিসফিসানি',
  },
  {
    voiceId: 'Grandfather',
    value: 'স্নেহময়, ধীরস্থির বয়স্ক দাদুর রূপকথা ও স্মৃতিচারণ',
    label: 'Dadu · স্নেহময়, ধীরস্থির বয়স্ক দাদুর রূপকথা ও স্মৃতিচারণ',
  },
  {
    voiceId: 'SciFiRobot',
    value: 'ফিউচারিস্টিক মেটালিক সাই-ফাই ও এআই রোবট কণ্ঠভঙ্গি',
    label: 'CyberBot · ফিউচারিস্টিক মেটালিক সাই-ফাই ও রোবট কণ্ঠভঙ্গি',
  },
  {
    voiceId: 'Commentator',
    value: 'উত্তেজিত ও প্রাণবন্ত স্টেডিয়াম খেলার ধারাভাষ্য',
    label: 'CricketPro · উত্তেজিত ও প্রাণবন্ত স্টেডিয়াম ধারাভাষ্য',
  },
];

export interface DialogueTemplate {
  id: string;
  title: string;
  subtitle: string;
  speaker1Name: string;
  speaker1Voice: import('../types.ts').VoicePersona;
  speaker2Name: string;
  speaker2Voice: import('../types.ts').VoicePersona;
  lines: Array<{ speaker: 1 | 2; text: string; emotion: import('../types.ts').VoiceEmotion }>;
}

export const DIALOGUE_TEMPLATES: DialogueTemplate[] = [
  {
    id: 'pari-vs-thanos',
    title: 'Pari বনাম Thanos (মজার লড়াই)',
    subtitle: 'কিউট ছোট্ট বাবু মেয়ে আর ভয়ংকর থ্যানোসের মজার কথোপকথন',
    speaker1Name: 'পরী (বাবু)',
    speaker1Voice: 'BabyGirl',
    speaker2Name: 'থ্যানোস',
    speaker2Voice: 'Thanos',
    lines: [
      { speaker: 2, text: 'হাহাহা! এই মহাবিশ্বের সব চকলেট আজ আমার দখলে থাকবে!', emotion: 'scary' },
      { speaker: 1, text: 'এই দুষ্টু আঙ্কেল! আমার চকলেট নিলে আমি কিন্তু আম্মুকে বলে দেবো!', emotion: 'angry' },
      { speaker: 2, text: 'আমিই অনিবার্য... কেউ আমাকে থামাতে পারবে না!', emotion: 'scary' },
      { speaker: 1, text: 'প্লিজ থ্যানোস আঙ্কেল, একটা চকলেট দাও না... আমি তো তোমার কিউট বন্ধু!', emotion: 'happy' },
    ],
  },
  {
    id: 'oggy-mishti',
    title: 'Oggy ও Mishti (কার্টুন কমেডি)',
    subtitle: 'মজার কার্টুন ডাবিং ও মিষ্টি কথোপকথন',
    speaker1Name: 'অগি',
    speaker1Voice: 'Oggy',
    speaker2Name: 'মিষ্টি',
    speaker2Voice: 'Mishti',
    lines: [
      { speaker: 1, text: 'আরে ভাই, ফ্রিজের ভেতর আমার প্রিয় কেকটা কে খেলো?!', emotion: 'excited' },
      { speaker: 2, text: 'ইয়ে মানে... আমি একটুখানি চেখে দেখেছিলাম, তারপর পুরোটা শেষ হয়ে গেছে!', emotion: 'happy' },
      { speaker: 1, text: 'হায় আল্লাহ! একটুখানি চেখে পুরো কেক গায়েব করে দিলে?!', emotion: 'angry' },
      { speaker: 2, text: 'রাগ করো না তো, চলো এখন দুজনে মিলে আইসক্রিম খাই!', emotion: 'happy' },
    ],
  },
  {
    id: 'dadu-nati',
    title: 'দাদু ও নাতি (রাতের গল্পের আসর)',
    subtitle: 'বয়স্ক দাদু ও ছোট্ট পরীর মিষ্টি গল্প',
    speaker1Name: 'দাদু',
    speaker1Voice: 'Grandfather',
    speaker2Name: 'পরী',
    speaker2Voice: 'BabyGirl',
    lines: [
      { speaker: 2, text: 'দাদুভাই, আজ রাতে আমাকে একটা সুন্দর গল্প শোনাবে?', emotion: 'happy' },
      { speaker: 1, text: 'অবশ্যই শোনাবো মা! অনেক অনেক দিন আগে, আকাশের ওই উজ্জ্বল তারার নিচে ছিল এক শান্ত গ্রাম।', emotion: 'auto' },
      { speaker: 2, text: 'ওয়াও! সেই গ্রামে কি ছোট্ট পরী থাকতো?', emotion: 'excited' },
      { speaker: 1, text: 'হ্যাঁ দাদুমণি, ঠিক তোমার মতোই মিষ্টি আর দয়ালু একটি মেয়ে থাকতো।', emotion: 'happy' },
    ],
  },
  {
    id: 'horror-night',
    title: 'রাতের ভৌতিক রহস্য (Horror)',
    subtitle: 'ভয়ংকর ফিসফিসানি আর সাইবার রোবটের রোমাঞ্চকর দৃশ্য',
    speaker1Name: 'রহস্যময় ছায়া',
    speaker1Voice: 'HorrorGhost',
    speaker2Name: 'সাইবার-বট',
    speaker2Voice: 'SciFiRobot',
    lines: [
      { speaker: 1, text: 'কে ওখানে? রাত তিনটায় এই পুরোনো বাড়িতে তুমি একা কেন এসেছো?', emotion: 'whisper' },
      { speaker: 2, text: 'সতর্কতা! অজানা তাপমাত্রা শনাক্ত হয়েছে। এই কক্ষে কোনো মানুষের অস্তিত্ব নেই।', emotion: 'auto' },
      { speaker: 1, text: 'ফিরে যাও... নয়তো এই অন্ধকার তোমাকে আর কখনো বের হতে দেবে না!', emotion: 'scary' },
    ],
  },
];

