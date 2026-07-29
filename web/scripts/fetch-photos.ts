/**
 * C6 — cricketer faces from Wikimedia Commons, keyed on our stored Cricinfo IDs
 * via Wikidata (P2698 Cricinfo player ID → P18 image). CC/PD-licensed only, with
 * attribution written to public/players/CREDITS.md. Never hotlinks or scrapes
 * Cricinfo/Getty. Idempotent: re-runs skip already-downloaded faces.
 *
 *   npx tsx scripts/fetch-photos.ts [--limit N]
 *
 * Outputs:
 *   public/players/<playerId>.jpg   downloaded thumbnails (free-licensed)
 *   public/players/CREDITS.md       attribution table
 *   gen/photos.json                 { playerId: filename } manifest for the app
 */
import Database from "better-sqlite3";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_PATH = join(ROOT, "data", "gitcric.db");
const PEOPLE_CSV = join(ROOT, "data", "raw", "people.csv");

/**
 * Bridge: Wikidata's P2698 ("ESPNcricinfo playing ID") actually matches the
 * Cricsheet register's `key_cricketarchive` column value — verified against
 * Kohli/Tendulkar/Warner/Rohit/Bumrah — NOT `key_cricinfo`. So we key photos on
 * the register's cricketarchive id, looked up by our player id (= register
 * identifier).
 */
function loadCricketArchiveIds(): Map<string, string> {
  const text = readFileSync(PEOPLE_CSV, "utf8").split(/\r?\n/);
  const header = text[0].split(",");
  const idCol = header.indexOf("identifier");
  const caCol = header.indexOf("key_cricketarchive");
  const map = new Map<string, string>();
  for (let i = 1; i < text.length; i++) {
    const c = text[i].split(",");
    const id = c[idCol]?.trim();
    const ca = c[caCol]?.trim();
    if (id && ca) map.set(id, ca);
  }
  return map;
}
const PHOTO_DIR = join(__dirname, "..", "public", "players");
const GEN = join(__dirname, "..", "gen");

/**
 * Wikimedia's User-Agent policy wants a UA that identifies the tool AND offers
 * a way to contact whoever runs it. The old value named "github.com/gitcric",
 * which is not a real repository and carries no contact, and Wikimedia
 * throttled it hard: upload.wikimedia.org returned 429 for this UA while the
 * same request from a compliant one returned 200. That was the cause of the
 * download failures in the Phase 2A batch, not request volume.
 */
const UA = "GitCric/1.1 (https://github.com/bhabishnu/gitcric; cricketer identity photo build; non-commercial)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
/** Re-download even when the file already exists (for a width/quality upgrade). */
const REFETCH = process.argv.includes("--refetch");
/** `--only id,id` restricts the run to specific player ids — for iterating on a
 *  single override without touching the other 300+ faces. */
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1].split(",").map((s) => s.trim())) : null;

/**
 * Requested thumbnail width. Was 500, which capped EVERY face at 500px even when
 * Commons held a far larger original — the card's portrait zone is ~460 CSS px
 * wide, i.e. ~920 device px on a retina screen, so 500px was being upscaled ~1.8x
 * and read as blur. 1000 covers the retina case with no meaningful waste;
 * Commons returns the original when it is smaller than this.
 */
const THUMB_W = 1000;
/** Re-encode quality. Commons thumbs are generously encoded; 80 (mozjpeg) keeps
 *  these visually identical at roughly half the bytes, which matters at 300+. */
const JPEG_Q = 80;

/**
 * Per-player overrides, keyed by OUR player id — they beat the Wikidata P18
 * pick, which is sometimes an action/stadium shot rather than a face.
 * Attribution is unaffected: these run through the same commonsInfo() lookup,
 * so CREDITS.json / CREDITS.md pick up the new author and licence themselves.
 */
const PHOTO_OVERRIDES: Record<string, string> = {
  // Wikidata's pick is 190x260 at ORIGINAL — nothing to re-fetch, it is simply
  // a tiny file. This one is a sun-hat head-shot, eyes visible, 1265x1273.
  // Head-and-shoulders in the India sun-hat, face clear. The batting action
  // shots ("Tendulkar batting against Australia, October 2010 (1)" and its
  // cropped sibling) were trialled and REJECTED: landscape sources lose 27-47%
  // of their width to the portrait crop, and he is helmeted and head-down, so
  // no face survives. Do not re-try them.
  d2c2b2d5: "Sachin Tendulkar cropped.jpg", // SR Tendulkar
  // Wikidata's pick is a wide stadium shot: full body at the crease, helmeted,
  // crowd + hoarding. The card crops to the upper-centre, so it showed crowd.
  a343262c: "Joe Root HIP1487 (cropped).jpg", // JE Root
  // Stored file was 117x133 — unusably small.
  "70b37e7b": "Graham Gooch OBE (3494096746).jpg", // GA Gooch
  // Wikidata's pick is a good face but sits so low that the name plate clips
  // his chin, and no crop can fix it (the cover-scale is width-driven, so a
  // shorter source only pulls the window up). This one frames higher.
  "4ba44e19": "MUTTIAH MURALITHARAN (5155181205).jpg", // M Muralitharan

  // ── Phase 2A: 33 vetted replacements for low-quality stored photos ────────
  // Selection was NOT filename-based — that approach proposed a bronze statue
  // for Ponting, a TV camera in front of Dhawan's face, and (worst) Ravindra
  // Jadeja's wife Rivaba. Each entry below was face-detected (YuNet), scored on
  // where the face lands in the card's real crop, identity-checked against the
  // player's previous photo (SFace cosine >= 0.36), and finally eyeballed.
  // Full record: web/photo-phase2a-proposals.json / -review.html.
  "271f83cd": "Suryakumar Yadav in PMO New Delhi.jpg", // SA Yadav
  db584dad: "CHRIS GAYLE (4338758231).jpg", // CH Gayle
  "6b71e6cf": "KUMAR SANGAKKARA (5155171149).jpg", // KC Sangakkara
  b8d490fd: "AARON FINCH (6299558883).jpg", // AJ Finch
  "6a26221c": "Aiden Markram interview after WTC final 2025 (cropped).png", // AK Markram
  abb83e27: "2 05 Bairstow out.jpg", // JM Bairstow
  a757b0d8: "Kieron Pollard.jpg", // KA Pollard
  "0a476045": "SHIKHAR DHAWAN (16005494418).jpg", // S Dhawan
  // KS Williamson deliberately has NO override. "Kane Williamson.jpg" was
  // trialled and REVERTED: at 450x386 it fell below the card's ~920 device-px
  // retina need and turned a portrait source (0.65) into a landscape one
  // (1.17). The automatic P18 pick, "Kane Williamson in 2019.jpg", is the
  // better card image. Do not re-add it.
  "7dc35884": "Shakib Al Hasan (2).jpg", // Shakib Al Hasan
  de8cce37: "VVSLaxman.jpg", // VVS Laxman
  "3fb19989": "Mitchell Starc fielding 2021 (cropped).jpg", // MA Starc
  "495d42a5": "Ravichandran Ashwin (2).jpg", // R Ashwin
  fe93fd9d: "Ravindra Jadeja in PMO New Delhi.jpg", // RA Jadeja
  c03f1114: "Dinesh.Karthik.jpg", // KD Karthik
  "2254ab79": "Sarfaraz Ahmed answering RAPID FIRE questions (PCB) 02.jpg", // Sarfraz Ahmed
  "8cf9814c": "Mohammed Shami bowling against England at Edgbaston.jpg", // Mohammed Shami
  a94e08ea: "Mushfiqur Rahim 2018 (cropped).jpg", // Mushfiqur Rahim
  "9cb8d7a6": "Imad Wasim 1.jpg", // Imad Wasim
  "96a6a7ad": "Nathan Lyon The Test clip.png", // NM Lyon
  "53597be1": "Cricket at Lord's (17165108401) (Brendon Taylor cropped).jpg", // BRM Taylor
  "00ea847a": "2 38 Agarwal mugshot.jpg", // MA Agarwal
  "40c041ea": "4 12 Imam-ul-Haq mugshot.jpg", // Imam-ul-Haq
  cc1e8c68: "Umesh Yadav (2).jpg", // UT Yadav
  "45a7e761": "Shaheen Afridi jogging Sri Lanka vs Pakistan - 2nd TEST Match - SSC, Colombo (cropped).jpg", // Shaheen Shah Afridi
  "7147f314": "Sabbir Rahman 2016 (cropped).jpg", // Sabbir Rahman
  "5bb1a1c4": "Ishant Sharma 2.JPG", // I Sharma
  "755a77c6": "4 02 Gary Ballance.jpg", // GS Ballance
  c16d2e28: "Steve Harmison bowl.jpg", // SJ Harmison
  "10a91f35": "Shoaib Akhtar in 2014 (cropped).jpg", // Shoaib Akhtar
  bbd41817: "Andre Russell (2).jpg", // AD Russell
  "5a37ec26": "Monty Panesar (2014) (02).jpg", // MS Panesar
  ef18b66e: "Taskin Ahmed at Chef's Table.png", // Taskin Ahmed

  // ── Phase 2B: photos for players who were on the monogram fallback ────────
  // 208 picks approved from the four review pages. Candidates came only
  // from each player's own Wikidata image or their own Commons category; where a
  // category held several photos the face recurring across them was taken as the
  // player, so group shots resolve to the right person. Each was rendered through
  // the card's real crop and eyeballed before approval.
  //
  // 15 further proposals are deliberately ABSENT pending confirmation — they were
  // same-name matches on a different person (an architect, an Oklahoma politician,
  // Asif Ali Zardari, a Taliban minister, an FC St. Pauli footballer) or two-person
  // photos where the player's face could not be told from the other's.
  "126e56a1": "Wasim Akram WWC.jpg", // Wasim Akram · B1 · tier A
  "hist:viv-richards": "Viv Richards.jpg", // Viv Richards · B1 · tier B
  "622dee94": "Steve Waugh (6529451409).jpg", // SR Waugh · B1 · tier A
  "b410bd3d": "Sandeep Lamichhane in 2018.png", // S Lamichhane · B1 · tier B
  "5f547c8b": "Rashid Khan.jpg", // Rashid Khan · B1 · tier A
  "hist:curtly-ambrose": "CURTLEY AMBROSE AND GRAHAM GOOCH (2876068345).jpg", // Curtly Ambrose · B1 · tier B
  "hist:allan-border": "ALLAN BORDER (6299581573).jpg", // Allan Border · B1 · tier B
  "4f629497": "New Zealand cricket team, Shoaib Malik, Dunedin, NZ, 2009 (cropped).jpg", // SE Bond · B1 · tier C
  "hist:kapil-dev": "Kapil Dev at Equation sports auction.jpg", // Kapil Dev · B1 · tier B
  "752f7486": "Ishan Kishan.jpg", // Ishan Kishan · B1 · tier C
  "hist:courtney-walsh": "Courtney Walsh (1).jpg", // Courtney Walsh · B1 · tier B
  "hist:sunil-gavaskar": "Sunil Gavaskar BH.jpg", // Sunil Gavaskar · B1 · tier B
  "hist:dennis-lillee": "Dennis Keith Lillee (8121209028).jpg", // Dennis Lillee · B1 · tier B
  "hist:mahela-jayawardene": "Mahela Jayawardene 3.JPG", // Mahela Jayawardene · B1 · tier B
  "hist:javed-miandad": "Cricket Nederland tegen Pakistan Javed Miomdaal van Pakistan aan bat, achter he, Bestanddeelnr 929-8094.jpg", // Javed Miandad · B1 · tier C
  "hist:ian-botham": "Sky Team.jpg", // Ian Botham · B1 · tier C
  "hist:richard-hadlee": "Sir Richard Hadlee Fill the Basin for Christchurch.jpg", // Richard Hadlee · B1 · tier B
  "1dc12ab9": "Suresh Raina.jpg", // SK Raina · B2 · tier A
  "b17e2f24": "LOKESH RAHUL-15573141953 (cropped).JPG", // KL Rahul · B2 · tier B
  "e798611a": "Hashim Amla.jpg", // HM Amla · B2 · tier A
  "1777c020": "Fakhar Zaman, Pakistan vs Sri Lanka, 1st ODI, 2017.jpg", // Fakhar Zaman · B2 · tier B
  "eade4650": "DarylMitchellEmmysSept09.jpg", // DJ Mitchell · B2 · tier B (full-name match)
  "b4b99816": "Shubman Gill.jpg", // Shubman Gill · B2 · tier B
  "48a1d7b7": "Shimron Hetmyer.jpg", // SO Hetmyer · B2 · tier B
  "4c61a0f9": "Hayley and Nathan Bracken (6640177185).jpg", // NW Bracken · B2 · tier B
  "989889ff": "20251224 Josh Inglis 01.jpg", // JP Inglis · B2 · tier B
  "e62dd25d": "Rabada.jpg", // K Rabada · B2 · tier A
  "8d2c70ad": "Kuldeep Yadav in PMO New Delhi.jpg", // Kuldeep Yadav · B2 · tier B
  "d8906a73": "Waqar younis.jpg", // Waqar Younis · B2 · tier A
  "fa433be6": "20251224 Marnus Labuschagne 01.jpg", // M Labuschagne · B2 · tier A
  "ea42ddb9": "Trescothick misfield.JPG", // ME Trescothick · B2 · tier C
  "ba5e1069": "Rachin Ravindra.jpg", // R Ravindra · B2 · tier C
  "12bffe91": "Tsotsobe.jpg", // LL Tsotsobe · B2 · tier A
  "81c36ee9": "Marco Jansen 2022.jpg", // M Jansen · B2 · tier B
  "e824e6ee": "U.S. Rep. Tom Latham, R-Ames (4100119599).jpg", // TWM Latham · B2 · tier B (full-name match)
  "59ea70a4": "Harry Tector 2022.jpg", // HT Tector · B2 · tier B
  "fd835ab3": "David Hussey 2.jpg", // DJ Hussey · B2 · tier B
  "0a8fce53": "Mustafizur Rahman on practice field in Dhaka on 2018 (1) (cropped).jpg", // Mustafizur Rahman · B2 · tier B
  "2f49c897": "Mohammed.siraj.jpg", // Mohammed Siraj · B2 · tier B
  "9e52a414": "Towhid Hridoy.jpg", // Towhid Hridoy · B2 · tier B
  "33085ffb": "3 27 Dean Elgar mugshot.jpg", // D Elgar · B2 · tier A
  "29e95537": "Ajinkya Rahane 2016.jpg", // AM Rahane · B2 · tier B
  "8afe73e2": "1 52 Young faces Rauf (cropped).jpg", // WA Young · B2 · tier C
  "c03449e0": "Grant Elliott.jpg", // GD Elliott · B2 · tier B
  "03521fd3": "Henry Nicholls double century 2023-03-18.jpg", // HM Nicholls · B2 · tier C (full-name match)
  "ccdd8308": "The England Cricket Team Ashes 2015 (finn cropped).jpg", // ST Finn · B2 · tier B
  "f19ccfad": "Washington Sundar 2.jpg", // Washington Sundar · B2 · tier C
  "2498e163": "James Hopes.jpg", // JR Hopes · B2 · tier B
  "a8e3170f": "Mohammad Irfan 03.jpg", // Mohammad Irfan · B2 · tier B
  "84826f48": "Niall O'Brien with ICL.jpg", // NJ O'Brien · B2 · tier C
  "9de62878": "Shadab Khan.png", // Shadab Khan · B2 · tier C
  "24bb1c2f": "1 53 Haris Rauf.jpg", // Haris Rauf · B2 · tier B
  "5fbe14fc": "Imrul Kayes (2).jpg", // Imrul Kayes · B2 · tier B
  "7d5af2ea": "Kraigg Brathwaite batting at Perth Stadium, First Test Australia versus West Indies, 2 December 2022 06.jpg", // KC Brathwaite · B2 · tier C
  "244048f6": "Prime Minister Of Bharat Shri Narendra Damodardas Modi with Arshdeep Singh Family (Cropped).jpg", // Arshdeep Singh · B2 · tier B
  "1747ea18": "Dsairee.jpg", // DS Airee · B3 · tier B
  "e3386c8a": "Kushal-bhurtel.jpg", // K Bhurtel · B3 · tier B
  "3c6ffae8": "Yusuf Pathan.jpg", // YK Pathan · B3 · tier B
  "b0482a1d": "Tilak Varma in March 2026.png", // Tilak Varma · B3 · tier B
  "06cad4f0": "Alishan sharafu 007.jpg", // A Sharafu · B3 · tier C (full-name match)
  "a4e37e47": "Shivam Dube in PMO New Delhi.jpg", // S Dube · B3 · tier B
  "23638956": "Simon Harmer.jpg", // SR Harmer · B3 · tier B
  "6c19c6e5": "Yashasvi Jaiswal in PMO New Delhi.jpg", // YBK Jaiswal · B3 · tier B
  "7e9f1cde": "Kushal-malla-4.jpg", // Kushal Malla · B3 · tier C
  "a3bfec5d": "Stuart clark closeup.jpg", // SR Clark · B3 · tier C
  "78adc879": "2 37 Neil Wagner.jpg", // N Wagner · B3 · tier B
  "d167edd3": "260329 D4 Scott Boland 01.jpg", // SM Boland · B3 · tier A
  "45eda7c8": "Chris lynn 2018.jpg", // CA Lynn · B3 · tier C
  "e03b66ec": "MOHAMMAD ASIF (4246253787).jpg", // Mohammad Asif · B3 · tier A
  "6a71ba3a": "Michael Levitt (50372828237).jpg", // M Levitt · B3 · tier B (full-name match)
  "94198ef4": "Justin Langer Portrait.jpg", // JL Langer · B3 · tier A
  "e66732f8": "2 40 Ryan Rickleton.jpg", // RD Rickelton · B3 · tier B
  "94eac556": "Clint McKay.jpg", // CJ McKay · B3 · tier A
  "aa8d28ae": "DAVID WIESE (15702924581).jpg", // D Wiese · B3 · tier B
  "5b8c830e": "Krunal Pandya and Hardik Pandya.jpg", // KH Pandya · B3 · tier C
  "72e60730": "Assad Vala.png", // A Vala · B3 · tier B
  "e94bc520": "Ollie Pope.jpg", // OJ Pope · B3 · tier C
  "df1f2f29": "2 51 Farhan Ahmed.jpg", // Fiaz Ahmed · B3 · tier C (full-name match)
  "0f3ee070": "Ollie Robinson, 2023 (cropped).jpg", // OE Robinson · B3 · tier B
  "a72b14ff": "Chris Tremlett, 2009 Friends Provident Trophy final, Lord's.jpg", // CT Tremlett · B3 · tier C
  "c89474d1": "Tim Murtagh.jpg", // TJ Murtagh · B3 · tier B
  "dc0f5506": "Hoggy & Strauss at the Brabourne.jpg", // MJ Hoggard · B3 · tier B
  "f28a60e0": "SaadBinZafarDisplay.jpg", // Saad Bin Zafar · B3 · tier B
  "9caf69a1": "4 20 Will Jacks.jpg", // WG Jacks · B3 · tier C (full-name match)
  "49b6c09f": "James Tredwell playing cricket.jpg", // JC Tredwell · B3 · tier C
  "7a8bd078": "Rajasthan Royals player Shreyas Gopal in a post-match presentation during 2019 Indian Premier League.png", // S Gopal · B3 · tier B
  "922e1b19": "1 03 Zak Crawley (cropped).jpg", // Z Crawley · B3 · tier B
  "c834c290": "3 48 Jamie Smith.jpg", // JL Smith · B3 · tier B
  "84212ffb": "Janith Liyanage batting debut.jpg", // J Liyanage · B3 · tier C
  "c654af19": "RYAN MCLAREN (15519878577).jpg", // R McLaren · B3 · tier B
  "32198ae0": "Moises' Henriques NSW.jpg", // MC Henriques · B3 · tier A
  "23eeb873": "Deepak Chahar.jpg", // DL Chahar · B3 · tier B
  "d8360178": "Chris Rogers.jpg", // CJL Rogers · B3 · tier B
  "9d84d41d": "Haynes Gough.jpg", // DL Haynes · B3 · tier C
  "cb9b8664": "2 14 Will O'Rourke mugshot.jpg", // W O'Rourke · B3 · tier B
  "c3b93a03": "Jermaine Blackwood batting and Cameron Green bowling at Perth Stadium, First Test Australia versus West Indies, 2 December 2022 04.jpg", // J Blackwood · B3 · tier C
  "fcbf5a30": "Darren Gough portrait.jpg", // D Gough · B3 · tier A
  "60dac349": "STUART MACGILL.jpg", // SCG MacGill · B3 · tier A
  "addfb70e": "Shan Tait.jpg", // SW Tait · B3 · tier B
  "6843a783": "1 26 Shan Masood.jpg", // Shan Masood · B3 · tier A
  "18fac429": "1 51 Samit.jpg", // SR Patel · B3 · tier A
  "9b4935c8": "CALLUM FERGUSON (6319486691).jpg", // CJ Ferguson · B3 · tier A
  "c374f37f": "Cricket at Lord's (17165108401).jpg", // JWA Taylor · B3 · tier C
  "a8e56914": "Duanne Olivier 2019.jpg", // D Olivier · B3 · tier C
  "03252e44": "Phil Jaques (cropped).jpg", // PA Jaques · B3 · tier A
  "d07c1b2f": "1 37 Saud Shakeel.jpg", // Saud Shakeel · B3 · tier C
  "1adb8ee8": "Sompal Kami Cricketer.jpg", // Sompal Kami · B3 · tier B
  "619aa81f": "Wasim jafar With Rashid Zirak.jpg", // W Jaffer · B3 · tier A
  "feb37330": "With moin khan.jpg", // Moin Khan · B3 · tier B
  "8ea6e670": "Nathan Hauritz 2.jpg", // NM Hauritz · B3 · tier B
  "a48fc79d": "Ed Joyce 2007 cropped.jpg", // EC Joyce · B3 · tier B
  "74d12124": "Justin Greaves.jpg", // JP Greaves · B3 · tier C (full-name match)
  "6020a3c6": "Keacy Carty.jpg", // KU Carty · B3 · tier C (full-name match)
  "3987e390": "Jack Leach.jpg", // MJ Leach · B3 · tier B
  "45a43fe2": "Ruturaj Gaikwad.jpeg", // RD Gaikwad · B3 · tier B
  "348195ea": "Jefferson and Flower.jpg", // GW Flower · B3 · tier C
  "c404f58a": "Dirk nannes.jpg", // DP Nannes · B3 · tier B
  "33f28243": "Rana Naved Ul Hassan 1.jpg", // Naved-ul-Hasan · B3 · tier A
  "3eb7c45d": "Imran Nazir (02).jpg", // Imran Nazir · B3 · tier C
  "aad0c365": "Nitish Kumar Reddy BGT 2024 (cropped) 2.jpg", // Nithish Kumar Reddy · B3 · tier B
  "a830c083": "Neil McKenzie 2.jpg", // ND McKenzie · B3 · tier B
  "3540beff": "Stephen O'Keefe.jpg", // SNJ O'Keefe · B3 · tier A
  "f5f18a18": "SURAJ RANDIV (5155795898).jpg", // S Randiv · B3 · tier B
  "0be1b885": "DANISH KANERIA (4246120363).jpg", // Danish Kaneria · B3 · tier A
  "a354c917": "Neil Broom.jpg", // NT Broom · B3 · tier A
  "78f34e15": "Iain O'Brien, Dunedin, NZ, 2009 1.jpg", // IE O'Brien · B3 · tier A
  "d32782ae": "Rashid Latif (1).jpg", // Rashid Latif · B3 · tier A
  "bd17b45f": "Stuart Binny (2019).jpg", // STR Binny · B3 · tier B
  "0994d0ae": "Vijay Shankar 4.jpg", // V Shankar · B3 · tier B
  "26e5cabf": "Manoj Tiwary 2.jpg", // MK Tiwary · B3 · tier B
  "502b2c81": "XAVIER DOHERTY (3071566113).jpg", // XJ Doherty · B3 · tier B
  "7ee2ce62": "Vikram Solanki.jpg", // VS Solanki · B3 · tier B
  "79aad751": "Lakshan Sandakan.jpg", // PADLR Sandakan · B3 · tier B (full-name match)
  "59ddd811": "Nkrumah Bonner batting at Perth Stadium, First Test Australia versus West Indies, 2 December 2022 02.jpg", // NE Bonner · B3 · tier C
  "43936951": "DARYL TUFFEY (11914123155).jpg", // DR Tuffey · B3 · tier A
  "99464591": "Marcus North (5108060986).jpg", // MJ North · B3 · tier B
  "dadbdb68": "1 01 Jacob Duffy.jpg", // JA Duffy · B3 · tier B (full-name match)
  "37654b75": "Nasum Ahmed on 2022.png", // Nasum Ahmed · B3 · tier C
  "fd093ca9": "PAUL HARRIS (3194655079).jpg", // PL Harris · B3 · tier A
  "29e8a62e": "3 27 Rory Burns.jpg", // RJ Burns · B3 · tier C
  "f76ffa81": "Nasser Hussain.JPG", // N Hussain · B3 · tier C
  "818e8bf2": "Somerset bowlers warming up.JPG", // ID Blackwell · B3 · tier C
  "1e66c162": "2 09 Jaydev Unadkat 1.jpg", // JD Unadkat · B3 · tier C
  "749a1b3a": "Brendan Nash.jpg", // BP Nash · B3 · tier C
  "a15aaa7f": "Ambrose, Tim.JPG", // TR Ambrose · B3 · tier C
  "fee3c48a": "Ed Cowan.jpg", // EJM Cowan · B3 · tier B
  "894b2d25": "2 14 Matthew Potts mugshot.jpg", // MJ Potts · B3 · tier B
  "8479a24a": "Keaton Jennings (51208506111) (cropped).jpg", // KK Jennings · B3 · tier B
  "e9987a94": "Craig Overton.jpg", // C Overton · B3 · tier A
  "582e9baa": "Chris Harris (Cricketer).jpg", // CZ Harris · B3 · tier B
  "1bb0993e": "Abu Jayed Chowdhury (1).jpg", // Abu Jayed · B3 · tier A
  "48ad3373": "1 03 Blair Tickner.jpg", // BM Tickner · B3 · tier B
  "218d4d78": "2 02 Matt Renshaw.jpg", // MT Renshaw · B3 · tier C
  "bdadf7da": "Joe Denly TW 18.jpg", // JL Denly · B3 · tier A
  "4d3097d8": "Gareth hopkins a.jpg", // GJ Hopkins · B3 · tier A
  "be4cefab": "Slips.jpg", // CMW Read · B3 · tier C
  "05da443b": "Adnan akmal cropped.jpg", // Adnan Akmal · B3 · tier A
  "bab78fa2": "Joshua Da Silva batting at Perth Stadium, First Test Australia versus West Indies, 2 December 2022 07.jpg", // J Da Silva · B3 · tier C
  "3812d56b": "Michael Yardy 2010.jpg", // MH Yardy · B3 · tier C
  "97e434a6": "Dom Sibley in June 2019 (cropped).jpg", // DP Sibley · B3 · tier B
  "e1891e00": "2 10 Ben Sears (cropped).jpg", // BV Sears · B3 · tier B
  "99663fa5": "Dinesh Mongia (Dec 2021) 01.jpg", // D Mongia · B3 · tier B
  "e5437a99": "Nick compton training.jpg", // NRD Compton · B3 · tier C
  "463cd7cb": "Craig Cumming 2.jpg", // CD Cumming · B3 · tier A
  "f78e7113": "Seekkuge Prasanna.jpg", // S Prasanna · B3 · tier A
  "a22fb7b5": "Peter Nevill 2011.jpg", // PM Nevill · B3 · tier A
  "0b0cc297": "Tanzim Hasan Sakib in 2024.jpg", // Tanzim Hasan Sakib · B3 · tier B
  "0c8a1d51": "Khaled Mahmud Sujon (2).jpg", // Khaled Mahmud · B3 · tier A
  "3d0ed2f9": "Jake Ball bowls for Nottinghamshire.jpg", // JT Ball · B3 · tier C
  "8b3e9c7c": "Prithvi shaw.png", // PP Shaw · C · tier C
  "5d9a1a73": "Rohit Sharma in PMO New Delhi.jpg", // R Sharma · C · tier B
  "119678fd": "Karn Sharma 2015.jpg", // KV Sharma · C · tier A
  "56b93d46": "20251224 Beau Webster 02.jpg", // BJ Webster · C · tier A
  "c7a995d3": "Sai Kishore.jpg", // R Sai Kishore · C · tier C
  "8fb88ee3": "Cricket, Oval, 26th April 2007 006 (cropped).jpg", // MA Butcher · C · tier A
  "62af8546": "Mohammad Nabi with an Afghan-Australian fan in 2014.jpg", // Mohammad Nabi · C · tier C
  "a24be938": "Venkatesh Iyer.png", // VR Iyer · C · tier C
  "c1f6c27e": "Onions at Edgbaston, 2009 (1) (cropped).jpg", // G Onions · C · tier C
  "c03e2850": "MananVohra Magic book of record.jpg", // M Vohra · C · tier C
  "9a158001": "Azhar Mahmood.jpg", // Azhar Mahmood · C · tier C
  "f4dfcbb4": "Stiaan van Zyl (51223939959).jpg", // S van Zyl · C · tier C
  "e2db2409": "M Ashwin.jpg", // M Ashwin · C · tier C
  "3576e47e": "Subramaniam Badrinath.JPG", // S Badrinath · C · tier A
  "709b0bac": "India Vs New zealand One day International, 10 December 2010 (6160465490).jpg", // SS Tiwary · C · tier C
  "063b3673": "RCL 2016 MoM Dishant Yagnik.jpg", // DH Yagnik · C · tier C (full-name match)
  "ae091d39": "Swapnil Asnodkar 2009.jpg", // SA Asnodkar · C · tier C
  "ad46c747": "3 12 Well batted.jpg", // DM Bess · C · tier A
  "7d92277a": "Mujeeb Ur Rahman celebrating.jpg", // Mujeeb Ur Rahman · C · tier C
  "c8179c68": "Shadab Jakati in 2016 (01).jpg", // SB Jakati · C · tier C
  "4b685e2d": "4 34 Dan Lawrence mugshot.jpg", // DW Lawrence · C · tier A
  "890946a0": "NAMAN OJHA (16192960225).jpg", // NV Ojha · C · tier A
  "f89d3b11": "Sameer rizvi With Rashid Zirak.jpg", // Sameer Rizvi · C · tier C
  "ce794613": "T Natarajan.jpg", // T Natarajan · C · tier C
  "399b0b94": "2 22 Cameron Bancroft.jpg", // CT Bancroft · C · tier C
  "855a210c": "Aditya Tare.jpg", // AP Tare · C · tier C
  "c4d9634c": "Rahkeem Cornwall collects first-ever CPL century.png", // RRS Cornwall · C · tier A
  "9e85455c": "260329 D4 Marcus Harris 02.jpg", // MS Harris · C · tier A
  "1c2a64cd": "Ashish Reddy and Shikhar Dhawan.jpg", // A Ashish Reddy · C · tier B
  "a3ce3d1d": "Saral Erwee 2022.jpg", // SJ Erwee · C · tier C
  "c42aaf71": "Mithun manhas.jpg", // M Manhas · C · tier C
  "dc9dd038": "Sachin baby.jpg", // Sachin Baby · C · tier B
  "fe0c5457": "Scott bowland dismisses haseeb hameed.jpg", // H Hameed · C · tier C
  "ae78bc32": "Mpsgoni.jpg", // MS Gony · C · tier C
  "46a9bea1": "Tushar Deshpande.jpg", // TU Deshpande · C · tier C
  "c9c0fe50": "Alex Lees (cricketer).jpg", // AZ Lees · C · tier B
  "2e11c706": "Ben Cutting GABBA.jpg", // BCJ Cutting · C · tier C
};

/**
 * Players who get the monogram instead of a photo. Commons has no usable
 * portrait — better a clean monogram than a broken or unrecognisable face.
 */
const PHOTO_EXCLUDE = new Set<string>([
  // AM Rahane — was excluded in Phase 2A (only a watermarked red-carpet shot
  // and a two-person awards photo existed then). Phase 2B found a real portrait
  // in his own Commons category, so the exclude is lifted and the override wins.
  // Phase 2A: reviewed and chosen for the monogram. Commons has files for these
  // players but nothing that is both verifiably them and usable after the
  // card's crop — a clean monogram beats an unrecognisable face.
  "88fccd6c", // SM Pollock
  "d2babdd5", // E Chigumbura
  "221ad9d9", // GP Swann
  "0fa5042b", // L Ronchi
  "f846de6a", // MN Samuels
  "944533a5", // KK Nair
  "e957b38f", // AR McBrine
  "2503e881", // A Nel
  "6eea0b32", // Nasir Hossain

  // ── Phase 2B: reviewed and chosen for the monogram ────────────────────────
  // 68 players whose proposed photo was rejected on review — wrong person,
  // unusable crop, or no photo worth having. Listed here so a re-run cannot
  // quietly resurrect a rejected pick.
  "a28a7fba", // A Johnson
  "17aa4f1d", // Aaron Jones
  "f29185a1", // Abhishek Sharma
  "abb7c76c", // Abrar Ahmed
  "53bc7b84", // Aftab Ahmed
  "de3acffe", // AJ McKay
  "0a67aec0", // Akash Deep
  "eb2d5fe7", // Anwar Ali
  "db31895a", // AS Rajpoot
  "e7e86505", // B Evans
  "7fca84b7", // BA King
  "953e3931", // BA Williams
  "adbf0400", // Basil Hameed
  "dcdb87f2", // Bilal Khan
  "eaa36b2a", // BJ Bennett
  "fb66ce1f", // CH Morris
  "05e0fab5", // CS Martin
  "de7d833e", // D Madushanka
  "f1eb3c73", // DMW Rawlins
  "9d710afe", // DR Flynn
  "85ad2217", // DS Smith
  "0d38ab25", // H Fennell
  "94238673", // HK Bennett
  "2b0f2af3", // Imran Khan (2)
  "cd56a813", // Jaker Ali
  "b80dd12c", // Jatinder Singh
  "6fd0c8e1", // JD Campbell
  "aae9ce90", // JF Mooney
  "bc773eeb", // JM Bird
  "086f5984", // Junaid Khan
  "934b36a6", // Khawar Ali
  "e012ad13", // KOA Powell
  "e1592949", // KS Leverock
  "4a461c24", // LA Dawson
  "b8f3362a", // LR Johnson
  "c8574282", // MD Craig
  "759ac88f", // MM Sharma
  "ff3f6fc1", // Mohammad Haris
  "7923a51d", // Mohammad Naim
  "7ff3fcaa", // Mohammad Rafique
  "b3a28446", // Mohammad Saifuddin
  "2cffab74", // Mukesh Kumar
  "c573d173", // MWR Stokes
  "023f6b02", // Nadeem Ahmed
  "05b1aef8", // NG Smith
  "efc04be7", // Noor Ahmad
  "9eb1455b", // NT Ellis
  "9418198b", // P Simran Singh
  "41eb4a4f", // R Vinay Kumar
  "a63775d6", // Rahat Ali
  "17efdeb8", // Raqibul Hasan
  "b8527c3d", // Rasikh Salam
  "cccdde80", // RP Arnold
  "67af6f81", // RW Price
  "957532de", // S Aravind
  "0f6db197", // S Mahmood
  "8de618ab", // SA Ahmad
  "b59db04f", // SA Edwards
  "bbc192a4", // Sajid Khan
  "ce820073", // Sandeep Sharma
  "13bee186", // SC Cook
  "090f9211", // Shahadat Hossain
  "f088b960", // SN Khan
  "5af743d0", // Sohail Khan
  "7f3ad1ed", // SR Thompson
  "a9231c3f", // Steven Ryan Taylor
  "21e5f325", // TA Blundell
  "f1f99156", // TH David

  // ── Phase 2B follow-up: confirmed wrong-person / unverifiable ─────────────
  // Reviewed and rejected after the main batch. Nine were same-name matches on a
  // different human entirely; the rest were two-person photos where the player
  // could not be told from the other face.
  "d3851cd8", // Ehsan Khan — file is Ehsan Khan (architect)
  "7fa12533", // MS Chapman — file is Mark Chapman, Oklahoma politician
  "afe57f7a", // SC Williams — file is Sean Williams the author
  "0a4736eb", // Asif Ali — file is Asif Ali Zardari, President of Pakistan
  "8abdf100", // CJ Anderson — file is Corey Anderson the Australian para-athlete
  "d84378a4", // M Kaif — file categorised 'Founders from Rajasthan' — a startup founder
  "c5d7b244", // Mohammad Nadeem — file is Neda Mohammad Nadeem, Taliban minister
  "5e5eab39", // Nazmul Hossain — file categorised 'Journalists from Bangladesh'
  "aab3e7be", // MJ Mason — file is a FC St. Pauli footballer
  "7dcb9bc9", // M Shahrukh Khan — Wikidata P18 is titled 'Majid Khan Cricket Legend' — a different cricketer
  "39a2dfa8", // R Tewatia — 3-person photo, cannot verify which face is him
  "7a5f232a", // JA Burns — 2-person photo with James Franklin
  "a1b69936", // DG Bedingham — 2-player photo shared with K Verreynne
  "bf814547", // K Verreynne — 2-player photo shared with DG Bedingham
  "de3d549a", // AM Fernando — file categorised under Babar Azam, not him

  // Two-person photos, rejected on review: neither face can be confirmed as the
  // player. Madande's African Games shot is categorised under both him and
  // Rakep Patel; Ervine's Wikidata image is literally named DominicCork.jpg and
  // described as Dominic Cork lifting the 2009 Friends Provident Trophy.
  "3560a786", // C Madande — 2-player African Games photo, face unconfirmable
  "556302a7", // SM Ervine — file is a Dominic Cork photo
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with retry/backoff for transient network + rate-limit failures. */
async function fetchRetry(url: string, init?: RequestInit, tries = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await sleep(500 * 2 ** i);
  }
  throw last instanceof Error ? last : new Error("fetch failed");
}
const chunk = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function freeLicense(short: string): boolean {
  // Commons only hosts freely-licensed content (CC, PD, GODL, OGL, FAL, GFDL, …),
  // so accept by default and reject only explicitly non-free tags.
  return !/fair use|non-?free|all rights reserved|copyright(?!ed free)/i.test(short || "");
}
const stripHtml = (h: string) => (h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function sparqlBatch(cids: string[]): Promise<Map<string, string>> {
  const values = cids.map((c) => `"${c.replace(/"/g, "")}"`).join(" ");
  const query = `SELECT ?cid ?img WHERE { VALUES ?cid { ${values} } ?item wdt:P2698 ?cid . OPTIONAL { ?item wdt:P18 ?img . } }`;
  const res = await fetchRetry(SPARQL, {
    method: "POST",
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = (await res.json()) as { results: { bindings: { cid: { value: string }; img?: { value: string } }[] } };
  const out = new Map<string, string>();
  for (const b of json.results.bindings) {
    if (b.img?.value) {
      // MediaWiki treats "_" and space as equivalent in titles — normalise to
      // spaces so this filename matches Commons' page.title on lookup.
      const file = decodeURIComponent(b.img.value.split("/Special:FilePath/")[1] ?? b.img.value.split("/").pop() ?? "").replace(/_/g, " ");
      if (file) out.set(b.cid.value, file);
    }
  }
  return out;
}

interface ImgInfo { thumburl: string; license: string; licenseUrl: string; artist: string; descUrl: string }

/** Returns Map keyed by the INPUT filename (resolving MediaWiki title
 *  normalization + file redirects so every input maps to its real page). */
async function commonsInfo(files: string[]): Promise<Map<string, ImgInfo>> {
  const titles = files.map((f) => `File:${f}`).join("|");
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: "query", titles, redirects: "1", prop: "imageinfo", iiprop: "extmetadata|url", iiurlwidth: String(THUMB_W), format: "json",
  })}`;
  const res = await fetchRetry(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const json = (await res.json()) as {
    query?: {
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
      pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value: string }> }[] }>;
    };
  };
  const q = json.query ?? {};
  const remap = new Map<string, string>();
  for (const n of q.normalized ?? []) remap.set(n.from, n.to);
  for (const r of q.redirects ?? []) remap.set(r.from, r.to);
  const resolve = (t: string) => {
    let cur = t;
    const seen = new Set<string>();
    while (remap.has(cur) && !seen.has(cur)) { seen.add(cur); cur = remap.get(cur)!; }
    return cur;
  };
  const infoByTitle = new Map<string, ImgInfo>();
  for (const page of Object.values(q.pages ?? {})) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const em = ii.extmetadata ?? {};
    infoByTitle.set(page.title, {
      thumburl: ii.thumburl ?? ii.url ?? "",
      license: em.LicenseShortName?.value ?? "",
      licenseUrl: em.LicenseUrl?.value ?? "",
      artist: stripHtml(em.Artist?.value ?? "Unknown"),
      descUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    });
  }
  const out = new Map<string, ImgInfo>();
  for (const f of files) {
    const info = infoByTitle.get(resolve(`File:${f}`));
    if (info) out.set(f, info);
  }
  return out;
}

async function download(u: string, dest: string): Promise<boolean> {
  // upload.wikimedia.org rate-limits bursts — retry 429/5xx with backoff.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": UA, Referer: "https://commons.wikimedia.org/" } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // A rate-limited response can still come back 200 with an HTML error
        // page; writing that would leave a "JPEG" the browser can't decode.
        if (!(buf[0] === 0xff && buf[1] === 0xd8) && buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
          throw new Error("not an image");
        }
        // Normalise: bound the width and re-encode. Commons hands back the
        // ORIGINAL when it declines to render a thumb, so iiurlwidth alone does
        // not cap anything — without this a 4000px original would land on disk
        // whole. 1000 still clears the card's ~920 device-px retina need.
        writeFileSync(
          dest,
          await sharp(buf)
            .resize({ width: THUMB_W, withoutEnlargement: true })
            .jpeg({ quality: JPEG_Q, mozjpeg: true })
            .toBuffer(),
        );
        return true;
      }
      if (res.status !== 429 && res.status < 500) return false; // hard failure — don't retry
    } catch {
      /* network hiccup / bad payload — retry */
    }
    await sleep(500 * 2 ** attempt); // 0.5, 1, 2, 4, 8s
  }
  return false;
}

async function main() {
  mkdirSync(PHOTO_DIR, { recursive: true });
  mkdirSync(GEN, { recursive: true });
  const db = new Database(DB_PATH, { readonly: true });
  const caIds = loadCricketArchiveIds();
  // gf>=2 gates the AUTOMATIC sweep to players recognizable in two or more
  // formats. An explicit override is a decision already made by hand, so it
  // bypasses the gate: 144 of the approved photos are for players who render as
  // cards in the app but sit below the threshold, and an inner join silently
  // dropped every one of them.
  const players = (db.prepare(`
    WITH agg AS (SELECT player_id, SUM(CASE WHEN gated=1 THEN 1 ELSE 0 END) gf FROM player_format_stats GROUP BY player_id)
    SELECT p.id, p.name, COALESCE(a.gf, 0) AS gf FROM players p LEFT JOIN agg a ON a.player_id=p.id
  `).all() as { id: string; name: string; gf: number }[])
    .filter((p) => p.gf >= 2 || PHOTO_OVERRIDES[p.id])
    .map((p) => ({ ...p, cid: caIds.get(p.id) ?? "" }))
    // A cricketarchive id is how the AUTOMATIC Wikidata lookup finds a photo, so
    // players without one used to be dropped here. But an explicit override
    // needs no lookup — it already names the file — and most of the players we
    // hand-picked have no cricketarchive id at all (that is precisely why they
    // had to be resolved by name). Dropping them silently skipped 162 of 208
    // approved photos, so keep anyone who has an override.
    .filter((p) => p.cid || PHOTO_OVERRIDES[p.id])
    .filter((p) => !ONLY || ONLY.has(p.id))
    .slice(0, LIMIT);
  console.log(`${players.length} players in scope (${players.filter((p) => p.cid).length} with a cricketarchive id, ${players.filter((p) => !p.cid).length} override-only)`);

  // existing manifest → allow idempotent re-runs
  const manifestPath = join(GEN, "photos.json");
  const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const credits: Record<string, { name: string; artist: string; license: string; url: string }> = {};
  const creditsPath = join(PHOTO_DIR, "CREDITS.json");
  const priorCredits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, "utf8")) : {};
  Object.assign(credits, priorCredits);

  const byCid = new Map(players.filter((p) => p.cid).map((p) => [p.cid, p]));

  // Persist manifest + credits + CREDITS.md — called after every batch so a
  // timeout never loses progress (idempotent, resumable).
  const persist = () => {
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(creditsPath, JSON.stringify(credits, null, 0));
    const lines = ["# Cricketer photo credits", "", "All images from Wikimedia Commons under free (CC / public-domain / open-data) licenses. No images are hotlinked or scraped from ESPNcricinfo or Getty.", ""];
    lines.push("| Player | Author | License | Source |", "| --- | --- | --- | --- |");
    for (const c of Object.values(credits).sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| ${c.name} | ${c.artist} | ${c.license} | [Commons](${c.url}) |`);
    }
    writeFileSync(join(PHOTO_DIR, "CREDITS.md"), lines.join("\n"));
  };

  // 1) Wikidata SPARQL → cricketarchive id → commons filename (ALL players, so
  // credits are (re)captured even for faces downloaded in an earlier run).
  // Keyed by OUR player id, not the cricketarchive id: overrides exist for
  // players who have no cricketarchive id at all, and a cid-keyed map cannot
  // represent them (they would all collide on the empty string).
  const fileByPlayer = new Map<string, string>();
  for (const batch of chunk(players.filter((p) => p.cid).map((p) => p.cid), 140)) {
    try {
      const m = await sparqlBatch(batch);
      m.forEach((file, cid) => {
        const p = byCid.get(cid);
        if (p) fileByPlayer.set(p.id, file);
      });
    } catch (e) {
      console.log("  SPARQL batch failed:", (e as Error).message);
    }
    await sleep(400);
  }
  console.log(`Wikidata: ${fileByPlayer.size} players have a Commons image`);

  // Manual picks beat the automatic one. Applied here, before any download, so
  // overridden players flow through the identical licence/credit path.
  const byId = new Map(players.map((p) => [p.id, p]));
  let overrideHits = 0;
  for (const [id, file] of Object.entries(PHOTO_OVERRIDES)) {
    const p = byId.get(id);
    if (!p) continue; // out of scope for this run (--only), or not a gated player
    fileByPlayer.set(p.id, file);
    overrideHits++;
  }
  console.log(`overrides applied in this run: ${overrideHits}`);
  // Excluded players fall back to the monogram: drop any stored face + manifest
  // entry, so re-running can't quietly resurrect the bad image.
  for (const id of PHOTO_EXCLUDE) {
    fileByPlayer.delete(id);
    delete manifest[id];
    delete credits[id];
    rmSync(join(PHOTO_DIR, `${id}.jpg`), { force: true });
  }
  console.log(`monogram (excluded): ${PHOTO_EXCLUDE.size}`);

  // 2) Commons imageinfo (license + thumburl), 3) download if not already present
  let saved = 0, skippedNonFree = 0, noMeta = 0, noThumb = 0, dlFail = 0;
  const entries = [...fileByPlayer.entries()];
  for (const fileBatch of chunk(entries, 25)) {
    const files = fileBatch.map(([, f]) => f);
    let info: Map<string, ImgInfo>;
    try {
      info = await commonsInfo(files);
    } catch (e) {
      console.log("  Commons batch failed:", (e as Error).message);
      await sleep(500);
      continue;
    }
    for (const [playerId, file] of fileBatch) {
      const meta = info.get(file);
      const player = byId.get(playerId);
      if (!player) continue;
      if (!meta) { noMeta++; continue; }
      if (!meta.thumburl) { noThumb++; continue; }
      if (!freeLicense(meta.license)) { skippedNonFree++; continue; }
      const dest = join(PHOTO_DIR, `${player.id}.jpg`);
      let ok = existsSync(dest) && !REFETCH;
      if (!ok) {
        ok = await download(meta.thumburl, dest);
        if (ok) saved++;
        else dlFail++;
        await sleep(150); // gentler on upload.wikimedia.org during a full refetch
      }
      if (ok) {
        manifest[player.id] = `${player.id}.jpg`;
        credits[player.id] = { name: player.name, artist: meta.artist || "Unknown", license: meta.license || "CC", url: meta.descUrl };
      }
    }
    persist();
    console.log(`  …${saved} new saved, ${Object.keys(manifest).length} total (dlFail ${dlFail})`);
  }

  console.log(`\n✓ ${Object.keys(manifest).length} photos (+${saved} new), ${skippedNonFree} non-free skipped, ${noMeta + noThumb} unusable. Monogram fallback for the rest.`);
  db.close();
}

main();
