/**
 * His single talks, from the two playlists the client sent (2026-11-22): PLbywE47BtkDE in English
 * (43 videos, most by Islam Net in Oslo) and PLQYUp9URG-XQ in Somali (142 videos from many
 * channels). Curated: full talks only, no trailers, promos or second uploads. `pic` marks the
 * talks with a frame checked by eye (src/assets/talks/<id>.jpg: he is not caught mid-word); the
 * others show as text tiles. Durations as the playlists list them.
 */
export interface TalkItem {
  id: string;
  title: string;
  len: string;
  place?: string;
  pic?: boolean;
}

export const EN_PLAYLIST = 'PLbywE47BtkDE';
export const SO_PLAYLIST = 'PLQYUp9URG-XQ';
export const EN_COUNT = 43;
export const SO_COUNT = 142;

export const EN_LINE = 'In English. Most of these were recorded by Islam Net in Oslo.';
export const SO_LINE = 'Af-Soomaali: talks given in Kampala, Nairobi, Tanzania, Germany, the UK and Oslo.';

export const EN_TALKS: TalkItem[] = [
  { id: 'kZRrJvN4h3s', title: 'Let the Qur’an Enter Your Life', len: '33 min', pic: true },
  { id: 'TJ4a-EghNW4', title: 'Lights on Sūrat al-Ḥujurāt', len: '55 min', pic: true },
  { id: '13NorFteApg', title: 'How Muslims Can Become Happy', len: '1 h 7', pic: true },
  { id: 'lmJSQv9SmdM', title: 'Jesus Christ: A Messenger of Allah?', len: '48 min', pic: true },
  { id: 'dORQ8eJYh0A', title: 'Dacwah of the Prophets', len: '42 min', pic: true },
  { id: 'kZDynBs3rg0', title: 'What Is Happening in the World Today', len: '23 min', pic: true },
  { id: 'QnBwH7Dkbq8', title: 'The Devil’s Deception', len: '1 h 27' },
  { id: 'o0Nhtjvt970', title: 'Signs of the Last Hour', len: '1 h 8' },
  { id: 'vlQGcjGEmCM', title: 'Black Magic: Cures and Protection', len: '38 min' },
  { id: 'kklUBxkvmUg', title: 'How to Unite the Ummah', len: '45 min' },
  { id: 'Ff89iIB1oa4', title: 'Etiquette of Seeking Knowledge', len: '1 h 5' },
  { id: '-DNgx2Uyl7M', title: 'The Youth That Changed the World', len: '32 min' },
  { id: 'vfCmNidou0w', title: 'Accountability', len: '27 min' },
  { id: '3kuUW3nsbHg', title: 'The Best in the Sight of Allah', len: '45 min' },
];

/* Short answers from the Q&A sessions. */
export const EN_ANSWERS = [
  { id: 'Tn0GjFj6D2k', title: 'Is Dajjal alive now?' },
  { id: '2t4o8NdmcLk', title: 'Who are Gog and Magog?' },
  { id: 'jvy8Nu28zdM', title: 'Do I have to follow a particular madhab?' },
];

export const SO_TALKS: TalkItem[] = [
  { id: 'cbnyxmu77iM', title: 'Qorsheynta mustaqbalka da’yarta muslimiinta', len: '53 min', place: 'Kampala', pic: true },
  { id: 'f-2pX_4_9sE', title: 'Sidee ubadka Soomaaliyeed qurbaha loogu tarbiyeyn karaa?', len: '50 min', place: 'Kassel', pic: true },
  { id: 'IfvlfY9lRFM', title: 'Nafta iyo sida loo carbiyo', len: '32 min', pic: true },
  { id: 'zaWqnIohxA4', title: 'Iimaan ma leh ninka aan amaanada ilaalin', len: '34 min', pic: true },
  { id: 'c81we5gC6wI', title: 'Diinta oo shaki lagu geliyo', len: '1 h 13' },
  { id: 'kJ32HvfggUM', title: 'Jacaylka Nabigeena ﷺ', len: '51 min' },
  { id: '8BmHYBnVKT4', title: 'Xishoodku waa qayb ka mid ah iimaanka', len: '39 min' },
  { id: 'o1jWC0TqfSo', title: 'Tarbiyadda iimaanka', len: '29 min' },
  { id: '-yzDhHv1unQ', title: 'Dumarka iyo xaqa ay diintu siisay', len: '55 min', place: 'Kampala' },
  { id: 'j7mdWGZ6WxI', title: 'Islaamka iyo dagaalka lagu hayo', len: '1 h 5', place: 'Kampala' },
  { id: '0jrhbLvsgXQ', title: '10ka dhibaato ee ribada', len: '55 min' },
  { id: 'htKSSmkjnnY', title: 'Kitaabka Alle oo la isku xukumo', len: '40 min' },
  { id: 'JsRAJ7MiamA', title: 'Hoos u dhaca iimaanka iyo dawadiisa', len: '1 h 22' },
  { id: 'BJx8k_mSBj8', title: 'Maareynta carada', len: '35 min' },
  { id: 'CzA5vTOIH6k', title: 'Muranka iyo khilaafka diiniga ah', len: '41 min', place: 'Oslo' },
  { id: 'Hi227KTtAc8', title: 'Ha quusan weligaa', len: '38 min' },
  { id: 'SI3mfkCj9NM', title: 'Mid wax tar leh noqo', len: '1 h 6', place: 'UK' },
];

/* Somali talks given as short series, listed by their parts. */
export const SO_GROUPS: { title: string; parts: { id: string; title: string }[] }[] = [
  {
    title: 'Religions and sects',
    parts: [
      { id: 'krldZjtRD1U', title: 'Yahuudiyada 1' },
      { id: 'jVEZ7DDw6_g', title: 'Yahuudiyada 2' },
      { id: 'uZ8U5KEogN8', title: 'Yahuudiyada 3' },
      { id: 'pxevbqxu9h4', title: 'Bahaa’iya' },
      { id: '3oNnp_l07pI', title: 'Qadyaaniyah' },
      { id: '9egqWsQF6Z0', title: 'Duruus' },
      { id: 'JqygcXwm9O0', title: 'Axbaash' },
      { id: 'Qvh_xe7UNiM', title: 'Sahyuuniya' },
    ],
  },
  {
    title: 'The creed of the Shia (Caqiidada Shiicada)',
    parts: [
      { id: '5NgxCBK8-sA', title: 'Part 1' },
      { id: 'ZWmyoAOo83s', title: 'Part 2' },
    ],
  },
  {
    title: 'Ramadan rulings',
    parts: [
      { id: 'y96WZS2bpT0', title: '2013' },
      { id: 'jJ11oz6PqjM', title: '2015' },
      { id: 'IhZXVmIeRM0', title: 'Su’aalaha bisha Ramadan' },
      { id: 'kgly1eLBzv4', title: 'Sakaatul Fidriga' },
    ],
  },
];
