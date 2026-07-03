$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$docsDir = Join-Path $root "docs"
$tmpDir = Join-Path $docsDir "postfan-explicacao-docx"
$zipPath = Join-Path $docsDir "PostFan-explicacao-do-projeto.zip"
$docxPath = Join-Path $docsDir "PostFan-explicacao-do-projeto.docx"

New-Item -ItemType Directory -Force -Path $docsDir | Out-Null
if (Test-Path $tmpDir) {
  Remove-Item -LiteralPath $tmpDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
if (Test-Path $docxPath) {
  Remove-Item -LiteralPath $docxPath -Force
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmpDir "_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmpDir "docProps") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmpDir "word") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmpDir "word\_rels") | Out-Null

function Escape-XmlText {
  param([string]$Text)
  return [System.Security.SecurityElement]::Escape($Text)
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [string]$Style = "Normal"
  )

  $escaped = Escape-XmlText $Text
  $styleXml = ""
  if ($Style -ne "Normal") {
    $styleXml = "<w:pPr><w:pStyle w:val=`"$Style`"/></w:pPr>"
  }

  return "<w:p>$styleXml<w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

$sections = @(
  @{ Style = "Title"; Text = "PostFan - Explicacao completa do projeto para entrevista" },
  @{ Style = "Subtitle"; Text = "Documento de estudo: o que o projeto faz, por que cada parte existe e como explicar o codigo com seguranca." },

  @{ Style = "Heading1"; Text = "1. Visao geral do projeto" },
  @{ Style = "Normal"; Text = "O PostFan e uma plataforma social de debates. A proposta e permitir que usuarios criem conta, facam login, publiquem ideias, comentem, curtam posts, sigam outras pessoas, participem de grupos e recuperem senha por email." },
  @{ Style = "Normal"; Text = "Em uma entrevista, voce pode apresentar o projeto como uma aplicacao full stack: o frontend foi feito com React e Vite, o backend com Node.js e Express, e o banco de dados com PostgreSQL." },
  @{ Style = "Normal"; Text = "A arquitetura principal e: navegador do usuario -> frontend React -> backend Express -> banco PostgreSQL. O frontend mostra a interface. O backend recebe as requisicoes e aplica as regras de negocio. O banco guarda usuarios, posts, comentarios, curtidas, seguidores, grupos e mensagens." },

  @{ Style = "Heading1"; Text = "2. Estrutura de pastas" },
  @{ Style = "Normal"; Text = "A pasta src contem o frontend. Dentro dela ficam as paginas, componentes, contextos, servicos e estilos da aplicacao." },
  @{ Style = "Normal"; Text = "A pasta backend contem a API Node.js/Express. O arquivo principal e backend/server.js, e a conexao com PostgreSQL fica em backend/db.js." },
  @{ Style = "Normal"; Text = "A pasta api contem o arquivo usado para ambientes como Vercel, encaminhando chamadas /api para o servidor Express." },
  @{ Style = "Normal"; Text = "Arquivos como package.json definem scripts e dependencias. Arquivos .env guardam configuracoes sensiveis, como URL do banco, JWT_SECRET, email e Google Client ID." },

  @{ Style = "Heading1"; Text = "3. Frontend com React e Vite" },
  @{ Style = "Normal"; Text = "O frontend e a parte visual do sistema. Ele renderiza telas como Login, Cadastro, Feed, Perfil, Recuperar Senha, Configuracoes e Sala Virtual." },
  @{ Style = "Normal"; Text = "O Vite e usado como ferramenta de desenvolvimento e build. Ele torna o desenvolvimento mais rapido e gera a versao final otimizada com npm run build." },
  @{ Style = "Normal"; Text = "O React organiza a interface em componentes. Uma pagina, como Login.jsx, e um componente React que tem estado, funcoes e JSX para montar a tela." },

  @{ Style = "Heading2"; Text = "3.1 src/main.jsx" },
  @{ Style = "Normal"; Text = "Esse e o ponto de entrada do frontend. Ele pega a div root do index.html e renderiza o aplicativo React dentro dela." },
  @{ Style = "Normal"; Text = "Ele envolve o App com BrowserRouter, AuthProvider e NotificationProvider. O BrowserRouter permite navegar entre paginas. O AuthProvider guarda dados de login. O NotificationProvider controla notificacoes." },
  @{ Style = "Normal"; Text = "Tambem existe o GoogleOAuthProvider, que so e ativado quando o Google Client ID esta configurado corretamente." },

  @{ Style = "Heading2"; Text = "3.2 src/App.jsx" },
  @{ Style = "Normal"; Text = "Esse arquivo define as rotas do sistema. Por exemplo, /login abre a tela de login, /cadastro abre cadastro, /feed abre o feed e /perfil abre o perfil." },
  @{ Style = "Normal"; Text = "Algumas rotas ficam dentro de PrivateRoutes. Isso significa que so podem ser acessadas por usuarios autenticados." },

  @{ Style = "Heading2"; Text = "3.3 src/routes/PrivateRoutes.jsx" },
  @{ Style = "Normal"; Text = "Esse componente verifica se o usuario esta autenticado. Se houver token salvo, ele permite acessar a pagina. Se nao houver, redireciona para /login." },
  @{ Style = "Normal"; Text = "Em uma entrevista, voce pode dizer que isso protege rotas no frontend, melhorando a experiencia do usuario. A protecao real de seguranca, porem, tambem precisa existir no backend." },

  @{ Style = "Heading1"; Text = "4. Contextos do React" },
  @{ Style = "Normal"; Text = "Context API e uma forma de compartilhar informacoes entre varias partes do React sem precisar passar props manualmente por todos os componentes." },
  @{ Style = "Normal"; Text = "No projeto, AuthContext guarda a sessao do usuario, e NotificationContext cuida das mensagens visuais da interface." },

  @{ Style = "Heading2"; Text = "4.1 AuthContext.jsx" },
  @{ Style = "Normal"; Text = "O AuthContext guarda token e usuario. Quando o login funciona, o sistema salva esses dados no localStorage. Isso permite manter o usuario logado mesmo se atualizar a pagina." },
  @{ Style = "Normal"; Text = "A funcao salvarSessao salva token e usuario. A funcao sair remove esses dados. A propriedade autenticado indica se existe token ativo." },

  @{ Style = "Heading1"; Text = "5. Comunicacao com a API" },
  @{ Style = "Normal"; Text = "O arquivo src/services/api.js cria uma instancia do Axios. O Axios e uma biblioteca usada para fazer requisicoes HTTP do frontend para o backend." },
  @{ Style = "Normal"; Text = "Esse arquivo define a baseURL. Em desenvolvimento, normalmente usa http://localhost:5000. Em producao, pode usar /api ou a URL publicada do backend." },
  @{ Style = "Normal"; Text = "O interceptor de request adiciona automaticamente Authorization: Bearer token quando existe token no localStorage. Assim, as chamadas protegidas levam a identidade do usuario." },
  @{ Style = "Normal"; Text = "O interceptor de response trata erro 401. Se o backend disser que o token nao e valido, o frontend remove a sessao local e manda o usuario para login." },

  @{ Style = "Heading2"; Text = "5.1 auth.js" },
  @{ Style = "Normal"; Text = "O arquivo src/services/auth.js concentra funcoes de autenticacao: loginComEmail, cadastrarComEmail e loginComGoogle. Isso evita espalhar chamadas HTTP por varias paginas." },
  @{ Style = "Normal"; Text = "Essa organizacao deixa o codigo mais limpo: a pagina chama uma funcao com nome claro, e o arquivo de servico cuida da chamada para a API." },

  @{ Style = "Heading1"; Text = "6. Backend com Node.js e Express" },
  @{ Style = "Normal"; Text = "O backend e a camada que recebe requisicoes do frontend, valida dados, conversa com o banco e devolve respostas em JSON." },
  @{ Style = "Normal"; Text = "O Express e o framework usado para criar rotas como POST /login, POST /cadastro, GET /posts e POST /auth/google." },
  @{ Style = "Normal"; Text = "O backend tambem usa middlewares. Middleware e uma funcao que roda antes da rota final. Exemplos: CORS, Helmet, rate limit, parser de JSON, upload com Multer e autenticacao JWT." },

  @{ Style = "Heading2"; Text = "6.1 backend/server.js" },
  @{ Style = "Normal"; Text = "Esse e o arquivo central da API. Ele importa dependencias, configura seguranca, define rotas, cria tabelas, recebe uploads, autentica usuarios e inicia o servidor." },
  @{ Style = "Normal"; Text = "As configuracoes vem de variaveis de ambiente. Isso e importante porque senhas, URLs e chaves nao devem ficar fixas no codigo." },

  @{ Style = "Heading2"; Text = "6.2 CORS" },
  @{ Style = "Normal"; Text = "CORS controla quais origens podem acessar a API pelo navegador. O projeto permite localhost em desenvolvimento e dominios especificos em producao." },
  @{ Style = "Normal"; Text = "Sem CORS configurado, o navegador pode bloquear chamadas do frontend para o backend." },

  @{ Style = "Heading2"; Text = "6.3 Helmet e rate limit" },
  @{ Style = "Normal"; Text = "Helmet adiciona headers de seguranca HTTP. Rate limit limita o numero de requisicoes em um intervalo de tempo, ajudando a reduzir abuso e ataques simples." },

  @{ Style = "Heading1"; Text = "7. Banco de dados PostgreSQL" },
  @{ Style = "Normal"; Text = "O PostgreSQL e usado para persistir os dados. Persistir significa salvar de verdade, para que os dados continuem existindo depois que o servidor reiniciar." },
  @{ Style = "Normal"; Text = "A conexao fica em backend/db.js. Esse arquivo le DATABASE_URL e cria um Pool do pacote pg. Pool e um conjunto de conexoes reutilizaveis com o banco." },
  @{ Style = "Normal"; Text = "O server.js cria ou atualiza tabelas quando o servidor inicia. Isso inclui usuarios, posts, comentarios, curtidas, seguidores, mensagens privadas, grupos e membros de grupos." },

  @{ Style = "Heading2"; Text = "7.1 Principais tabelas" },
  @{ Style = "Normal"; Text = "usuarios: guarda nome, email, senha criptografada, foto, dados de perfil, google_id e provider." },
  @{ Style = "Normal"; Text = "posts: guarda conteudo, imagem ou arquivo, tema, usuario autor e data de criacao." },
  @{ Style = "Normal"; Text = "comentarios: guarda comentarios vinculados a posts." },
  @{ Style = "Normal"; Text = "curtidas: registra quais usuarios curtiram quais posts." },
  @{ Style = "Normal"; Text = "seguidores: representa relacoes de seguir entre usuarios." },
  @{ Style = "Normal"; Text = "grupos, grupo_membros e grupo_mensagens: sustentam as salas e conversas em grupo." },

  @{ Style = "Heading1"; Text = "8. Autenticacao com email e senha" },
  @{ Style = "Normal"; Text = "No cadastro tradicional, o usuario envia nome, email, senha e opcionalmente foto. O backend valida os campos, verifica se o email ja existe, criptografa a senha com bcrypt e salva no banco." },
  @{ Style = "Normal"; Text = "Bcrypt e usado porque nao devemos salvar senhas em texto puro. Ele transforma a senha em um hash seguro. No login, o backend compara a senha digitada com o hash salvo." },
  @{ Style = "Normal"; Text = "Quando o login da certo, o backend gera um JWT. JWT significa JSON Web Token. Ele funciona como uma credencial assinada que prova quem e o usuario." },

  @{ Style = "Heading2"; Text = "8.1 JWT" },
  @{ Style = "Normal"; Text = "O JWT carrega informacoes como id, nome e email do usuario. Ele e assinado com JWT_SECRET. Se alguem alterar o token, a assinatura deixa de ser valida." },
  @{ Style = "Normal"; Text = "No frontend, o token e salvo no localStorage. Nas proximas requisicoes, ele e enviado no header Authorization." },
  @{ Style = "Normal"; Text = "No backend, o middleware autenticar verifica o token. Se for valido, adiciona req.usuario e deixa a rota continuar. Se nao for valido, retorna erro 401." },

  @{ Style = "Heading1"; Text = "9. Login com Google OAuth" },
  @{ Style = "Normal"; Text = "O login com Google permite que o usuario entre usando a conta Google. No frontend, o componente GoogleLogin gera uma credencial quando o usuario autoriza." },
  @{ Style = "Normal"; Text = "Essa credencial e enviada para POST /auth/google. O backend usa google-auth-library para verificar se a credencial veio realmente do Google e se pertence ao Client ID configurado." },
  @{ Style = "Normal"; Text = "Se a conta ja existe no banco, o backend atualiza google_id e foto quando necessario. Se nao existe, cria um usuario novo com provider google." },
  @{ Style = "Normal"; Text = "Depois disso, o backend gera o mesmo tipo de JWT usado no login tradicional. Isso padroniza a sessao: depois de logado, tanto faz se veio por email/senha ou Google." },

  @{ Style = "Heading2"; Text = "9.1 Client ID vs Client Secret" },
  @{ Style = "Normal"; Text = "O Client ID e publico o suficiente para ir no frontend. Ele normalmente termina com .apps.googleusercontent.com." },
  @{ Style = "Normal"; Text = "O Client Secret nao deve ir para o frontend. Valores que comecam com GOCSPX- geralmente sao segredos, nao Client IDs. Usar esse valor no botao gera erro invalid_client." },
  @{ Style = "Normal"; Text = "Por isso foi criada uma validacao em src/utils/googleOAuth.js. Ela so habilita o provider do Google quando o VITE_GOOGLE_CLIENT_ID tem formato correto." },

  @{ Style = "Heading1"; Text = "10. Recuperacao de senha por email" },
  @{ Style = "Normal"; Text = "O fluxo de recuperar senha comeca na pagina Recuperar.jsx. O usuario informa o email." },
  @{ Style = "Normal"; Text = "O backend gera um token de recuperacao, salva esse token com prazo de expiracao no banco e envia um link por email usando Nodemailer." },
  @{ Style = "Normal"; Text = "Quando o usuario abre o link, ele vai para a tela de resetar senha. O frontend envia token e nova senha para o backend. O backend valida token, verifica expiracao, gera novo hash com bcrypt e limpa o token antigo." },

  @{ Style = "Heading1"; Text = "11. Uploads e arquivos" },
  @{ Style = "Normal"; Text = "O projeto usa Multer para receber arquivos enviados pelo usuario, como foto de perfil ou midia de post." },
  @{ Style = "Normal"; Text = "Em desenvolvimento, os arquivos podem ficar em backend/uploads. Em producao, o projeto pode usar Cloudinary quando as variaveis CLOUDINARY_* estao configuradas." },
  @{ Style = "Normal"; Text = "Cloudinary e melhor para producao porque servidores temporarios, como alguns deploys gratuitos, podem apagar arquivos locais ao reiniciar." },

  @{ Style = "Heading1"; Text = "12. Variaveis de ambiente" },
  @{ Style = "Normal"; Text = "Variaveis de ambiente separam configuracao sensivel do codigo. Isso permite usar valores diferentes em desenvolvimento e producao sem alterar os arquivos da aplicacao." },
  @{ Style = "Normal"; Text = "DATABASE_URL: string de conexao com PostgreSQL." },
  @{ Style = "Normal"; Text = "JWT_SECRET: chave usada para assinar tokens JWT. Deve ser longa, aleatoria e secreta." },
  @{ Style = "Normal"; Text = "EMAIL_USER e EMAIL_PASS: credenciais para envio de email. No Gmail, EMAIL_PASS deve ser senha de app." },
  @{ Style = "Normal"; Text = "VITE_GOOGLE_CLIENT_ID: Client ID usado pelo frontend no botao do Google." },
  @{ Style = "Normal"; Text = "GOOGLE_CLIENT_ID: mesmo Client ID usado no backend para validar a credencial." },
  @{ Style = "Normal"; Text = "FRONTEND_URL e BACKEND_URL: URLs usadas para CORS, links de recuperacao e montagem de caminhos." },

  @{ Style = "Heading1"; Text = "13. Fluxos principais para explicar" },
  @{ Style = "Heading2"; Text = "13.1 Cadastro com email" },
  @{ Style = "Normal"; Text = "Usuario preenche formulario -> frontend envia FormData para /cadastro -> backend valida -> criptografa senha -> salva usuario -> gera JWT -> frontend salva sessao -> redireciona para feed." },
  @{ Style = "Heading2"; Text = "13.2 Login com email" },
  @{ Style = "Normal"; Text = "Usuario envia email e senha -> backend busca usuario -> bcrypt compara senha -> backend gera JWT -> frontend salva token -> usuario entra no sistema." },
  @{ Style = "Heading2"; Text = "13.3 Login com Google" },
  @{ Style = "Normal"; Text = "Usuario clica no botao Google -> Google devolve credential -> frontend envia para /auth/google -> backend valida com Google -> cria ou atualiza usuario -> gera JWT -> frontend salva sessao." },
  @{ Style = "Heading2"; Text = "13.4 Publicar post" },
  @{ Style = "Normal"; Text = "Usuario escreve conteudo ou envia arquivo -> frontend chama /posts com token -> backend autentica -> valida conteudo -> salva no banco -> feed exibe o novo post." },
  @{ Style = "Heading2"; Text = "13.5 Recuperar senha" },
  @{ Style = "Normal"; Text = "Usuario informa email -> backend gera token -> envia email -> usuario abre link -> define nova senha -> backend valida token e troca senha." },

  @{ Style = "Heading1"; Text = "14. Como responder em entrevista" },
  @{ Style = "Normal"; Text = "Resposta curta: O PostFan e uma rede social de debates feita com React, Node.js, Express e PostgreSQL. O frontend consome uma API REST com Axios, usa Context API para sessao e notificacoes, e protege rotas privadas. O backend valida dados, autentica com JWT, criptografa senhas com bcrypt, integra login com Google OAuth, envia email de recuperacao com Nodemailer e persiste dados no PostgreSQL." },
  @{ Style = "Normal"; Text = "Resposta sobre seguranca: Eu nao salvo senha em texto puro. Uso bcrypt para hash de senha e JWT para sessao. As rotas protegidas validam o token no backend. As variaveis sensiveis ficam no .env e nao devem ser versionadas." },
  @{ Style = "Normal"; Text = "Resposta sobre Google: O Google OAuth usa um Client ID no frontend para abrir o login e o mesmo Client ID no backend para validar a credencial. Client Secret nao deve ser usado no botao. Por isso existe validacao do formato do Client ID." },
  @{ Style = "Normal"; Text = "Resposta sobre banco: O PostgreSQL guarda dados relacionais, como usuarios, posts, comentarios, curtidas e seguidores. Isso combina bem com a estrutura do projeto porque existem muitos relacionamentos entre entidades." },

  @{ Style = "Heading1"; Text = "15. Pontos fortes do projeto" },
  @{ Style = "Normal"; Text = "O projeto demonstra conhecimento full stack: interface, API, banco, autenticacao, upload, email e integracao externa com Google." },
  @{ Style = "Normal"; Text = "Tambem mostra preocupacao com organizacao, separando services, contexts, rotas, backend e configuracoes de ambiente." },
  @{ Style = "Normal"; Text = "Outro ponto positivo e a validacao de configuracao do Google, evitando erro confuso para o usuario e facilitando diagnostico." },

  @{ Style = "Heading1"; Text = "16. O que ainda pode evoluir" },
  @{ Style = "Normal"; Text = "Adicionar testes automatizados para login, cadastro, posts e recuperacao de senha." },
  @{ Style = "Normal"; Text = "Adicionar migracoes formais de banco, por exemplo com Prisma, Knex ou node-pg-migrate, em vez de criar tabelas diretamente no server.js." },
  @{ Style = "Normal"; Text = "Melhorar observabilidade com logs estruturados e monitoramento de erros." },
  @{ Style = "Normal"; Text = "Adicionar refresh token ou cookies httpOnly para uma estrategia de sessao mais robusta." },
  @{ Style = "Normal"; Text = "Criar testes de interface para os principais fluxos do usuario." },

  @{ Style = "Heading1"; Text = "17. Resumo final para memorizar" },
  @{ Style = "Normal"; Text = "PostFan e uma aplicacao full stack de rede social. React cuida das telas. Express cuida da API. PostgreSQL guarda os dados. Axios conecta frontend e backend. JWT autentica sessoes. Bcrypt protege senhas. Google OAuth permite login social. Nodemailer envia recuperacao de senha. Multer e Cloudinary cuidam de uploads. Variaveis .env guardam configuracoes sensiveis." }
)

$body = New-Object System.Text.StringBuilder
foreach ($section in $sections) {
  [void]$body.AppendLine((New-ParagraphXml -Text $section.Text -Style $section.Style))
}
[void]$body.AppendLine("<w:sectPr><w:pgSz w:w=`"12240`" w:h=`"15840`"/><w:pgMar w:top=`"1440`" w:right=`"1440`" w:bottom=`"1440`" w:left=`"1440`"/></w:sectPr>")

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
$($body.ToString())
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1F4E79"/></w:rPr>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="666666"/></w:rPr>
    <w:pPr><w:spacing w:after="280"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="1F4E79"/></w:rPr>
    <w:pPr><w:spacing w:before="320" w:after="160"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="25"/><w:color w:val="2F75B5"/></w:rPr>
    <w:pPr><w:spacing w:before="220" w:after="120"/></w:pPr>
  </w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$created = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>PostFan - Explicacao completa do projeto</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$created</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$created</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Word</Application>
</Properties>
"@

Set-Content -LiteralPath (Join-Path $tmpDir "[Content_Types].xml") -Value $contentTypesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "_rels\.rels") -Value $relsXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "docProps\core.xml") -Value $coreXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "docProps\app.xml") -Value $appXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "word\document.xml") -Value $documentXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "word\styles.xml") -Value $stylesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tmpDir "word\_rels\document.xml.rels") -Value $documentRelsXml -Encoding UTF8

$packageItems = Get-ChildItem -LiteralPath $tmpDir -Force
Compress-Archive -LiteralPath $packageItems.FullName -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $docxPath -Force
Remove-Item -LiteralPath $tmpDir -Recurse -Force

Write-Output $docxPath
