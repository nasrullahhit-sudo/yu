import horrorForest from '../assets/images/bg_horror_forest_1795286999919.jpg';
import horrorMansion from '../assets/images/bg_horror_mansion_1795287543012.jpg';
import horrorCorridor from '../assets/images/bg_horror_corridor_1795286977294.jpg';

import fantasyMeadow from '../assets/images/bg_fantasy_meadow_1795286978080.jpg';
import fantasyVillage from '../assets/images/bg_fantasy_village_1795286999693.jpg';
import fantasyClouds from '../assets/images/bg_fantasy_clouds_1795286978006.jpg';

import scifiTitan from '../assets/images/bg_scifi_titan_1795287577830.jpg';
import scifiNebula from '../assets/images/bg_scifi_nebula_1795287577079.jpg';
import scifiCity from '../assets/images/bg_scifi_city_1795287580561.jpg';

import natureMeadow from '../assets/images/scene_dawn_meadow_1794241321857.jpg';
import natureGarden from '../assets/images/scene_eden_paradise_1794241321567.jpg';
import natureTree from '../assets/images/scene_celestial_tree_1794241321470.jpg';
import natureCivilization from '../assets/images/scene_dawn_civilization_1794241324244.jpg';
import natureCosmos from '../assets/images/scene_starlit_cosmos_1794241322109.jpg';

export interface BackgroundPhotoItem {
  id: string;
  url: string;
  label: string;
  isCustom?: boolean;
}

export type SlideDurationMode = 0 | 3 | 5 | 8;

export interface BackgroundThemePack {
  id: string;
  name: string;
  shortDesc: string;
  accentClass: string;
  photos: BackgroundPhotoItem[];
}

export const BACKGROUND_THEME_PACKS: BackgroundThemePack[] = [
  {
    id: 'horror',
    name: 'হরর ও ভৌতিক',
    shortDesc: 'ভুতুড়ে বন, পুরোনো বাড়ি ও অন্ধকার করিডর',
    accentClass: 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
    photos: [
      { id: 'horror-1', url: horrorForest, label: 'ভুতুড়ে বন' },
      { id: 'horror-2', url: horrorMansion, label: 'ভৌতিক বাড়ি' },
      { id: 'horror-3', url: horrorCorridor, label: 'অন্ধকার করিডর' },
    ],
  },
  {
    id: 'fantasy',
    name: 'কার্টুন ও ফ্যান্টাসি',
    shortDesc: 'জাদুর প্রান্তর, ট্রি-হাউস ও রঙধনু আকাশ',
    accentClass: 'border-pink-500/40 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20',
    photos: [
      { id: 'fantasy-1', url: fantasyMeadow, label: 'জাদুর প্রান্তর' },
      { id: 'fantasy-2', url: fantasyVillage, label: 'ট্রি-হাউস গ্রাম' },
      { id: 'fantasy-3', url: fantasyClouds, label: 'রঙধনু মেঘ' },
    ],
  },
  {
    id: 'scifi',
    name: 'থানোস ও সাই-ফাই',
    shortDesc: 'ভাঙা চাঁদের গ্রহ, মহাকাশ ও নিয়ন শহর',
    accentClass: 'border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20',
    photos: [
      { id: 'scifi-1', url: scifiTitan, label: 'ভিনগ্রহের প্রান্তর' },
      { id: 'scifi-2', url: scifiNebula, label: 'গভীর মহাকাশ' },
      { id: 'scifi-3', url: scifiCity, label: 'নিয়ন শহর' },
    ],
  },
  {
    id: 'nature',
    name: 'প্রকৃতি ও ইতিহাস',
    shortDesc: 'ভোরের প্রান্তর, বাগান ও তারার আকাশ',
    accentClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
    photos: [
      { id: 'nature-1', url: natureMeadow, label: 'ভোরের প্রান্তর' },
      { id: 'nature-2', url: natureGarden, label: 'সবুজ বাগান' },
      { id: 'nature-3', url: natureTree, label: 'ছায়াময় বৃক্ষ' },
      { id: 'nature-4', url: natureCivilization, label: 'প্রাচীন সভ্যতা' },
      { id: 'nature-5', url: natureCosmos, label: 'তারার আকাশ' },
    ],
  },
];
