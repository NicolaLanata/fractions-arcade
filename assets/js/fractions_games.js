// Fractions Arcade registry
// Keeps original activity names/icons/record keys while exposing a flat list
// compatible with the shared Adventure HQ shell.

const FRACTIONS_ARCADE_SECTIONS = [
  {
    section: "FOUNDATIONS",
    items: [
      {
        id: "fractions_primer",
        title: "Fractions Primer",
        href: "fractions_primer.html",
        icon: "🍕",
        badge: "📗",
        kind: "practice",
        desc: "Build a fraction by splitting a whole into equal parts.",
        tag: "Learn",
        bestKey: null,
        qCount: null
      },
      {
        id: "fractions_primer_distance",
        title: "Fractions on a Number Line",
        href: "fractions_primer_distance.html",
        icon: "📏",
        badge: "📗",
        kind: "practice",
        desc: "See fractions as distances from 0 to 1.",
        tag: "Learn",
        bestKey: null,
        qCount: null
      },
      {
        id: "fractions_lab",
        title: "Fractions Lab",
        href: "fractions_lab.html",
        icon: "🧪",
        badge: "🎯",
        kind: "practice",
        desc: "Practice building and recognizing fractions.",
        tag: "Practice",
        bestKey: null,
        qCount: null
      }
    ]
  },
  {
    section: "COMMON DENOMINATOR",
    items: [
      {
        id: "common_multiples",
        title: "Common Multiples",
        href: "common_multiples.html",
        icon: "🔁",
        badge: "⏱️",
        kind: "game",
        desc: "Find the smallest number that is a multiple of both.",
        tag: "Timed",
        bestKey: "common_multiples_best_v1",
        qCount: 5
      },
      {
        id: "fractions_equivalents",
        title: "Equivalent Fractions",
        href: "fractions_equivalents.html",
        icon: "♻️",
        badge: "⏱️",
        kind: "game",
        desc: "Find fractions that represent the same amount.",
        tag: "Timed",
        bestKey: "fractions_equivalents_best_v1",
        qCount: 5
      },
      {
        id: "fractions_units_remainder",
        title: "Units + Remainder",
        href: "fractions_units_remainder.html",
        icon: "🧩",
        badge: "⏱️",
        kind: "game",
        desc: "Switch between improper fractions and mixed numbers.",
        tag: "Timed",
        bestKey: "fractions_units_remainder_best_v1",
        qCount: 5
      }
    ]
  },
  {
    section: "COMPARE AND PLACE",
    items: [
      {
        id: "fractions_compare",
        title: "Compare Fractions",
        href: "fractions_compare.html",
        icon: "⚖️",
        badge: "⏱️",
        kind: "game",
        desc: "Choose <, =, or > between two fractions.",
        tag: "Timed",
        bestKey: "fractions_compare_best_v1",
        qCount: 5
      },
      {
        id: "fractions_numberline_place",
        title: "Split + Place",
        href: "fractions_numberline_place.html",
        icon: "📍",
        badge: "⏱️",
        kind: "game",
        desc: "Choose the split, then place the fraction on a line.",
        tag: "Timed",
        bestKey: "fractions_numberline_place_best_v1",
        qCount: 5
      }
    ]
  },
  {
    section: "OPERATIONS",
    items: [
      {
        id: "fractions_addition",
        title: "Add Fractions",
        href: "fractions_addition.html",
        icon: "➕",
        badge: "📘",
        kind: "practice",
        desc: "Step-by-step addition with a common denominator.",
        tag: "Tutor",
        bestKey: null,
        qCount: null
      },
      {
        id: "fractions_subtraction",
        title: "Subtract Fractions",
        href: "fractions_subtraction.html",
        icon: "➖",
        badge: "📘",
        kind: "practice",
        desc: "Step-by-step subtraction with a common denominator.",
        tag: "Tutor",
        bestKey: null,
        qCount: null
      }
    ]
  },
  {
    section: "APPLICATIONS",
    items: [
      {
        id: "decimals_primer",
        title: "Decimals Primer",
        href: "decimals_primer.html",
        icon: "🔢",
        badge: "📗",
        kind: "practice",
        desc: "Connect fractions and decimals on a number line.",
        tag: "Learn",
        bestKey: null,
        qCount: null
      },
      {
        id: "fractions_coins_equal",
        title: "Coins + Fractions: Equal?",
        href: "fractions_coins_equal.html",
        icon: "🪙",
        badge: "⏱️",
        kind: "game",
        desc: "Decide if two money amounts match.",
        tag: "Timed",
        bestKey: "fractions_coins_equal_best_v1",
        qCount: 5
      }
    ]
  }
];

const FRACTIONS_ARCADE_GAMES = FRACTIONS_ARCADE_SECTIONS.flatMap((section, sectionIndex) => {
  return section.items.map((item, itemIndex) => ({
    ...item,
    section: section.section,
    order: sectionIndex * 100 + itemIndex + 1
  }));
});

const FRACTIONS_ARCADE_ALL_ITEMS = FRACTIONS_ARCADE_GAMES;
