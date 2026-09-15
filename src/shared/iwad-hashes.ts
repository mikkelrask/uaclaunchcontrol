// GENERATED FILE — do not edit by hand.
// Source: tools/iwad-hashes/doom_wad_hashes.csv (94 revisions:
// 73 IWADs, 21 PWAD add-ons).
// Regenerate with: npm run sync:iwad-hashes

/** One known WAD revision, identified by its file's MD5 sum. */
export interface IKnownWad {
  /** Display name of the build, e.g. `Ultimate Doom (BFG)`. */
  name: string
  /** Identity slug — selects the built-in icon in `icons/DoomIcons.tsx`. */
  slug: string
  /** The name this build ships under, used to pick between identical copies. */
  fileName: string
  /**
   * PWAD add-on content (SIGIL, No Rest for the Living, ...). It supplies extra
   * levels for a game the player must already own, so it can never be used as
   * the base WAD of a launch.
   */
  addon?: true
}

/** MD5 sum of the WAD file -> the revision it contains. */
export const KNOWN_WADS: Record<string, IKnownWad> = {
  '90facab21eede7981be10790e3f82da2': { name: 'Doom (1.0)', slug: 'doom', fileName: 'DOOM1.WAD' },
  '52cbc8882f445573ce421fa5453513c1': {
    name: 'Doom (shareware 1.1)',
    slug: 'doom',
    fileName: 'DOOM1.WAD'
  },
  '30aa5beb9e5ebfbbe1e1765561c08f38': {
    name: 'Doom (shareware 1.2)',
    slug: 'doom',
    fileName: 'DOOM1.WAD'
  },
  '17aebd6b5f2ed8ce07aa526a32af8d99': { name: 'Doom (1.25)', slug: 'doom', fileName: 'DOOM1.WAD' },
  'a21ae40c388cb6f2c3cc1b95589ee693': { name: 'Doom (1.4)', slug: 'doom', fileName: 'DOOM1.WAD' },
  'e280233d533dcc28c1acd6ccdc7742d4': { name: 'Doom (1.5)', slug: 'doom', fileName: 'DOOM1.WAD' },
  '762fd6d4b960d4b759730f01387a50a1': { name: 'Doom (1.6)', slug: 'doom', fileName: 'DOOM1.WAD' },
  '981b03e6d1dc033301aa3095acc437ce': {
    name: 'Doom (registered 1.1)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '792fd1fea023d61210857089a7c1e351': {
    name: 'Doom (registered 1.2)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '54978d12de87f162b9bcc011676cb3c0': { name: 'Doom (1.666)', slug: 'doom', fileName: 'DOOM.WAD' },
  '11e1cd216801ea2657723abc86ecb01f': { name: 'Doom (1.8)', slug: 'doom', fileName: 'DOOM.WAD' },
  '1cd63c5ddff1bf8ce844237f580e9cf3': { name: 'Doom (1.9)', slug: 'doom', fileName: 'DOOM.WAD' },
  'c4fe9fd920207691a9f493668e0a2083': {
    name: 'Ultimate Doom (1.9)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  'fb35c4a5a9fd49ec29ab6e900572c524': {
    name: 'Ultimate Doom (BFG Edition)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '232a79f7121b22d7401905ee0ee1e487': {
    name: 'Ultimate Doom (1.0)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '21b200688d0fa7c1b6f63703d2bdd455': {
    name: 'Ultimate Doom (1.1)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '72286ddc680d47b9138053dd944b2a3d': {
    name: 'Ultimate Doom (XBLA)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '0c8758f102ccafe26a3040bee8ba5021': {
    name: 'Ultimate Doom (Xbox)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '7912931e44c7d56e021084a256659800': {
    name: 'Ultimate Doom (Xbox 360 BFG)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  'e4f120eab6fb410a5b6e11c947832357': {
    name: 'Ultimate Doom (PSN)',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  'dae77aff77a0491e3b7254c9c8401aa8': {
    name: 'Doom Pocket PC',
    slug: 'doom',
    fileName: 'DOOM.WAD'
  },
  '30e3c2d0350b67bfbf47271970b74b2f': {
    name: 'Doom II (1.666)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'd9153ced9fd5b898b36cc5844e35b520': {
    name: 'Doom II (1.666g)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'ea74a47a791fdef2e9f2ea8b8a9da13b': {
    name: 'Doom II (1.7)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'd7a07e5d3f4625074312bc299d7ed33f': {
    name: 'Doom II (1.7a)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'c236745bb01d89bbb866c8fed81b6f8c': {
    name: 'Doom II (1.8)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '3cb02349b3df649c86290907eed64e7b': {
    name: 'Doom II (1.8f)',
    slug: 'doom2',
    fileName: 'DOOM2F.WAD'
  },
  '25e1459ca71d321525f84628f45ca8cd': {
    name: 'Doom II (1.9)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'c3bea40570c23e511a7ed3ebcd9865f7': {
    name: 'Doom II (BFG Edition)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '97573aaf26957099ed45e61d81a0a1a3': {
    name: 'Doom II (Bethesda.net Original)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '9aa3cbf65b961d0bdac98ec403b832e1': {
    name: 'Doom II (Doom + Doom II)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '7895d10c281305c45a7e5f01b3f7b1d8': {
    name: 'Doom II (1.3)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '43c2df32dc6c740cb11f34dc5ab693fa': {
    name: 'Doom II (XBLA)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'a793ebcdd790afad4a1f39cc39a893bd': {
    name: 'Doom II (Xbox)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '9640fc4b2c8447bbd28f2080725d5c51': {
    name: 'Doom II (Tapwave Zodiac)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '4c3db5f23b145fccd24c9b84aba3b7dd': {
    name: 'Doom II (PS3 Classic Complete)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  'f617591a6c5d07037eb716dc4863e26b': {
    name: 'Doom II (PS3/Xbox 360 BFG)',
    slug: 'doom2',
    fileName: 'DOOM2.WAD'
  },
  '4e158d9953c79ccf97bd0663244cc6b6': {
    name: 'Final Doom: TNT Evilution (1.9)',
    slug: 'tnt',
    fileName: 'TNT.WAD'
  },
  '1d39e405bf6ee3df69a8d2646c8d5c49': {
    name: 'Final Doom: TNT Evilution (id Anthology)',
    slug: 'tnt',
    fileName: 'TNT.WAD'
  },
  'be626c12b7c9d94b1dfb9c327566b4ff': {
    name: 'Final Doom: TNT Evilution (PS3 Classic Complete)',
    slug: 'tnt',
    fileName: 'TNT.WAD'
  },
  'a6685de59ddf2c07f45deeec95296d98': {
    name: 'Final Doom: TNT Evilution (Unity)',
    slug: 'tnt',
    fileName: 'TNT.WAD'
  },
  'ad7885c17a6b9b79b09d7a7634dd7e2c': {
    name: 'Final Doom: TNT Evilution (KEX)',
    slug: 'tnt',
    fileName: 'tnt.wad'
  },
  '75c8cf89566741fa9d22447604053bd7': {
    name: 'Final Doom: Plutonia (1.9)',
    slug: 'plutonia',
    fileName: 'PLUTONIA.WAD'
  },
  '3493be7e1e2588bc9c8b31eab2587a04': {
    name: 'Final Doom: Plutonia (id Anthology)',
    slug: 'plutonia',
    fileName: 'PLUTONIA.WAD'
  },
  'b77ca6a809c4fae086162dad8e7a1335': {
    name: 'Final Doom: Plutonia (PS3 Classic Complete)',
    slug: 'plutonia',
    fileName: 'PLUTONIA.WAD'
  },
  '0b381ff7bae93bde6496f9547463619d': {
    name: 'Final Doom: Plutonia (Unity)',
    slug: 'plutonia',
    fileName: 'PLUTONIA.WAD'
  },
  'e47cf6d82a0ccedf8c1c16a284bb5937': {
    name: 'Final Doom: Plutonia (KEX)',
    slug: 'plutonia',
    fileName: 'plutonia.wad'
  },
  '713c5a3c1734b1d55b2813a3dd0136d9': {
    name: 'Doom (Legacy of Rust)',
    slug: 'doom',
    fileName: 'id1.wad'
  },
  'fc7eab659f6ee522bb57acc1a946912f': {
    name: 'Heretic (shareware beta 1.0)',
    slug: 'heretic',
    fileName: 'HERETIC1.WAD'
  },
  '023b52175d2f260c3bdc5528df5d0a8c': {
    name: 'Heretic (shareware 1.0)',
    slug: 'heretic',
    fileName: 'HERETIC1.WAD'
  },
  'ae779722390ec32fa37b0d361f7d82f8': {
    name: 'Heretic (shareware 1.2)',
    slug: 'heretic',
    fileName: 'HERETIC1.WAD'
  },
  '3117e399cdb4298eaa3941625f4b2923': {
    name: 'Heretic (registered 1.0)',
    slug: 'heretic',
    fileName: 'HERETIC.WAD'
  },
  '1e4cb4ef075ad344dd63971637307e04': {
    name: 'Heretic (registered 1.2)',
    slug: 'heretic',
    fileName: 'HERETIC.WAD'
  },
  '66d686b1ed6d35ff103f15dbd30e0341': {
    name: 'Heretic (1.3)',
    slug: 'heretic',
    fileName: 'HERETIC.WAD'
  },
  '9178a32a496ff5befebfe6c47dac106c': {
    name: 'Hexen (demo beta unnumbered)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  '876a5a44c7b68f04b3bb9bc7a5bd69d6': {
    name: 'Hexen (demo 1.0)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  'c88a2bb3d783e2ad7b599a8e301e099e': {
    name: 'Hexen (registered beta unnumbered)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  'b2543a03521365261d0a0f74d5dd90f0': {
    name: 'Hexen (registered 1.0)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  'abb033caf81e26f12a2103e1fa25453f': { name: 'Hexen (1.1)', slug: 'hexen', fileName: 'HEXEN.WAD' },
  'b68140a796f6fd7f3a5d3226a32b93be': {
    name: 'Hexen (1.1-based)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  '925f9f5000e17dc84b0a6a3bed3a6f31': {
    name: 'Hexen (Macintosh demo 1.0)',
    slug: 'hexen',
    fileName: 'HEXEN.WAD'
  },
  'a66ae0448436a990b3aecd018bc2708a': { name: 'Hexen (2.1)', slug: 'hexen', fileName: 'HEXEN.WAD' },
  '1ac69f8f51de55452bf853831c017aec': { name: 'Hexen (2.2)', slug: 'hexen', fileName: 'HEXEN.WAD' },
  'ff3f090163719f8ecb1060886027dcd4': { name: 'Hexen (2.3)', slug: 'hexen', fileName: 'HEXEN.WAD' },
  '1077432e2690d390c256ac908b5f4efa': {
    name: 'Hexen: Deathkings of the Dark Citadel (1.0)',
    slug: 'hexen-deathkings',
    fileName: 'HEXDD.WAD'
  },
  '78d5898e99e220e4de64edaa0e479593': {
    name: 'Hexen: Deathkings of the Dark Citadel (1.1)',
    slug: 'hexen-deathkings',
    fileName: 'HEXDD.WAD'
  },
  '2bb0f56ab1f98000990524c1b67e8759': {
    name: 'Hexen: Deathkings of the Dark Citadel (2.1)',
    slug: 'hexen-deathkings',
    fileName: 'HEXDD.WAD'
  },
  'c078b329f53378044b8fc28d60db8e51': {
    name: 'Hexen: Deathkings of the Dark Citadel (2.2)',
    slug: 'hexen-deathkings',
    fileName: 'HEXDD.WAD'
  },
  '25485721882b050afa96a56e5758dd52': {
    name: 'Chex Quest (1996-10-31)',
    slug: 'chex',
    fileName: 'CHEX.WAD'
  },
  'f428a9a226f143a01b5782af611a83dd': {
    name: 'Chex Quest (1996-10-28)',
    slug: 'chex',
    fileName: 'DOOM.WAD'
  },
  'fdc4ffa57e1983e30912c006284a3e01': {
    name: 'Chex Quest 2 (1997)',
    slug: 'chex2',
    fileName: 'CHEX2.WAD'
  },
  '59c985995db55cd2623c1893550d82b3': {
    name: 'Chex Quest 3 (1.0)',
    slug: 'chex3',
    fileName: 'CHEX3.WAD'
  },
  'bce163d06521f9d15f9686786e64df13': {
    name: 'Chex Quest 3 (1.4)',
    slug: 'chex3',
    fileName: 'CHEX3.WAD'
  },
  '967d5ae23daf45196212ae1b605da3b0': {
    name: 'Doom II (No Rest for the Living BFG Edition)',
    slug: 'doom2',
    fileName: 'NERVE.WAD',
    addon: true
  },
  '4214c47651b63ee2257b1c2490a518c9': {
    name: 'Doom II (No Rest for the Living Unity)',
    slug: 'doom2',
    fileName: 'NERVE.WAD',
    addon: true
  },
  '23422eb42833ac7b0dd59c0c7ae18a6f': {
    name: 'Doom II (No Rest for the Living KEX)',
    slug: 'doom2',
    fileName: 'nerve.wad',
    addon: true
  },
  'f53ffc4fb89e966839bb8d20c632819a': {
    name: 'SIGIL (SIGIL 1.0)',
    slug: 'sigil',
    fileName: 'SIGIL.wad',
    addon: true
  },
  '1fe9daa0e837c7452eb2f91aac2cc983': {
    name: 'SIGIL (SIGIL 1.1)',
    slug: 'sigil',
    fileName: 'SIGIL.wad',
    addon: true
  },
  '427ca995600970abcd2efcc684a64c88': {
    name: 'SIGIL (SIGIL 1.2)',
    slug: 'sigil',
    fileName: 'SIGIL_v1_2.wad',
    addon: true
  },
  '743d6323cb2b9be24c258ff0fc350883': {
    name: 'SIGIL (SIGIL 1.21)',
    slug: 'sigil',
    fileName: 'SIGIL_v1_21.wad',
    addon: true
  },
  'edd5c3dfd3fb1c981cf7390c5c14454e': {
    name: 'SIGIL (SIGIL 1.23)',
    slug: 'sigil',
    fileName: 'SIGIL_V1_23.wad',
    addon: true
  },
  '25c5835ec5352c9587440b7403ff6e8f': {
    name: 'SIGIL (1.23 Registered)',
    slug: 'sigil',
    fileName: 'SIGIL_V1_23_REG.wad',
    addon: true
  },
  '08ee05388c137db5f5d7996e89425b95': {
    name: 'SIGIL (KEX)',
    slug: 'sigil',
    fileName: 'sigil.wad',
    addon: true
  },
  'a775262ca0e423468196803b71a57a43': {
    name: 'SIGIL (Compatible 1.0)',
    slug: 'sigil',
    fileName: 'SIGIL_COMPAT.wad',
    addon: true
  },
  'c04912beab6aa82c114a19c976ec8c0d': {
    name: 'SIGIL (Compatible 1.1)',
    slug: 'sigil',
    fileName: 'SIGIL_COMPAT.wad',
    addon: true
  },
  '9285e9cc2dbd87d238baab37d700c644': {
    name: 'SIGIL (Compatible 1.2)',
    slug: 'sigil',
    fileName: 'SIGIL_COMPAT_v1_2.wad',
    addon: true
  },
  '573f3f178c76709f512089ed15484391': {
    name: 'SIGIL (Compatible 1.21)',
    slug: 'sigil',
    fileName: 'SIGIL_COMPAT_v1_21.wad',
    addon: true
  },
  'e4c5ab58e226bfcc8761f35204aeb3fc': {
    name: 'SIGIL (Compatible 1.23)',
    slug: 'sigil',
    fileName: 'SIGIL_COMPAT_V1_23.wad',
    addon: true
  },
  '94cd9ea558989c1eb681d5f02a2fe47e': {
    name: 'SIGIL (Unity)',
    slug: 'sigil',
    fileName: 'SIGIL.wad',
    addon: true
  },
  'b424dcf46ae55a496c34ac37cce32646': {
    name: 'SIGIL (SIGIL Buckethead Music)',
    slug: 'sigil',
    fileName: 'SIGIL_SHREDS.wad',
    addon: true
  },
  '343faa815928c58faa08939a4502d5d2': {
    name: 'SIGIL (SIGIL Buckethead Music Compatible)',
    slug: 'sigil',
    fileName: 'SIGIL_SHREDS_COMPAT.wad',
    addon: true
  },
  'd0442f5a75f2faef3405c09a0c3acc58': {
    name: 'SIGIL II (SIGIL II 1.0)',
    slug: 'sigil2',
    fileName: 'SIGIL_II_V1_0.WAD',
    addon: true
  },
  '953f65cf079d0ba9a25be2c407da7ec1': {
    name: 'SIGIL II (KEX)',
    slug: 'sigil2',
    fileName: 'sigil2.wad',
    addon: true
  },
  '732fb8f9c470e857189c206a9279af74': {
    name: 'SIGIL II (THORR Music 1.0)',
    slug: 'sigil2',
    fileName: 'SIGIL_II_MP3_V1_0.WAD',
    addon: true
  }
}

const KNOWN_WAD_NAMES = new Set(Object.values(KNOWN_WADS).map((wad) => wad.name))

/** Identifies a WAD file by MD5 sum. Unknown content returns undefined. */
export function identifyWadByHash(md5: string): IKnownWad | undefined {
  return KNOWN_WADS[md5.toLowerCase()]
}

/**
 * True when `name` is a name this table produced, i.e. an auto-generated one
 * rather than something the user typed into Settings.
 */
export function isKnownWadName(name: string): boolean {
  return KNOWN_WAD_NAMES.has(name)
}
