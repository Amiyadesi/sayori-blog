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
    id: 'prism-and-paddle', slug: 'prism-and-paddle',
    path: '/notes/prism-and-paddle', href: '/notes/prism-and-paddle/?paper=0617',
    date: '11 / 04', kicker: '玩的时候想到的', title: '按钮躲两次就够了',
    excerpt: '第一次没按到有点好笑。一直按不到就不好笑了。',
    lead: '我把开始按钮挪走了。两次。',
    voiceRemark: '第三次它就不躲了。真的。',
    sections: [
      { heading: null, paragraphs: [
        '你靠近那个蓝色按钮的时候，它会往旁边溜一下。第一次大概会以为自己手滑，第二次就知道是谁干的了。第三次不动，老老实实让你按。',
        '本来还想让它多躲几次。后来想想，人家是来打球的，不是来抓按钮的。逗一下就够了。要是它一直躲，我自己也会生气。',
      ]},
      { heading: '打坏了算我的', paragraphs: [
        '球会撞到这页真正的字，不是另外放一堆砖块给你打。那个很大的问号、被拽过的圈、底下还没摆好的几个字，都算。',
        '我喜欢球刚碰到边缘那一下，东西先缩一下，再歪过去。要是每次碰到都把整页晃一遍，打一局大概能把我晃晕。',
        '退出的时候我会收拾。你可以拆得放心一点。只是别一边打，一边认真问我为什么要把标题放在那里。我会分心。',
      ]},
    ],
  },
  {
    id: 'empty-corners', slug: 'empty-corners',
    path: '/notes/empty-corners', href: '/notes/empty-corners/?paper=0617',
    date: '11 / 04', kicker: '先说好', title: '不要替我摆整齐',
    excerpt: '问号歪着不是没放稳，是我放的。',
    lead: '问号歪着不是没放稳，是我放的。',
    voiceRemark: '我知道它是歪的。我看得见。',
    sections: [
      { heading: null, paragraphs: [
        '有些东西排齐了反而不好玩。比如底下那几个字，本来一眼就能读完，分开放以后，你会多看一眼那个感叹号。它看起来像是刚赶过来，前面几个都已经站好了，就它还在往下掉。',
        '当然，也有真没摆好的。比如你拽那个粉色圈，旁边的字就得让一让。松手以后得回得去，不然玩两下，这里就再也没法看了。',
        '我不想每个机关旁边都写“这里有机关”。那跟把礼物拆开以后再送人有什么区别。留一点线头就好了，想不想拉，随你。',
      ]},
      { heading: null, paragraphs: [
        '不过有一个地方我得承认：藏得太好也不行。你如果一直站着不动，我会忍不住提醒。不是催你。我就是想看看你碰到以后会有什么反应。',
      ]},
    ],
  },
  {
    id: 'afternoon-rankings', slug: 'afternoon-rankings',
    path: '/notes/afternoon-rankings', href: '/notes/afternoon-rankings/?paper=0617',
    date: '11 / 03', kicker: '随便排的', title: '暂时第一名：倒汽水的声音',
    excerpt: '只算前两秒。后面的不算。',
    lead: '下午看视频，突然决定给声音排个名。',
    voiceRemark: '不接受闹钟参赛。',
    sections: [
      { heading: null, paragraphs: [
        '第一名是往放了冰块的杯子里倒汽水。刚开始“咔”一下，后面一片沙沙声。只算前两秒。再往后气跑掉了，声音就没那么利索。',
        '第二名是旧录音里机械开关的“嗒”。没有背景音乐，也没人跟着说话。就一下，特别干脆。翻厚纸页也不错，暂时并列第二。',
        '第三名还没决定。有个视频里有四个音，我听完以后一直记着。视频找不到了，下一句也想不起来。挺好听，又挺烦的。',
      ]},
      { heading: '有几位直接除名', paragraphs: [
        '闹钟。突然响起来的广告。明明一点都不好笑还要放的笑声。',
        '还有那个每点一下就响很大声的按钮。别看我，我做的声音可以关。',
      ]},
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
