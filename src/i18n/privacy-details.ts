export const privacyDetails: Record<string, { network: string; analytics: string; comments: string }> = {
	ja: {
		network: "Cloudflareはページを配信するため、接続元のIPアドレスを受け取ります。任意のアクセス解析を許可した場合は、概況を知るために外部のIP照会サービスへアドレスが送信されることがあります。",
		analytics: "同意後にのみ、ブログ独自の訪問統計、Umami、Google Tag Manager／Google Analyticsが動作します。ブログ独自の統計はIPと訪問者・セッションIDをHMACで記録し、元のIPは保存しません。訪問記録は約90日を目安に削除します。",
		comments: "コメントを投稿すると、Twikooは本文、ニックネーム、入力したメールアドレス、接続情報を処理します。お問い合わせ：me@sayori.org。",
	},
	fr: {
		network: "Cloudflare reçoit votre adresse IP pour servir les pages. Si vous autorisez la mesure d’audience, des services de recherche IP peuvent recevoir cette adresse pour estimer votre région ou votre réseau.",
		analytics: "Les statistiques du blog, Umami et Google Tag Manager / Google Analytics ne démarrent qu’avec votre accord. Les statistiques du blog conservent des empreintes HMAC de l’IP et des identifiants de visite et de session, pas l’IP brute. Le délai de purge visé est de 90 jours.",
		comments: "Si vous publiez un commentaire, Twikoo traite le texte, votre pseudonyme, l’adresse e-mail éventuellement fournie et les données de connexion. Contact : me@sayori.org.",
	},
	ko: {
		network: "Cloudflare는 페이지를 제공하기 위해 접속 IP를 받습니다. 방문 통계를 허용하면 대략적인 지역과 네트워크를 확인하기 위해 외부 IP 조회 서비스에 주소가 전달될 수 있습니다.",
		analytics: "동의한 뒤에만 블로그 자체 방문 통계, Umami, Google Tag Manager 및 Google Analytics를 사용합니다. 자체 통계는 원본 IP가 아닌 IP·방문자·세션 식별자의 HMAC 값을 저장합니다. 방문 기록은 약 90일을 기준으로 삭제합니다.",
		comments: "댓글 작성 시 Twikoo는 댓글 내용, 닉네임, 입력한 이메일 주소와 접속 정보를 처리합니다. 문의: me@sayori.org.",
	},
	es: {
		network: "Cloudflare recibe tu IP para servir las páginas. Si permites las estadísticas, los servicios de consulta de IP pueden recibir esa dirección para estimar tu región y tu red.",
		analytics: "Las estadísticas propias, Umami y Google Tag Manager / Google Analytics solo se activan con tu permiso. Las estadísticas propias guardan resúmenes HMAC de la IP y de los identificadores de visitante y sesión, no la IP sin procesar. Los registros de visitas se eliminan con un plazo orientativo de 90 días.",
		comments: "Si publicas un comentario, Twikoo procesa su texto, tu alias, el correo electrónico que hayas dado y los datos de conexión. Contacto: me@sayori.org.",
	},
	de: {
		network: "Cloudflare erhält deine IP-Adresse, um die Seiten auszuliefern. Wenn du Webanalyse erlaubst, können IP-Auskunftsdienste die Adresse erhalten, um Region und Netzwerk grob zu bestimmen.",
		analytics: "Die eigene Besuchsstatistik, Umami und Google Tag Manager / Google Analytics starten erst nach deiner Einwilligung. Die eigene Statistik speichert HMAC-Prüfwerte der IP-Adresse sowie der Besucher- und Sitzungskennungen, nicht die IP-Adresse im Klartext. Besuchsdaten werden nach etwa 90 Tagen zur Löschung vorgesehen.",
		comments: "Wenn du einen Kommentar veröffentlichst, verarbeitet Twikoo den Text, deinen Anzeigenamen, eine ggf. angegebene E-Mail-Adresse und Verbindungsdaten. Kontakt: me@sayori.org.",
	},
	"pt-BR": {
		network: "A Cloudflare recebe seu IP para exibir as páginas. Se você permitir as estatísticas, serviços de consulta de IP poderão receber esse endereço para estimar sua região e rede.",
		analytics: "As estatísticas do blog, o Umami e o Google Tag Manager / Google Analytics só são ativados com sua autorização. As estatísticas próprias guardam resumos HMAC do IP e dos identificadores de visitante e sessão, não o IP bruto. O prazo previsto para a limpeza dos registros de visita é de 90 dias.",
		comments: "Quando você publica um comentário, o Twikoo trata o texto, o apelido, o e-mail que você informou e os dados de conexão. Contato: me@sayori.org.",
	},
};
