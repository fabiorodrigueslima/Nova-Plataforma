const os = require("node:os");

// Algumas instalações do Node no Windows podem falhar ao consultar o shell
// da conta (uv_os_get_passwd/ENOMEM). O Capacitor só usa esse dado para
// escolher o terminal, então aplicamos um fallback seguro quando necessário.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "postfan",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: process.env.COMSPEC || "cmd.exe",
  });
}

require("@capacitor/cli/dist/index").run();
