import { SITE_LOCALE } from "../utils/site-locale";

// Short, reader-facing labels shared by the notice, article and language editions.
const copies = {
	"zh-CN": [
		"隐私与翻译说明", "隐私说明", "访问统计默认开启，站内不设开关。博客只按小时累计全站浏览次数，不记录是谁看了哪一页。", "简体中文是本站原创文章的原版。其他语言均为 AI 辅助翻译，细节可能与原文有出入。", "阅读简体中文原文", "访问统计", "首页", "文章归档", "随笔", "搜索", "菜单", "Amiya 的书桌", "关于独立游戏、技术折腾和创作生活的个人博客。", "确定", "关闭", "翻译版目前仅收录已完成翻译的文章。",
	],
	"zh-Hant": [
		"隱私與翻譯說明", "隱私說明", "瀏覽統計預設啟用，站內不提供開關。部落格只按小時加總全站瀏覽次數，不記錄誰看了哪一頁。", "簡體中文是本站原創文章的原版。其他語言都是 AI 輔助翻譯，細節可能與原文有出入。", "閱讀簡體中文原文", "瀏覽統計", "首頁", "文章彙整", "隨筆", "搜尋", "選單", "Amiya 的書桌", "記錄獨立遊戲、技術探索與創作生活的個人部落格。", "知道了", "關閉", "翻譯版目前只收錄已翻譯的文章。",
	],
	"en": [
		"Privacy and translation", "Privacy notice", "Page-view counting is on by default, with no on-site switch. The blog keeps hourly totals for the whole site, not a record of who viewed which page.", "The original versions of my posts are in Simplified Chinese. All other editions are AI-assisted translations, so some details may differ from the original.", "Read the Simplified Chinese original", "Visit statistics", "Home", "Archive", "Essays", "Search", "Menu", "Amiya’s Desk", "A personal blog about indie games, tinkering with technology, and making things.", "Got it", "Close", "This edition lists only the posts available in translation.",
	],
	"ja": [
		"プライバシーと翻訳について", "プライバシーについて", "閲覧数は常に集計され、サイト内に切り替え設定はありません。ブログ全体の閲覧数を1時間ごとに数えるだけで、誰がどのページを見たかは記録しません。", "このブログの記事の原文は簡体字中国語です。他の言語版はすべてAIを用いて翻訳しており、細かな部分が原文と異なることがあります。", "簡体字中国語の原文を読む", "閲覧数の集計", "ホーム", "記事一覧", "エッセイ", "検索", "メニュー", "Amiyaの机", "インディーゲーム、技術の試行錯誤、ものづくりの日々をつづる個人ブログ。", "了解", "閉じる", "この言語版には、翻訳済みの記事のみが表示されます。",
	],
	"fr": [
		"Confidentialité et traduction", "Avis de confidentialité", "Le comptage des pages vues est actif par défaut, sans réglage sur le site. Le blog conserve un total horaire pour l’ensemble du site, sans enregistrer qui a consulté quelle page.", "Mes articles sont écrits à l’origine en chinois simplifié. Les autres versions sont traduites avec l’aide de l’IA ; certains détails peuvent différer de l’original.", "Lire l’original en chinois simplifié", "Statistiques de fréquentation", "Accueil", "Archives", "Essais", "Rechercher", "Menu", "Le bureau d’Amiya", "Un blog personnel sur les jeux indépendants, le bricolage technique et la création.", "Compris", "Fermer", "Cette édition ne présente que les articles disponibles en traduction.",
	],
	"ko": [
		"개인정보 및 번역 안내", "개인정보 안내", "페이지 조회수 집계는 기본으로 켜져 있으며 사이트에서 끌 수 없습니다. 블로그 전체의 조회수만 시간별로 합산하며, 누가 어느 페이지를 봤는지는 기록하지 않습니다.", "이 블로그의 원문은 중국어 간체로 작성됩니다. 다른 언어판은 모두 AI의 도움을 받아 번역했으며, 세부 표현이 원문과 다를 수 있습니다.", "중국어 간체 원문 읽기", "방문 통계", "홈", "글 모아보기", "에세이", "검색", "메뉴", "아미야의 책상", "인디 게임, 기술 탐구, 그리고 무언가를 만드는 일상을 기록하는 개인 블로그.", "확인", "닫기", "이 언어판에는 번역을 마친 글만 표시됩니다.",
	],
	"es": [
		"Privacidad y traducción", "Aviso de privacidad", "El recuento de páginas vistas está activado por defecto y no hay un interruptor en el sitio. El blog solo guarda el total de todo el sitio por hora, sin registrar quién vio cada página.", "Escribo mis artículos originales en chino simplificado. Las demás versiones se traducen con ayuda de IA, por lo que algunos detalles pueden diferir del original.", "Leer el original en chino simplificado", "Estadísticas de visitas", "Inicio", "Archivo", "Ensayos", "Buscar", "Menú", "El escritorio de Amiya", "Un blog personal sobre juegos indie, experimentos con tecnología y el día a día de crear.", "Entendido", "Cerrar", "Esta edición solo muestra los artículos que ya tienen traducción.",
	],
	"de": [
		"Datenschutz und Übersetzung", "Datenschutzhinweis", "Seitenaufrufe werden standardmäßig gezählt. Auf der Website gibt es dafür keinen Schalter. Der Blog speichert nur stundengenau die Gesamtzahl der Aufrufe, nicht, wer welche Seite angesehen hat.", "Ich schreibe meine Originalbeiträge auf vereinfachtem Chinesisch. Alle anderen Fassungen sind KI-gestützte Übersetzungen; einzelne Details können vom Original abweichen.", "Vereinfachtes chinesisches Original lesen", "Besuchsstatistik", "Startseite", "Archiv", "Essays", "Suchen", "Menü", "Amiyas Schreibtisch", "Ein persönlicher Blog über Indie-Spiele, technische Basteleien und kreativen Alltag.", "Verstanden", "Schließen", "Diese Ausgabe zeigt nur Beiträge, für die bereits eine Übersetzung vorliegt.",
	],
	"pt-BR": [
		"Privacidade e tradução", "Aviso de privacidade", "A contagem de visualizações vem ativada por padrão e não há botão para desativá-la no site. O blog guarda apenas o total de visualizações do site por hora, sem registrar quem abriu cada página.", "Escrevo meus textos originais em chinês simplificado. As outras versões são traduzidas com ajuda de IA e podem apresentar diferenças em relação ao original.", "Ler o original em chinês simplificado", "Estatísticas de visitas", "Início", "Arquivo", "Ensaios", "Buscar", "Menu", "A mesa da Amiya", "Um blog pessoal sobre jogos indie, experiências com tecnologia e o dia a dia de quem cria.", "Entendi", "Fechar", "Esta edição mostra apenas os textos que já foram traduzidos.",
	],
} as const;

const [notice, privacy, privacySummary, translation, original, analytics, home, archive, essays, search, menu, siteTitle, siteDescription, gotIt, close, coverage] = copies[SITE_LOCALE];

export const readingCopy = { notice, privacy, privacySummary, translation, original, analytics, home, archive, essays, search, menu, siteTitle, siteDescription, gotIt, close, coverage };

export const [readingShortcuts, returnHome, backToTop] = {
	"zh-CN": ["阅读快捷入口", "返回首页", "回到顶部"],
	"zh-Hant": ["閱讀捷徑", "返回首頁", "回到頂部"],
	en: ["Reading shortcuts", "Home", "Back to top"],
	ja: ["記事内のショートカット", "ホームに戻る", "ページの先頭へ"],
	fr: ["Raccourcis de lecture", "Retour à l’accueil", "Haut de page"],
	ko: ["읽기 바로가기", "홈으로", "맨 위로"],
	es: ["Atajos de lectura", "Volver al inicio", "Volver arriba"],
	de: ["Lese-Navigation", "Zur Startseite", "Nach oben"],
	"pt-BR": ["Atalhos de leitura", "Voltar ao início", "Voltar ao topo"],
}[SITE_LOCALE];
