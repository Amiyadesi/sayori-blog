// 台词本：只改引号内的文字；\n 是屏幕上的换行。分支条件在 p34-adventure.js。
export const LINES = {
  // 相遇、试玩邀请
  arrival: ['等下，球还没停\n……你能看见啊？', '那正好\n我自己打都快打习惯了'],
  offer: {
    draft: '我做了个打砖块\n试试？',
    tuned: '这份宽了一点\n砖还是那一组',
    guided: '这次会自己瞄准\n你再打几球看看',
  },
  oldTrial: '我把同一组砖留了三份\n先试一下最早的回球',

  // 日常闲聊：按点击次数轮换，不推进主线
  chat: {
    sound: '我刚把爆炸声换掉了',
    door: '不是，太像关门了\n炸一次就以为有人走了',
    trySound: '你开声音打一局就知道了',
    water: '昨天想做水波\n最后一晚上都在调那个弯',
    curve: '对\n没做成水波，但这条我也挺喜欢',
    rain: '我在听昨天录的雨\n中间有辆车一直倒不出去',
    car: '留着啊\n每次都以为它这次该出去了',
  },

  // 两轮修改反馈
  feedback: {
    missed: '刚才那几球\n挡板过去又滑了一点',
    caught: '我喜欢横着抽那一下\n但确实不太好停',
    tuned: '现在好接多了\n你还会想横着抽吗？',
  },
  revision: {
    keepInertia: '那个手感我也舍不得\n不过我还是做了另一份',
    changeInertia: '嗯，我也总滑过去\n所以改了另一份',
    contact: '挡板宽了一点\n回弹方向改成看接球的位置',
    keepChanges: '这两处我想先留着',
    guided: '我还试了个自动瞄准\n一直打不到最后一块，挺烦的',
  },

  // 分歧：四种意见改变回应，不评判玩家善恶
  decide: '我想把三份收成一个版本\n结果改一处，又想改回去',
  conflict: {
    free: '我也喜欢那一下\n可昨天还在改它',
    clear: '是省心了\n可我又想把它关掉',
    both: '都留着呢\n我已经不想点开了',
    unsure: '我也是\n昨天还觉得改好了',
    again: '今天又改回去了\n我都不知道昨天在忙什么',
    close: '先关了吧',
  },

  // 重逢、记忆与共作
  reunion: ['……是你啊', '先别开灯'],
  sit: '你坐这儿',
  memory: {
    light: '这个弯你还留着\n我当时还嫌它歪',
    round: '这一下我记得\n我当时只顾着看砖碎没碎',
    empty: '好\n我先把这些挪开',
    likedGuided: '你喜欢自动瞄准，我知道\n但这次我想自己控制',
    freeReturn: '我还是想试那种横着打的手感',
    invite: '这两堆砖接不上\n你帮我挪一下中间的炸弹？',
  },
  workshop: {
    after: '这份先放这儿\n我还想试试别的位置',
    cleared: '炸开了\n不过右边还有点挤',
    missed: '还是没连上\n右边再往里一点呢',
    save: '这份先留着\n我另开一份',
    continue: '别关\n我再挪一下',
    placed: '打几球看看\n光摆着我也看不出来',
    untouched: '中间那块还没挪\n先试试靠哪边',
  },
  after: {
    letter: '留言我留着了\n先等我打完这局',
    visit: '来啦\n我又挪了一点',
  },

  // 页面大字、拉光时的反应
  home: {
    arrive: '诶？\n先别碰——', shared: '回来了？', tuned: '这次好接一点',
    guided: '又改了一份', choice: '有点乱', inside: '我在里面', after: '来啦\n我还在改',
  },
  rooms: { works: '试试这个', lab: '拉一下', archive: '先留着', blog: '写在这里', guestbook: '留点什么？' },
  map: '去哪里？',
  reading: '你先看',
  closedReading: '她写的',
  lightSaved: '好，就留这条！',
  lightDrag: ['等下，这边别拉太直', '这个弯留着！', '再往左一点？\n嗯，就这儿'],
  touch: '喂，\n我刚调好的！',
  lightReset: '拉回来了\n你再试试',
  leave: '走啦？\n下次见',
  cannotSave: '这里暂时存不下来',
  letterSaved: '好\n就放在这儿',
};

// 玩家可点的回应。改文案不会改变按钮对应的动作。
export const CHOICES = {
  next: '嗯', play: '玩', later: '待会儿', wander: '我先逛逛', explore: '我自己逛逛',
  leave: '回原来的网页', busy: '你还在忙什么？', tryIt: '去试试',
  noisy: '原来那个很吵？', now: '现在呢？', keepBusy: '那你接着忙',
  thatCurve: '就是实验室那条？', pullLight: '我去拉一下', leaveLight: '先别动它了',
  youWork: '那你忙', keepRain: '你连这个也留着？', read: '看看你写的', quiet: '不打扰了',
  draft: '试初稿', finishStage: '我先把这关打完',
  inertia: '惯性挺有意思', freeAgain: '会，原来能甩得更开',
  slippery: '容易滑过头', comfortable: '现在舒服多了',
  feedbackUnsure: '我还没拿准', moreBalls: '再打几球',
  opinionFree: '我更喜欢能自己甩球', opinionClear: '自动瞄准也挺好',
  opinionBoth: '先把三份都留着呢？', opinionUnsure: '我也还没想清楚',
  desk: '去工作间', moreStages: '再打几关', chat: '聊别的',
  memoryRound: '聊起之前那次回球', memoryLight: '把留下的光拿给她看', memoryEmpty: '先陪她待一会儿',
  keepMaking: '继续改这份', previous: '打打上一份', outside: '去外面逛逛',
  retry: '再试', backOutside: '先回外面',
};
