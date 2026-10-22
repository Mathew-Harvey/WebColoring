// All visible copy for WebColoring lives here so it can be reviewed in one place.
// Keep it short and plain. No em dashes.

export const copy = {
  appName: 'WebColoring',
  tagline: 'Pick a book. Pick a page. Colour!',
  // Used for the page title, search results and the installed app.
  metaDescription: 'Free colouring pages for kids and grown-ups. No ads, no accounts. Works offline.',
  noScript: 'WebColoring needs JavaScript to colour pages.',

  // The preview card shown when the site is shared on Facebook, WhatsApp, X and others.
  share: {
    title: 'WebColoring: free colouring pages for kids and grown-ups',
    description: 'Dragons, block towns, mandalas and machines to fill, paint and colour by numbers on any phone, tablet or computer. No ads, no accounts. Works offline.',
    imageAlt: 'A treehouse colouring page, half coloured in, next to the WebColoring name.',
    // Text drawn on the card image itself (npm run social).
    headline: 'Free colouring pages for kids and grown-ups',
    points: ['No ads', 'No accounts', 'Works offline'],
  },

  home: {
    shelfLabel: 'Your books',
    // Shown under the tagline, mostly for the grown-ups.
    promises: ['Free', 'No ads or accounts', 'Works offline'],
    kidsShelf: 'For kids',
    grownUpsShelf: 'For grown-ups',
    openBook: (title: string) => `Open ${title}`,
    pages: (n: number) => `${n} pages`,
    ages: (a: string) => `Ages ${a}`,
    forGrownUps: 'Grown-ups',
    started: (n: number) => (n === 1 ? '1 started' : `${n} started`),
    keepGoingTitle: 'Keep colouring',
    keepGoingPage: (book: string, n: number) => `${book}, page ${n}`,
  },

  // Each book's own page, /book/<id>: its search result and link preview (title, description),
  // and the heading and intro at the top of its pages. The build prerenders these
  // (vite.config.ts). A book with none here uses bookPageFallback.
  // DRAFT: to be replaced with the BookMaker copy (traffic/seo-book-pages.md).
  bookPages: {
    'blocky-builders': {
      title: 'Blocky Builders: free block town colouring pages | WebColoring',
      description:
        '30 free block town colouring pages for kids aged 6 to 10. Fill, paint or colour by numbers on any phone, tablet or computer. No ads, works offline.',
      intro:
        '30 block town pictures for kids aged 6 to 10, full of towers, bridges and busy builders. Tap to fill, paint with crayons and brushes, or colour by numbers. Free, with no ads or accounts.',
    },
    'scaly-pals': {
      title: 'Scaly Pals: free dragon colouring pages for kids | WebColoring',
      description:
        '30 free dragon colouring pages for kids aged 6 to 11. Fill, paint or colour by numbers on any phone, tablet or computer. No ads, works offline.',
      intro:
        '30 friendly dragons to colour, for kids aged 6 to 11. Tap to fill, paint with crayons and brushes, or colour by numbers. Free, with no ads or accounts.',
    },
    'still-water-mandalas': {
      title: 'Still Water Mandalas: free mandala colouring pages | WebColoring',
      description:
        '30 free mandala colouring pages for adults. Detailed designs to fill and paint online, for a calm few minutes. No ads, no accounts, works offline.',
      intro:
        '30 detailed mandalas for grown-ups, made for slow, calm colouring. Fill each part with a tap, or paint it by hand. Free, with no ads or accounts.',
    },
    'taken-apart': {
      title: 'Taken Apart: exploded view colouring pages for adults | WebColoring',
      description:
        '30 free exploded view colouring pages for adults: car engines, gramophones, cassette players, phones and drones. Colour online, no ads, works offline.',
      intro:
        'Thirty machines pulled apart piece by piece, from a 1910s car engine to drones and electric cars. Detailed exploded view drawings for grown-ups to colour. Free, with no ads or accounts.',
    },
    'kart-kingdom-racers': {
      title: 'Kart Kingdom Racers: free kart colouring pages for kids | WebColoring',
      description:
        '30 free kart racing colouring pages for kids aged 6 to 10. Fill, paint or colour by numbers on any phone, tablet or computer. No ads, works offline.',
      intro:
        'A raccoon, a frog and a bunny race their karts through mushroom lands, castles, space and the sea. 30 pictures for kids aged 6 to 10. Free, with no ads or accounts.',
    },
    'doodles-through-the-decades': {
      title: 'Doodles Through the Decades: retro colouring pages | WebColoring',
      description:
        '30 free retro doodle colouring pages for grown-ups: smileys, peace signs, cassettes, pixel art and more. Colour online, no ads, works offline.',
      intro:
        'Retro doodles from the 1950s on: atoms and boomerangs, flower power, smileys, cassettes, synthwave grids and pixel art. 30 pages for grown-ups. Free, with no ads or accounts.',
    },
    'deep-sea-friends': {
      title: 'Deep Sea Friends: free ocean colouring pages for kids | WebColoring',
      description:
        '30 free ocean colouring pages for kids aged 4 to 8: an octopus, sea turtle, whale, seahorses and a coral reef. Big, bold shapes on any phone, tablet or computer.',
      intro:
        'A grinning anglerfish lights the way to a whole sea full of friends: an octopus, a sea turtle, jellyfish, whales and a coral reef. 30 big, friendly pictures for kids aged 4 to 8. Free, with no ads or accounts.',
    },
    'aussie-bush-buddies': {
      title: 'Aussie Bush Buddies: free Australian animal colouring pages | WebColoring',
      description:
        '30 free Australian animal colouring pages for kids aged 4 to 8: a kangaroo, koala, wombat, platypus and kookaburra. Big, bold shapes on any phone, tablet or computer.',
      intro:
        "A joey peeks out of its mum's pouch, a koala hugs a gum tree and a wombat says g'day. 30 big, friendly pictures of Australian animals for kids aged 4 to 8. Free, with no ads or accounts.",
    },
  } as Record<string, { title: string; description: string; h1?: string; intro: string }>,
  // For a new book until it has its own copy above.
  bookPageFallback: (title: string, pages: number) => ({
    title: `${title}: free colouring pages | WebColoring`,
    description: `${pages} free colouring pages from ${title}, a colouring book by Mat Harvey. Colour online on any phone, tablet or computer. No ads, works offline.`,
    intro: `${pages} pictures to colour from ${title}, a colouring book by Mat Harvey. Free, with no ads or accounts.`,
  }),
  // The link preview image on a book's page.
  bookShareAlt: (title: string) => `The cover of ${title}, a colouring book by Mat Harvey`,

  // The real paperbacks. Gentle, never pushy: the site stays free either way.
  paper: {
    bannerTitle: 'Colour it on paper too',
    bannerBody: 'Every picture here comes from a real book. Some days are made for crayons, paper and no screen at all.',
    bannerButton: 'See the paper books',
    pageTitle: 'The paper books',
    pageIntro: [
      'Every picture on WebColoring comes from a real colouring book by Mat Harvey.',
      'Paper feels different. The scratch of a crayon, colours you can smudge with a thumb, a finished page for the fridge.',
      'Buying a book is what keeps WebColoring free, with no ads and no tracking. Thank you.',
    ],
    comingSoon: 'Coming soon',
    comingSoonBody: 'The paperback is on its way to Amazon.',
    available: 'Available now',
    formats: { paperback: 'Paperback' } as Record<string, string>,
    price: (format: string, price: string) => `${format}, ${price}`,
    by: (author: string) => `By ${author}`,
    buy: 'Get the paperback',
    buyHint: 'Grown-ups: hold to open Amazon',
    buyLink: 'Get the paperback on Amazon',
    opensNewTab: '(opens in a new tab)',
    pictures: (n: number) => `${n} pictures to colour`,
    ages: (a: string) => `For ages ${a}`,
    forGrownUps: 'Made for grown-ups',
    size: (s: string) => `Big ${s} pages`,
    singleSided: 'One picture per page, so markers will not bleed through',
    pickerTitle: (title: string) => `${title} on paper`,
    pickerBody: 'All of these pictures in a real book, for colouring away from the screen.',
    finished: 'Colour this one with real crayons too',
    seeBook: 'See the paper book',
    coverAlt: (title: string) => `Front cover of ${title}`,
  },

  // The footer of the home screen: Mat's other sites, as on his other sites.
  alsoBy: {
    label: 'Also by Mat Harvey',
    hint: 'Grown-ups: hold to open',
    sites: {
      gym: 'The Bodyweight Gym',
      webfpv: 'WebFPV',
      apphub: 'AppHub',
    },
  },

  picker: {
    back: 'Back',
    filterLabel: 'Show pages',
    filters: {
      all: 'All',
      easy: 'Easy',
      detailed: 'Detailed',
      cbn: 'Colour by numbers',
    },
    page: (n: number) => `Page ${n}`,
    started: 'Started',
    done: 'Done',
    empty: 'No pages here yet.',
    progress: (started: number, done: number) =>
      done ? `${started} started, ${done} finished` : started === 1 ? '1 started' : `${started} started`,
  },

  tools: {
    fill: 'Fill',
    crayon: 'Crayon',
    marker: 'Marker',
    pencil: 'Pencil',
    paintbrush: 'Brush',
    watercolour: 'Water',
    spray: 'Spray',
    glitter: 'Glitter',
    rainbow: 'Rainbow',
    neon: 'Neon',
    stamp: 'Stamp',
    eraser: 'Eraser',
    eyedropper: 'Picker',
  },

  fills: {
    solid: 'Plain',
    gradient: 'Fade',
    dots: 'Dots',
    stripes: 'Stripes',
    stars: 'Stars',
  },

  stamps: {
    star: 'Star',
    heart: 'Heart',
    block: 'Block',
    flower: 'Flower',
    smile: 'Smile',
  },

  colouring: {
    back: 'Back to pages',
    undo: 'Undo',
    redo: 'Redo',
    fit: 'Fit',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    stayInside: 'Inside',
    stayInsideOn: 'Stay inside the lines: on',
    stayInsideOff: 'Stay inside the lines: off',
    cbn: 'Numbers',
    cbnOn: 'Colour by numbers: on',
    cbnOff: 'Colour by numbers: off',
    hint: 'Hint',
    done: 'Done',
    size: 'Size',
    opacity: 'See through',
    moreColours: 'More',
    colours: 'Colours',
    skin: 'Skin',
    recent: 'Recent',
    wheel: 'Mix',
    close: 'Close',
    loading: 'Getting your page ready',
    loadError: 'This page did not load. Check your connection and try again.',
    tryAgain: 'Try again',
    canvasLabel: (n: number) => `Colouring page ${n}`,
    progress: (done: number, total: number) => `${done} of ${total} filled`,
    numberSwatch: (n: number, done: number, total: number) => `Number ${n}, ${done} of ${total} filled`,
    colourSwatch: (name: string) => name,
    tools: 'Tools',
    fillStyle: 'Fill style',
    stampShape: 'Stamp shape',
  },

  finished: {
    title: 'You did it!',
    save: 'Save picture',
    print: 'Print it',
    share: 'Share',
    keepGoing: 'Keep colouring',
    morePages: 'More pages',
    saved: 'Saved!',
  },

  grownUps: {
    open: 'Grown-ups',
    holdHint: 'Hold to open',
    title: 'For grown-ups',
    back: 'Back',
    contents: 'On this page',
    aboutTitle: 'About',
    about: [
      'WebColoring is a free colouring site for kids and grown-ups. It works on phones, tablets and computers.',
      'Every page comes from a real colouring book by Mat Harvey. You can colour them here for free.',
      'The illustrations were made with the help of AI tools.',
    ],
    privacyTitle: 'Privacy',
    privacy: [
      'Nothing leaves your device.',
      'There are no accounts, no ads, no tracking and no cookies.',
      'Pictures are saved in this browser only. Clearing your browser data will remove them.',
    ],
    booksTitle: 'The paper books',
    settingsTitle: 'Settings',
    sound: 'Sound',
    volume: 'Volume',
    haptics: 'Buzz on tap',
    hapticsUnsupported: 'This device does not buzz.',
    patterns: 'Show shapes on colour by numbers (helps with colour blindness)',
    offlineTitle: 'Use offline',
    offlineBody: 'WebColoring keeps pages you have opened. You can also save every page now.',
    offlineButton: (title: string) => `Save all of ${title} for offline`,
    offlineProgress: (done: number, total: number) => `Saving ${done} of ${total}`,
    offlineDone: 'All pages saved for offline.',
    offlineError: 'Some pages could not be saved. Try again when online.',
    backupTitle: 'Backup',
    backupBody: 'Keep a copy of all saved pictures in one file, or bring them back from a backup.',
    backupExport: 'Backup my art',
    backupImport: 'Restore from backup',
    backupDone: (n: number) => (n === 1 ? 'Restored 1 picture.' : `Restored ${n} pictures.`),
    backupEmpty: 'There are no saved pictures yet.',
    backupError: 'That file did not look like a WebColoring backup.',
    clearTitle: 'Clear saved art',
    clearBody: 'This removes every saved picture on this device.',
    clearButton: 'Clear all saved art',
    clearConfirm: 'Remove all saved pictures? This cannot be undone.',
    clearDone: 'All saved art removed.',
    creditsTitle: 'Credits',
    credits: [
      'Font: Nunito, by the Nunito Project Authors, SIL Open Font License 1.1.',
      'All sounds are made in your browser. No recordings are used.',
    ],
    version: (v: string) => `Version ${v}`,
  },

  colourNames: {
    sky: 'Sky blue',
    grass: 'Grass green',
    leaf: 'Leaf green',
    yellow: 'Sunny yellow',
    orange: 'Orange',
    red: 'Red',
    pink: 'Pink',
    purple: 'Purple',
    brown: 'Brown',
    sand: 'Sand',
    grey: 'Grey',
    blue: 'Blue',
  } as Record<string, string>,

  // Names read out for each crayon box colour.
  paletteNames: {
    red: 'Red',
    orange: 'Orange',
    amber: 'Golden yellow',
    yellow: 'Yellow',
    lime: 'Lime',
    green: 'Green',
    forest: 'Dark green',
    teal: 'Teal',
    sky: 'Sky blue',
    blue: 'Blue',
    navy: 'Navy',
    purple: 'Purple',
    violet: 'Violet',
    pink: 'Pink',
    blush: 'Light pink',
    berry: 'Berry',
    brown: 'Brown',
    chocolate: 'Dark brown',
    sand: 'Sand',
    white: 'White',
    silver: 'Light grey',
    grey: 'Grey',
    charcoal: 'Dark grey',
    black: 'Black',
    skin1: 'Skin tone 1',
    skin2: 'Skin tone 2',
    skin3: 'Skin tone 3',
    skin4: 'Skin tone 4',
    skin5: 'Skin tone 5',
    skin6: 'Skin tone 6',
    skin7: 'Skin tone 7',
    custom: 'My colour',
  } as Record<string, string>,

  misc: {
    offline: 'You are offline. Pages you opened before still work.',
    updateReady: 'A new version is ready.',
    reload: 'Update',
    notFound: 'We could not find that page.',
    notFoundBody: 'It may have moved, or the link was not quite right.',
    goHome: 'Back to the bookshelf',
    rotateTip: 'Turn your phone sideways for a bigger page',
    gotIt: 'Got it',
  },
};
