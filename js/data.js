// Stammdaten: Muskeln, Ausrüstung, Übungsbibliothek, Split-Vorlagen
export const MUSCLES={chest:'Brust',back:'Rücken',shoulders:'Schultern',biceps:'Bizeps',triceps:'Trizeps',quads:'Quadrizeps',hamstrings:'Beinbeuger',glutes:'Gesäß',calves:'Waden',abs:'Bauch'};
export const EQUIP={barbell:'Langhantel',dumbbell:'Kurzhanteln',bench:'Bank',cable:'Kabelzug',machine:'Maschinen',pullupbar:'Klimmzugstange',dipbar:'Dip-Barren',band:'Widerstandsbänder'};
export const LIMITS={shoulder:'Schulter',knee:'Knie',back:'Unterer Rücken'};
export const GOALS={hyp:'Muskelaufbau',str:'Maximalkraft',fat:'Fettabbau (Muskeln halten)',fit:'Allgemeine Fitness'};
export const EXP={beg:'Anfänger (< 1 Jahr)',int:'Fortgeschritten (1–3 Jahre)',adv:'Erfahren (> 3 Jahre)'};
export const WEEKDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
export const PATTERNS={squat:'Kniebeuge',hinge:'Hüftbeuge',lunge:'Einbeinig',legext:'Quadrizeps isoliert',legcurl:'Beinbeuger isoliert',glute:'Gesäß',calf:'Waden',hpush:'Drücken horizontal',vpush:'Drücken vertikal',hpull:'Ziehen horizontal',vpull:'Ziehen vertikal',fly:'Brust isoliert',lateral:'Seitliche Schulter',rear:'Hintere Schulter',curl:'Bizeps',triext:'Trizeps',core:'Rumpf'};

// t: c = Grundübung, i = Isolation · inc: Steigerung in kg · bw: Körpergewicht (Gewicht = Zusatzlast) · av: bei Beschwerden meiden
export const EX=[
 {id:'bb_squat',n:'Kniebeuge (Langhantel)',p:'squat',m:'quads',s:['glutes'],eq:['barbell'],t:'c',inc:5,av:['back','knee'],cue:'Füße schulterbreit, Knie folgen den Zehen, so tief wie du den Rücken neutral halten kannst.'},
 {id:'leg_press',n:'Beinpresse',p:'squat',m:'quads',s:['glutes'],eq:['machine'],t:'c',inc:5,cue:'Becken bleibt am Polster, kontrolliert tief, Knie nicht ganz durchstrecken.'},
 {id:'hack_squat',n:'Hackenschmidt-Kniebeuge',p:'squat',m:'quads',s:['glutes'],eq:['machine'],t:'c',inc:5,av:['knee'],cue:'Rücken fest am Polster, tiefe Position kontrolliert ansteuern.'},
 {id:'goblet_squat',n:'Goblet Squat (Kurzhantel)',p:'squat',m:'quads',s:['glutes'],eq:['dumbbell'],t:'c',inc:2,cue:'Hantel vor der Brust, Ellbogen zwischen die Knie, aufrechter Oberkörper.'},
 {id:'bw_squat',n:'Kniebeuge mit Pause (Körpergewicht)',p:'squat',m:'quads',s:['glutes'],eq:[],t:'c',inc:2.5,bw:1,cue:'3 Sekunden runter, 1 Sekunde Pause unten. Zusatzlast per Rucksack.'},
 {id:'rdl',n:'Rumänisches Kreuzheben (Langhantel)',p:'hinge',m:'hamstrings',s:['glutes','back'],eq:['barbell'],t:'c',inc:5,av:['back'],cue:'Hüfte nach hinten schieben, Stange nah am Bein, Rücken neutral, Dehnung in den Beinbeugern.'},
 {id:'db_rdl',n:'Rumänisches Kreuzheben (Kurzhanteln)',p:'hinge',m:'hamstrings',s:['glutes'],eq:['dumbbell'],t:'c',inc:2,cue:'Wie mit Langhantel, Hanteln entlang der Oberschenkel führen.'},
 {id:'sl_rdl',n:'Einbeiniges Kreuzheben (Körpergewicht)',p:'hinge',m:'hamstrings',s:['glutes'],eq:[],t:'c',inc:2.5,bw:1,cue:'Standbein leicht gebeugt, Becken bleibt gerade. Zusatzlast in die Gegenhand.'},
 {id:'bulgarian',n:'Bulgarian Split Squat',p:'lunge',m:'quads',s:['glutes'],eq:['dumbbell','bench'],t:'c',inc:2,av:['knee'],cue:'Hinterer Fuß auf der Bank, vorderes Knie über dem Mittelfuß, kontrolliert tief.'},
 {id:'walking_lunge',n:'Ausfallschritte gehend (Kurzhanteln)',p:'lunge',m:'quads',s:['glutes'],eq:['dumbbell'],t:'c',inc:2,av:['knee'],cue:'Lange Schritte, hinteres Knie Richtung Boden, Oberkörper aufrecht.'},
 {id:'step_up',n:'Step-ups (Kurzhanteln)',p:'lunge',m:'quads',s:['glutes'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Ganzen Fuß auf die Bank, aus dem vorderen Bein hochdrücken, nicht abspringen.'},
 {id:'split_squat',n:'Split Squat (Körpergewicht)',p:'lunge',m:'quads',s:['glutes'],eq:[],t:'c',inc:2.5,bw:1,cue:'Schrittstellung, senkrecht nach unten. Zusatzlast per Rucksack.'},
 {id:'leg_ext',n:'Beinstrecker',p:'legext',m:'quads',s:[],eq:['machine'],t:'i',inc:2.5,av:['knee'],cue:'Oben kurz halten, langsam ablassen.'},
 {id:'heel_goblet',n:'Goblet Squat mit erhöhten Fersen',p:'legext',m:'quads',s:[],eq:['dumbbell'],t:'i',inc:2,cue:'Fersen auf Hantelscheibe oder Keil, Knie weit nach vorn, aufrecht bleiben.'},
 {id:'cyclist_squat',n:'Cyclist Squat (Körpergewicht)',p:'legext',m:'quads',s:[],eq:[],t:'i',inc:2.5,bw:1,cue:'Enge Fußstellung, Fersen erhöht, langsam tief.'},
 {id:'lying_curl',n:'Beinbeuger liegend',p:'legcurl',m:'hamstrings',s:[],eq:['machine'],t:'i',inc:2.5,cue:'Hüfte am Polster, voll beugen, langsam zurück.'},
 {id:'seated_curl',n:'Beinbeuger sitzend',p:'legcurl',m:'hamstrings',s:[],eq:['machine'],t:'i',inc:2.5,cue:'Oberkörper leicht vorlehnen, volle Bewegung.'},
 {id:'slider_curl',n:'Beinbeuger mit Gleitern (Körpergewicht)',p:'legcurl',m:'hamstrings',s:['glutes'],eq:[],t:'i',inc:2.5,bw:1,rr:[8,15],cue:'Becken oben halten, Fersen auf Handtuch oder Gleitern heranziehen.'},
 {id:'band_curl_leg',n:'Beinbeuger mit Band (liegend)',p:'legcurl',m:'hamstrings',s:[],eq:['band'],t:'i',inc:0,cue:'Band an Fußgelenk, Ferse zum Gesäß ziehen.'},
 {id:'hip_thrust',n:'Hip Thrust (Langhantel)',p:'glute',m:'glutes',s:['hamstrings'],eq:['barbell','bench'],t:'c',inc:5,cue:'Kinn zur Brust, Becken oben kurz halten, Rippen unten.'},
 {id:'db_hip_thrust',n:'Hip Thrust (Kurzhantel)',p:'glute',m:'glutes',s:['hamstrings'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Hantel auf dem Becken, oben 1 Sekunde halten.'},
 {id:'glute_bridge',n:'Einbeinige Glute Bridge',p:'glute',m:'glutes',s:['hamstrings'],eq:[],t:'i',inc:2.5,bw:1,cue:'Ein Fuß am Boden, Becken gerade nach oben drücken.'},
 {id:'calf_machine',n:'Wadenheben stehend (Maschine)',p:'calf',m:'calves',s:[],eq:['machine'],t:'i',inc:5,cue:'Unten 2 Sekunden Dehnung halten, oben voll hoch.'},
 {id:'db_calf',n:'Wadenheben einbeinig (Kurzhantel)',p:'calf',m:'calves',s:[],eq:['dumbbell'],t:'i',inc:2,cue:'Auf einer Stufe, volle Bewegung, unten kurz halten.'},
 {id:'bw_calf',n:'Wadenheben einbeinig (Körpergewicht)',p:'calf',m:'calves',s:[],eq:[],t:'i',inc:2.5,bw:1,cue:'Auf einer Stufe, langsam ablassen.'},
 {id:'bench',n:'Bankdrücken (Langhantel)',p:'hpush',m:'chest',s:['triceps','shoulders'],eq:['barbell','bench'],t:'c',inc:2.5,av:['shoulder'],cue:'Schulterblätter zusammen, Füße fest, Stange zur unteren Brust.'},
 {id:'db_bench',n:'Bankdrücken (Kurzhanteln)',p:'hpush',m:'chest',s:['triceps','shoulders'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Ellbogen ca. 45° zum Körper, tiefe Dehnung, kontrolliert.'},
 {id:'incline_db',n:'Schrägbankdrücken (Kurzhanteln)',p:'hpush',m:'chest',s:['shoulders','triceps'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Bank 30°, Hanteln über der oberen Brust zusammenführen.'},
 {id:'chest_press',n:'Brustpresse (Maschine)',p:'hpush',m:'chest',s:['triceps'],eq:['machine'],t:'c',inc:2.5,cue:'Griffe auf Brusthöhe, Schultern unten lassen.'},
 {id:'pushup',n:'Liegestütze',p:'hpush',m:'chest',s:['triceps','shoulders'],eq:[],t:'c',inc:2.5,bw:1,cue:'Körper als Brett, Brust bis knapp über den Boden.'},
 {id:'ohp',n:'Schulterdrücken stehend (Langhantel)',p:'vpush',m:'shoulders',s:['triceps'],eq:['barbell'],t:'c',inc:2.5,av:['shoulder','back'],cue:'Gesäß und Bauch fest, Stange nah am Gesicht nach oben.'},
 {id:'db_ohp',n:'Schulterdrücken sitzend (Kurzhanteln)',p:'vpush',m:'shoulders',s:['triceps'],eq:['dumbbell','bench'],t:'c',inc:2,av:['shoulder'],cue:'Lehne fast senkrecht, Hanteln bis Kinnhöhe absenken.'},
 {id:'landmine',n:'Landmine Press (einarmig)',p:'vpush',m:'shoulders',s:['chest','triceps'],eq:['barbell'],t:'c',inc:2.5,cue:'Schräge Druckbahn, schulterschonend. Stangenende in einer Ecke.'},
 {id:'machine_shoulder',n:'Schulterpresse (Maschine)',p:'vpush',m:'shoulders',s:['triceps'],eq:['machine'],t:'c',inc:2.5,av:['shoulder'],cue:'Sitz so einstellen, dass Griffe auf Schulterhöhe starten.'},
 {id:'pike',n:'Pike Push-ups',p:'vpush',m:'shoulders',s:['triceps'],eq:[],t:'c',inc:2.5,bw:1,av:['shoulder'],rr:[6,15],cue:'Hüfte hoch, Kopf Richtung Boden zwischen die Hände.'},
 {id:'bb_row',n:'Langhantelrudern',p:'hpull',m:'back',s:['biceps','shoulders'],eq:['barbell'],t:'c',inc:2.5,av:['back'],cue:'Oberkörper ca. 45°, Stange zum Bauchnabel, Rücken neutral.'},
 {id:'cable_row',n:'Rudern am Kabel sitzend',p:'hpull',m:'back',s:['biceps'],eq:['cable'],t:'c',inc:2.5,cue:'Brust raus, Ellbogen nach hinten, vorne Dehnung zulassen.'},
 {id:'chest_row',n:'Brustgestütztes Rudern (Kurzhanteln)',p:'hpull',m:'back',s:['biceps','shoulders'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Brust auf Schrägbank, Ellbogen Richtung Hüfte ziehen.'},
 {id:'db_row',n:'Einarmiges Rudern (Kurzhantel)',p:'hpull',m:'back',s:['biceps'],eq:['dumbbell','bench'],t:'c',inc:2,cue:'Hand und Knie auf der Bank, Hantel zur Hüfte.'},
 {id:'inverted_row',n:'Rudern unter der Stange (Körpergewicht)',p:'hpull',m:'back',s:['biceps'],eq:['pullupbar'],t:'c',inc:2.5,bw:1,cue:'Stange tief oder stabiler Tisch, Körper gerade, Brust zur Stange.'},
 {id:'band_row',n:'Rudern mit Band',p:'hpull',m:'back',s:['biceps'],eq:['band'],t:'c',inc:0,cue:'Band auf Brusthöhe befestigt, Schulterblätter zusammenziehen.'},
 {id:'pullup',n:'Klimmzüge',p:'vpull',m:'back',s:['biceps'],eq:['pullupbar'],t:'c',inc:2.5,bw:1,rr:[4,10],cue:'Aus dem toten Hang, Brust zur Stange. Zu schwer? Mit Band unterstützen.'},
 {id:'lat_pulldown',n:'Latziehen',p:'vpull',m:'back',s:['biceps'],eq:['cable'],t:'c',inc:2.5,cue:'Leicht zurücklehnen, Stange zur oberen Brust, oben volle Dehnung.'},
 {id:'chinup',n:'Klimmzüge Untergriff',p:'vpull',m:'back',s:['biceps'],eq:['pullupbar'],t:'c',inc:2.5,bw:1,rr:[4,10],cue:'Schulterbreiter Untergriff, Ellbogen nach unten ziehen.'},
 {id:'band_pulldown',n:'Latziehen mit Band',p:'vpull',m:'back',s:['biceps'],eq:['band'],t:'c',inc:0,cue:'Band oben befestigt, kniend nach unten ziehen.'},
 {id:'cable_fly',n:'Kabel-Flys',p:'fly',m:'chest',s:[],eq:['cable'],t:'i',inc:2.5,cue:'Leicht gebeugte Arme, Hände vor der Brust zusammenführen.'},
 {id:'pec_deck',n:'Butterfly (Maschine)',p:'fly',m:'chest',s:[],eq:['machine'],t:'i',inc:2.5,cue:'Griffe auf Brusthöhe, hinten Dehnung ohne Schulterschmerz.'},
 {id:'db_fly',n:'Flys (Kurzhanteln)',p:'fly',m:'chest',s:[],eq:['dumbbell','bench'],t:'i',inc:2,av:['shoulder'],cue:'Weiter Bogen, nur so tief wie die Schulter es angenehm zulässt.'},
 {id:'deficit_pushup',n:'Liegestütze mit erhöhten Händen (Defizit)',p:'fly',m:'chest',s:['triceps'],eq:[],t:'i',inc:2.5,bw:1,cue:'Hände auf Büchern oder Griffen, Brust tiefer als die Hände.'},
 {id:'db_lateral',n:'Seitheben (Kurzhanteln)',p:'lateral',m:'shoulders',s:[],eq:['dumbbell'],t:'i',inc:1,cue:'Ellbogen führen, bis Schulterhöhe, ohne Schwung.'},
 {id:'cable_lateral',n:'Seitheben am Kabel',p:'lateral',m:'shoulders',s:[],eq:['cable'],t:'i',inc:1.25,cue:'Kabel hinter dem Körper, gleichmäßige Spannung.'},
 {id:'band_lateral',n:'Seitheben mit Band',p:'lateral',m:'shoulders',s:[],eq:['band'],t:'i',inc:0,cue:'Band unter dem Fuß, langsam ablassen.'},
 {id:'face_pull',n:'Face Pulls',p:'rear',m:'shoulders',s:['back'],eq:['cable'],t:'i',inc:2.5,cue:'Seil auf Augenhöhe, Hände neben die Ohren ziehen.'},
 {id:'rear_fly',n:'Reverse Flys (Kurzhanteln)',p:'rear',m:'shoulders',s:['back'],eq:['dumbbell'],t:'i',inc:1,cue:'Vorgebeugt, Arme seitlich öffnen, Schulterblätter mitnehmen.'},
 {id:'pull_apart',n:'Band Pull-aparts',p:'rear',m:'shoulders',s:['back'],eq:['band'],t:'i',inc:0,cue:'Arme gestreckt, Band vor der Brust auseinanderziehen.'},
 {id:'db_curl',n:'Bizepscurls (Kurzhanteln)',p:'curl',m:'biceps',s:[],eq:['dumbbell'],t:'i',inc:1,cue:'Ellbogen am Körper, unten voll strecken.'},
 {id:'bb_curl',n:'Bizepscurls (SZ/Langhantel)',p:'curl',m:'biceps',s:[],eq:['barbell'],t:'i',inc:2.5,cue:'Kein Schwung aus dem Rücken, langsam ablassen.'},
 {id:'cable_curl',n:'Bizepscurls am Kabel',p:'curl',m:'biceps',s:[],eq:['cable'],t:'i',inc:2.5,cue:'Konstante Spannung, oben kurz anspannen.'},
 {id:'hammer_curl',n:'Hammercurls',p:'curl',m:'biceps',s:[],eq:['dumbbell'],t:'i',inc:1,cue:'Neutraler Griff, Daumen zeigt nach oben.'},
 {id:'band_curl',n:'Bizepscurls mit Band',p:'curl',m:'biceps',s:[],eq:['band'],t:'i',inc:0,cue:'Band unter den Füßen, oben 1 Sekunde halten.'},
 {id:'pushdown',n:'Trizepsdrücken am Kabel',p:'triext',m:'triceps',s:[],eq:['cable'],t:'i',inc:2.5,cue:'Ellbogen fixiert, unten voll strecken.'},
 {id:'oh_ext',n:'Trizepsstrecken über Kopf (Kurzhantel)',p:'triext',m:'triceps',s:[],eq:['dumbbell'],t:'i',inc:2,cue:'Hantel hinter den Kopf, Ellbogen zeigen nach vorn-oben.'},
 {id:'skull',n:'Skullcrusher (SZ-Stange)',p:'triext',m:'triceps',s:[],eq:['barbell','bench'],t:'i',inc:2.5,cue:'Stange hinter die Stirn absenken, Oberarme ruhig.'},
 {id:'close_pushup',n:'Enge Liegestütze',p:'triext',m:'triceps',s:['chest'],eq:[],t:'i',inc:2.5,bw:1,cue:'Hände unter den Schultern, Ellbogen nah am Körper.'},
 {id:'band_pushdown',n:'Trizepsdrücken mit Band',p:'triext',m:'triceps',s:[],eq:['band'],t:'i',inc:0,cue:'Band oben befestigt, Ellbogen am Körper.'},
 {id:'cable_crunch',n:'Kabel-Crunch',p:'core',m:'abs',s:[],eq:['cable'],t:'i',inc:2.5,cue:'Kniend, Brustbein zum Becken einrollen.'},
 {id:'hanging_knee',n:'Knieheben hängend',p:'core',m:'abs',s:[],eq:['pullupbar'],t:'i',inc:2.5,bw:1,cue:'Becken einrollen, nicht schwingen.'},
 {id:'dead_bug',n:'Dead Bug',p:'core',m:'abs',s:[],eq:[],t:'i',inc:0,bw:1,rr:[8,16],cue:'Lendenwirbel am Boden, Arm und Gegenbein langsam strecken.'},
 {id:'front_squat',n:'Frontkniebeuge (Langhantel)',p:'squat',m:'quads',s:['glutes'],eq:['barbell'],t:'c',inc:2.5,av:['knee'],cue:'Stange auf den vorderen Schultern, Ellbogen hoch, Oberkörper aufrecht.'},
 {id:'deadlift',n:'Kreuzheben (Langhantel)',p:'hinge',m:'hamstrings',s:['glutes','back'],eq:['barbell'],t:'c',inc:5,av:['back'],cue:'Stange über dem Mittelfuß, Rücken neutral, Beine drücken den Boden weg, Stange nah am Körper.'},
 {id:'nordic',n:'Nordic Hamstring Curl',p:'legcurl',m:'hamstrings',s:[],eq:[],t:'i',inc:2.5,bw:1,rr:[4,8],cue:'Füße fixiert, Hüfte gestreckt, so langsam wie möglich nach vorn ablassen, mit den Händen abfangen. In Studien mit Fußballern senkte die Übung Verletzungen der Beinbeuger. Vorsichtig einsteigen: starker Muskelkater.'},
 {id:'dips',n:'Dips am Barren',p:'hpush',m:'chest',s:['triceps','shoulders'],eq:['dipbar'],t:'c',inc:2.5,bw:1,av:['shoulder'],rr:[6,12],cue:'Leicht vorlehnen, bis die Oberarme waagerecht sind, Schultern unten halten.'}
];
export const EXM=Object.fromEntries(EX.map(e=>[e.id,e]));
export const exById=id=>EXM[id]||{id,n:id,p:'core',m:'abs',s:[],eq:[],t:'i',inc:2.5};

export const TPL={
 FA:{name:'Ganzkörper A',slots:['squat','hpush','hpull','legcurl','lateral','curl','core']},
 FB:{name:'Ganzkörper B',slots:['hinge','vpush','vpull','lunge','triext','calf']},
 FC:{name:'Ganzkörper C',slots:['lunge','hpush','vpull','glute','fly','triext','curl'],v:1},
 UA:{name:'Oberkörper A',slots:['hpush','vpull','vpush','hpull','lateral','curl','triext']},
 UB:{name:'Oberkörper B',slots:['hpush','hpull','vpull','fly','lateral','triext','curl'],v:1},
 LA:{name:'Unterkörper A',slots:['squat','legcurl','lunge','calf','core']},
 LB:{name:'Unterkörper B',slots:['hinge','legext','glute','calf','core'],v:1},
 PU:{name:'Push',slots:['hpush','vpush','fly','lateral','triext']},
 PL:{name:'Pull',slots:['vpull','hpull','rear','curl','curl']},
 LG:{name:'Beine',slots:['squat','hinge','legext','legcurl','calf','core']},
 PU2:{name:'Push B',slots:['hpush','vpush','fly','lateral','triext'],v:1},
 PL2:{name:'Pull B',slots:['vpull','hpull','rear','curl','curl'],v:1},
 LG2:{name:'Beine B',slots:['hinge','squat','lunge','legcurl','calf','core'],v:1}
};
export const SPLITS={2:['FA','FB'],3:['FA','FB','FC'],4:['UA','LA','UB','LB'],5:['UA','LA','PU','PL','LG'],6:['PU','PL','LG','PU2','PL2','LG2']};
export const SPLITNAME={2:'Ganzkörper 2×',3:'Ganzkörper 3×',4:'Ober-/Unterkörper',5:'Ober/Unter + Push/Pull/Beine',6:'Push/Pull/Beine 2×'};
export const RIR={beg:[3,3,2,2,4],int:[3,2,2,1,4],adv:[3,2,1,1,4]};
export const WF=[0.8,0.9,1.0,1.1];

// Bildmaterial: je zwei Fotos (Start/Ende) aus free-exercise-db (gemeinfrei, Unlicense), in media/ex/<id>-0.webp und -1.webp
export const MEDIA=new Set('bb_squat,leg_press,hack_squat,goblet_squat,bw_squat,front_squat,rdl,db_rdl,sl_rdl,deadlift,bulgarian,walking_lunge,step_up,split_squat,leg_ext,lying_curl,seated_curl,nordic,hip_thrust,glute_bridge,calf_machine,db_calf,bench,db_bench,incline_db,chest_press,pushup,dips,ohp,db_ohp,machine_shoulder,bb_row,cable_row,chest_row,db_row,inverted_row,pullup,lat_pulldown,chinup,cable_fly,pec_deck,db_fly,db_lateral,cable_lateral,band_lateral,face_pull,rear_fly,pull_apart,db_curl,bb_curl,cable_curl,hammer_curl,pushdown,oh_ext,skull,close_pushup,cable_crunch,hanging_knee,dead_bug'.split(','));
export const LEGS=['quads','hamstrings','glutes','calves'];
export const LOCS={gym:'Gym',home:'Zuhause'};
