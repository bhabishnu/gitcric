# Phase 2A — proposed photo replacements (for approval)

**Nothing downloaded into the repo, applied, or committed.** Preview thumbnails live only in the scratchpad.

## How these were chosen

1. Commons searched per player by category, quoted filename, and their Wikipedia article — 572 candidate images across the 100 targets. All 100 lookups completed cleanly (0 rate-limited, 0 unresolved).
2. Every candidate face-detected (YuNet) and scored on where the face lands inside the card's **real** crop — 540×820 card, portrait window = top 58%, `object-position: 50% 14%`.
3. **Identity-checked** (SFace) against each player's existing photo, which is correct but low-res. This is what caught the wrong-person picks: filename-ranking had proposed Ravindra Jadeja's *wife*, a stranger for Jayasuriya, and US soldiers for Kyle Mills.
4. I then looked at all 50 surviving crops and tiered them by eye.

| tier | count | meaning |
|---|---|---|
| A | 22 | clear face, well framed — recommend applying |
| B | 12 | usable but flawed — **your call** |
| C | 16 | I recommend rejecting; leave current photo |
| — | 50 | no usable free photo found at all |

Contact sheets (open these to spot-check):

```
/tmp/claude-1000/-home-shinkiro7-Music-gitcric/4d7a2cdc-3ff9-4f20-b8ef-9262ae85a0a4/scratchpad/preview/tier-A-confident.png
/tmp/claude-1000/-home-shinkiro7-Music-gitcric/4d7a2cdc-3ff9-4f20-b8ef-9262ae85a0a4/scratchpad/preview/tier-B-marginal.png
/tmp/claude-1000/-home-shinkiro7-Music-gitcric/4d7a2cdc-3ff9-4f20-b8ef-9262ae85a0a4/scratchpad/preview/tier-C-rejected.png
```

`sim` = SFace cosine similarity to the current photo; ≥0.36 is the same-person threshold.

## Tier A — recommend applying (22)

| OVR | player | sec | current | proposed file | proposed | sim | license | author |
|---|---|---|---|---|---|---|---|---|
| 95 | SA Yadav | A | 500×326 | `Suryakumar Yadav in PMO New Delhi.jpg` | 560×716 | 0.55 | GODL-India | Prime Minister's Office |
| 94 | CH Gayle | A | 417×577 | `CHRIS GAYLE (4338758231).jpg` | 1080×1482 | 0.55 | CC BY-SA 2.0 | NAPARAZZI |
| 93 | KC Sangakkara | A | 199×239 | `KUMAR SANGAKKARA (5155171149).jpg` | 2448×3264 | 0.37 | CC BY-SA 2.0 | NAPARAZZI |
| 92 | AK Markram | A | 1000×666 | `Aiden Markram interview after WTC final 2025 (cropped).png` | 590×660 | 0.65 | CC BY 3.0 | Michael Sherman |
| 91 | KA Pollard | A | 500×1251 | `Kieron Pollard.jpg` | 509×677 | 0.55 | CC BY 3.0 | Adelaide Strikers |
| 88 | Shakib Al Hasan | B | 1000×1334 | `Shakib Al Hasan (2).jpg` | 6000×4000 | 0.61 | CC BY-SA 4.0 | Nurunnaby Chowdhury (Hasive) |
| 86 | MA Starc | A | 400×662 | `Mitchell Starc fielding 2021 (cropped).jpg` | 2036×2703 | 0.56 | CC BY-SA 4.0 | SirWellsy99 |
| 86 | R Ashwin | A | 335×481 | `Ravichandran Ashwin (2).jpg` | 765×744 | 0.57 | CC BY 3.0 | Indian yogi and author Sadhguru, on Youtube |
| 86 | RA Jadeja | A | 205×270 | `Ravindra Jadeja in PMO New Delhi.jpg` | 593×695 | 0.52 | GODL-India | Prime Minister's Office |
| 85 | KD Karthik | A | 500×914 | `Dinesh.Karthik.jpg` | 2824×2969 | 0.64 | CC BY-SA 4.0 | Anand Anil |
| 85 | Sarfraz Ahmed | A | 317×334 | `Sarfaraz Ahmed answering RAPID FIRE questions (PCB) 02.jpg` | 660×520 | 0.70 | CC BY 3.0 | Pakistan Cricket Board on Youtube |
| 84 | Mushfiqur Rahim | A | 1000×666 | `Mushfiqur Rahim 2018 (cropped).jpg` | 1137×1365 | 0.94 | CC BY-SA 4.0 | Rasi56 |
| 82 | Imad Wasim | A | 377×274 | `Imad Wasim 1.jpg` | 460×450 | 0.47 | CC BY 3.0 | CRICKETNEXT |
| 81 | NM Lyon | A | 185×272 | `Nathan Lyon The Test clip.png` | 657×820 | 0.62 | CC BY 3.0 | Prime Video AU &amp; NZ |
| 81 | BRM Taylor | A | 255×539 | `Cricket at Lord's (17165108401) (Brendon Taylor cropped).jpg` | 1332×1729 | 0.55 | CC BY 2.0 | DncnH from Melton Mowbray, UK |
| 78 | Imam-ul-Haq | A | 245×317 | `4 12 Imam-ul-Haq mugshot.jpg` | 2541×2732 | 0.58 | Public domain | Dave Morton |
| 77 | UT Yadav | A | 333×333 | `Umesh Yadav (2).jpg` | 607×542 | 0.72 | CC BY 3.0 | Kolkata Knight Riders - Official |
| 76 | Shaheen Shah Afridi | B | 583×468 | `Shaheen Afridi jogging Sri Lanka vs Pakistan - 2nd TEST Match - SSC, Colombo (cropped).jpg` | 718×1076 | 0.54 | CC BY-SA 4.0 | Nazly Ahmed |
| 75 | Sabbir Rahman | A | 283×354 | `Sabbir Rahman 2016 (cropped).jpg` | 744×868 | 0.66 | CC BY-SA 4.0 | Ahmed Salahuddin BD |
| 75 | I Sharma | A | 500×1020 | `Ishant Sharma 2.JPG` | 720×878 | 0.38 | CC BY-SA 3.0 | Blnguyen |
| 75 | Shoaib Akhtar | A | 210×295 | `Shoaib Akhtar in 2014 (cropped).jpg` | 2486×2359 | 0.60 | CC BY 2.0 | Vinod Divakaran |
| 71 | Taskin Ahmed | A | 248×431 | `Taskin Ahmed at Chef's Table.png` | 555×611 | 0.51 | CC BY 3.0 | Tripod Films |

## Tier B — usable but flawed, your call (12)

| OVR | player | sec | current | proposed file | proposed | sim | license | author | concern |
|---|---|---|---|---|---|---|---|---|---|
| 94 | RT Ponting | A | 500×362 | `Ricky Ponting signing.jpg` | 871×1122 | 0.50 | CC BY-SA 2.0 | paddynapper | head down looking at his watch, cap shadows the eyes |
| 93 | AJ Finch | B | 1000×1613 | `AARON FINCH (6299558883).jpg` | 3755×2695 | 0.50 | CC BY-SA 2.0 | NAPARAZZI | a mic intrudes into frame; source is landscape (1.39) |
| 91 | JM Bairstow | A | 300×400 | `2 05 Bairstow out.jpg` | 2058×2413 | 0.61 | Public domain | Dave Morton | walking off — face is small in frame |
| 90 | S Dhawan | A | 224×217 | `SHIKHAR DHAWAN (16005494418).jpg` | 3264×4928 | 0.51 | CC BY-SA 2.0 | NAPARAZZI | a TV camera sits in front of his chin |
| 89 | KS Williamson | A | 392×602 | `Kane Williamson.jpg` | 450×386 | 0.51 | CC BY 3.0 | CRICKETNEXT | only 450×386 — below the card's retina need |
| 87 | VVS Laxman | B | 742×1024 | `VVSLaxman.jpg` | 1371×1725 | 0.54 | CC BY-SA 3.0 | Fenopy | casual shot, sunglasses on |
| 85 | Mohammed Shami | A | 1000×663 | `Mohammed Shami bowling against England at Edgbaston.jpg` | 4252×3189 | 0.40 | CC BY 2.0 | Aidan Sammons | mid-bowling-action, face smallish |
| 79 | MA Agarwal | A | 252×506 | `2 38 Agarwal mugshot.jpg` | 1414×1338 | 0.45 | Public domain | Dave Morton | head down, cap over the eyes |
| 75 | GS Ballance | A | 1000×652 | `4 02 Gary Ballance.jpg` | 2361×2090 | 0.51 | Public domain | Dave Morton | walking, face small |
| 75 | SJ Harmison | A | 334×475 | `Steve Harmison bowl.jpg` | 682×493 | 0.46 | CC BY-SA 3.0 | Blnguyen | mid-delivery grimace |
| 74 | AD Russell | A | 223×454 | `Andre Russell (2).jpg` | 552×547 | 0.47 | CC BY 3.0 | Kolkata Knight Riders - Official | usable face but busy background |
| 73 | MS Panesar | A | 280×336 | `Monty Panesar (2014) (02).jpg` | 1002×1380 | 0.53 | CC BY-SA 2.0 | NAPARAZZI | sunglasses on |

## Tier C — recommend rejecting (16)

| OVR | player | sec | current | proposed file | proposed | sim | license | author | concern |
|---|---|---|---|---|---|---|---|---|---|
| 91 | ST Jayasuriya | A | 281×308 | `Sanath Jayasuriya snapped 5.jpg` | 585×881 | 0.43 | CC BY 3.0 | Bollywood Hungama | dark group shot, he is small and off to the side |
| 90 | BB McCullum | A | 400×460 | `Brendon McCullum ONZM investiture.jpg` | 1024×833 | 0.45 | CC BY 4.0 | New Zealand Government, Office of the Govern | handshake with a dignitary — two people |
| 89 | SS Iyer | A | 324×476 | `Shreyas Iyer snapped at the airport.jpg` | 585×1040 | 0.43 | CC BY 3.0 | https://www.bollywoodhungama.com | airport snap, sunglasses, face small |
| 87 | DPMD Jayawardene | A | 376×569 | `Mahela Jayawardene 3.JPG` | 2338×3000 | 0.55 | CC BY-SA 4.0 | Amal316 | full-body on the field, face tiny |
| 84 | WJ Cronje | A | 343×566 | `Hanse Cronje (2).jpg` | 964×524 | 0.46 | CC BY 3.0 | BBC News اردو | trophy group shot, very wide (1.84) |
| 84 | BM Duckett | B | 500×586 | `Ben Duckett celebrates a half-century (cropped).jpg` | 732×932 | 0.65 | CC BY-SA 4.0 | Charltonkyle @ Wikimedia Commons | batting in a helmet — no face |
| 81 | Umar Akmal | A | 500×949 | `Kamran Akmal (2010).jpg` | 1578×2172 | 0.41 | CC BY-SA 2.0 | NAPARAZZI | fielding shot, face tiny |
| 81 | JN Rhodes | B | 1000×1500 | `Jonty Rhodes.jpg` | 2048×1536 | 0.66 | CC BY 2.0 | Afrika Force | full-body, stood far from camera |
| 80 | Mohammad Amir | A | 291×283 | `MOHAMMAD AMIR.jpg` | 1230×1716 | 0.44 | CC BY-SA 2.0 | NAPARAZZI | full-body, face tiny |
| 80 | A Ranatunga | A | 172×221 | `The Prime Minister, Shri Narendra Modi signing the visitor’s book at Bandaranaike International Airport, in Colombo, Sri Lanka on March 13, 2015. The Prime Minister of Sri Lanka, Mr. Ranil Wickremesinghe is also seen.jpg` | 2100×1165 | 0.59 | GODL-India | Prime Minister's Office | political podium group photo |
| 79 | G Kirsten | A | 257×300 | `We met Gary Kirsten!.jpg` | 1024×768 | 0.89 | CC BY 2.0 | Sumeet Moghe | two people in a car |
| 76 | AU Rashid | A | 500×1160 | `Adil rashid.jpg` | 592×1373 | 0.60 | CC BY-SA 3.0 | Harrias | celebrating, head thrown back |
| 75 | PA Patel | A | 329×348 | `PARTHIV PATEL With Rashid Zirak.jpg` | 1536×1417 | 0.63 | CC BY-SA 4.0 | Akshayparmar.gu | casual two-man snapshot |
| 74 | Nasir Hossain | B | 500×693 | `Prime Minister felicitates Bangladesh cricket team April 25 2015 (PID-0059786).jpg` | 1626×1332 | 0.57 | Public domain | Press Information Department | group photo with the PM |
| 69 | AF Giles | A | 305×395 | `Ashley giles bowl.jpg` | 692×988 | 0.42 | CC BY-SA 3.0 | Blnguyen | bowling action, sunglasses, face turned |
| 69 | JA Rudolph | B | 500×605 | `Jacques Rudolph.jpg` | 1867×1470 | 0.76 | CC BY-SA 3.0 | Mdcollins1984 | award handshake — two people |

## No usable free photo — 50 players

These keep their current photo unchanged. Commons has files for most of them, but nothing that survives the identity check and the card crop.

| OVR | player | sec | current | files seen | closest candidate | why not |
|---|---|---|---|---|---|---|
| 91 | GC Smith | A | 413×458 | 40 | `GRAEME SMITH (3175187734).jpg` | identity uncertain (sim 0.29) |
| 91 | A Mishra | B | 479×406 | 5 | `Amit Mishra.jpg` | low-res source, this is the current photo |
| 90 | SM Pollock | A | 200×310 | 9 | `Shaun Pollock.jpg` | identity uncertain (sim 0.30), 5 faces |
| 87 | Younis Khan | A | 393×463 | 7 | `Younis khan batting.jpg` | different person (sim -0.03) |
| 86 | KD Mills | A | 400×300 | 10 | `Kyle Mills.JPG` | low-res source, this is the current photo |
| 86 | SB Styris | A | 272×394 | 3 | `Chris Cairns and Scott Styris signing autographs` | identity uncertain (sim 0.28), 11 faces |
| 86 | M Azharuddin | A | 290×570 | 5 | `Dr. Najeeb Qasmi receiving memento from previous` | face small, 7 faces |
| 85 | PA de Silva | A | 287×414 | 2 | `Aravinda de Silva Graph.png` | no face detected |
| 84 | E Chigumbura | A | 1000×667 | 2 | `Elton Chigumbura fielding.jpg` | face small, 4 faces, this is the current photo |
| 84 | SM Katich | A | 220×290 | 14 | `Simon Katich bowling.jpg` | identity uncertain (sim 0.28), face small, 2 faces |
| 84 | MJ Henry | B | 500×605 | 35 | `Matt Henry 2018.jpg` | 3 faces, this is the current photo |
| 83 | BAW Mendis | A | 500×913 | 1 | `Mendis bowling.jpg` | face small, 3 faces, this is the current photo |
| 83 | DL Vettori | A | 222×436 | 11 | `Daniel Vettori ONZM (cropped).jpg` | identity uncertain (sim 0.35) |
| 83 | NJ Astle | A | 500×343 | 5 | `A charity cricket match in New Zealand, (March, ` | identity unverified (no reference face), face small, 104 faces |
| 83 | GP Swann | B | 707×952 | 19 | `Broad bowling 2012, The Oval.jpg` | identity uncertain (sim 0.32), face small, 118 faces |
| 82 | MM Patel | A | 688×1256 | 5 | `India Vs New zealand One day International, 10 D` | face small, 20 faces |
| 82 | DE Bollinger | A | 410×500 | 4 | `DOUG BOLLINGER (3072218082).jpg` | face small |
| 81 | L Ronchi | B | 500×614 | 1 | `Luke Ronchi 2010.jpg` | no face detected |
| 80 | Abdur Razzak | A | 500×347 | 30 | `A parliamentary delegation from Bangladesh led b` | face cropped off by the card |
| 80 | MN Samuels | A | 156×263 | 2 | `Trent Bridge, 2012 England v West Indies Test.jp` | face small |
| 80 | A Nel | A | 1000×615 | 29 | `Andre Nel Bfdefence.jpg` | no face detected |
| 79 | DJ Bravo | A | 500×953 | 15 | `-IIFA2017 - NYC (35880713746).jpg` | identity uncertain (sim 0.32), 4 faces |
| 79 | Asad Shafiq | A | 1000×728 | 1 | `Asad Shafiq.png` | this is the current photo |
| 78 | JO Holder | A | 500×317 | 16 | `U.S. Army Maj. Jason Holder stands while discuss` | different person (sim 0.25) |
| 78 | A Nehra | A | 226×347 | 5 | `Ashish Nehra.jpg` | face small, 3 faces |
| 78 | AT Rayudu | B | 484×468 | 1 | `Ambati Rayudu.jpg` | low-res source, this is the current photo |
| 77 | KK Nair | A | 165×284 | 1 | `Karun nair With Rashid Zirak.jpg` | no face detected |
| 77 | LH Ferguson | A | 632×410 | 1 | `Lockie Ferguson.jpg` | this is the current photo |
| 76 | R Rampaul | A | 255×453 | 1 | `Ravi Rampaul.jpg` | no face detected |
| 76 | Azhar Ali | A | 298×317 | 25 | `Duchess of Cambridge Pakistan Tour 2019.png` | face small, 7 faces |
| 76 | JE Taylor | A | 281×293 | 13 | `Absattar Derbisali.png` | different person (sim 0.17) |
| 75 | HH Streak | A | 222×361 | 4 | `Lord's Cricket Ground Heath Streak.jpg` | no face detected |
| 75 | WU Tharanga | A | 360×451 | 1 | `Upul-Tharanga, Sri Lanka vs Pakistan, 1st ODI, 2` | no face detected |
| 75 | KM Jarvis | A | 244×520 | 2 | `Jarvis, Kyle.jpg` | no face detected |
| 75 | RJW Topley | A | 500×361 | 2 | `Reece Topley.png` | face small, 6 faces, this is the current photo |
| 75 | JP Faulkner | B | 500×782 | 20 | `Eoin Morgan and James Faulkner.jpg` | face small, 48 faces |
| 75 | RP Singh | B | 550×711 | 12 | `R. P. Singh.jpg` | 2 faces, this is the current photo |
| 73 | Ahmed Shehzad | A | 317×325 | 2 | `Shehzad Ahmed - Denmark.jpg` | no face detected |
| 73 | AJ Tye | A | 251×301 | 1 | `2018.02.03.20.38.56-AUSvNZL T20 NZL innings, SCG` | no face detected |
| 72 | AR McBrine | B | 1000×1232 | 1 | `Andy McBrine.jpg` | face cropped off by the card |
| 71 | Naseem Shah | A | 293×344 | 19 | `Naz Shah and Dave Green in City Park, Bradford.j` | different person (sim 0.23) |
| 71 | G Malla | A | 1000×666 | 2 | `Gyanendra Malla.JPG` | 2 faces, this is the current photo |
| 71 | B Bhandari | A | 500×332 | 2 | `विनोद भण्डारी 1.jpg` | this is the current photo |
| 70 | M Kartik | A | 500×1002 | 5 | `Murali kartik bowling.jpg` | face cropped off by the card |
| 69 | Yasir Hameed | A | 193×241 | 2 | `Ehsen pakistan cricket team and heartbeats.jpg` | face small, 13 faces |
| 67 | D Bishoo | A | 225×426 | 1 | `Devendra Bishoo.jpg` | no face detected |
| 67 | Sohail Tanvir | A | 500×333 | 1 | `Sohail Tanvir with a native eagle in the UAE.jpg` | this is the current photo |
| 64 | Mohammad Mithun | A | 170×235 | 1 | `Mohammad Mithun (cropped).jpg` | no face detected |
| 59 | HJH Marshall | A | 247×323 | 4 | `Governor-General's XI 2019.jpg` | face small, 16 faces |
| 59 | Junaid Siddique | A | 360×480 | 1 | `Junaid Siddique training, 23 January, 2009, Dhak` | no face detected |
