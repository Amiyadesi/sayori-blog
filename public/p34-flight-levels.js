const m = (x, y, extra = {}) => ({ x, y, r: 52, ...extra });
const w = (x, y, direction = 0) => ({ x, y, r: 38, direction });
// Walls: endpoints, optional switch channel, optional inverted opening.
export const FLIGHT_LEVELS = [
  { title: '轻轻放开', region: '纸岸', hint: '两片羽都带上，再去空心圆。',
    moons: [m(0,0),m(250,-160,{key:true}),m(520,-90,{key:true}),m(720,-330)], finish:3 },
  { title: '留个来回', region: '纸岸', hint: '先别急着去出口。羽片在两边。',
    moons: [m(0,0),m(280,-200),m(30,-420,{key:true}),m(590,-420,{key:true}),m(540,-20)], finish:4,
    walls:[[400,-270,400,-100]] },
  { title: '双月亮', region: '纸岸', hint: '两边都可以绕。飞过的地方仍能回来。',
    moons:[m(0,0),m(305,-180),m(70,-455,{key:true}),m(350,-735),m(95,-1030),m(570,-420,{key:true,double:true})], finish:4 },
  { title: '借一阵风', region: '风廊', hint: '停下时，点风箭头可以转向。让它向上。',
    moons:[m(0,0),m(250,-320,{key:true}),m(520,-520)], finish:2,
    winds:[w(250,0)], walls:[[125,-430,125,-80]] },
  { title: '两次转弯', region: '风廊', hint: '先把两阵风都调好，再接着飞。',
    moons:[m(0,0),m(260,-360,{key:true}),m(520,-640,{key:true}),m(800,-600)], finish:3,
    winds:[w(260,0),w(520,-360,1)], walls:[[130,-690,130,-75],[390,-800,390,-445]] },
  { title: '借回来的风', region: '风廊', hint: '上面没有横穿的路。同一阵风，可以先向上，再向右。',
    moons:[m(-280,0),m(280,0,{key:true}),m(0,-330,{key:true}),m(-280,-330,{key:true}),m(280,-520)], finish:4,
    winds:[w(0,0,1)], walls:[[-130,-950,-130,-80],[130,-950,130,-80]] },
  { title: '开一下', region: '折门', hint: '去带菱形的月亮。停靠才会开门。',
    moons:[m(0,0),m(0,-320,{switch:0}),m(410,-180,{key:true}),m(690,-430)], finish:3,
    walls:[[210,-650,210,150,0]] },
  { title: '开一边，关一边', region: '折门', hint: '同一个开关，开右边，也关左边。先拿哪片羽？',
    moons:[m(0,0),m(250,-180,{switch:0}),m(-60,-400,{key:true}),m(560,-160,{key:true}),m(620,-530)], finish:4,
    walls:[[100,-650,100,-250,0,true],[430,-700,430,120,0]] },
  { title: '隔着两扇门', region: '折门', hint: '右边还有一个菱形开关。去时关门，回来开门。',
    moons:[m(0,0),m(220,-110,{switch:0}),m(490,-120,{switch:1}),m(1080,-190,{key:true}),m(490,-610,{key:true}),m(770,-380,{switch:0}),m(60,-720)], finish:6,
    walls:[[360,-1200,360,350,0],[640,-1200,640,350,1],[930,-1200,930,350,0,true]] },
  { title: '带回来', region: '折门', hint: '先想回程。右上的羽片需要开圆门，出口却要关圆门。',
    moons:[m(0,0),m(230,-180,{switch:0}),m(580,-90,{key:true}),m(780,-330,{switch:1}),m(590,-680,{key:true}),m(10,-660,{switch:1}),m(210,-930,{key:true}),m(-170,-970),m(-220,-380,{key:true})], finish:7,
    walls:[[400,-1400,400,350,0],[-500,-440,400,-440,0,true],[400,-460,1120,-460,1],[-60,-1400,-60,-550,1,true]] },
  { title: '纸的背面', region: '背页', hint: '两个同形的折口相连。方向会带过去。',
    moons:[m(0,0),m(880,-230,{key:true}),m(1180,-400)], finish:2,
    walls:[[460,-800,460,300]], folds:[[230,-30,730,-230,0]] },
  { title: '把方向也折过去', region: '背页', hint: '纸折了四分之一圈。往右进入，从另一边向上出来。',
    moons:[m(0,0),m(780,-370,{key:true}),m(1030,-600)], finish:2,
    walls:[[450,-900,450,350]], folds:[[240,-20,780,-140,-1]] },
  { title: '折进去，再折回来', region: '背页', hint: '单折口通向来处，双折口通向背页。出口在中间这一页。',
    moons:[m(-140,40),m(720,20,{key:true}),m(980,-320,{switch:0}),m(1450,-510,{key:true}),m(1300,-900,{key:true}),m(740,-720),m(800,-580)], finish:5,
    walls:[[340,-1350,340,400],[1180,-1350,1180,400],[340,-450,1180,-450,0]], folds:[[150,40,550,20,0],[1030,-580,1300,-620,-1]] },
  { title: '同一扇门，两边', region: '背页', hint: '回来也要穿折口。离开右边前，再落一次开关。',
    moons:[m(0,0),m(930,-300,{switch:0}),m(930,0,{key:true}),m(1300,-290,{key:true}),m(-100,-430)], finish:4,
    walls:[[500,-900,500,350],[1100,-850,1100,250,0],[-230,-220,180,-220,0,true]], folds:[[230,0,740,0,0]] },
  { title: '风吹开的门', region: '未完的图', hint: '借风去，也借风回。右边的菱形开关要去两次。',
    moons:[m(0,0),m(240,-350,{switch:0}),m(750,-350,{switch:1}),m(1080,-350,{key:true}),m(0,-650,{key:true}),m(1080,-800,{key:true}),m(750,-750,{switch:0}),m(0,-1040)], finish:7,
    winds:[w(240,0)], walls:[[120,-1500,120,-80],[380,-1500,380,350,0],[540,-1500,540,350],[920,-1500,920,350,1],[920,-610,1480,-610,0,true]], folds:[[480,-350,600,-350,0]] },
  { title: '雨停在半空', region: '未完的图', hint: '右边关菱形门，中间关圆门。回来的折口在门的另一侧。',
    moons:[m(0,0),m(200,-240,{switch:0}),m(40,-570,{key:true}),m(620,-220,{key:true}),m(660,-640,{switch:1}),m(1060,-300,{switch:0}),m(1240,-640,{key:true}),m(1060,-900,{key:true}),m(600,-1020,{key:true}),m(0,-1000)], finish:9,
    walls:[[400,-1450,400,400],[870,-1450,870,400],[-350,-400,400,-400,0],[400,-800,870,-800,1,true],[870,-480,1590,-480,0,true],[1150,-1450,1150,-500,1],[-350,-800,400,-800,0,true]],
    folds:[[260,-430,530,-230,0],[730,-580,1010,-200,-1]] },
  { title: '来路也会变', region: '未完的图', hint: '右边会关掉圆门。双折口是另一条回程，不必原路返回。',
    moons:[m(0,0),m(260,-150,{switch:0}),m(650,-220,{switch:1}),m(990,-150,{switch:0}),m(1340,-170,{key:true}),m(1330,-620,{switch:1,key:true}),m(1000,-840,{key:true}),m(610,-860,{key:true}),m(230,-850,{key:true}),m(-120,-1080),m(980,180,{key:true})], finish:9,
    walls:[[440,-1500,440,500],[880,-1500,880,500,1],[1150,-1500,1150,500,0,true],[-450,-280,440,-280,0],[880,-450,1150,-450,0,true]],
    folds:[[250,-350,520,-220,0],[1050,-650,620,-700,2]] },
  { title: '我自己选', region: '未完的图', hint: '把全景打开，先找各自的回程。两处折口可以少开一次门。',
    moons:[m(0,0),m(250,-160,{switch:0}),m(-70,-560,{key:true}),m(620,-200,{switch:1}),m(1010,-190,{key:true}),m(1080,-400,{switch:0}),m(1370,-680,{key:true}),m(1040,-830,{switch:1}),m(650,-740,{key:true}),m(280,-1000,{key:true}),m(0,-1280),m(970,-1210,{key:true}),m(1320,-1170,{key:true}),m(230,-650)], finish:10,
    walls:[[440,-1730,440,350,0],[840,-1730,840,350,1],[1190,-1730,1190,350,0,true],[-430,-900,440,-900,1,true],[440,-520,840,-520,0,true],[840,-980,1730,-980,1,true]],
    folds:[[650,-470,260,-770,1],[1010,-510,1040,-1060,2]] },
];

export function newCampaign() { return { v:1, selected:0, records:{}, checkpoint:null }; }
export function readCampaign(raw) {
  if (raw === null) return newCampaign();
  const s = JSON.parse(raw);
  const valid = (ok, label) => { if (!ok) throw new Error(`航图存档有误：${label}`); };
  valid(s?.v === 1 && Number.isInteger(s.selected) && s.selected >= 0 && s.selected < FLIGHT_LEVELS.length, '版本或片段');
  valid(s.records && typeof s.records === 'object' && !Array.isArray(s.records), '记录');
  for (const [id, r] of Object.entries(s.records)) {
    valid(/^(0|[1-9]\d*)$/.test(id) && FLIGHT_LEVELS[Number(id)] && r && Number.isInteger(r.shots) && r.shots > 0 && r.shots <= 100000 && Number.isFinite(r.seconds) && r.seconds >= 0 && r.seconds <= 1e7, '完成记录');
  }
  if (s.checkpoint !== null) {
    const c = s.checkpoint, l = FLIGHT_LEVELS[c.level];
    valid(Number.isInteger(c.level) && c.level === s.selected && l && Number.isInteger(c.node) && l.moons[c.node] && Number.isInteger(c.mask) && c.mask >= 0 && c.mask < 4, '落点');
    valid(Array.isArray(c.keys) && c.keys.every(n => Number.isInteger(n) && l.moons[n]?.key) && new Set(c.keys).size === c.keys.length, '羽片');
    valid(Array.isArray(c.winds) && c.winds.length === (l.winds?.length || 0) && c.winds.every(n => Number.isInteger(n) && n >= 0 && n < 4), '风向');
    valid(Number.isInteger(c.shots) && c.shots >= 0 && c.shots <= 100000 && Number.isFinite(c.seconds) && c.seconds >= 0 && c.seconds <= 1e7, '试玩时间');
  }
  return s;
}
