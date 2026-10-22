// 《书桌背面：回声档案》交互逻辑。仅使用本地浏览器存档，不上传用户输入。
const KEY = "amiya.echoes.v1";
const chapters = [
  { name: "00 / 访客", subtitle: "一个不应该出现的目录", cue: "从书桌开始", answer: ["0521", "5月21日", "五月二十一日"], question: "档案最早的建立日期是什么？输入四位数字（月月日日）。", hints: ["先查看「站点维护记录」和「第一张便笺」。", "寻找与这个书桌首次开放有关的日期。", "答案是 0521。"] },
  { name: "01 / 追赶", subtitle: "四封来自不同季节的信", cue: "给时间排序", answer: ["2413"], question: "按时间先后排列 A、B、C、D 四封便笺，输入对应编号（如 1234）。", hints: ["四封便笺都有时间戳，情绪的强弱与时间顺序无关。", "最早的是 B，最后的是 C。", "完整顺序：B → D → A → C，输入 2413。"] },
  { name: "02 / 两份记录", subtitle: "同一天可以有两种真实", cue: "找出反复出现的意象", answer: ["灯", "一盏灯", "台灯"], question: "在公开记录与未寄出的对话里，反复出现、也一直留在书桌上的东西是什么？", hints: ["不是一个人，也不是一款软件。", "它照亮的地方很小，却足够让人把字写下去。", "答案是「灯」。"] },
  { name: "03 / 未完", subtitle: "允许故事继续存在", cue: "核对记录", answer: ["都是真的", "两者都是真的", "都真", "都是"], question: "同一晚，一份记录说「我想放弃」，另一份说「我还想继续」。哪一份是真的？", hints: ["不要急着选择更乐观的那份。", "矛盾的感受可以出现在同一个人身上。", "输入「都是真的」。"] }
];
const records = [
  {id:"system", ch:0, type:"系统", title:"恢复通知", stamp:"2026 / 未知", text:[
    "这里是 Amiya 的书桌背面。正常的访问路径不应出现这个目录。",
    "一次归档操作中，有人勾选了「仅保留已完成内容」。于是，未发布的游戏、删去的段落、临时起意写下的信都被移到了这里。",
    "系统没有损坏。只是没有人想好，这些没做完的东西究竟算不算生活的一部分。",
    "你拥有只读权限。请阅读各卷的记录，完成校对，才能打开下一卷。所有内容为虚构互动叙事；其中的情绪来自真实生活，但人物和细节都经过改编。"
  ]},
  {id:"maintenance", ch:0, type:"日志", title:"站点维护记录", stamp:"2026-05-21 23:08", text:[
    "[23:08] 创建目录 /desk/ 。",
    "[23:12] 页面标题：『书桌』。说明：『把想到的、做过的、没搞懂的，都慢慢写下来。』",
    "[23:59] 有人问：为什么非要记录这么多？",
    "[00:03] 回答：或许未来的我会忘记今天的我究竟在想什么。",
    "附注：恢复密钥采用该目录最初建立的月日，四位数字。"
  ]},
  {id:"bookmark", ch:0, type:"便笺", title:"第一张便笺", stamp:"无日期", text:[
    "我给书桌留了一张纸。上面没有宏伟的目标，只有四个字：不要忘记。",
    "我怕忘记那个第一次学会做游戏时，跑去向朋友炫耀的小孩。也怕忘记那些失败后，仍然会重新打开编辑器的晚上。",
    "后来纸被咖啡杯压出了一个圆圈。字没有褪色。",
    "有人说，建立于五月二十一日的地方，应该把自己的生日记住。书桌不是活物，但它确实从那一天起开始收留故事。"
  ]},
  {id:"routing", ch:0, type:"规则", title:"访客说明 / README", stamp:"版本 1.0", text:[
    "本作品没有真实账号、收款、外部密码或隐藏的第三方登录步骤。",
    "你可以在「线索簿」里重新查看找到的内容，也可以在控制台输入 help、ls、status、hint、open 记录编号。",
    "你阅读过的记录会留下标记。校对答案保存在当前浏览器，不会上传服务器。",
    "如果现在不想继续，关闭页面就好。未完成的阅读不会被扣分。"
  ]},
  {id:"letter-a", ch:1, type:"信件 A", title:"A / 苦夏", stamp:"2026-10-04", text:[
    "今天我写下了太多句『应该』：应该画得更好，应该做出更有趣的玩法，应该比昨天更接近那个梦想。",
    "屏幕上有一个能运行的角色。他会跳跃、攻击、移动，但我看着他，总觉得哪里都还差一点。",
    "我不是讨厌他。也许只是太期待他真的活起来。",
    "我把这一页折好，没有扔掉。"
  ]},
  {id:"letter-b", ch:1, type:"信件 B", title:"B / 书桌刚刚开始", stamp:"2026-05-21", text:[
    "我决定开始认真记录。不是因为今天发生了什么大事，而是我希望未来某一天回头时，能看见自己不是突然走到了那里。",
    "我要留下每一个小小的起点。就算它们现在看起来毫不起眼。",
    "这封信的收件人，是以后某个也许会忘记初心的自己。"
  ]},
  {id:"letter-c", ch:1, type:"信件 C", title:"C / 用价值衡量一切", stamp:"2026-10-18", text:[
    "我尝试把自己变得有用：多懂一点技术，多会做一点东西，多能帮别人一点。",
    "可有一天，我忽然想到：如果今天的我一件事情也做不好，是不是连被认真对待都要先找理由？",
    "想到这里，我把那张写满计划的纸翻过来。背面什么都没有。",
    "我没有得到答案。没有答案的夜晚，也确实发生过。"
  ]},
  {id:"letter-d", ch:1, type:"信件 D", title:"D / 发布之后", stamp:"2026-09-20", text:[
    "按下发布按钮之前，我反复看了好多遍。",
    "我总觉得还能再改改。封面、声音、节奏，每一处都可以更好。",
    "可最后，我还是按了下去。作品离开电脑，去往那些我不知道的屏幕。",
    "原来『完成』并不是完美的另一个名字。"
  ]},
  {id:"inventory", ch:1, type:"物件", title:"抽屉里的旧游戏", stamp:"未注明", text:[
    "目录 /unfinished/ 中留下三类物件：未完成的动画、写了一半的剧情、能运行却不太好玩的战斗。",
    "管理员曾建议一键删除，以免它们占用空间。",
    "有人在删除确认框里停留了很久，然后点了取消。",
    "他没有因此立刻变得更有能力。他只是决定，再给那些小东西一点时间。"
  ]},
  {id:"public-log", ch:2, type:"公开记录", title:"公开页 / 今天的进展", stamp:"21:10", text:[
    "今天修复了角色攻击的一个问题。仍然有很多地方需要修改，但总算获得了能看见的进展。",
    "我把截图保存到一个叫 /captures/ 的目录里，又想起还有许多没有完成的任务。",
    "书桌上的灯亮着。窗外已经没有行人。",
    "发布前，我删掉了最后一行：『我怕自己永远做不出喜欢的作品。』"
  ]},
  {id:"private-log", ch:2, type:"未寄对话", title:"草稿箱 / 没有发出去的话", stamp:"21:12", text:[
    "其实我今天很难过。",
    "我知道怎么使用工具，知道怎么提出需求，代码也能跑起来。可就是不知道怎样让它变得真正好玩。",
    "我看着别人展示的新作品，觉得自己离他们越来越远。",
    "桌角有一盏灯。它照亮了我写错的地方，却没有替我写出正确的答案。",
    "我想关掉电脑。但再过一会儿，我又会想打开它。"
  ]},
  {id:"diff-view", ch:2, type:"差异", title:"同一篇文章的两次保存", stamp:"21:13", text:[
    "+++ 『今天我做到了』",
    "--- 『可是我还是害怕』",
    "版本比较器把这两句话标记为冲突。作者却在旁边写下：『它们并不冲突。』",
    "当时没有人看见这行注释。除了桌上的台灯，和后来偶然打开归档的你。"
  ]},
  {id:"night-window", ch:2, type:"场景", title:"窗户 / 城市仍然醒着", stamp:"22:46", text:[
    "隔着玻璃，远处的写字楼亮着成百上千个窗口。",
    "每一格光里都可能有人在奋斗，也可能有人正在休息、吵架、吃饭或者发呆。",
    "主人公忽然觉得自己很小。然后他想：小小的一盏灯，是不是也算这座城市的一部分？",
    "这不是一个答案，只是他那天晚上想到的句子。"
  ]},
  {id:"leave", ch:3, type:"恢复记录", title:"记录 003 / 我想放弃", stamp:"23:01", text:[
    "我不想再和这个游戏互相折磨下去了。",
    "每次打开它，我就看到更多不满意的地方。我不知道那些问题什么时候才能真正解决。",
    "我想去做别的东西，像故事，像网页，像一个可以随时进入的秘密档案。",
    "我知道自己可能是在逃避。但我现在真的很想喘口气。"
  ]},
  {id:"stay", ch:3, type:"恢复记录", title:"记录 004 / 我还想继续", stamp:"23:01", text:[
    "我还是想做出来。",
    "我想要那场战斗真的好玩，想要角色会让人喜欢，想要故事讲完之后有人舍不得关掉游戏。",
    "我知道现在还做不到，可我依然想试。",
    "这一段和上一段拥有完全相同的时间戳。两份原始记录都没有损坏。"
  ]},
  {id:"machine", ch:3, type:"系统", title:"归档机的异常说明", stamp:"23:04", text:[
    "无法合并：同一作者于同一时刻存在互相矛盾的记录。",
    "旧系统只能选择保留一份。新系统开放了第三个选项：允许它们同时存在。",
    "不是因为所有矛盾都会自动解决，而是人原本就可以在犹豫时继续活着。",
    "剩余操作：确认记录真实性，随后为这个档案选择一个结局。"
  ]},
  {id:"blank-page", ch:3, type:"空白", title:"没有写完的最后一页", stamp:"--:--", text:[
    "如果你已经来到这里，说明你读过一部分不太光鲜的记录。",
    "这个档案没有要求你替主人公原谅过去，也没有给你一套让他迅速成功的方法。",
    "最后一页留给正在阅读的人。",
    "你可以把它公开、收进抽屉，或者继续写下去。没有一个按钮可以替另一个人完成整个人生。"
  ]},
  {id:"secret", ch:3, type:"隐藏记录", title:"来自未来的便签", stamp:"??:??", secret:true, text:[
    "你找到了藏在控制台里的第十八份碎片。",
    "我不记得当年用了什么最好的模型，不记得买过多少工具，也记不清每次失败后的具体原因。",
    "但我记得有一夜，自己原本想把所有半成品都删掉，最后却只是关上了窗口。",
    "第二天早上，我又回到了书桌前。那不是传奇的开头。只是一个平常的早晨。",
    "P.S. 这封信不是预言。它是一个仍然愿意想象未来的人，留给自己的虚构便签。"
  ]}
];
const endings = {
  publish: {title:"结局 / 向世界敞开",body:["你把档案里能够公开的部分整理成一篇故事。","读者未必理解全部细节，也可能有人匆匆划过。","可是其中一个人停了下来，在评论里留下一句：『我也有过这样的晚上。』","没有盛大的掌声。那天的书桌，却比平时更明亮一些。"]},
  keep: {title:"结局 / 留在抽屉里",body:["你没有把任何私密记录发出去。","你只是把它们按日期整理好，放回抽屉，给每一份未完成的东西留下位置。","窗外很安静。没有人知道这次整理，也没有人需要知道。","有些东西没有成为作品，也依然属于一个人的生活。"]},
  continue: {title:"结局 / 下一页",body:["你在档案最后点击了『新增页面』。","光标闪了很久，才出现第一句话：『今天我仍然想做点什么。』","你不知道接下来会写成喜剧、冒险，还是一本普通的开发日志。","但空白不再只是必须填满的缺陷。它也可能是下一个故事的位置。"]}
};
const root = document.querySelector("#echo-app");
if (!root) throw new Error("echo app root not found");
function defaultSave(){return {started:false,chapter:0,visited:[],unlocked:0,hints:[0,0,0,0],ending:null,secret:false};}
let state = defaultSave();
try{const raw=localStorage.getItem(KEY);if(raw){const old=JSON.parse(raw);if(old && typeof old==="object")state={...defaultSave(),...old};}}catch(_){/* private mode can disable storage */}
let activeId = "system";
let tab = "files";
let filter = "";
let feedback = "";
let terminal = ['ECHO // 归档接口已连接。输入 help 查看命令。'];
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function visibleRecords(){return records.filter(r=>r.ch<=state.unlocked&&(!r.secret||state.secret));}
function currentRecords(){return visibleRecords().filter(r=>r.ch===state.chapter);}
function progressCount(){return records.filter(r=>!r.secret&&state.visited.includes(r.id)).length;}
function activeRecord(){return visibleRecords().find(r=>r.id===activeId)||currentRecords()[0];}
function showRecord(id){const doc=visibleRecords().find(r=>r.id===id);if(!doc){feedback="该档案尚未恢复。";render();return;}activeId=id;state.chapter=doc.ch;if(!state.visited.includes(id))state.visited.push(id);feedback="";save();render();}
function switchChapter(i){if(i>state.unlocked)return;state.chapter=i;activeId=currentRecords()[0]?.id||"system";feedback="";save();render();}
function normalize(value){return value.trim().toLowerCase().replace(/\s+/g,"").replace(/[，。！!？?]/g,"");}
function solve(answer){const ch=state.chapter;const c=chapters[ch];if(c.answer.some(a=>normalize(a)===normalize(answer))){if(state.unlocked===ch&&ch<3)state.unlocked=ch+1;else if(ch===3)state.unlocked=4;state.hints[ch]=0;feedback=ch===3?"校对完成。档案已可以结案。":"校对成功。下一卷已恢复。";state.chapter=Math.min(ch+1,3);activeId=currentRecords()[0]?.id||"system";save();render();return;}feedback="校对未通过。请重新查看记录，或者打开提示。";render();}
function setEnding(key){if(state.unlocked<4||!endings[key])return;state.ending=key;save();render();}
function reset(){if(!window.confirm("确定重置回声档案的本地阅读记录吗？"))return;state=defaultSave();activeId="system";terminal=['ECHO // 归档接口已连接。'];feedback="";save();render();}
function issueCommand(line){
 const s=line.trim();if(!s)return;
 terminal.push("> "+s);
 const bits=s.split(/\s+/);const cmd=bits[0].toLowerCase();const arg=bits.slice(1).join(" ");
 if(cmd==="help")terminal.push("命令：help, ls, status, hint, open <编号>, unlock <答案>, whoami, echo, clear, find future");
 else if(cmd==="ls")terminal.push(visibleRecords().map(r=>r.id).join("  /  "));
 else if(cmd==="status")terminal.push("已恢复 "+progressCount()+"/17 份公开档案；卷 "+(state.unlocked+1)+"/4；"+(state.unlocked===4?"校对全部完成":"仍有未解锁的记录"));
 else if(cmd==="hint"){state.hints[state.chapter]=Math.min(3,state.hints[state.chapter]+1);terminal.push(chapters[state.chapter].hints[state.hints[state.chapter]-1]);save();}
 else if(cmd==="open"){const r=visibleRecords().find(x=>x.id===arg);if(r){showRecord(r.id);terminal.push("已打开 "+r.title);}else terminal.push("没有找到这份可访问的档案。");}
 else if(cmd==="unlock"){solve(arg);terminal.push(feedback);}
 else if(cmd==="whoami")terminal.push("visitor: 一个偶然读到这里的人。");
 else if(cmd==="echo")terminal.push("系统没有回声。只有你刚刚敲下的字。");
 else if(cmd==="clear")terminal=[];
 else if(cmd==="find"&&arg.toLowerCase()==="future"){if(state.unlocked>=3){state.secret=true;terminal.push("隐藏记录已恢复。查看第 03 卷的『来自未来的便签』。");save();}else terminal.push("索引未完全恢复。");}
 else terminal.push("未识别的命令。输入 help。");
 terminal=terminal.slice(-40);render();
}
function render(){
 const pct=Math.round((Math.min(state.unlocked,4)/4)*100);
 const file=activeRecord();
 const intro=!state.started?'<section class="echo-opening"><div class="echo-opening-label">AN INTERACTIVE FICTION / 2026</div><h1>书桌背面<span>：回声档案</span></h1><p class="echo-lead">有人把未完成的故事，藏在了博客的另一面。</p><p>四卷互相矛盾的记录、一间还亮着灯的书桌、一个不知道该不该继续写下去的人。</p><p>这不是对真实人物的调查。这是从公开随笔中生长出的<span class="echo-mark">虚构交互叙事</span>。不需要账号，进度留在你的浏览器。</p><button class="echo-primary" data-action="start">开始恢复档案　↗</button><span class="echo-playtime">预计 25～45 分钟 · 支持中断续玩</span></section>':"";
 const nav=chapters.map((c,i)=>'<button class="echo-chapter '+(state.chapter===i?'active':'')+'" data-chapter="'+i+'" '+(i>state.unlocked?'disabled':'')+'><span class="echo-ch-num">'+String(i).padStart(2,"0")+'</span><span><b>'+escapeHtml(c.name.split(" / ")[1])+'</b><small>'+escapeHtml(c.subtitle)+'</small></span><span class="echo-lock">'+(i<state.unlocked?'✓':i===state.unlocked?'●':'⌑')+'</span></button>').join("");
 const entries=currentRecords().filter(r=>!r.secret||state.secret).filter(r=>(r.title+r.type+r.id).toLowerCase().includes(filter.toLowerCase())).map(r=>'<button class="echo-file '+(file?.id===r.id?'chosen':'')+'" data-open="'+r.id+'"><span class="echo-file-icon">'+(r.type.includes("信")?"✉":r.type==="系统"?"⌁":"▤")+'</span><span><b>'+escapeHtml(r.title)+'</b><small>'+escapeHtml(r.type)+' / '+escapeHtml(r.stamp)+'</small></span><span>'+(state.visited.includes(r.id)?'◉':'○')+'</span></button>').join("")||'<div class="echo-quiet">没有符合搜索条件的记录。</div>';
 const reader=file?'<div class="echo-doc-top"><span>'+escapeHtml(file.type)+' / '+escapeHtml(file.id)+'</span><span>'+escapeHtml(file.stamp)+'</span></div><h2>'+escapeHtml(file.title)+'</h2><div class="echo-doc-body">'+file.text.map(p=>'<p>'+escapeHtml(p)+'</p>').join("")+'</div><div class="echo-doc-foot">档案读取完成 <span>◉</span></div>':'<p>还没有可阅读的记录。</p>';
 const c=chapters[state.chapter];
 const hint=state.hints[state.chapter]?'<p class="echo-hint">'+escapeHtml(c.hints[state.hints[state.chapter]-1])+'</p>':'';
 const puzzle=state.unlocked>state.chapter?'<div class="echo-puzzle-solved">✓ 本卷校对已通过，可继续阅读下一卷。</div>':state.unlocked===4?'<div class="echo-puzzle-solved">✓ 全部校对完成。</div>':'<form id="echo-puzzle"><label for="echo-answer">'+escapeHtml(c.question)+'</label><div class="echo-answer-row"><input id="echo-answer" name="answer" autocomplete="off" placeholder="输入校对答案" required maxlength="32"/><button type="submit">校对 ↗</button></div></form><button class="echo-hint-button" data-action="hint">需要提示？ '+state.hints[state.chapter]+'/3</button>'+hint;
 const ending=state.unlocked===4?'<section class="echo-ending"><div class="echo-flag">ARCHIVE COMPLETE</div><h2>最后一页，由你决定。</h2><p>这里没有唯一正确的结局。选择一种处理这些记录的方式。</p><div class="echo-ending-choices"><button data-ending="publish">寄给世界 <span>↗</span></button><button data-ending="keep">放回抽屉 <span>↗</span></button><button data-ending="continue">继续写下去 <span>↗</span></button></div>'+(state.ending?'<article class="echo-ending-result"><h3>'+escapeHtml(endings[state.ending].title)+'</h3>'+endings[state.ending].body.map(x=>'<p>'+escapeHtml(x)+'</p>').join("")+'<p class="echo-restart-note">存档会保留。你可以重新选择，也可以去读那些还没看完的文件。</p></article>':'')+'</section>':'';
 root.innerHTML=intro+'<div class="echo-shell '+(!state.started?'echo-not-started':'')+'"><header class="echo-hero"><div><div class="echo-flag">AMIYA DESK / HIDDEN ARCHIVE</div><h1>回声档案 <span>Echoes of the Desk</span></h1><p>一份关于创作、追赶和未完成之物的互动小说。</p></div><div class="echo-meter"><strong>'+pct+'%</strong><span>归档校对</span><div class="echo-progress"><i style="width:'+pct+'%"></i></div></div></header><div class="echo-layout"><aside class="echo-left"><div class="echo-panel-label">ARCHIVE / 卷宗目录</div>'+nav+'<div class="echo-side-note">点击卷宗阅读记录。每一卷末尾都有一项校对任务，答案藏在文本里。</div><div class="echo-sidebar-bottom"><button data-action="reset">重置本地存档</button><a href="/">← 返回书桌</a></div></aside><section class="echo-work"><div class="echo-work-tabs"><button data-tab="files" class="'+(tab==="files"?'on':'')+'">档案室</button><button data-tab="journal" class="'+(tab==="journal"?'on':'')+'">线索簿 <span>'+progressCount()+'</span></button><button data-tab="terminal" class="'+(tab==="terminal"?'on':'')+'">控制台 _</button></div>'+(tab==="files"?'<div class="echo-document-grid"><div class="echo-file-list"><div class="echo-file-search"><label for="echo-filter">本卷记录</label><input id="echo-filter" placeholder="筛选文件" value="'+escapeHtml(filter)+'"/></div><div class="echo-file-items">'+entries+'</div></div><article class="echo-reader">'+reader+'</article></div><section class="echo-checkpoint"><span class="echo-panel-label">CHECKPOINT / '+escapeHtml(c.cue)+'</span><h3>卷宗校对</h3>'+puzzle+(feedback?'<p class="echo-feedback" role="status">'+escapeHtml(feedback)+'</p>':'')+'</section>'+ending:'')+(tab==="journal"?'<section class="echo-journal"><h2>已找到的碎片</h2><p>这里记录你已读过的档案，不会自动替你解读它们。</p><div class="echo-journal-grid">'+records.filter(r=>state.visited.includes(r.id)).map(r=>'<button data-open="'+r.id+'"><strong>'+escapeHtml(r.title)+'</strong><span>'+escapeHtml(r.stamp)+'</span><small>'+escapeHtml(r.text[0].slice(0,68))+'…</small></button>').join("")+'</div><div class="echo-credits">创作灵感来自公开随笔，所有对话与情节均经虚构改编。<br/><a href="https://blog.sayori.org/posts/from-90-to-667/">《从90%+到66.7%》</a> · <a href="https://blog.sayori.org/posts/summer-2026-end/">《19岁的苦夏》</a> · <a href="https://blog.sayori.org/posts/i-tried-to-measure-everything-by-value/">《我尝试用价值衡量一切》</a></div></section>':'')+(tab==="terminal"?'<section class="echo-terminal"><h2>访客控制台 <span>read-only / local</span></h2><div id="echo-terminal-output" aria-live="polite">'+terminal.map(x=>'<div>'+escapeHtml(x)+'</div>').join("")+'</div><form id="echo-command"><span>&gt;</span><input name="command" aria-label="控制台命令" placeholder="help" autocomplete="off"/><button type="submit">执行</button></form><p>提示：如果你想寻找不在索引里的记录，也许可以试着使用 find 命令。</p></section>':'')+'</section></div><footer class="echo-footer"><span>一个虚构的故事，不是私人档案泄漏或现实求助。</span><span>← <a href="/">Amiya 的书桌</a></span></footer></div>';
 if(!state.started)root.querySelector(".echo-shell").setAttribute("inert","");
 if(tab==="terminal"){const log=document.querySelector("#echo-terminal-output");if(log)log.scrollTop=log.scrollHeight;}
}
root.addEventListener("click",event=>{
 const target=event.target instanceof Element?event.target.closest("button"):null;if(!target)return;
 if(target.dataset.action==="start"){state.started=true;save();render();return;}
 if(target.dataset.action==="reset"){reset();return;}
 if(target.dataset.action==="hint"){state.hints[state.chapter]=Math.min(3,state.hints[state.chapter]+1);save();render();return;}
 if(target.dataset.chapter!==undefined){switchChapter(Number(target.dataset.chapter));return;}
 if(target.dataset.open){tab="files";filter="";showRecord(target.dataset.open);return;}
 if(target.dataset.tab){tab=target.dataset.tab;feedback="";render();return;}
 if(target.dataset.ending){setEnding(target.dataset.ending);return;}
});
root.addEventListener("submit",event=>{
 const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
 const data=new FormData(form);
 if(form.id==="echo-puzzle")solve(String(data.get("answer")||""));
 if(form.id==="echo-command")issueCommand(String(data.get("command")||""));
});
root.addEventListener("input",event=>{
 const target=event.target;
 if(!(target instanceof HTMLInputElement)||target.id!=="echo-filter")return;
 filter=target.value.toLowerCase();
 root.querySelectorAll(".echo-file").forEach(el=>{const name=el.textContent?.toLowerCase()||"";el.hidden=!name.includes(filter);});
});
render();
