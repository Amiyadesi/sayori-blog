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
    date: '11 / 04', kicker: '刚玩过的', title: '打坏了算我的',
    excerpt: '退出的时候我会收拾。你可以放心拆。',
    lead: '我本来觉得这页已经摆得很好看了。',
    voiceRemark: '你打完以后，我有点不想收拾。',
    sections: [
      { heading: null, paragraphs: [
        '然后把球放了进去。现在标题会歪，字会被撞出缺口，那句还没找到位置的话也能挨打。好像比原来更好看了。至少更好笑。',
        '我最喜欢的是连续打到几个地方。球还没回来，这边已经乱成一团。你得接球，我得看着刚摆好的东西被你拆掉。很公平。',
        '如果真的快掉了，我会垫一下。不是每次都垫，不然就变成你看我打球了。',
      ]},
      { heading: '收拾也是一部分', paragraphs: [
        '打完我会把字捡回来。最麻烦的是那个逗号，明明只占一点地方，歪着放和正着放看起来完全不一样。',
        '但看着刚才的缺口消失，我又有点舍不得。先把成绩记下来吧。下次看看能不能拆得更乱。',
      ]},
    ],
  },
  {
    id: 'empty-corners', slug: 'empty-corners',
    path: '/notes/empty-corners', href: '/notes/empty-corners/?paper=0617',
    date: '11 / 04', kicker: '那个边缘', title: '整页拽过来的时候',
    excerpt: '本来只想挪一小块。现在会一起跟过来。',
    lead: '边上那个不是滚动条。',
    voiceRemark: '你拉完记得松手。我还拽着另一头呢。',
    sections: [
      { heading: null, paragraphs: [
        '拉它的时候，不光是旁边那一块会动。字、那条线、开始按钮，都得跟着让一点位置。要是只有一个小东西被拉来拉去，跟拖图标有什么区别。',
        '我没有让它们走一样远。有的离得近，有的慢一拍。松手以后还会往回多走一点，再停下。对，就是那个多走的一点。我喜欢那个。',
        '另外，逗号可以戳。它已经不负责断句了，干脆让它干点别的。',
      ]},
      { heading: null, paragraphs: [
        '下面那几个字也可以按。别问有什么用。这个问题再问下去，我很多东西都得删。',
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
