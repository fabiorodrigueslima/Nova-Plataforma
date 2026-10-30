# Aplicativo Android do PostFan

O aplicativo usa o mesmo frontend React e o mesmo backend publicado do site.
Contas, publicacoes, perfis e mensagens permanecem no mesmo banco de dados.

## Abrir no Android Studio

Execute na pasta principal:

```powershell
npm run android:open
```

No Android Studio, selecione o Java 21 em **Settings > Build, Execution,
Deployment > Build Tools > Gradle > Gradle JDK**.

## Atualizar o aplicativo depois de mudar o frontend

```powershell
npm run android:sync
```

## Gerar um APK de teste no Windows

```powershell
npm run android:apk
```

O arquivo sera criado em:

`android/app/build/outputs/apk/debug/app-debug.apk`

Esse APK e apenas para testes. A publicacao na Google Play exige um pacote AAB
de producao assinado com uma chave privada que deve ser guardada em seguranca.

## Configuracao do servidor

O build Android usa `.env.mobile` e se conecta a `https://postfan.onrender.com`.
O backend aceita a origem segura interna do Capacitor (`https://localhost`) e
mantem a sessao em cookie HttpOnly, sem expor o token ao JavaScript.
