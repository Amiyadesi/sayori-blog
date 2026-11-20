import { SITE_LOCALE } from "../utils/site-locale";

// Short, reader-facing labels shared by the notice, article and language editions.
const copies = {
	"zh-CN": [
		"隐私与翻译说明", "隐私说明", "打开页面时，网站会处理提供页面所需的基本网络信息。访问、继续浏览或关闭本公告，都不代表同意可选统计。", "简体中文是本站原创文章的原版。其他语言均为 AI 辅助翻译，细节可能与原文有出入。", "阅读简体中文原文", "允许统计", "关闭统计", "可选访问统计", "统计已开启", "统计未开启", "首页", "文章归档", "随笔", "搜索", "菜单", "Amiya 的书桌", "关于独立游戏、技术折腾和创作生活的个人博客。", "确定", "关闭", "翻译版目前仅收录已完成翻译的文章。", "隐私设置可以随时在隐私说明页更改。",
	],
	"zh-Hant": [
		"隱私與翻譯說明", "隱私說明", "開啟網頁時，網站會處理提供頁面所需的基本網路資訊。造訪、繼續瀏覽或關閉本公告，都不代表同意選用的流量統計。", "簡體中文是本站原創文章的原版。其他語言都是 AI 輔助翻譯，細節可能與原文有出入。", "閱讀簡體中文原文", "允許統計", "關閉統計", "選用的流量統計", "已開啟統計", "未開啟統計", "首頁", "文章彙整", "隨筆", "搜尋", "選單", "Amiya 的書桌", "記錄獨立遊戲、技術探索與創作生活的個人部落格。", "知道了", "關閉", "翻譯版目前只收錄已翻譯的文章。", "你隨時可以在隱私說明頁變更設定。",
	],
	en: [
		"Privacy and translation", "Privacy notice", "The blog processes basic connection data to serve its pages. Visiting, continuing to browse or closing this notice does not opt you into optional analytics.", "The original versions of my posts are in Simplified Chinese. All other editions are AI-assisted translations, so some details may differ from the original.", "Read the Simplified Chinese original", "Allow analytics", "Turn off analytics", "Optional analytics", "Analytics on", "Analytics off", "Home", "Archive", "Essays", "Search", "Menu", "Amiya’s Desk", "A personal blog about indie games, tinkering with technology, and making things.", "Got it", "Close", "This edition lists only the posts available in translation.", "You can change your choice at any time on the privacy page.",
	],
	ja: [
		"プライバシーと翻訳について", "プライバシーについて", "ページの表示に必要な基本的な接続情報を処理します。サイトの閲覧や、このお知らせを閉じることは、任意のアクセス解析への同意にはなりません。", "このブログの記事の原文は簡体字中国語です。他の言語版はすべてAIを用いて翻訳しており、細かな部分が原文と異なることがあります。", "簡体字中国語の原文を読む", "アクセス解析を許可", "アクセス解析を無効にする", "任意のアクセス解析", "アクセス解析：オン", "アクセス解析：オフ", "ホーム", "記事一覧", "エッセイ", "検索", "メニュー", "Amiyaの机", "インディーゲーム、技術の試行錯誤、ものづくりの日々をつづる個人ブログ。", "了解", "閉じる", "この言語版には、翻訳済みの記事のみが表示されます。", "設定はプライバシーページでいつでも変更できます。",
	],
	fr: [
		"Confidentialité et traduction", "Avis de confidentialité", "Le blog traite les données de connexion nécessaires à l’affichage des pages. Consulter le site, poursuivre la navigation ou fermer cet avis ne vaut pas accord pour la mesure d’audience facultative.", "Mes articles sont écrits à l’origine en chinois simplifié. Les autres versions sont traduites avec l’aide de l’IA ; certains détails peuvent différer de l’original.", "Lire l’original en chinois simplifié", "Autoriser la mesure d’audience", "Désactiver la mesure d’audience", "Mesure d’audience facultative", "Mesure d’audience activée", "Mesure d’audience désactivée", "Accueil", "Archives", "Essais", "Rechercher", "Menu", "Le bureau d’Amiya", "Un blog personnel sur les jeux indépendants, le bricolage technique et la création.", "Compris", "Fermer", "Cette édition ne présente que les articles disponibles en traduction.", "Votre choix peut être modifié à tout moment sur la page de confidentialité.",
	],
	ko: [
		"개인정보 및 번역 안내", "개인정보 안내", "페이지를 제공하는 데 필요한 기본 접속 정보를 처리합니다. 사이트를 방문하거나 계속 둘러보거나 이 안내를 닫아도 선택형 방문 통계에 동의한 것으로 보지 않습니다.", "이 블로그의 원문은 중국어 간체로 작성됩니다. 다른 언어판은 모두 AI의 도움을 받아 번역했으며, 세부 표현이 원문과 다를 수 있습니다.", "중국어 간체 원문 읽기", "방문 통계 허용", "방문 통계 끄기", "선택형 방문 통계", "방문 통계 켜짐", "방문 통계 꺼짐", "홈", "글 모아보기", "에세이", "검색", "메뉴", "아미야의 책상", "인디 게임, 기술 탐구, 그리고 무언가를 만드는 일상을 기록하는 개인 블로그.", "확인", "닫기", "이 언어판에는 번역을 마친 글만 표시됩니다.", "개인정보 안내 페이지에서 언제든 선택을 바꿀 수 있습니다.",
	],
	es: [
		"Privacidad y traducción", "Aviso de privacidad", "El blog trata los datos de conexión básicos para mostrar sus páginas. Visitar el sitio, seguir navegando o cerrar este aviso no activa las estadísticas opcionales.", "Escribo mis artículos originales en chino simplificado. Las demás versiones se traducen con ayuda de IA, por lo que algunos detalles pueden diferir del original.", "Leer el original en chino simplificado", "Permitir estadísticas", "Desactivar estadísticas", "Estadísticas opcionales", "Estadísticas activadas", "Estadísticas desactivadas", "Inicio", "Archivo", "Ensayos", "Buscar", "Menú", "El escritorio de Amiya", "Un blog personal sobre juegos indie, experimentos con tecnología y el día a día de crear.", "Entendido", "Cerrar", "Esta edición solo muestra los artículos que ya tienen traducción.", "Puedes cambiar tu elección en cualquier momento en la página de privacidad.",
	],
	de: [
		"Datenschutz und Übersetzung", "Datenschutzhinweis", "Der Blog verarbeitet grundlegende Verbindungsdaten, um seine Seiten anzuzeigen. Ein Besuch, das Weiterblättern oder das Schließen dieses Hinweises gilt nicht als Einwilligung in die optionale Webanalyse.", "Ich schreibe meine Originalbeiträge auf vereinfachtem Chinesisch. Alle anderen Fassungen sind KI-gestützte Übersetzungen; einzelne Details können vom Original abweichen.", "Vereinfachtes chinesisches Original lesen", "Webanalyse erlauben", "Webanalyse ausschalten", "Optionale Webanalyse", "Webanalyse eingeschaltet", "Webanalyse ausgeschaltet", "Startseite", "Archiv", "Essays", "Suchen", "Menü", "Amiyas Schreibtisch", "Ein persönlicher Blog über Indie-Spiele, technische Basteleien und kreativen Alltag.", "Verstanden", "Schließen", "Diese Ausgabe zeigt nur Beiträge, für die bereits eine Übersetzung vorliegt.", "Du kannst deine Auswahl jederzeit auf der Datenschutzseite ändern.",
	],
	"pt-BR": [
		"Privacidade e tradução", "Aviso de privacidade", "O blog trata dados básicos de conexão para exibir as páginas. Acessar o site, continuar navegando ou fechar este aviso não ativa as estatísticas opcionais.", "Escrevo meus textos originais em chinês simplificado. As outras versões são traduzidas com ajuda de IA e podem apresentar diferenças em relação ao original.", "Ler o original em chinês simplificado", "Permitir estatísticas", "Desativar estatísticas", "Estatísticas opcionais", "Estatísticas ativadas", "Estatísticas desativadas", "Início", "Arquivo", "Ensaios", "Buscar", "Menu", "A mesa da Amiya", "Um blog pessoal sobre jogos indie, experiências com tecnologia e o dia a dia de quem cria.", "Entendi", "Fechar", "Esta edição mostra apenas os textos que já foram traduzidos.", "Você pode mudar sua escolha a qualquer momento na página de privacidade.",
	],
} as const;

const [notice, privacy, privacySummary, translation, original, allow, turnOff, analytics, enabled, disabled, home, archive, essays, search, menu, siteTitle, siteDescription, gotIt, close, coverage, changeChoice] = copies[SITE_LOCALE];

export const readingCopy = { notice, privacy, privacySummary, translation, original, allow, turnOff, analytics, enabled, disabled, home, archive, essays, search, menu, siteTitle, siteDescription, gotIt, close, coverage, changeChoice };
