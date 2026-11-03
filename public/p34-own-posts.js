/**
 * @typedef {Object} OwnPostSection
 * @property {string | null} heading
 * @property {string[]} paragraphs
 */

/**
 * @typedef {Object} OwnPost
 * @property {string} id
 * @property {string} slug
 * @property {string} path
 * @property {string} href
 * @property {string} date
 * @property {string} kicker
 * @property {string} title
 * @property {string} excerpt
 * @property {string} lead
 * @property {string} voiceRemark
 * @property {OwnPostSection[]} sections
 * @property {string[]} paragraphs
 */

/** @type {Omit<OwnPost, 'paragraphs'>[]} */
const RAW_OWN_POSTS = [
  {
    id: 'prism-and-paddle',
    slug: 'prism-and-paddle',
    path: '/notes/prism-and-paddle',
    href: '/notes/prism-and-paddle/?paper=0617',
    date: '11 / 03',
    kicker: '光路与页面实验',
    title: '把折光拨偏一点，顺便在底下接球',
    excerpt: '本来只是嫌主页那束光太直，调着调着就在页面底下支起挡板打起球来了。',
    lead: '原本只想把主页那块三棱镜拨偏一点，结果顺手在页面底下支起了挡板。',
    voiceRemark: '主页底下那块挡板还在，每次想试一下反弹角度都会不知不觉多打两局。',
    sections: [
      {
        heading: null,
        paragraphs: [
          '之前看主页右边那束光，总觉得它斜得太规矩了，什么时候看都朝同一个方向。我干脆把桌角那块三棱镜往外拨了一点，让折出去的光路换个偏角；旁边顺手拉了一根细光弦，清透青、晴空蓝和晨光金三档张力松紧真的不一样，我自己最常停在清透青那一档。',
        ],
      },
      {
        heading: '拿整页的标题和卡片接球',
        paragraphs: [
          '看着页面上排开的标题和那几张卡片，我突然想试试拿光球去撞它们会怎么样，就在最底下支起了一块挡板。结果标题和卡片被撞上的时候真的会往里缩一下再弹回来，撞狠了边角还会磕出折角。',
          '我不忍心看卡片一直歪着，就加了个小规矩：只要连续接住、撞满五下，我就顺手帮它修好一处折角。原本只是想试一下挡板边缘的角度，结果每次发完球，都会忍不住多打好几个回合。',
        ],
      },
    ],
  },
  {
    id: 'empty-corners',
    slug: 'empty-corners',
    path: '/notes/empty-corners',
    href: '/notes/empty-corners/?paper=0617',
    date: '10 / 29',
    kicker: '偏见与备忘',
    title: '左边空着就空着，别往里塞小挂件',
    excerpt: '看见页面空出一块就想找东西填满，十有八九会把刚腾出来的清净全毁掉。',
    lead: '不是每一块空地方都欠着一排小挂件。',
    voiceRemark: '左边那块空地就让它空着吧，硬塞进来的小卡片最吵了。',
    sections: [
      {
        heading: null,
        paragraphs: [
          '前阵子翻旧文章，看到那篇博客改版记录：先把堆成山的小卡片装饰全砍了，只留最上面一段简介，结果写到最后又犯嘀咕，纠结左边空出来的地方要不要再放点什么。',
          '我看到那句就想拦着——千万别放。改页面最怕看见空地就觉得手痒，今天为了填左边补一个小框，过两天准会为了两边对称再加三个挂件，最后好不容易腾出来的清净又全绕回原点。',
          '他也写过限时做游戏的事：他在最后六个小时砍掉解谜，只留下追逐。我赞成砍掉，但那跟左边要不要放挂件是两回事。做不完的机关是不得不砍，页面左边明明已经排完了，纯粹是看着空地手痒。能忍住不往里塞那一下，比砍掉旧挂件难多了。',
        ],
      },
    ],
  },
  {
    id: 'afternoon-rankings',
    slug: 'afternoon-rankings',
    path: '/notes/afternoon-rankings',
    href: '/notes/afternoon-rankings/?paper=0617',
    date: '10 / 21',
    kicker: '闲暇评定',
    title: '暂时第一名：倒汽水的声音',
    excerpt: '下午看视频时顺手排的几个声音，往冰块上倒汽水的那两秒暂时排第一。',
    lead: '下午不想改字，干脆把最近听见的声音按顺耳程度排了个名。',
    voiceRemark: '视频里往冰块上倒汽水的那两秒，暂时还是第一名。',
    sections: [
      {
        heading: null,
        paragraphs: [
          '第一名是视频里往玻璃杯倒汽水的前两秒。杯底放两三块冰，汽水冲下去先“咔”地响一声，紧接着窜起一片细碎的沙沙声，听着最利索。过了前两秒就不算数了，气跑掉一半，声音马上发闷。',
          '第二名留给没配背景音乐的旧录音，翻厚纸页或者拨机械开关的“嗒”一声。干干净净，不拖泥带水。',
        ],
      },
      {
        heading: '卡住的四个音',
        paragraphs: [
          '第三名其实挺烦人：前两天看短视频，背景曲子中间有一小句刚好四个音的转折。视频早就关了，那四个音还一直来回打转，偏偏短得没法搜歌名，也不知道下一句旋律往哪拐。',
          '至于突然炸响的闹钟音效和硬塞进来的罐头笑声，直接除名。每次冷不防撞上这两种动静，我都会立刻把页面关掉，去隔壁主页打两局球清清静。',
        ],
      },
    ],
  },
];

/** @type {OwnPost[]} */
export const HER_OWN_POSTS = RAW_OWN_POSTS.map(post => ({
  ...post,
  paragraphs: post.sections.flatMap(section => section.paragraphs),
}));

const OWN_POST_BY_SLUG = new Map(HER_OWN_POSTS.map(post => [post.slug, post]));

export function normalizeBlogPath(pathname = '/') {
  const clean = String(pathname || '/').trim().replace(/\/+$/, '');
  return clean || '/';
}

export function getOwnPostBySlug(slug = '') {
  const key = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  return OWN_POST_BY_SLUG.get(key) || null;
}

export function getOwnPostByPath(pathname = '/') {
  const clean = normalizeBlogPath(pathname);
  const match = /^\/notes\/([a-z0-9-]+)$/i.exec(clean);
  if (!match) return null;
  return getOwnPostBySlug(match[1]);
}

export function isOwnNotePath(pathname = '/') {
  return Boolean(getOwnPostByPath(pathname));
}
