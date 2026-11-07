const layout = (name, rows, tip = '', motion = null) => ({ name, rows: rows.trim().split(/\s+/), tip, motion });

// 1/2/3 are remaining hits; B chains an explosion, E gives energy, . leaves space.
export const STAGES = [
  layout('起手', `
    .11111111.
    1122222211
    11.1EE1.11
    .111..111.
  `, '两道刻痕，要打两次'),
  layout('斜着打', `
    22......22
    .22....22.
    ..221122..
    ...1EE1...
    ..111111..
    .11....11.
  `, '球碰到挡板时，点击击打'),
  layout('连起来', `
    .11222211.
    .11B11B11.
    .11222211.
    ..11EE11..
    ...1111...
  `, '菱形会炸开，先找连锁'),
  layout('开一条缝', `
    222....222
    131....131
    1B111111B1
    222.11.222
    .E1.11.1E.
  `, 'Shift 冲刺，赶得上另一边'),
  layout('蓄满', `
    .33333333.
    2222222222
    11E1111E11
    .111BB111.
    ...1EE1...
  `, '能量满了，按 R 发射激光'),
  layout('从后面', `
    1111111111
    1B222222B1
    1123333211
    112....211
    11E....E11
    .11....11.
  `),
  layout('擦过去', `
    .222..222.
    1111..1111
    .11E..E11.
    ..1B..B1..
    ...2222...
    ....11....
  `, '按住右键吸引球，会消耗能量'),
  layout('横移', `
    .22222222.
    .11111111.
    .1B1EE1B1.
    .11111111.
    .22....22.
  `, '', { axis:'x', amount:.025, speed:.85 }),
  layout('左右两边', `
    333....333
    2B2....2B2
    212....212
    1E1....1E1
    111....111
    .11....11.
  `),
  layout('别急着开火', `
    3..3..3..3
    2222222222
    1B1E11E1B1
    .11111111.
    ..222222..
    ...1EE1...
  `),
  layout('错开半拍', `
    .22222222.
    .11BB1111.
    .1111BB11.
    .22EE2222.
    .11111111.
  `, '', { axis:'x', amount:.027, speed:1.1, alternate:true }),
  layout('空心', `
    ..222222..
    .23B11B32.
    121....121
    1E1....1E1
    .12111121.
    ..111111..
  `),
  layout('三层', `
    3333333333
    .22B11B22.
    1111111111
    .11E11E11.
    222....222
    .11....11.
  `),
  layout('把球留在上面', `
    11E1111E11
    .1B1111B1.
    2222222222
    333.11.333
    11..11..11
    .1......1.
  `),
  layout('传过去', `
    22B22B22B2
    1111111111
    .2B22B22B.
    .11111111.
    ..E1..1E..
  `),
  layout('浮动', `
    .33333333.
    .11B11B11.
    .22222222.
    .11E11E11.
    .11111111.
  `, '', { axis:'y', amount:12, speed:1.15 }),
  layout('窄口', `
    1111111111
    22B2222B22
    333.11.333
    222.11.222
    1E1.11.1E1
    111....111
  `),
  layout('一块一块拆', `
    3.3.33.3.3
    .22222222.
    3.3.33.3.3
    .1E1111E1.
    11B1111B11
    .11....11.
  `),
  layout('两股', `
    .333..333.
    .2B2..2B2.
    .222..222.
    .1E1..1E1.
    .111..111.
    ..11..11..
  `, '', { axis:'x', amount:.022, speed:1.4, alternate:true }),
  layout('十字', `
    ...3333...
    ...2BB2...
    2222112222
    1E111111E1
    2222112222
    ...1111...
    ....EE....
  `),
  layout('外壳', `
    3333333333
    311B11B113
    32E1111E23
    32..11..23
    32..11..23
    111....111
  `),
  layout('换手', `
    .33B22B33.
    .22111122.
    .11E11E11.
    .222BB222.
    .11111111.
    ..22..22..
  `, '', { axis:'x', amount:.03, speed:1.2, alternate:true }),
  layout('余波', `
    332B22B233
    2221111222
    .1B3333B1.
    .111EE111.
    22.2112.22
    11..BB..11
    .11....11.
  `),
  layout('再打一局', `
    .33333333.
    .2B2222B2.
    .222EE222.
    .31B11B13.
    .22111122.
    .11E11E11.
    ..111111..
  `, '', { axis:'x', amount:.022, speed:.95, alternate:true }),
];

export const SAMPLE = layout('同一组砖', `
  .222..222.
  1111..1111
  11B1..1B11
  .1E1..1E1.
  ..11..11..
`);

export const WORKSHOP = layout('再挪一点', `
  .222..222.
  .1B1..1B1.
  .111..111.
  ..E....E..
`);

export function createBricks(level, width, height, workshopX = null) {
  const cols=level.rows[0].length, step=width*.84/cols, rowStep=Math.min(51,width*.068);
  const top=Math.max(142,height*.185), w=step*.84, h=Math.min(29,width*.044);
  const bricks=[];
  level.rows.forEach((row,y)=>{
    if(row.length!==cols)throw new Error(`Unequal rows in ${level.name}`);
    [...row].forEach((type,x)=>{
      if(type==='.')return;
      if(!'123BE'.includes(type))throw new Error(`Unknown brick ${type}`);
      const hp='123'.includes(type)?Number(type):1;
      bricks.push({id:y*cols+x,x:width*.08+step*(x+.5),y:top+y*rowStep,w,h,hp,maxHp:hp,
        kind:type==='B'?'bomb':type==='E'?'energy':'normal',row:y,col:x,movable:false});
    });
  });
  if(workshopX!==null)bricks.push({id:1000,x:workshopX/1920*width,y:top+rowStep*1.5,w:Math.min(40,w),h:Math.min(40,w),hp:1,maxHp:1,kind:'bomb',row:1,col:5,movable:true});
  for(const b of bricks){b.baseX=b.x;b.baseY=b.y;}
  return bricks;
}
