/**
 * GIA colored-stone hue system (31 hues + pink/brown exceptions)
 * hex from Multicolour GIA hue table, plus common trade names as shades.
 * @see https://www.multicolour.com/catalogue/source/clg.html
 * @see https://www.gia.edu/gem-encyclopedia
 */

export type GemColorShade = {
  value: string;
  label: string;
  hex: string;
};

export type GemColorFamily = {
  value: string;
  label: string;
  /** GIA hue code when applicable */
  giaCode?: string;
  hex: string;
  shades: GemColorShade[];
};

export const GEM_COLOR_FAMILIES: GemColorFamily[] = [
  {
    value: 'red',
    label: 'Red',
    giaCode: 'R',
    hex: '#FA0303',
    shades: [
      { value: 'red', label: 'Red (R)', hex: '#FA0303' },
      { value: 'vivid_red', label: 'Vivid Red', hex: '#E10600' },
      { value: 'pigeon_blood', label: 'Pigeon Blood', hex: '#9B111E' },
      { value: 'medium_red', label: 'Medium Red', hex: '#C41E3A' },
      { value: 'dark_red', label: 'Dark Red', hex: '#7A0C1A' },
    ],
  },
  {
    value: 'orangy_red',
    label: 'Orangy Red',
    giaCode: 'oR',
    hex: '#EE2102',
    shades: [
      { value: 'orangy_red', label: 'Orangy Red (oR)', hex: '#EE2102' },
      { value: 'slightly_orangy_red', label: 'Slightly Orangy Red', hex: '#E8381A' },
    ],
  },
  {
    value: 'red_orange',
    label: 'Red-Orange / Orange-Red',
    giaCode: 'RO/OR',
    hex: '#FB3E00',
    shades: [
      { value: 'red_orange', label: 'Red-Orange (RO)', hex: '#FB3E00' },
      { value: 'orange_red', label: 'Orange-Red (OR)', hex: '#F04A10' },
    ],
  },
  {
    value: 'reddish_orange',
    label: 'Reddish Orange',
    giaCode: 'rO',
    hex: '#FE6000',
    shades: [
      { value: 'reddish_orange', label: 'Reddish Orange (rO)', hex: '#FE6000' },
      { value: 'fanta_orange', label: 'Fanta Orange', hex: '#FF5E00' },
    ],
  },
  {
    value: 'orange',
    label: 'Orange',
    giaCode: 'O',
    hex: '#F87B00',
    shades: [
      { value: 'orange', label: 'Orange (O)', hex: '#F87B00' },
      { value: 'vivid_orange', label: 'Vivid Orange', hex: '#FF6A00' },
      { value: 'mandarin', label: 'Mandarin', hex: '#F37A20' },
    ],
  },
  {
    value: 'yellowish_orange',
    label: 'Yellowish Orange',
    giaCode: 'yO',
    hex: '#F6A400',
    shades: [
      { value: 'yellowish_orange', label: 'Yellowish Orange (yO)', hex: '#F6A400' },
      { value: 'golden_orange', label: 'Golden Orange', hex: '#F5A623' },
    ],
  },
  {
    value: 'orangy_yellow',
    label: 'Orangy Yellow',
    giaCode: 'oY',
    hex: '#F7CD00',
    shades: [
      { value: 'orangy_yellow', label: 'Orangy Yellow (oY)', hex: '#F7CD00' },
      { value: 'honey_yellow', label: 'Honey Yellow', hex: '#E8B923' },
    ],
  },
  {
    value: 'yellow',
    label: 'Yellow',
    giaCode: 'Y',
    hex: '#F8F800',
    shades: [
      { value: 'yellow', label: 'Yellow (Y)', hex: '#F8F800' },
      { value: 'canary', label: 'Canary', hex: '#FFEF00' },
      { value: 'golden_yellow', label: 'Golden Yellow', hex: '#FFD700' },
      { value: 'lemon', label: 'Lemon', hex: '#FFF44F' },
    ],
  },
  {
    value: 'greenish_yellow',
    label: 'Greenish Yellow',
    giaCode: 'gY',
    hex: '#CEE600',
    shades: [
      { value: 'greenish_yellow', label: 'Greenish Yellow (gY)', hex: '#CEE600' },
      { value: 'chartreuse', label: 'Chartreuse', hex: '#DFFF00' },
    ],
  },
  {
    value: 'yellow_green',
    label: 'Yellow-Green / Green-Yellow',
    giaCode: 'YG/GY',
    hex: '#B0DD00',
    shades: [
      { value: 'yellow_green', label: 'Yellow-Green (YG)', hex: '#B0DD00' },
      { value: 'green_yellow', label: 'Green-Yellow (GY)', hex: '#ADFF2F' },
    ],
  },
  {
    value: 'strongly_yellowish_green',
    label: 'Strongly Yellowish Green',
    giaCode: 'styG',
    hex: '#7BCE00',
    shades: [
      { value: 'strongly_yellowish_green', label: 'Strongly Yellowish Green (styG)', hex: '#7BCE00' },
    ],
  },
  {
    value: 'yellowish_green',
    label: 'Yellowish Green',
    giaCode: 'yG',
    hex: '#4DC100',
    shades: [
      { value: 'yellowish_green', label: 'Yellowish Green (yG)', hex: '#4DC100' },
      { value: 'peridot_green', label: 'Peridot Green', hex: '#9ACD32' },
    ],
  },
  {
    value: 'slightly_yellowish_green',
    label: 'Slightly Yellowish Green',
    giaCode: 'slyG',
    hex: '#26C200',
    shades: [{ value: 'slightly_yellowish_green', label: 'Slightly Yellowish Green (slyG)', hex: '#26C200' }],
  },
  {
    value: 'green',
    label: 'Green',
    giaCode: 'G',
    hex: '#00C000',
    shades: [
      { value: 'green', label: 'Green (G)', hex: '#00C000' },
      { value: 'emerald_green', label: 'Emerald Green', hex: '#046307' },
      { value: 'forest_green', label: 'Forest Green', hex: '#228B22' },
      { value: 'tsavorite_green', label: 'Tsavorite Green', hex: '#0B7A4B' },
      { value: 'chrome_green', label: 'Chrome Green', hex: '#1B8A3A' },
    ],
  },
  {
    value: 'very_slightly_bluish_green',
    label: 'Very Slightly Bluish Green',
    giaCode: 'vslbG',
    hex: '#00BE26',
    shades: [
      { value: 'very_slightly_bluish_green', label: 'Very Slightly Bluish Green (vslbG)', hex: '#00BE26' },
    ],
  },
  {
    value: 'bluish_green',
    label: 'Bluish Green',
    giaCode: 'bG',
    hex: '#00BA4A',
    shades: [
      { value: 'bluish_green', label: 'Bluish Green (bG)', hex: '#00BA4A' },
      { value: 'teal_green', label: 'Teal Green', hex: '#008080' },
    ],
  },
  {
    value: 'very_strongly_bluish_green',
    label: 'Very Strongly Bluish Green',
    giaCode: 'vstbG',
    hex: '#00B96F',
    shades: [
      { value: 'very_strongly_bluish_green', label: 'Very Strongly Bluish Green (vstbG)', hex: '#00B96F' },
    ],
  },
  {
    value: 'green_blue',
    label: 'Green-Blue / Blue-Green',
    giaCode: 'GB/BG',
    hex: '#00B893',
    shades: [
      { value: 'green_blue', label: 'Green-Blue (GB)', hex: '#00B893' },
      { value: 'blue_green', label: 'Blue-Green (BG)', hex: '#0D7377' },
      { value: 'seafoam', label: 'Seafoam', hex: '#71EEB8' },
    ],
  },
  {
    value: 'very_strongly_greenish_blue',
    label: 'Very Strongly Greenish Blue',
    giaCode: 'vstgB',
    hex: '#09B4B4',
    shades: [
      { value: 'very_strongly_greenish_blue', label: 'Very Strongly Greenish Blue (vstgB)', hex: '#09B4B4' },
    ],
  },
  {
    value: 'very_slightly_greenish_blue',
    label: 'Very Slightly Greenish Blue',
    giaCode: 'vslgB',
    hex: '#0A59AA',
    shades: [
      { value: 'very_slightly_greenish_blue', label: 'Very Slightly Greenish Blue (vslgB)', hex: '#0A59AA' },
      { value: 'peacock_blue', label: 'Peacock Blue', hex: '#005F73' },
    ],
  },
  {
    value: 'blue',
    label: 'Blue',
    giaCode: 'B',
    hex: '#0916A5',
    shades: [
      { value: 'blue', label: 'Blue (B)', hex: '#0916A5' },
      { value: 'royal_blue', label: 'Royal Blue', hex: '#1E4DB7' },
      { value: 'cornflower', label: 'Cornflower', hex: '#6495ED' },
      { value: 'kashmir_blue', label: 'Kashmir Blue', hex: '#2E5A88' },
      { value: 'ceylon_blue', label: 'Ceylon Blue', hex: '#5B8DB8' },
      { value: 'inky_blue', label: 'Inky Blue', hex: '#0B1E3A' },
      { value: 'light_blue', label: 'Light Blue', hex: '#7EB6E8' },
      { value: 'medium_blue', label: 'Medium Blue', hex: '#3A7BD5' },
    ],
  },
  {
    value: 'violetish_blue',
    label: 'Violetish Blue',
    giaCode: 'vB',
    hex: '#0808A0',
    shades: [
      { value: 'violetish_blue', label: 'Violetish Blue (vB)', hex: '#0808A0' },
      { value: 'indigo', label: 'Indigo', hex: '#3F51B5' },
    ],
  },
  {
    value: 'bluish_violet',
    label: 'Bluish Violet',
    giaCode: 'bV',
    hex: '#3E08AA',
    shades: [
      { value: 'bluish_violet', label: 'Bluish Violet (bV)', hex: '#3E08AA' },
    ],
  },
  {
    value: 'violet',
    label: 'Violet',
    giaCode: 'V',
    hex: '#7B0AB4',
    shades: [
      { value: 'violet', label: 'Violet (V)', hex: '#7B0AB4' },
      { value: 'lavender', label: 'Lavender', hex: '#B57EDC' },
    ],
  },
  {
    value: 'bluish_purple',
    label: 'Bluish Purple',
    giaCode: 'bP',
    hex: '#C70BC7',
    shades: [
      { value: 'bluish_purple', label: 'Bluish Purple (bP)', hex: '#C70BC7' },
    ],
  },
  {
    value: 'purple',
    label: 'Purple',
    giaCode: 'P',
    hex: '#D40CB1',
    shades: [
      { value: 'purple', label: 'Purple (P)', hex: '#D40CB1' },
      { value: 'amethyst', label: 'Amethyst', hex: '#9966CC' },
      { value: 'grape', label: 'Grape', hex: '#6F2DA8' },
    ],
  },
  {
    value: 'reddish_purple',
    label: 'Reddish Purple',
    giaCode: 'rP',
    hex: '#E90A9E',
    shades: [
      { value: 'reddish_purple', label: 'Reddish Purple (rP)', hex: '#E90A9E' },
      { value: 'magenta', label: 'Magenta', hex: '#C71585' },
    ],
  },
  {
    value: 'red_purple',
    label: 'Red-Purple / Purple-Red',
    giaCode: 'RP/PR',
    hex: '#F50E80',
    shades: [
      { value: 'red_purple', label: 'Red-Purple (RP)', hex: '#F50E80' },
      { value: 'purple_red', label: 'Purple-Red (PR)', hex: '#C71585' },
    ],
  },
  {
    value: 'strongly_purplish_red',
    label: 'Strongly Purplish Red',
    giaCode: 'stpR',
    hex: '#F80E5C',
    shades: [
      { value: 'strongly_purplish_red', label: 'Strongly Purplish Red (stpR)', hex: '#F80E5C' },
      { value: 'purplish_red', label: 'Purplish Red', hex: '#A02040' },
    ],
  },
  {
    value: 'slightly_purplish_red',
    label: 'Slightly Purplish Red',
    giaCode: 'slpR',
    hex: '#F20E33',
    shades: [
      { value: 'slightly_purplish_red', label: 'Slightly Purplish Red (slpR)', hex: '#F20E33' },
      { value: 'pinkish_red', label: 'Pinkish Red', hex: '#E0456A' },
    ],
  },
  {
    value: 'pink',
    label: 'Pink',
    giaCode: 'Pk',
    hex: '#FFDFDF',
    shades: [
      { value: 'pink', label: 'Pink (Pk)', hex: '#FFB6C1' },
      { value: 'light_pink', label: 'Light Pink', hex: '#F7B6C8' },
      { value: 'medium_pink', label: 'Medium Pink', hex: '#E75480' },
      { value: 'hot_pink', label: 'Hot Pink', hex: '#FF1493' },
      { value: 'padparadscha', label: 'Padparadscha', hex: '#FF6F61' },
      { value: 'peach', label: 'Peach', hex: '#FFCBA4' },
      { value: 'salmon', label: 'Salmon', hex: '#FA8072' },
    ],
  },
  {
    value: 'brown',
    label: 'Brown',
    giaCode: 'Brn',
    hex: '#B7770D',
    shades: [
      { value: 'brown', label: 'Brown (Brn)', hex: '#B7770D' },
      { value: 'champagne', label: 'Champagne', hex: '#F7E7CE' },
      { value: 'cognac', label: 'Cognac', hex: '#9A463D' },
      { value: 'chocolate', label: 'Chocolate', hex: '#4E2A0A' },
      { value: 'yellowish_brown', label: 'Yellowish Brown', hex: '#C4A35A' },
    ],
  },
  {
    value: 'white_colorless',
    label: 'White / Colorless',
    hex: '#F5F5F5',
    shades: [
      { value: 'colorless', label: 'Colorless', hex: '#FAFAFA' },
      { value: 'near_colorless', label: 'Near Colorless', hex: '#F0F0F0' },
      { value: 'white', label: 'White', hex: '#FFFFFF' },
      { value: 'milky', label: 'Milky', hex: '#F8F4E8' },
    ],
  },
  {
    value: 'black_gray',
    label: 'Black / Gray',
    hex: '#1A1A1A',
    shades: [
      { value: 'black', label: 'Black', hex: '#0D0D0D' },
      { value: 'dark_gray', label: 'Dark Gray', hex: '#3A3A3A' },
      { value: 'silver_gray', label: 'Silver Gray', hex: '#A8A8A8' },
    ],
  },
  {
    value: 'multicolor',
    label: 'Multicolor / Phenomena',
    hex: '#4ECDC4',
    shades: [
      { value: 'bi_color', label: 'Bi-color', hex: '#45B7D1' },
      { value: 'parti', label: 'Parti', hex: '#96CEB4' },
      { value: 'color_change', label: 'Color Change', hex: '#6C5CE7' },
      { value: 'chameleon', label: 'Chameleon', hex: '#00B894' },
      { value: 'play_of_color', label: 'Play-of-Color', hex: '#FF6B6B' },
      { value: 'asterism', label: 'Asterism (Star)', hex: '#A0AEC0' },
      { value: 'chatoyancy', label: "Chatoyancy (Cat's Eye)", hex: '#D4A017' },
    ],
  },
];
